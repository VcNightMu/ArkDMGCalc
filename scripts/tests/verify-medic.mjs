// 验证医疗干员技能等级是否影响 HPS / 总治疗量
// 口径: elite2/maxLevel/信赖100/潜0;闪灵 S1 信条(攻击力档)、白面鸮 S1 治疗强化·γ型(攻击力档)、
//       白面鸮 S2 脑啡肽(base_attack_time 缩短间隔)。数值为当前引擎真值，用于等级→HPS/总治疗量的回归。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc';
function load(id, sub) {
  return JSON.parse(fs.readFileSync(`${BASE}/src/frontend/data/MEDIC/${sub}/${id}.json`, 'utf8'));
}

const shining = load('char_147_shining', 'physician');
const plosis = load('char_128_plosis', 'ringhealer');

let ok = true, pass = 0, fail = 0;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const check = (label, cond) => { if (cond) pass++; else { fail++; ok = false; } console.log(label + ': ' + (cond ? 'OK' : 'FAIL')); };

// 各档期望值(当前引擎真值):[lv, panelAtk, realInterval, normalHps, skillHps, totalHeal]
const CASES = [
  { label: '闪灵', op: shining, si: 0, rows: [
    [0, 884.5, 2.375, 214.0, 372.4, 7076.0],
    [3, 963.8, 2.375, 214.0, 405.8, 7710.4],
    [6, 1018.7, 2.192, 214.0, 464.7, 9168.3],
    [9, 1098.0, 2.192, 214.0, 500.8, 9882.0],
  ] },
  { label: '白面鸮', op: plosis, si: 0, rows: [
    [0, 546.0, 2.850, 136.8, 191.6, 5460.0],
    [3, 604.5, 2.850, 136.8, 212.1, 6045.0],
    [6, 663.0, 2.850, 136.8, 232.6, 6630.0],
    [9, 741.0, 2.850, 136.8, 260.0, 7410.0],
  ] },
  { label: '白面鸮', op: plosis, si: 1, rows: [
    [0, 390.0, 1.200, 136.8, 325.0, 9360.0],
    [3, 390.0, 1.050, 136.8, 371.4, 12090.0],
    [6, 390.0, 0.950, 136.8, 410.5, 14430.0],
    [9, 390.0, 0.750, 136.8, 520.0, 20670.0],
  ] },
];

for (const c of CASES) {
  const maxLevel = c.op.phases[c.op.phases.length - 1].maxLevel;
  let prevHps = -Infinity, prevHeal = -Infinity;
  console.log(`\n=== ${c.label} (技能${c.si}: ${c.op.skills[c.si].name}) ===`);
  for (const [lv, atk, int, nHps, sHps, tHeal] of c.rows) {
    const r = calculateOperator(c.op, { elite: 2, level: maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: c.si, skillLevel: lv });
    console.log(`  Lv${lv}: 面板ATK=${r.panelAtk.toFixed(1)}  间隔=${r.realInterval.toFixed(3)}s  常态HPS=${r.normalHps.toFixed(1)}  技能期HPS=${r.skillHps.toFixed(1)}  总治疗量=${(r.totalHeal ?? 0).toFixed(1)}`);
    const tag = `${c.label} S${c.si + 1} Lv${lv}`;
    check(tag + ' 面板ATK=' + atk, near(r.panelAtk, atk, 0.05));
    check(tag + ' 间隔=' + int, near(r.realInterval, int, 0.001));
    check(tag + ' 常态HPS=' + nHps, near(r.normalHps, nHps, 0.1));
    check(tag + ' 技能期HPS=' + sHps, near(r.skillHps, sHps, 0.1));
    check(tag + ' 总治疗量=' + tHeal, near(r.totalHeal, tHeal, 0.5));
    check(tag + ' 技能期HPS 随等级单调不降', r.skillHps >= prevHps - 1e-9);
    check(tag + ' 总治疗量 随等级单调递增', r.totalHeal > prevHeal);
    prevHps = r.skillHps; prevHeal = r.totalHeal;
  }
}

console.log(`\n医疗技能等级验证: ${pass} 通过 / ${fail} 失败`);
console.log(ok ? '✅ 全部通过' : '❌ 存在失败');
process.exit(ok ? 0 : 1);
