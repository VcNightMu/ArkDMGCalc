// 战术家召唤物形态验证:眠兽 S2(夜半安眠期)=5s 群攻法伤攻击沉睡目标×1.7(M1),4 击
import * as ui from '../../src/frontend/js/ui.js';
import { state } from '../../src/frontend/js/state.js';
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import fs from 'fs';

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
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

const tok = JSON.parse(fs.readFileSync(BASE + '/TOKEN/notchar1/token_10021_blkngt_hypnos.json', 'utf8'));
const ph = tok.phases[tok.phases.length - 1];
const mk = (si) => ({ elite: 2, level: ph.maxLevel, trustPercent: 0, potentialRank: 0, skillIndex: si, skillLevel: 7 });
const arts = (atk) => Math.max(atk * (1 - 50 / 100), atk * 0.05);
const phys = (atk) => Math.max(atk - 600, atk * 0.05);

let pass = 0, fail = 0;
const check = (name, actual, expect, eps = 0.5) => {
  const ok = typeof actual === 'string' || typeof expect === 'string' ? actual === expect : Math.abs(actual - expect) <= eps;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} actual=${actual} expect=${expect}`);
};

// ===== 引擎:眠兽 S2(安眠期) =====
const s2 = calculateOperator(tok, mk(1));
const panelAtk = s2.panelAtk;
check('眠兽面板atk(E2)', panelAtk, 474);
check('眠兽S2 类型=arts(群攻法伤)', s2.damageType, 'arts');
const perHit = arts(474 * 1.7);  // 攻击沉睡目标×1.7 → A(805.8,res50)
check('眠兽S2 每击法伤', perHit, 402.9, 0.01);
check('眠兽S2 总伤=4击(5s/1.25)', s2.skillTotalDamage, perHit * 4, 0.01);
check('眠兽S2 DPS=总伤/5s', s2.skillDps, perHit * 4 / 5, 0.01);
check('眠兽S2 常态DPS(物理保底)', s2.normalDps, phys(474) / 1.25, 0.01);
check('眠兽S2 dmgTypes仅arts档', JSON.stringify(Object.keys(s2.dmgTypes || {})), '["arts"]');
// 常态 S1 位不受形态影响
const s1 = calculateOperator(tok, mk(0));
check('眠兽S1 无技能期输出(占位)', s1.skillTotalDamage, 0);
check('眠兽S1 常态DPS', s1.normalDps, phys(474) / 1.25, 0.01);

// ===== UI:眠兽 S2 渲染技能期行 =====
state.slots = [null, null, null, null];
state.slots[0] = { operatorId: 'token_10021_blkngt_hypnos', elite: 2, level: ph.maxLevel, trustPercent: 0, potentialRank: 0, skillIndex: 1, skillLevel: 7 };
const container = document.getElementById('result-comparison');
container.innerHTML = '';
await ui.updateResults();
const html = container.innerHTML;
const hasSkillPhase = (html.match(/<span class="label">[^<]*技能期[^<]*<\/span>/g) || []).length > 0;
check('UI 眠兽S2 出现技能期条目', hasSkillPhase, true);
const hasNormal = html.includes('常态 DPS');
check('UI 眠兽S2 保留常态DPS', hasNormal, true);
const hasArtsCls = html.includes('dmg-arts');
check('UI 眠兽S2 法伤色值档', hasArtsCls, true);

console.log(`\n${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
