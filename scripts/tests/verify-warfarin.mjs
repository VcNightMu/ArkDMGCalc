// 验证华法琳特殊处理：
// 1技能「紧急包扎」：攻击回复触发型，额外回复目标最大生命值 hp_ratio（默认目标=自身→panelHp），算周期 HPS
// 2技能「不稳定血浆」：手动开启自身加攻 buff 持续 duration 秒，视为持续型技能（技能期=15s）
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import fs from 'fs';

const op = JSON.parse(fs.readFileSync('F:/ArkCodes/ArkDMGCalc/src/frontend/data/MEDIC/physician/char_171_bldsk.json', 'utf8'));

let ok = true;
const check = (label, actual, expect) => {
  const pass = Math.abs(actual - expect) < 1e-6;
  if (!pass) ok = false;
  console.log(`${label}: ${actual} (期望 ${expect}) ${pass ? 'OK' : 'FAIL'}`);
};

// 精二满级 Lv80，信赖 100%，潜能 0。白值 ATK = 505 + 75 = 580；maxHp = 1520（无信赖/潜能加成）
const RAW = 580;
const HP = 1520;
const BASE_INTERVAL = 2.85;
const slot = { elite: 2, level: 80, trustPercent: 100, potentialRank: 0 };

console.log('=== 数据字段 ===');
console.log('1技能 hp_ratio Lv1/专三:', op.skills[0].levels[0].hp_ratio, op.skills[0].levels[9].hp_ratio);
console.log('1技能 spType:', op.skills[0].levels[0].spType, 'spCost:', op.skills[0].levels[0].spCost, 'skillType:', op.skills[0].levels[0].skillType);
console.log('2技能 duration:', op.skills[1].levels[0].duration, 'atk Lv1/专三:', op.skills[1].levels[0].atk, op.skills[1].levels[9].atk);

console.log('\n=== 1技能 紧急包扎（攻击回复触发型，治疗量=自身maxHp×hp_ratio）===');
// 攻击回复 1sp/攻，spCost=4 → 4 次攻击攒满即触发；周期时长 = 4 × 2.85 = 11.4s
const cycleTime = 4 * BASE_INTERVAL;

const s1_lv1 = calculateOperator(op, { ...slot, skillIndex: 0, skillLevel: 0 });
check('Lv1 总治疗量（普攻+额外）', s1_lv1.totalHeal, RAW + HP * 0.11);
check('Lv1 周期HPS（全程普攻+额外）', s1_lv1.cycleHps, (RAW * 4 + HP * 0.11) / cycleTime);
check('常态HPS', s1_lv1.normalHps, RAW / BASE_INTERVAL);
check('技能期HPS 为 null（触发型不显示）', s1_lv1.skillHps === null ? 1 : 0, 1);

const s1_m3 = calculateOperator(op, { ...slot, skillIndex: 0, skillLevel: 9 });
check('专三 总治疗量（普攻+额外）', s1_m3.totalHeal, RAW + HP * 0.25);
check('专三 周期HPS', s1_m3.cycleHps, (RAW * 4 + HP * 0.25) / cycleTime);
check('专三 周期HPS > 常态HPS', s1_m3.cycleHps > s1_m3.normalHps, true);
check('专三 技能期HPS 为 null', s1_m3.skillHps === null ? 1 : 0, 1);

console.log('\n=== 2技能 不稳定血浆（自身必然获得加攻 buff，持续 duration 秒 → 持续型）===');
// 技能期 = 15s；攻击次数 = floor(15/2.85) = 5
const attackCount = Math.floor(15 / BASE_INTERVAL);

const s2_lv1 = calculateOperator(op, { ...slot, skillIndex: 1, skillLevel: 0 });
check('Lv1 技能期ATK（+30%）', s2_lv1.panelAtk, RAW * 1.3);
check('Lv1 技能期HPS', s2_lv1.skillHps, RAW * 1.3 / BASE_INTERVAL);
check('Lv1 总治疗量', s2_lv1.totalHeal, RAW * 1.3 * attackCount);
check('Lv1 常态HPS（不加攻）', s2_lv1.normalHps, RAW / BASE_INTERVAL);

const s2_m3 = calculateOperator(op, { ...slot, skillIndex: 1, skillLevel: 9 });
check('专三 技能期ATK（+90%）', s2_m3.panelAtk, RAW * 1.9);
check('专三 技能期HPS', s2_m3.skillHps, RAW * 1.9 / BASE_INTERVAL);
check('专三 总治疗量', s2_m3.totalHeal, RAW * 1.9 * attackCount);
check('专三 技能期HPS > 常态HPS', s2_m3.skillHps > s2_m3.normalHps, true);

console.log('\n' + (ok ? '✅ 全部通过' : '❌ 存在失败'));
process.exit(ok ? 0 : 1);
