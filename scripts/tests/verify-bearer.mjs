// 执旗手(bearer)验证:技能开启停止攻击输出归0(9处) + 琴柳S3单发瞬伤 + 常态保留
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { calcPhysicalDamage, calcRealInterval } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/PIONEER/bearer/';
const load = n => JSON.parse(fs.readFileSync(B + n + '.json', 'utf8'));
const mk = (op, si) => {
  const e = Math.min(2, op.phases.length - 1);
  return { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7 };
};
const P = atk => calcPhysicalDamage(atk, 600);
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) pass++; else { fail++; console.log('FAIL: ' + name + (extra ? ' => ' + extra : '')); }
};
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

const ops = {};
for (const id of ['char_151_myrtle', 'char_401_elysm', 'char_4119_wanqin', 'char_4237_jcinta', 'char_479_sleach']) ops[id] = load(id);
check('执旗手 5人数据在位', Object.keys(ops).length === 5 && Object.values(ops).every(o => o.subProfessionId === 'bearer'));

// 停攻技能(除琴柳S3外全部技能):技能期伤害0+cycle null+内部档0;常态普攻保留
const stopAll = [];
for (const id of Object.keys(ops)) {
  const op = ops[id];
  for (let si = 0; si < op.skills.length; si++) {
    if (id === 'char_479_sleach' && si === 2) continue; // 琴柳 S3 有瞬发伤害
    stopAll.push([op, si]);
  }
}
check('停攻技能共10处(5人:桃金娘/极境/万顷/嘉辛塔各2+琴柳2)', stopAll.length === 10, String(stopAll.length));
for (const [op, si] of stopAll) {
  const r = calculateOperator(op, mk(op, si));
  const ok0 = r.skillDps === 0 && r.skillTotalDamage === 0 && r.cycleDps === null;
  const okInner = Object.values(r.dmgTypes || {}).every(t => t.skillDps === 0 && t.skillTotalDamage === 0);
  const okNorm = (r.normalDps || 0) > 0;
  check(`${op.name} S${si + 1} 停攻归0(顶层+内部档)且常态保留`, ok0 && okInner && okNorm, JSON.stringify({ skillDps: r.skillDps, dmgTypes: r.dmgTypes, normalDps: r.normalDps }).slice(0, 150));
}

// 琴柳 S3 光辉旗帜:单发瞬伤 P(atk×2.6 L7) + 常态;眩晕/易伤/减攻/回费不计
const ql = ops['char_479_sleach'];
const qlPs = calcPanelStats(ql, mk(ql, 2));
const qlS3 = calculateOperator(ql, mk(ql, 2));
const qlLv = ql.skills[2].levels[7];
const flagHit = P(qlPs.panelAtk * qlLv.atk_scale);
check('琴柳S3 总伤=单发P(atk×2.6)', Math.abs(qlS3.skillTotalDamage - flagHit) <= 1, `${qlS3.skillTotalDamage} vs ${flagHit}`);
check('琴柳S3 skillDps=总伤/10s', Math.abs(qlS3.skillDps - flagHit / 10) <= 0.1);
// 常态间隔含天赋不退之旗攻速+10(E2) → 1.3×100/110=1.1818
const qlNormInt = calcRealInterval(1.3, 110);
check('琴柳S3 常态=P(atk)/1.1818(攻速+10)', Math.abs((qlS3.normalDps || 0) - P(qlPs.panelAtk) / qlNormInt) <= 0.1, `${qlS3.normalDps} vs ${P(qlPs.panelAtk) / qlNormInt}`);
check('琴柳 面板间隔 1.1818(E2 攻速+10)', Math.abs(qlPs.attackInterval - qlNormInt) <= 0.01);
// 琴柳 E1 攻速+5 → 1.2381
const qlE1Ps = calcPanelStats(ql, { ...mk(ql, 0), elite: 1, level: ql.phases[1].maxLevel });
check('琴柳 E1 面板间隔 1.2381(攻速+5)', Math.abs(qlE1Ps.attackInterval - calcRealInterval(1.3, 105)) <= 0.01, String(qlE1Ps.attackInterval));
check('琴柳S3 内部档同步单发', qlS3.dmgTypes.physical.skillTotalDamage === qlS3.skillTotalDamage);
check('琴柳S3 非停攻(有伤害)', qlS3.skillTotalDamage > 0);

// ===== S2 治疗技能(每秒1跳,治疗量=面板atk×ratio,单目标口径) =====
// 桃金娘 S2 0.4×atk dur16 | 万顷 S2 0.2×atk dur15 | 嘉辛塔 S2 0.22×atk dur30 | 琴柳 S2 0.4×atk dur15
const healCases = [
  ['char_151_myrtle', 1, 0.4, 16], ['char_4119_wanqin', 1, 0.2, 15],
  ['char_4237_jcinta', 1, 0.22, 30], ['char_479_sleach', 1, 0.4, 15],
];
for (const [id, si, ratio, dur] of healCases) {
  const op = ops[id];
  const ps = calcPanelStats(op, mk(op, si));
  const r = calculateOperator(op, mk(op, si));
  const expHps = ps.panelAtk * ratio;
  check(`${op.name} S${si + 1} 治疗型(type=heal)`, r.type === 'heal');
  check(`${op.name} S${si + 1} HPS=atk×${ratio}/秒`, Math.abs((r.skillHps || 0) - expHps) <= 1, `${r.skillHps} vs ${expHps}`);
  check(`${op.name} S${si + 1} 总治疗=HPS×${dur}s`, Math.abs((r.totalHeal || 0) - expHps * dur) <= 15, `${r.totalHeal} vs ${expHps * dur}`);
  check(`${op.name} S${si + 1} 无技能期伤害(停攻转治疗)`, r.skillDps === 0 && r.skillTotalDamage === 0);
  check(`${op.name} S${si + 1} 常态普攻保留`, (r.normalDps || 0) > 0);
}
// 极境 S2 聆听(减速减防反隐无治疗):仍为停攻归0非治疗型
const jy = ops['char_401_elysm'];
const jyS2 = calculateOperator(jy, mk(jy, 1));
check('极境S2 聆听 无治疗(非heal型)', jyS2.type !== 'heal' && (jyS2.skillHps || 0) === 0);
check('极境S2 聆听 停攻归0', jyS2.skillDps === 0 && jyS2.skillTotalDamage === 0);

// ===== 天赋:桃金娘浮光跃金(E2 全场先锋每秒回25,自身必吃→常态HPS)/琴柳不退之旗(军旗攻速自身必吃) =====
const mt = ops['char_151_myrtle'];
// E1(天赋未解锁):无常态自回,type damage
const mtE1 = calculateOperator(mt, { ...mk(mt, 0), elite: 1, level: mt.phases[1].maxLevel });
check('桃金娘 E1(浮光跃金未解锁) 无常态HPS', (mtE1.normalHps || 0) === 0 && mtE1.type === 'damage');
// E2:常态 HPS 25(自回天赋常驻,所有技能槽位一致)
for (const si of [0, 1]) {
  const r = calculateOperator(mt, mk(mt, si));
  check(`桃金娘 E2 S${si + 1} 常态HPS=25(浮光跃金自身必吃)`, (r.normalHps || 0) === 25, String(r.normalHps));
  check(`桃金娘 E2 S${si + 1} 自回与治疗并存(heal型)`, r.type === 'heal');
}

console.log(`执旗手验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
