// 守望者子职业验证：风絮(1技能间隔乘算+普攻倍率替换 / 2技能attack@atk乘算)、凯尔希·思衡托(1攻速3间隔减算常规、2弹药机制真伤+治疗双轨)
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const load = p => JSON.parse(fs.readFileSync(BASE + p, 'utf8'));

let ok = true;
const check = (label, cond) => { if (!cond) ok = false; console.log(label + ': ' + (cond ? 'OK' : 'FAIL')); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const eps = 0.5;

// ===== 风絮：E2 L80 信赖100 无潜能 =====
const taraxa = load('/MEDIC/watchman/char_4222_taraxa.json');
const tBase = { elite: 2, level: 80, trustPercent: 100, potentialRank: 0, module: null };
const tPs = calcPanelStats(taraxa, tBase);
console.log('  风絮 E2面板: ATK=' + tPs.panelAtk + ' 间隔=' + tPs.attackInterval.toFixed(3) + 's');
check('风絮面板 ATK = 460+45信赖', tPs.panelAtk === 505);

// 技能1：普攻间隔 ×0.2(0.57s)，每次回复攻击力 ×0.4(Lv1)/×0.6(专三)
const s1Lv1 = calculateOperator(taraxa, { ...tBase, skillIndex: 0, skillLevel: 0 });
console.log('  技能1 Lv1: 间隔=' + s1Lv1.realInterval.toFixed(3) + 's 每次=' + (s1Lv1.skillHps * s1Lv1.realInterval).toFixed(1) + ' 期望每次=202');
check('技能1 Lv1 间隔 = 2.85×0.2=0.57', near(s1Lv1.realInterval, 0.57));
check('技能1 Lv1 每次治疗 = 505×0.4', near(s1Lv1.skillHps * s1Lv1.realInterval, 202, eps));
const s1M = calculateOperator(taraxa, { ...tBase, skillIndex: 0, skillLevel: 9 });
console.log('  技能1 专三: 间隔=' + s1M.realInterval.toFixed(3) + 's 总治疗=' + s1M.totalHeal.toFixed(0));
check('技能1 专三 每次治疗 = 505×0.6', near(s1M.skillHps * s1M.realInterval, 303, eps));
check('技能1 专三 总治疗 = 303×floor(45/0.57)', near(s1M.totalHeal, 303 * Math.floor(45 / 0.57), eps));

// 技能2：attack@atk=1.2 → skillAtk=505×2.2=1111，普攻治疗 ×1.0，间隔不变
const s2M = calculateOperator(taraxa, { ...tBase, skillIndex: 1, skillLevel: 9 });
console.log('  技能2 专三: skillAtk=' + s2M.panelAtk.toFixed(0) + ' 总治疗=' + s2M.totalHeal.toFixed(0));
check('技能2 专三 skillAtk = 505×2.2=1111', near(s2M.panelAtk, 1111, eps));
check('技能2 专三 间隔不变 2.85', near(s2M.realInterval, 2.85));
check('技能2 专三 每次治疗 = 1111', near(s2M.skillHps * s2M.realInterval, 1111, eps));
check('技能2 专三 总治疗 = 1111×floor(25/2.85)', near(s2M.totalHeal, 1111 * Math.floor(25 / 2.85), eps));

// ===== 凯尔希·思衡托：E2 L90 信赖100 无潜能 =====
const kalts2 = load('/MEDIC/watchman/char_1052_kalts2.json');
const kBase = { elite: 2, level: 90, trustPercent: 100, potentialRank: 0, module: null };
const kPs = calcPanelStats(kalts2, kBase);
console.log('  凯尔希·思衡托 E2面板: ATK=' + kPs.panelAtk + ' 间隔=' + kPs.attackInterval.toFixed(3) + 's');
check('面板 ATK = 510', kPs.panelAtk === 510);
// 天赋2（部署30秒HOT光环）不计算 → 常态普攻治疗 = 510
const k0 = calculateOperator(kalts2, { ...kBase, skillIndex: 0, skillLevel: 0 });
check('常态普攻 HPS = 510/2.85 (HOT天赋不计算)', near(k0.normalHps, 510 / 2.85, 1e-4));

// 技能1：atk+90% + attack_speed 50 → 间隔 2.85×100/150=1.9s
const k1 = calculateOperator(kalts2, { ...kBase, skillIndex: 0, skillLevel: 9 });
console.log('  技能1 专三: skillAtk=' + k1.panelAtk.toFixed(0) + ' 间隔=' + k1.realInterval.toFixed(3) + 's 总治疗=' + k1.totalHeal.toFixed(0));
check('技能1 skillAtk = 510×1.9=969', near(k1.panelAtk, 969, eps));
check('技能1 间隔 = 2.85×100/150=1.9', near(k1.realInterval, 1.9));
check('技能1 总治疗 = 969×floor(35/1.9)', near(k1.totalHeal, 969 * Math.floor(35 / 1.9), eps));

// 技能2：弹药机制！10发，单发真伤=skillAtk×3.8，单发治疗=skillAtk×2
const k2 = calculateOperator(kalts2, { ...kBase, skillIndex: 1, skillLevel: 9 });
const ammo = 10;
const ammoAtk = 510 * (1 + 1.5);            // 顶层 atk 直接乘算
const perDmg = ammoAtk * 3.8;               // 单发真伤
const perHeal = ammoAtk * 2;                // 单发治疗
const ammoTime = ammo * 2.85;
console.log('  技能2 专三: type=' + k2.type + ' damageType=' + k2.damageType + ' 总伤=' + k2.skillTotalDamage.toFixed(0) + ' 总治疗=' + k2.totalHeal.toFixed(0));
check('技能2 skillAtk = 510×2.5=1275', near(k2.panelAtk, 1275, eps));
check('技能2 总伤 = 10发×1275×3.8真伤', near(k2.skillTotalDamage, perDmg * ammo, eps));
check('技能2 总治疗 = 10发×1275×2', near(k2.totalHeal, perHeal * ammo, eps));
check('技能2 DPS = 总伤/28.5s', near(k2.skillDps, perDmg * ammo / ammoTime, 1e-4));
check('技能2 HPS = 总治疗/28.5s', near(k2.skillHps, perHeal * ammo / ammoTime, 1e-4));
check('技能2 伤害类型 = true(白字真伤)', k2.damageType === 'true');

// 技能3：atk+150% + base_attack_time -1.55 → 间隔 1.3s
const k3 = calculateOperator(kalts2, { ...kBase, skillIndex: 2, skillLevel: 9 });
console.log('  技能3 专三: skillAtk=' + k3.panelAtk.toFixed(0) + ' 间隔=' + k3.realInterval.toFixed(3) + 's 总治疗=' + k3.totalHeal.toFixed(0));
check('技能3 skillAtk = 510×2.5=1275', near(k3.panelAtk, 1275, eps));
check('技能3 间隔 = 2.85-1.55=1.3', near(k3.realInterval, 1.3));
check('技能3 总治疗 = 1275×floor(35/1.3)', near(k3.totalHeal, 1275 * Math.floor(35 / 1.3), eps));

console.log(ok ? '✅ 全部通过' : '❌ 存在失败');
process.exit(ok ? 0 : 1);
