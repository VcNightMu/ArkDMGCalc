// 限时被动 UI 验证：PASSIVE+duration>0(芬 S2 执守阵线)按正常技能显示技能期+常态；
// 永久被动(星熊 S2 荆棘)仍只显示常态(回归)
import * as ui from '../../src/frontend/js/ui.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
globalThis.fetch = async (url) => {
  const fp = BASE + '/' + url.replace(/^data\//, '');
  return { ok: fs.existsSync(fp), json: async () => JSON.parse(fs.readFileSync(fp, 'utf8')) };
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

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) pass++; else { fail++; console.log('FAIL: ' + name + (extra ? ' => ' + extra : '')); }
};

async function render(opId, skillIndex) {
  const idx = JSON.parse(fs.readFileSync(BASE + '/index.json', 'utf8'));
  const entry = idx.find(e => e.id === opId);
  const op = JSON.parse(fs.readFileSync(`${BASE}/${entry.profession}/${entry.subProfessionId}/${opId}.json`, 'utf8'));
  const e = Math.min(2, op.phases.length - 1);
  state.slots = [null, null, null, null];
  state.slots[0] = { operatorId: opId, elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex, skillLevel: 7 };
  const container = document.getElementById('result-comparison');
  container.innerHTML = '';
  await ui.updateResults();
  return container.innerHTML;
}

// ===== 芬 S2 执守阵线(限时被动 PASSIVE dur19):必须显示技能期 + 常态 =====
let html = await render('char_1036_fang2', 1);
check('芬S2(限时被动) 出现「技能期 DPS」', html.includes('技能期 DPS'), html.slice(0, 400));
check('芬S2(限时被动) 出现「技能期总伤」', html.includes('技能期总伤'));
check('芬S2(限时被动) 出现「技能期攻击间隔」', html.includes('技能期攻击间隔'));
check('芬S2(限时被动) 出现「技能期 ATK」', html.includes('技能期 ATK'));
check('芬S2(限时被动) 出现「常态 DPS」', html.includes('常态 DPS'));
check('芬S2(限时被动) 技能期总伤数值 12920(专一档 19击×P(2atk))', html.includes('12920'));
check('芬S2(限时被动) 技能期 DPS 数值 680', html.includes('680'));

// ===== 野鬃 S1 骑枪刺击(限时被动 PASSIVE dur27 攻速型):显示技能期 =====
html = await render('char_496_wildmn', 0);
check('野鬃S1(限时被动) 出现「技能期 DPS」', html.includes('技能期 DPS'));
check('野鬃S1(限时被动) 出现「技能期总伤」', html.includes('技能期总伤'));

// ===== 星熊 S2 荆棘(永久被动 PASSIVE dur0):不得出现技能期(回归) =====
html = await render('char_136_hsguma', 1);
const skillPhase = (html.match(/技能期[^<]*/g) || []);
check('星熊S2(永久被动) 不出现「技能期」条目', skillPhase.length === 0, skillPhase.join(','));
check('星熊S2(永久被动) 有常态信息', html.includes('常态 DPS') || html.includes('面板'));

// ===== 风笛 S1 / 苇草 S1 迅捷打击·γ型(skcom_ 通用技能模板,正常手动持续技):必须显示技能期 =====
html = await render('char_222_bpipe', 0);
check('风笛S1(skcom迅捷打击) 出现「技能期 DPS」', html.includes('技能期 DPS'));
check('风笛S1(skcom迅捷打击) 出现「技能期总伤」', html.includes('技能期总伤'));
check('风笛S1(skcom迅捷打击) 出现「常态 DPS」', html.includes('常态 DPS'));
html = await render('char_261_sddrag', 0);
check('苇草S1(skcom迅捷打击) 出现「技能期 DPS」', html.includes('技能期 DPS'));
check('苇草S1(skcom迅捷打击) 出现「技能期总伤」', html.includes('技能期总伤'));

console.log(`\n限时被动/通用技能 UI 验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
