// 验证伤害类型字段传递与 UI 颜色 class（物理红/法术紫/真实白/元素灰）
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import * as ui from '../../src/frontend/js/ui.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const load = (id) => {
  const p = BASE + '/';
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = dir + '/' + e.name;
      if (e.isDirectory()) { const r = walk(fp); if (r) return r; }
      else if (e.name.endsWith('.json') && !['index.json', 'sub-professions.json'].includes(e.name)) {
        const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
        if (d.id === id) return d;
      }
    }
    return null;
  };
  return walk(p);
};

globalThis.fetch = async (url) => {
  const fp = BASE + '/' + url.replace(/^data\//, '');
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(fp, 'utf8')) };
};

function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), innerHTML: '', className: '', dataset: {},
    style: {}, value: '', classList: { add() {}, remove() {}, contains: () => false },
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], focus() {},
  };
  el.appendChild = (child) => { el.innerHTML += (child.innerHTML || ''); };
  return el;
}
const els = {};
globalThis.document = {
  getElementById: (id) => (els[id] || (els[id] = makeEl(id))),
  createElement: (tag) => makeEl(tag),
  addEventListener() {}, body: makeEl('body'),
};

let ok = true;
const check = (label, actual, expect) => {
  const pass = actual === expect;
  if (!pass) ok = false;
  console.log(`${label}: ${actual} (期望 ${expect}) ${pass ? 'OK' : 'FAIL'}`);
};

// ==== 计算层 damageType ====
const slot = (id, skillIndex, elite = 2) => ({ operatorId: id, elite, level: 80, trustPercent: 100, potentialRank: 0, skillIndex, skillLevel: 9 });

check('银灰·真银斩 damageType', calculateOperator(load('char_172_svrash'), slot('char_172_svrash', 2)).damageType, 'physical');
check('艾雅法拉·火山 damageType', calculateOperator(load('char_180_amgoat'), slot('char_180_amgoat', 2)).damageType, 'arts');
check('亚叶·复合弹片 damageType', calculateOperator(load('char_345_folnic'), slot('char_345_folnic', 1)).damageType, 'arts');
check('闪灵·信条 damageType', calculateOperator(load('char_147_shining'), slot('char_147_shining', 0)).damageType, null);

// ==== UI 层颜色 class ====
async function renderClass(operatorId, skillIndex) {
  state.slots = [null, null, null, null];
  state.slots[0] = slot(operatorId, skillIndex);
  const container = document.getElementById('result-comparison');
  container.innerHTML = '';
  await ui.updateResults();
  return container.innerHTML;
}

const silverHtml = await renderClass('char_172_svrash', 2);
const eyjaHtml = await renderClass('char_180_amgoat', 2);
const folnicHtml = await renderClass('char_345_folnic', 1);

check('银灰 物理红 class', silverHtml.includes('value dmg-physical'), true);
check('银灰 无紫色 class', silverHtml.includes('dmg-arts'), false);
check('艾雅法拉 法术紫 class', eyjaHtml.includes('value dmg-arts'), true);
check('亚叶 法术紫 class', folnicHtml.includes('value dmg-arts'), true);

console.log('\n' + (ok ? '✅ 全部通过' : '❌ 存在失败'));
process.exit(ok ? 0 : 1);
