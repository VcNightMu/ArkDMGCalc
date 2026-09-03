// 验证图耶：1 技能「水流环」触发型一次性普攻治疗；2 技能「强心剂」永续
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const tuye = JSON.parse(fs.readFileSync('F:/ArkCodes/ArkDMGCalc/src/frontend/data/MEDIC/physician/char_402_tuye.json', 'utf8'));
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

let ok = true;
const check = (label, actual, expect) => {
  const pass = Math.abs(actual - expect) < 1e-6;
  if (!pass) ok = false;
  console.log(`${label}: ${actual} (期望 ${expect}) ${pass ? 'OK' : 'FAIL'}`);
};
const approx = (label, actual, expect, tol = 0.01) => {
  const pass = Math.abs(actual - expect) < tol;
  if (!pass) ok = false;
  console.log(`${label}: ${actual} (期望约 ${expect}) ${pass ? 'OK' : 'FAIL'}`);
};

const BI = 2.85;
const RAW = 493 + 75; // 精二满级 493 + 信赖 75 = 568

// 图耶 1 技能「水流环」精二80级专三（MANUAL 一次性普攻治疗，spCost 12）
const s1 = calculateOperator(tuye, { elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 9 });
console.log('=== 图耶 1 技能 水流环（MANUAL 一次性普攻治疗）===');
check('常态HPS', s1.normalHps, RAW / BI);
check('总治疗量(一次普攻)', s1.totalHeal, RAW);
// MANUAL 无延迟，cycleTime = spCost = 12
approx('周期HPS', s1.cycleHps, (RAW / BI) + RAW / 12);
console.log('技能期HPS 为 null:', s1.skillHps === null ? 'OK' : 'FAIL');
if (s1.skillHps !== null) ok = false;

// 图耶 2 技能「强心剂」精二80级专三（永续，atk +60%，heal_scale 不考虑）
const s2 = calculateOperator(tuye, { elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 1, skillLevel: 9 });
const skillAtk = RAW * (1 + 0.6);
console.log('\n=== 图耶 2 技能 强心剂（永续，atk +60%）===');
check('技能期HPS', s2.skillHps, skillAtk / BI);
console.log('总治疗量 为 null(永续):', s2.totalHeal === null ? 'OK' : 'FAIL');
if (s2.totalHeal !== null) ok = false;
check('isPermanent', s2.isPermanent, true);

console.log('\n' + (ok ? '✅ 全部通过' : '❌ 存在失败'));
process.exit(ok ? 0 : 1);
