// 端到端验证：真实数据 + mock fetch/DOM → calculateOperator → updateResults 渲染
import * as ui from '../../src/frontend/js/ui.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';

globalThis.fetch = async (url) => {
  const p = BASE + '/' + url.replace(/^data\//, '');
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
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

state.slots = [null, null, null, null, null];

// 闪灵·信条，切换两个技能等级，对比技能期 HPS
async function renderAt(level) {
  state.slots[0] = { operatorId: 'char_147_shining', elite: 2, level: 90, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: level };
  const container = document.getElementById('result-comparison');
  container.innerHTML = '';
  await ui.updateResults();
  const html = container.innerHTML;
  const hps = html.match(/技能期 HPS<\/span><span class="value heal">(\d+)</)?.[1];
  const total = html.match(/总治疗量<\/span><span class="value heal">(\d+)</)?.[1];
  const normal = html.match(/常态 HPS<\/span><span class="value heal">(\d+)</)?.[1];
  return { hps, total, normal };
}

const r0 = await renderAt(0);
const r9 = await renderAt(9);

console.log('Lv1 : 常态HPS=' + r0.normal + ' 技能期HPS=' + r0.hps + ' 总治疗量=' + r0.total);
console.log('专三: 常态HPS=' + r9.normal + ' 技能期HPS=' + r9.hps + ' 总治疗量=' + r9.total);

const ok = r0.hps !== r9.hps && r0.normal === r9.normal && Number(r9.hps) > Number(r0.hps);
console.log('\n技能期HPS随等级变化:', r0.hps !== r9.hps ? 'OK' : 'FAIL');
console.log('常态HPS不随等级变化:', r0.normal === r9.normal ? 'OK' : 'FAIL');
console.log('标签包含 技能期 ATK:', document.getElementById('result-comparison').innerHTML.includes('技能期 ATK') ? 'OK' : 'FAIL');
console.log('\n最终:', ok ? '通过' : '失败');
process.exit(ok ? 0 : 1);
