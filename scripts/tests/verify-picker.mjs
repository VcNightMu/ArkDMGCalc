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

state.slots = [null, null, null, null];
await showOperatorPicker(0);

console.log('主职业下拉框含 近卫:', pickerEl.innerHTML.includes('近卫') ? 'OK' : 'FAIL');
console.log('主职业下拉框含 医疗:', pickerEl.innerHTML.includes('医疗') ? 'OK' : 'FAIL');
console.log('主职业下拉框含 特殊:', pickerEl.innerHTML.includes('>特殊<') ? 'OK' : 'FAIL');
console.log('主职业下拉框含 9 个主职业:', (pickerEl.innerHTML.match(/<option value="[A-Z]+">/g) || []).length === 9 ? 'OK' : 'FAIL');

// 选择近卫 → 子职业只显示有数据的（领主/剑豪/术战者）
profSelect.value = 'WARRIOR';
await profSelect._onchange();
console.log('\n选近卫后子职业含 领主:', subSelect.innerHTML.includes('领主') ? 'OK' : 'FAIL');
console.log('选近卫后子职业含 剑豪:', subSelect.innerHTML.includes('剑豪') ? 'OK' : 'FAIL');
console.log('选近卫后子职业含 术战者:', subSelect.innerHTML.includes('术战者') ? 'OK' : 'FAIL');
console.log('选近卫后子职业不含 教官(空):', !subSelect.innerHTML.includes('教官') ? 'OK' : 'FAIL');

// 选择领主 → 干员列表含银灰、棘刺
subSelect.value = 'lord';
await subSelect._onchange();
console.log('\n选领主后干员列表含 银灰:', listEl.innerHTML.includes('银灰') ? 'OK' : 'FAIL');
console.log('选领主后干员列表含 棘刺:', listEl.innerHTML.includes('棘刺') ? 'OK' : 'FAIL');

// 选择 特殊 → 干员附带单位 → 召唤物显示「持有者·名称」
profSelect.value = 'TOKEN';
await profSelect._onchange();
subSelect.value = 'notchar1';
await subSelect._onchange();
console.log('\n选特殊/干员附带单位后显示 赫默·医疗探机:', listEl.innerHTML.includes('赫默·医疗探机') ? 'OK' : 'FAIL');
