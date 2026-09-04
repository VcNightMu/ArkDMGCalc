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

// ===== 狼群 S2(伺夜 S2 领袖的馈赠激活:狼群下次攻击×1.8 单发) =====
const wolf = JSON.parse(fs.readFileSync(BASE + '/TOKEN/notchar1/token_10028_vigil_wolf.json', 'utf8'));
const wph = wolf.phases[wolf.phases.length - 1];
const wslot = { elite: 2, level: wph.maxLevel, trustPercent: 0, potentialRank: 0, skillIndex: 1, skillLevel: 7 };
const w2 = calculateOperator(wolf, wslot);
check('狼群面板atk(E2)', w2.panelAtk, 371);
check('狼群S2 单发=P(atk×1.8)', w2.skillTotalDamage, phys(371 * 1.8), 0.01);
check('狼群S2 无技能期DPS(触发单发)', w2.skillDps, 0);
check('狼群S2 常态DPS', w2.normalDps, phys(371) / 1.25, 0.01);

// ===== 伺夜 S3 本体(三连击+附加法伤) =====
const vigil = JSON.parse(fs.readFileSync(BASE + '/PIONEER/tactician/char_427_vigil.json', 'utf8'));
const vph = vigil.phases[2];
const v3 = calculateOperator(vigil, { elite: 2, level: vph.maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: 2, skillLevel: 7 });
const vAtk = v3.panelAtk;  // (462+80)×1.5 战术家特性
check('伺夜S3 面板atk含特性×1.5', vAtk, 813);
check('伺夜S3 物理档=三连击×15轮', v3.dmgTypes.physical.skillTotalDamage, phys(813) * 3 * 15, 0.01);
check('伺夜S3 法伤档=0.35×atk×15轮', v3.dmgTypes.arts.skillTotalDamage, arts(813 * 0.35) * 15, 0.01);
check('伺夜S3 总伤', v3.skillTotalDamage, v3.dmgTypes.physical.skillTotalDamage + v3.dmgTypes.arts.skillTotalDamage, 0.01);
check('伺夜S3 DPS', v3.skillDps, v3.skillTotalDamage / 15, 0.01);

// ===== 樱桃三号 S1(渡桥遥控解体:自爆=渡桥攻击力×3.7,持有者联动) / S2(承压功率:停攻) =====
const crab = JSON.parse(fs.readFileSync(BASE + '/TOKEN/notchar1/token_10037_mitm_trshrb.json', 'utf8'));
const cph = crab.phases[crab.phases.length - 1];
const mitm = JSON.parse(fs.readFileSync(BASE + '/PIONEER/tactician/char_4147_mitm.json', 'utf8'));
const mph = mitm.phases[mitm.phases.length - 1];
const ownerSlot = { elite: 2, level: mph.maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7 };
const ctx = { ownerOp: mitm, ownerSlot };
const mAtk = calculateOperator(mitm, ownerSlot).panelAtk;  // 渡桥含特性×1.5
check('渡桥面板atk(含特性1.5)', mAtk, 832.5, 0.01);
const cslot = (si) => ({ elite: 2, level: cph.maxLevel, trustPercent: 0, potentialRank: 0, skillIndex: si, skillLevel: 7 });
const c1 = calculateOperator(crab, cslot(0), ctx);
check('樱桃S1 自爆=P(渡桥面板取整833×3.7)', c1.skillTotalDamage, phys(833 * 3.7), 0.01);
check('樱桃S1 无常态(自爆退场)', c1.normalDps, null);
const c2 = calculateOperator(crab, cslot(1), ctx);
check('樱桃S2 停攻无技能期伤害', c2.skillTotalDamage, 0);
check('樱桃S2 常态DPS保留', c2.normalDps, phys(323) / 1.25, 0.01);

// UI:樱桃 S1 渲染(含渡桥联动加载)
state.slots = [null, null, null, null];
state.slots[0] = { operatorId: 'token_10037_mitm_trshrb', elite: 2, level: cph.maxLevel, trustPercent: 0, potentialRank: 0, skillIndex: 0, skillLevel: 7 };
container.innerHTML = '';
await ui.updateResults();
const html2 = container.innerHTML;
const hasBurst = html2.indexOf('技能期总伤') >= 0 || html2.indexOf('总伤') >= 0;
check('UI 樱桃S1 渲染技能期总伤', hasBurst, true);

// ===== 流形双形态(缪尔赛思技能激活期,atk+40% M1) =====
const wtrR = JSON.parse(fs.readFileSync(BASE + '/TOKEN/notchar1/token_10030_mlyss_wtrman.json', 'utf8'));
const wtrM = JSON.parse(fs.readFileSync(BASE + '/TOKEN/notchar1/token_10030_mlyss_melee.json', 'utf8'));
const arts302 = (a) => Math.max(a * 0.5, a * 0.05);
for (const [w, nm] of [[wtrR, '流形·远程'], [wtrM, '流形·近战']]) {
  const wph = w.phases[w.phases.length - 1];
  const wslot = (si) => ({ elite: 2, level: wph.maxLevel, trustPercent: 0, potentialRank: 0, skillIndex: si, skillLevel: 7 });
  const none = calculateOperator(w, wslot(0));
  const isArts = w.damageType === 'arts';
  const hit302 = (a) => isArts ? arts302(a) : phys(a);
  check(nm + ' 面板atk', none.panelAtk, 302);
  check(nm + ' 常态DPS', none.normalDps, hit302(302) / 1.5, 0.01);
  // S1:攻速+40(间隔1.5→1.0714),14击
  const s1 = calculateOperator(w, wslot(0));
  check(nm + ' S1 间隔', s1.realInterval, 1.0714, 0.001);
  check(nm + ' S1 总伤=14击×atk1.4', s1.skillTotalDamage, hit302(302 * 1.4) * 14, 0.01);
  // S2
  const s2 = calculateOperator(w, wslot(1));
  if (w.id.includes('melee')) {
    check(nm + ' S2 总伤=10击×atk1.4(600防)', s2.skillTotalDamage, hit302(302 * 1.4) * 10, 0.01);
    check(nm + ' S2 自回HPS=5%×2000', s2.skillHps, 100, 0.01);
    check(nm + ' S2 总治疗=100×15', s2.totalHeal, 1500, 0.01);
  } else {
    check(nm + ' S2 总伤=二连击20hits', s2.skillTotalDamage, hit302(302 * 1.4) * 20, 0.01);
  }
  // S3:atk+40% 10击
  const s3 = calculateOperator(w, wslot(2));
  check(nm + ' S3 总伤=10击×atk1.4', s3.skillTotalDamage, hit302(302 * 1.4) * 10, 0.01);
}

console.log(`\n${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
