// 验证干员选择器：主职业 → 子职业（只显示有数据）→ 干员
import { showOperatorPicker } from '../../src/frontend/js/ui.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
globalThis.fetch = async (url) => {
  const p = BASE + '/' + url.replace(/^data\//, '');
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
};

function makeEl() {
  return { style: {}, innerHTML: '', value: '', appendChild() {}, addEventListener(type, fn) { this['_on' + type] = fn; } };
}

let createCount = 0;
const profSelect = makeEl();
const subSelect = makeEl();
const listEl = makeEl();
let pickerEl = null;

globalThis.document = {
  createElement(tag) {
    createCount++;
    if (createCount === 2) {
      pickerEl = makeEl();
      pickerEl.querySelector = (sel) => sel === '#picker-profession' ? profSelect : sel === '#picker-subprof' ? subSelect : sel === '#picker-list' ? listEl : null;
      return pickerEl;
    }
    return makeEl();
  },
  body: { appendChild() {} },
};

let ok = true;
const check = (label, cond) => { if (!cond) ok = false; console.log(label + ': ' + (cond ? 'OK' : 'FAIL')); };

state.slots = [null, null, null, null];
await showOperatorPicker(0);

check('主职业下拉框含 近卫', pickerEl.innerHTML.includes('近卫'));
check('主职业下拉框含 医疗', pickerEl.innerHTML.includes('医疗'));
check('主职业下拉框含 特殊', pickerEl.innerHTML.includes('>特殊<'));
check('主职业下拉框含 9 个主职业', (pickerEl.innerHTML.match(/<option value="[A-Z]+">/g) || []).length === 9);

// 选择近卫 → 子职业只显示有数据的（与 index.json 实际数据对齐，不再硬编码过时集合）
profSelect.value = 'WARRIOR';
await profSelect._onchange();
const subDict = JSON.parse(fs.readFileSync(BASE + '/sub-professions.json', 'utf8'));
const warriorSubIds = [...new Set(JSON.parse(fs.readFileSync(BASE + '/index.json', 'utf8')).filter((o) => o.profession === 'WARRIOR').map((o) => o.subProfessionId))];
const subOptions = [...subSelect.innerHTML.matchAll(/<option value="[^"]+">([^<]+)<\/option>/g)].map((m) => m[1]).filter((n) => n !== '子职业');
console.log('');
check('选近卫后子职业含 领主', subSelect.innerHTML.includes('领主'));
check('选近卫后子职业含 剑豪', subSelect.innerHTML.includes('剑豪'));
check('选近卫后子职业含 术战者', subSelect.innerHTML.includes('术战者'));
check('选近卫后子职业含 教官(现已有数据)', subSelect.innerHTML.includes('教官'));
check('选近卫后子职业项与数据一致(' + warriorSubIds.length + ' 项)', subOptions.length === warriorSubIds.length && warriorSubIds.every((id) => subOptions.includes(subDict[id].subProfessionName)));

// 选择教官 → 干员列表含全部 6 名教官(杜宾/鞭刃/诗怀雅/苍苔/医生/帕拉斯)
subSelect.value = 'instructor';
await subSelect._onchange();
check('选教官后干员列表含 6 名教官', ['杜宾', '鞭刃', '诗怀雅', '苍苔', '医生', '帕拉斯'].every((n) => listEl.innerHTML.includes(n)) && (listEl.innerHTML.match(/class="picker-item"/g) || []).length === 6);

// 选择领主 → 干员列表含银灰、棘刺
subSelect.value = 'lord';
await subSelect._onchange();
console.log('');
check('选领主后干员列表含 银灰', listEl.innerHTML.includes('银灰'));
check('选领主后干员列表含 棘刺', listEl.innerHTML.includes('棘刺'));

// 选择 特殊 → 干员附带单位 → 召唤物显示「持有者·名称」
profSelect.value = 'TOKEN';
await profSelect._onchange();
subSelect.value = 'notchar1';
await subSelect._onchange();
console.log('');
check('选特殊/干员附带单位后显示 赫默·医疗探机', listEl.innerHTML.includes('赫默·医疗探机'));

console.log(ok ? '✅ 全部通过' : '❌ 存在失败');
process.exit(ok ? 0 : 1);
