// 群愈师子职业验证：幻影(鸟笼)召唤物 DPS0/法术色、瑰盐天赋(白值-5%+治疗倍率)、微风/调香师边界
import { calcPanelStats, calculateOperator, calcTalentAtkBonus, calcTalentHealScale } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const load = p => JSON.parse(fs.readFileSync(BASE + p, 'utf8'));

let ok = true;
const check = (label, cond) => { if (!cond) ok = false; console.log(label + ': ' + (cond ? 'OK' : 'FAIL')); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ===== 夜莺幻影（鸟笼）：无攻击召唤物 =====
const bird = load('/TOKEN/notchar1/token_10003_cgbird_bird.json');
check('幻影数据 damageType=arts(法术色)', bird.damageType === 'arts');
check('幻影攻击力全 0', bird.phases.every(p => p.atk[0] === 0 && p.atk[1] === 0));
const birdSlot = { elite: 2, level: 90, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 0, module: null };
const birdRes = calculateOperator(bird, birdSlot);
console.log('  幻影: type=' + birdRes.type + ' damageType=' + birdRes.damageType + ' normalDps=' + birdRes.normalDps + ' 间隔=' + birdRes.realInterval.toFixed(2) + 's');
check('幻影 DPS 为 0', birdRes.normalDps === 0 && (birdRes.skillDps === 0 || birdRes.skillDps === null));

// ===== 瑰盐天赋：白值 -5% + 治疗倍率 =====
const rosa = load('/MEDIC/ringhealer/char_4163_rosesa.json');
check('瑰盐 elite0 治疗倍率 1.05', calcTalentHealScale(rosa, { elite: 0, level: 50, potentialRank: 0 }) === 1.05);
check('瑰盐 elite1 治疗倍率 1.10', calcTalentHealScale(rosa, { elite: 1, level: 70, potentialRank: 0 }) === 1.10);
check('瑰盐 elite2 治疗倍率 1.15', calcTalentHealScale(rosa, { elite: 2, level: 80, potentialRank: 0 }) === 1.15);
check('瑰盐 elite2 满潜(5阶) 治疗倍率 1.17', calcTalentHealScale(rosa, { elite: 2, level: 80, potentialRank: 4 }) === 1.17);
check('瑰盐 elite2 攻击 -5% 生效', calcTalentAtkBonus(rosa, { elite: 2, level: 80, potentialRank: 0 }) === -0.05);
const rosaBase = { elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 1, skillLevel: 9, module: null };
const rosaPs = calcPanelStats(rosa, rosaBase);
console.log('  瑰盐 E2面板: ATK=' + rosaPs.panelAtk + ' 间隔=' + rosaPs.attackInterval.toFixed(3) + 's (攻击含-5%天赋)');
// 技能1（应急药物 触发型 heal_scale=1.9）：触发那一下 = 面板ATK(已-5%) × 技能1.9 × 天赋1.15
const r1 = calculateOperator(rosa, { ...rosaBase, skillIndex: 0 });
console.log('  技能1 触发总治疗=' + (r1.totalHeal !== null && r1.totalHeal !== undefined ? r1.totalHeal.toFixed(1) : 'null') + ' 期望=' + (rosaPs.panelAtk * 1.9 * 1.15).toFixed(1));
check('技能1 触发治疗 = 面板×1.9×天赋1.15', r1.totalHeal !== null && near(r1.totalHeal, rosaPs.panelAtk * 1.9 * 1.15, 0.5));
// 技能2（长效药物 持续型，无 atk 加成，仅间隔缩短）：技能期单次=面板×1.15
const r2 = calculateOperator(rosa, { ...rosaBase, skillIndex: 1 });
const r2Dur = rosa.skills[1].levels[9].skillDuration;
console.log('  技能2 常态HPS=' + r2.normalHps.toFixed(1) + ' 总治疗=' + r2.totalHeal.toFixed(0) + ' 期望=' + (rosaPs.panelAtk * 1.15 * Math.floor(r2Dur / r2.realInterval)).toFixed(0));
check('技能2 总治疗 = 面板×1.15×攻击次数', near(r2.totalHeal, rosaPs.panelAtk * 1.15 * Math.floor(r2Dur / r2.realInterval), 0.5));
// 无天赋干员对比：调香师没有治疗倍率天赋 → 不乘
const flower = load('/MEDIC/ringhealer/char_181_flower.json');
check('调香师无治疗倍率驱动', calcTalentHealScale(flower, { elite: 2, level: 55, potentialRank: 0 }) === 1);
check('调香师无攻击惩罚天赋', calcTalentAtkBonus(flower, { elite: 2, level: 55, potentialRank: 0 }) === 0);
const flowerSlot = { elite: 2, level: 55, trustPercent: 100, potentialRank: 0, skillIndex: 1, skillLevel: 9, module: null };
const fPs = calcPanelStats(flower, flowerSlot);
const fRes = calculateOperator(flower, { ...flowerSlot, skillIndex: 0 });
const fDur = flower.skills[0].levels[9].skillDuration;
console.log('  调香师 技能1(治疗强化 atk+70%) 总治疗=' + fRes.totalHeal.toFixed(0) + ' 面板ATK=' + fPs.panelAtk + ' 期望=' + (fPs.panelAtk * 1.7 * Math.floor(fDur / fRes.realInterval)).toFixed(0));
check('调香师技能期治疗 = 面板×1.7(无天赋倍率)', near(fRes.totalHeal, fPs.panelAtk * 1.7 * Math.floor(fDur / fRes.realInterval), 5));

// ===== 微风：attack@scale(友方受疗减半) 不干扰自身 =====
const breeze = load('/MEDIC/ringhealer/char_275_breeze.json');
const bSlot = { elite: 2, level: 80, trustPercent: 100, potentialRank: 0, skillIndex: 1, skillLevel: 9, module: null };
const bPs = calcPanelStats(breeze, bSlot);
const bRes = calculateOperator(breeze, bSlot);
const bDur = breeze.skills[1].levels[9].skillDuration;
console.log('  微风 技能2(扩散疗法 atk+250%) 总治疗=' + bRes.totalHeal.toFixed(0) + ' 面板ATK=' + bPs.panelAtk + ' 期望=' + (bPs.panelAtk * 3.5 * Math.floor(bDur / bRes.realInterval)).toFixed(0));
check('微风技能期治疗 = 面板×3.5(attack@字段忽略)', near(bRes.totalHeal, bPs.panelAtk * 3.5 * Math.floor(bDur / bRes.realInterval), 0.5));

// ===== 白面鸮脑啡肽：base_attack_time 间隔缩短 =====
const plosis = load('/MEDIC/ringhealer/char_128_plosis.json');
const pSlot = { elite: 2, level: 90, trustPercent: 100, potentialRank: 0, skillIndex: 1, skillLevel: 9, module: null };
const pRes = calculateOperator(plosis, pSlot);
console.log('  白面鸮 脑啡肽 专三 技能期间隔=' + pRes.realInterval.toFixed(2) + 's (期望 0.75s = 2.85-2.1)');
check('白面鸮脑啡肽间隔 2.85-2.1=0.75s', near(pRes.realInterval, 0.75));

// ===== 夜莺 X 模组「紧闭的希望」：强化天赋1 白恶魔 → 治疗量 ×1.03/×1.05 =====
const night = load('/MEDIC/ringhealer/char_179_cgbird.json');
const nBase = { elite: 2, level: 90, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 9 };
const healRatio = (slot) => {
  const r = calculateOperator(night, slot);
  return r.normalHps * 2.85 / calcPanelStats(night, slot).panelAtk;
};
// 无模组：天赋1 仅法抗光环（不作用于自身治疗数值）→ 倍率 1.0
const n0 = healRatio({ ...nBase, module: null });
console.log('  夜莺 无模组 治疗倍率=' + n0.toFixed(3));
check('夜莺无模组治疗倍率 1.0', near(n0, 1.0, 0.01));
// X 模组 L2：天赋强化 heal_scale 1.03
const nX2 = healRatio({ ...nBase, module: { moduleId: 'uniequip_002_cgbird', moduleLevel: 2 } });
console.log('  夜莺 X模组L2 治疗倍率=' + nX2.toFixed(3));
check('夜莺 X模组L2 治疗倍率 1.03', near(nX2, 1.03, 0.01));
// X 模组 L3：1.05
const nX3 = healRatio({ ...nBase, module: { moduleId: 'uniequip_002_cgbird', moduleLevel: 3 } });
console.log('  夜莺 X模组L3 治疗倍率=' + nX3.toFixed(3));
check('夜莺 X模组L3 治疗倍率 1.05', near(nX3, 1.05, 0.01));
// Y 模组「鹭歌」：强化天赋2（幻影），无 heal_scale → 倍率 1.0
const nY = healRatio({ ...nBase, module: { moduleId: 'uniequip_003_cgbird', moduleLevel: 3 } });
console.log('  夜莺 Y模组L3 治疗倍率=' + nY.toFixed(3));
check('夜莺 Y模组L3 治疗倍率仍 1.0(不强化天赋1)', near(nY, 1.0, 0.01));

console.log(ok ? '\n✅ 全部通过' : '\n❌ 存在失败');
process.exit(ok ? 0 : 1);
