// 赤霄陈三技能引擎验证（弱点伤害）
import { calculateOperator, calcPanelStats } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const op = JSON.parse(fs.readFileSync('F:/ArkCodes/ArkDMGCalc/src/frontend/data/WARRIOR/artsfghter/char_1050_chen3.json', 'utf8'));
const mk = (si, sl, elite = 2, pot = 0) => ({ elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: pot, skillIndex: si, skillLevel: sl });
const phys = (atk) => Math.max(atk - 600, atk * 0.05);
const arts = (atk) => Math.max(atk * 0.5, atk * 0.05);
const weak = (atk) => Math.max(phys(atk), arts(atk));

let pass = 0, fail = 0;
const check = (name, actual, expect, eps = 0.5) => {
  const ok = typeof actual === 'string' || typeof expect === 'string'
    ? actual === expect
    : Math.abs(actual - expect) <= eps;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} actual=${actual} expect=${expect}`);
};

// 面板：E2 Lv80 pot0 trust100 → base 670 + trust 100 = 770 × (1+0.13天赋) = 870.1
const ps = calcPanelStats(op, mk(-1, 7));
console.log('panelAtk:', ps.panelAtk, 'interval:', ps.attackInterval);
const P = ps.panelAtk;

// ===== 无技能常态（弱点）=====
const none = calculateOperator(op, mk(-1, 7));
// 770×1.13=870.1: phys=870.1-600=270.1, arts=435.05 → 法伤赢 → ndps = 435.05/1.106
console.log('无技能 normalDps:', none.normalDps, 'type:', none.normalDamageType);

// ===== S1 奔夜: atk+120% → 2.2P 二连击, 18s =====
// 引擎乘区=白值×(1+天赋atk+技能atk) 直接累加(rawAtk=base+trust=770,天赋 0.13)
const s1 = calculateOperator(op, mk(0, 7)); // skillLevel 7 = levels[7] 专一档
const lv1 = op.skills[0].levels[7];
console.log('S1 L7 bb:', JSON.stringify(lv1));
const rawAtk = 770; // E2 base 670 + trust 100
const p1 = rawAtk * (1 + 0.13 + lv1.atk);  // 770×(1.13+0.9)=1563.1
const int1 = ps.attackInterval; // 攻速+13 后的间隔
const hit1 = weak(p1) * 2;
const att1 = Math.floor(18 / int1);
const exp1 = hit1 * att1;
check('S1 总伤=单次弱点×2连×次数', s1.skillTotalDamage, exp1, 2);
check('S1 技能期DPS=总伤/18', s1.skillDps, exp1 / 18, 0.5);
console.log('  p1=', p1, 'hit1=', hit1, 'att1=', att1);

// ===== S2 绝影-驰: 10斩×4.8P + 6s ×4P 普攻 =====
// 引擎内部用未取整白值 870.1(取整面板 870),基准用 panelAtk 精确值重算
const Praw = 670 + 100; // base+trust
const Pt = Praw * 1.13; // 含天赋 0.13(未取整)
const s2 = calculateOperator(op, mk(1, 7));
const lv2 = op.skills[1].levels[7];
console.log('S2 L7 bb:', JSON.stringify(lv2));
const slash = weak(Pt * lv2.atk_scale) * 10;
const buffHits = Math.floor(6 / int1);
const buff = weak(Pt * (lv2['chen3_s2[respawn_buff].atk'] + 1)) * buffHits;
const exp2 = slash + buff;
check('S2 总伤=10斩+6s加攻普攻', s2.skillTotalDamage, exp2, 2);
console.log('  slash=', slash, 'buffHits=', buffHits, 'buff=', buff);

// ===== S3 天喟: 剑气1次 + 攻击×3连×attack@atk_scale =====
const s3 = calculateOperator(op, mk(2, 7));
const lv3 = op.skills[2].levels[7];
console.log('S3 L7 bb:', JSON.stringify(lv3));
const sword = weak(Math.max(50000 * 0.06, Pt * lv3.projectile_min_atk_scale));
const att3 = Math.floor(20 / int1);
const atkTotal = weak(Pt * lv3['attack@atk_scale']) * 3 * att3;
const exp3 = sword + atkTotal;
check('S3 总伤=剑气+3连击×倍率', s3.skillTotalDamage, exp3, 2);
console.log('  sword=', sword, 'att3=', att3, 'atkTotal=', atkTotal);

// ===== 精0（无天赋）全法伤 =====
const ps0 = calcPanelStats(op, mk(-1, 7, 0));
const P0 = ps0.panelAtk;
console.log('精0 panelAtk:', P0);
const none0 = calculateOperator(op, mk(-1, 7, 0));
const expNone0 = arts(P0) / 1.25;
check('精0 常态=纯法伤(无弱点)', none0.normalDps, expNone0);
const s10 = calculateOperator(op, mk(0, 7, 0));
const p10 = P0 * (1 + lv1.atk);  // 精0 无天赋:skillAtk=白值×(1+0+技能atk)
const exp10 = arts(p10) * 2 * Math.floor(18 / 1.25);
check('精0 S1=纯法伤二连', s10.skillTotalDamage, exp10, 2);

// ===== 类型翻转验证(弱点逐击取优) =====
// E2 常态攻击 870.1: phys=270.1 < arts=435.1 → 法伤赢(normalDamageType=arts)
check('E2 常态弱点类型=arts(低攻走法伤)', none.normalDamageType, 'arts');
// S1 技能期 1563.1: phys=963.1 > arts=781.6 → 物理赢
check('E2 S1 弱点类型=physical(高攻走物理)', s1.damageType, 'physical');
check('E2 S1 dmgTypes 只有 physical 档', JSON.stringify(Object.keys(s1.dmgTypes)), JSON.stringify(['physical']));
// 高防敌人(res 低 def 高)也会翻转:换 def=1500 res=10 → 常态 870.1: phys<arts? phys=0保底43.5 arts=783 → 仍法伤;
// S1 1563: phys=63 arts=1407 → 法伤。用极低防验证物理侧: def=100 res=50 → 常态 phys=770 arts=435 → 物理赢
state.enemy = { hp: 50000, atk: 800, def: 100, res: 50, grade: 'normal' };
const noneLowDef = calculateOperator(op, mk(-1, 7));
check('低防敌人常态弱点类型=physical', noneLowDef.normalDamageType, 'physical');
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const s1Back = calculateOperator(op, mk(0, 7));
check('恢复默认敌人 S1 仍=physical', s1Back.damageType, 'physical');

console.log(`\n${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
