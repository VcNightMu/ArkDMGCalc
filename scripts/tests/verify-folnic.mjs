// 验证亚叶：1 技能「最大剂量输注」常规治疗；2 技能「复合型药物弹片」独立治疗 + 独立法术伤害
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const folnic = JSON.parse(fs.readFileSync('F:/ArkCodes/ArkDMGCalc/src/frontend/data/MEDIC/physician/char_345_folnic.json', 'utf8'));
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

let ok = true;
const check = (label, actual, expect) => {
  const pass = Math.abs(actual - expect) < 1e-6;
  if (!pass) ok = false;
  console.log(`${label}: ${actual} (期望 ${expect}) ${pass ? 'OK' : 'FAIL'}`);
};

const BI = 2.85;
const RAW = 479 + 50; // 精二满级 479 + 信赖 50 = 529

// 亚叶 2 技能「复合型药物弹片」精二80级专三（独立治疗 + 独立法术伤害）
const s2 = calculateOperator(folnic, { elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 1, skillLevel: 9 });
console.log('=== 亚叶 2 技能 复合型药物弹片（独立治疗+伤害）===');
check('技能期HPS', s2.skillHps, RAW * 1.5 / BI);
check('技能期DPS', s2.skillDps, (RAW * 2.0 * 0.5) / BI);
check('总治疗量', s2.totalHeal, RAW * 1.5 * 10);
check('技能期总伤', s2.skillTotalDamage, RAW * 2.0 * 0.5 * 10);
check('常态HPS', s2.normalHps, RAW / BI);

// 亚叶 1 技能「最大剂量输注」精二80级专三（常规治疗，atk +20%）
const s1 = calculateOperator(folnic, { elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 9 });
const skillAtk = RAW * 1.8; // 专三 atk +80%
console.log('\n=== 亚叶 1 技能 最大剂量输注（常规治疗，atk +20%）===');
check('技能期HPS', s1.skillHps, skillAtk / BI);
check('总治疗量', s1.totalHeal, skillAtk * Math.floor(40 / BI));
check('skillDps=0', s1.skillDps, 0);

console.log('\n' + (ok ? '✅ 全部通过' : '❌ 存在失败'));
process.exit(ok ? 0 : 1);
