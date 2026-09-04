// 术战者(artsfighter)引擎验证:赤霄陈弱点 + 史尔特尔熔火/S2对单 + 薇薇安娜燃烛/明灭 + 维娜混伤/真伤 + 星极叠层
import { calculateOperator, calcPanelStats } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/WARRIOR/artsfghter/';
const load = n => JSON.parse(fs.readFileSync(B + n + '.json', 'utf8'));
const op = load('char_1050_chen3');
const mkFor = (o, si, sl, elite = 2, pot = 0) => ({ elite, level: o.phases[elite].maxLevel, trustPercent: 100, potentialRank: pot, skillIndex: si, skillLevel: sl });
const mk = (si, sl, elite = 2, pot = 0) => mkFor(op, si, sl, elite, pot);
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

// ===== 史尔特尔(char_350_surtr):熔火穿透 + S2 对单 critical =====
const surtr = load('char_350_surtr');
const surtrRaw = surtr.phases[2].atk[1] + surtr.trustBonus.atk;   // 672+100=772,熔火精2 pot0=20 → 有效法抗 50-20=30
const arts30 = (atk) => atk * 0.7;  // 熔火穿透后有效法抗30 → 法伤×(100-30)/100
const sNone = calculateOperator(surtr, mkFor(surtr, -1, 7));
// 常态法伤 = arts30(772)=540.4,间隔 1.25 → 432.32
check('史尔特尔常态DPS含熔火穿透(法伤 res30)', sNone.normalDps, arts30(772) / 1.25, 0.01);
check('史尔特尔常态伤害类型=arts', sNone.damageType, 'arts');
// S1 烈焰魔剑:攻回 AUTO sp3 下次攻击 atk_scale 2.6(专一)→触发单发 arts30(772×2.6)
const surtrS1 = calculateOperator(surtr, mkFor(surtr, 0, 7));
const surtrS1Hit = arts30(772 * 2.6);
// cycleDps:3 击充能+1 触发=(3×常态 + 触发)/4击时间
const s1Int = 1.25;
check('史尔特尔S1 触发单发=2.6×atk法伤', surtrS1.skillTotalDamage, surtrS1Hit, 0.01);
check('史尔特尔S1 cycleDPS 口径', surtrS1.cycleDps, (3 * arts30(772) + surtrS1Hit) / (4 * s1Int), 0.01);
// S2 熔核巨影:atk+90%(专一)×critical 1.5, dur17, 间隔1.25 → 13击
const surtrS2 = calculateOperator(surtr, mkFor(surtr, 1, 7));
const surtrS2Atk = 772 * (1 + 0.9) * 1.5;  // 用户口径:atk 加成与 critical 相乘
const surtrS2Hit = arts30(surtrS2Atk);
check('史尔特尔S2 每击=atk加成×critical×法伤', surtrS2.skillTotalDamage / Math.floor(17 / 1.25), surtrS2Hit, 1);
check('史尔特尔S2 技能期总伤', surtrS2.skillTotalDamage, surtrS2Hit * Math.floor(17 / 1.25), 1);
// S3 黄昏:永续 isPermanent, atk+270%(专一),间隔1.25 → skillDps=arts30(772×3.7)/1.25
const surtrS3 = calculateOperator(surtr, mkFor(surtr, 2, 7));
check('史尔特尔S3 永续DPS', surtrS3.skillDps, arts30(772 * 3.7) / 1.25, 1);
check('史尔特尔S3 damageType=arts', surtrS3.damageType, 'arts');

// ===== 薇薇安娜(char_4098_vvana):燃烛施明按敌人类型 + 明灭间隔 =====
const vv = load('char_4098_vvana');
const vvRaw = vv.phases[2].atk[1] + vv.trustBonus.atk;  // 646+100=746
// 普通敌人:法伤×1.08(E2 pot0 燃烛 damage_scale_m 0.08);精英/领袖 ×1.16
const vvNone = calculateOperator(vv, mkFor(vv, -1, 7));
check('薇薇安娜常态DPS 普通敌×1.08', vvNone.normalDps, arts(746) * 1.08 / 1.25, 0.01);
state.enemy.grade = 'elite';
const vvNoneElite = calculateOperator(vv, mkFor(vv, -1, 7));
check('薇薇安娜常态DPS 精英敌×1.16', vvNoneElite.normalDps, arts(746) * 1.16 / 1.25, 0.01);
state.enemy.grade = 'normal';
// S3 明灭:间隔 1.25+0.5=1.75,二连击×2, atk+85%(专一), dur15 → 8次×2连
const vv3 = calculateOperator(vv, mkFor(vv, 2, 7));
check('薇薇安娜S3 间隔1.75s', vv3.realInterval, 1.75, 0.01);
const vv3Atk = 746 * 1.85 * 1.08;  // atk 加攻 × 燃烛法伤乘区
check('薇薇安娜S3 二连击总伤(2连×8次)', vv3.skillTotalDamage, arts(vv3Atk) * 2 * Math.floor(15 / 1.75), 1);

// ===== 维娜·维多利亚(char_1019_siege2):S1 附加真伤 / S3 转真伤 =====
const sg = load('char_1019_siege2');
const sgRaw = sg.phases[2].atk[1] + sg.trustBonus.atk;  // 675+70=745
// 天赋1 诸王的叹息:atk+5% 需范围内友方单位(单目标默认无 → 不计,同条件天赋先例)
const sgNone = calculateOperator(sg, mkFor(sg, -1, 7));
check('维娜常态DPS(天赋不计)', sgNone.normalDps, arts(745) / 1.25, 0.01);
// S1: AUTO sp5 触发=普攻法伤+1.4×atk真伤(专一);cycle=(充能4普攻+触发普攻+真伤)/5s
const sg1 = calculateOperator(sg, mkFor(sg, 0, 7));
const sg1Arts = arts(745), sg1True = 745 * 1.4;
check('维娜S1 触发法伤=普攻', sg1.dmgTypes.arts.skillTotalDamage, sg1Arts);
check('维娜S1 触发真伤=1.4×atk', sg1.dmgTypes.true.skillTotalDamage, sg1True);
check('维娜S1 cycleDPS', sg1.cycleDps, ((Math.floor(5 / 1.25) + 1) * sg1Arts + sg1True) / 5, 0.01);
// S3: dur25 atk+170%(专一) 间隔 1.25-0.25=1.0 → 真伤 25击
const sg3 = calculateOperator(sg, mkFor(sg, 2, 7));
check('维娜S3 间隔1.0s', sg3.realInterval, 1.0, 0.01);
check('维娜S3 damageType=true', sg3.damageType, 'true');
const sg3Hit = 745 * 2.7;
check('维娜S3 总伤=真伤×25击', sg3.skillTotalDamage, sg3Hit * 25, 1);

// ===== 星极(char_274_astesi):天体仪满层攻速(1.25×100/125=1.0) =====
const as = load('char_274_astesi');
const asNone = calculateOperator(as, mkFor(as, -1, 7));
check('星极常态间隔 攻速+25→1.0s', asNone.realInterval, 1.0, 0.01);

console.log(`\n${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
