// 验证凯尔希召唤物 Mon3tr（token_10002_kalts_mon3tr）技能效果：
// 技能由持有者凯尔希注入（attack@ 前缀剥离）：1技能防御型（输出=常态）、2技能加攻物理、
// 3技能攻击力增幅线性衰减 + 真实伤害（按每次攻击时刻即时攻击力结算）
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import fs from 'fs';

const op = JSON.parse(fs.readFileSync('F:/ArkCodes/ArkDMGCalc/src/frontend/data/TOKEN/notchar1/token_10002_kalts_mon3tr.json', 'utf8'));

let ok = true;
const near = (label, actual, expect, tol = 0.01) => {
  const pass = Math.abs(actual - expect) <= tol * Math.max(1, Math.abs(expect));
  if (!pass) ok = false;
  console.log(`${label}: ${actual} (期望 ${expect}) ${pass ? 'OK' : 'FAIL'}`);
};
const check = (label, actual, expect) => {
  const pass = actual === expect;
  if (!pass) ok = false;
  console.log(`${label}: ${actual} (期望 ${expect}) ${pass ? 'OK' : 'FAIL'}`);
};

// 数据字段核查
console.log('=== 数据字段 ===');
console.log('技能数:', op.skills.length, '(1防御/2加攻物理/3衰减真伤)');
check('技能1名', op.skills[0].name, '指令：结构加固');
check('技能2名', op.skills[1].name, '指令：战术协同');
check('技能3名', op.skills[2].name, '指令：熔毁');
check('技能3专三 atk', op.skills[2].levels[9].atk, 2.6);
check('技能3专三 atkDecay', op.skills[2].levels[9].atkDecay, true);
check('技能3专三 trueDamage', op.skills[2].levels[9].trueDamage, true);
check('技能2专三 duration', op.skills[1].levels[9].skillDuration, 20);

// 精二满级 Lv90：Mon3tr 白值 ATK = 1402（token 无信赖/潜能加成）；攻击间隔 2s
const RAW = 1402;
const INTERVAL = 2;
const ENEMY_DEF = 600;
const slot = { elite: 2, level: 90, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 9 };

console.log('\n=== 1技能 指令：结构加固（防御+150%，输出=常态物理）===');
const s1 = calculateOperator(op, slot);
check('type damage', s1.type, 'damage');
check('damageType physical', s1.damageType, 'physical');
near('技能期DPS = 常态', s1.skillDps, (RAW - ENEMY_DEF) / INTERVAL);
near('总伤（20 次普攻）', s1.skillTotalDamage, (RAW - ENEMY_DEF) * 20);
near('常态DPS', s1.normalDps, (RAW - ENEMY_DEF) / INTERVAL);

console.log('\n=== 2技能 指令：战术协同（攻击+90%，物理伤害）===');
const s2 = calculateOperator(op, { ...slot, skillIndex: 1 });
check('type damage', s2.type, 'damage');
check('damageType physical', s2.damageType, 'physical');
near('技能期单次伤害', s2.skillTotalDamage / 10, RAW * 1.9 - ENEMY_DEF);
near('总伤（10 次）', s2.skillTotalDamage, (RAW * 1.9 - ENEMY_DEF) * 10);
near('技能期DPS', s2.skillDps, (RAW * 1.9 - ENEMY_DEF) * 10 / 20);
near('常态DPS 不变', s2.normalDps, (RAW - ENEMY_DEF) / INTERVAL);
check('技能期ATK', Math.round(s2.panelAtk), Math.round(RAW * 1.9));

console.log('\n=== 3技能 指令：熔毁（增幅 +260% 线性衰减至 0，真实伤害）===');
const s3 = calculateOperator(op, { ...slot, skillIndex: 2 });
check('type damage', s3.type, 'damage');
check('damageType true（真实伤害）', s3.damageType, 'true');
// 10 次攻击 t=0,2,...,18s：增幅(t) = 2.6×(1-t/20)，真伤 = rawAtk×(1+增幅)
let expTotal = 0;
for (let i = 0; i < 10; i++) expTotal += RAW * (1 + 2.6 * (1 - (i * INTERVAL) / 20));
near('总伤（逐次即时攻击力累加）', s3.skillTotalDamage, expTotal);
near('技能期平均DPS', s3.skillDps, expTotal / 20);
near('常态DPS 仍为物理普攻', s3.normalDps, (RAW - ENEMY_DEF) / INTERVAL);
// 衰减尾段攻击力趋向面板：最后攻击（t=18s）增幅 0.26 → 攻击力 1766.52
near('末次攻击衰减至接近面板', expTotal - s3.skillTotalDamage, 0);
check('技能期ATK = 初始攻击力（增幅全开）', Math.round(s3.panelAtk), Math.round(RAW * 3.6));

console.log('\n=== 3技能 Lv1（增幅 +130%，18s，真实伤害）===');
const s3l1 = calculateOperator(op, { elite: 2, level: 90, trustPercent: 100, potentialRank: 0, skillIndex: 2, skillLevel: 0 });
check('damageType true', s3l1.damageType, 'true');
let expTotalL1 = 0;
for (let i = 0; i < 9; i++) expTotalL1 += RAW * (1 + 1.3 * (1 - (i * INTERVAL) / 18));
near('Lv1 总伤', s3l1.skillTotalDamage, expTotalL1);
near('Lv1 平均DPS', s3l1.skillDps, expTotalL1 / 18);

console.log('\n' + (ok ? '✅ 全部通过' : '❌ 存在失败'));
process.exit(ok ? 0 : 1);
