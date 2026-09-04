// 冲锋手(charger)验证:7人 通用技能/限时被动/混合伤害/概率天赋说明
import { calcPanelStats, calculateOperator, calcTalentAtkBonus } from '../../src/frontend/js/damage-calc.js';
import { calcArtsDamage, calcPhysicalDamage } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/PIONEER/charger/';
const load = n => JSON.parse(fs.readFileSync(B + n + '.json', 'utf8'));
const mk = (op, si) => {
  const e = Math.min(2, op.phases.length - 1);
  return { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7 };
};
const near = (a, b, eps = 8) => Math.abs(a - b) <= eps;
const A = atk => calcArtsDamage(atk, 50);
const P = atk => calcPhysicalDamage(atk, 600);
let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) pass++; else { fail++; console.log('FAIL: ' + name); } };

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

const ids = ['char_1036_fang2', 'char_192_falco', 'char_220_grani', 'char_222_bpipe', 'char_261_sddrag', 'char_290_vigna', 'char_496_wildmn'];
const ops = {};
for (const id of ids) ops[id] = load(id);
const L7 = (op, si) => { const ls = op.skills[si].levels; return ls[7] || ls[ls.length - 1]; };
const psOf = (op, si) => calcPanelStats(op, mk(op, si));
const taOf = op => calcTalentAtkBonus(op, mk(op, 0));
const skillAtkOf = (op, si) => {
  const ps = psOf(op, si);
  const ta = taOf(op);
  return (ps.panelAtk / (1 + ta)) * (1 + ta + (L7(op, si).atk || 0) + (L7(op, si)['attack@atk'] || 0));
};

check('冲锋手 7人数据在位', ids.every(id => ops[id] && ops[id].subProfessionId === 'charger'));

// ===== 历阵锐枪芬 =====
const fg = ops['char_1036_fang2'];
const fgPs = psOf(fg, 0);
// S1 贯敌刺枪 AUTO dur0:下次攻击 1.6×atk 二连击(MULTI×2),sp5 自然回 cycle
const fgS1 = calculateOperator(fg, mk(fg, 0));
check('芬S1 触发总伤=P(1.6atk)×2连', near(fgS1.skillTotalDamage, P(fgPs.panelAtk * L7(fg, 0).atk_scale) * 2));
check('芬S1 自然回周期存在(sp5)', fgS1.cycleDps !== null && fgS1.cycleDps > 0);
// S2 执守阵线 限时被动(PASSIVE dur19):部署自动生效 19s atk+100%(L7档)→按技能期19s计算,非永久常驻
const fgS2 = calculateOperator(fg, mk(fg, 1));
const fgS2Lv = L7(fg, 1);
check('芬S2 限时被动按技能期(dur19s)展示,总伤=P(2atk)×19击', near(fgS2.skillTotalDamage, P(fgPs.panelAtk * (1 + fgS2Lv.atk)) * Math.floor(fgS2Lv.skillDuration / 1.0), 15));
check('芬S2 不被永久入面板(总伤有限非全程)', fgS2.skillTotalDamage < P(fgPs.panelAtk * (1 + fgS2Lv.atk)) * 1000);

// ===== 翎羽(天赋 攻击提升 E1 +8%) =====
const fc = ops['char_192_falco'];
const fcPs = psOf(fc, 0);
const fcRaw = fc.phases[1].atk[1] + fc.trustBonus.atk;  // 3星 E1
check('翎羽 面板atk×1.08(攻击提升)', near(fcPs.panelAtk, fcRaw * 1.08, 2));
const fcS1 = calculateOperator(fc, mk(fc, 0));
const fcLv = L7(fc, 0);
const fcInt = 1.0 / (1 + (fcLv.attack_speed || 0) / 100);
check('翎羽S1 间隔=1/(1+攻速25)', near(fcS1.realInterval, fcInt, 0.01));
// 低 atk 干员取整误差大,期望用整数 raw 直接推
check('翎羽S1 总伤=P(raw×(1.08+atk))×N击', near(fcS1.skillTotalDamage, P(fcRaw * (1 + 0.08 + fcLv.atk)) * Math.floor(fcLv.skillDuration / fcInt), 20));

// ===== 格拉尼 =====
const gn = ops['char_220_grani'];
// S1 防御力强化·γ(纯防御 dur40)→归常态
const gnS1 = calculateOperator(gn, mk(gn, 0));
check('格拉尼S1 纯防御归常态', gnS1.skillDps === 0 && gnS1.skillTotalDamage === 0 && (gnS1.normalDps || 0) > 0);
// S2 永不后退 dur30 atk 加成普攻(攻击距离缩短/打阻挡所有单目标无差)
const gnS2 = calculateOperator(gn, mk(gn, 1));
check('格拉尼S2 总伤=P(skillAtk)×30击', near(gnS2.skillTotalDamage, P(skillAtkOf(gn, 1)) * 30));

// ===== 风笛 =====
const bp = ops['char_222_bpipe'];
const bpPs = psOf(bp, 0);
// S2 高效冲击 AUTO dur0:下次攻击 atk_scale 1.7(L7)替换普攻(额外攻击目标单目标无第二目标)
const bpS2 = calculateOperator(bp, mk(bp, 1));
check('风笛S2 单发=P(1.7atk)', near(bpS2.skillTotalDamage, P(bpPs.panelAtk * L7(bp, 1).atk_scale)));
check('风笛S2 自然回周期存在(sp5)', bpS2.cycleDps !== null && bpS2.cycleDps > 0);
// S3 闭膛连发 dur20 atk+100%(L7) 间隔+0.7→1.7s 三连击(MULTI×3)
const bpS3 = calculateOperator(bp, mk(bp, 2));
check('风笛S3 间隔1.7s(1.0+0.7)', near(bpS3.realInterval, 1.7, 0.01));
check('风笛S3 总伤=P(2atk)×3连×11击', near(bpS3.skillTotalDamage, P(bpPs.panelAtk * (1 + L7(bp, 2).atk)) * 3 * Math.floor(20 / 1.7), 15));

// ===== 苇草 =====
const wc = ops['char_261_sddrag'];
const wcPs = psOf(wc, 1);
// S2 生灵火花 dur27(L7档):atk 加成物理普攻 + 每击附加 0.35×技能期atk 法伤(物法双档)
const wcS2 = calculateOperator(wc, mk(wc, 1));
const wcLv = L7(wc, 1);
const wcHits = Math.floor(wcLv.skillDuration / 1.0);
const wcAdd = wcLv['attack@skill.atk_scale'] ?? 0;
const wcPhysHit = P(skillAtkOf(wc, 1));
const wcArtsHit = A(skillAtkOf(wc, 1) * wcAdd);
check('苇草S2 物理档=P(skillAtk)×27击(L7 dur)', near(wcS2.dmgTypes.physical.skillTotalDamage, wcPhysHit * wcHits, 15));
check('苇草S2 法伤档=A(skillAtk×0.35)×27击(每击附加)', near(wcS2.dmgTypes.arts.skillTotalDamage, wcArtsHit * wcHits, 15));
check('苇草S2 总伤=物+法', near(wcS2.skillTotalDamage, wcS2.dmgTypes.physical.skillTotalDamage + wcS2.dmgTypes.arts.skillTotalDamage));

// ===== 红豆 =====
const vg = ops['char_290_vigna'];
// S2 槌音 dur26(L7档) atk 加成 间隔+0.5→1.5s(BAT_ADD)
const vgS2 = calculateOperator(vg, mk(vg, 1));
check('红豆S2 间隔1.5s(1.0+0.5)', near(vgS2.realInterval, 1.5, 0.01));
check('红豆S2 总伤=P(skillAtk)×17击(26s/1.5)', near(vgS2.skillTotalDamage, P(skillAtkOf(vg, 1)) * Math.floor(L7(vg, 1).skillDuration / 1.5), 15));

// ===== 野鬃 =====
const wm = ops['char_496_wildmn'];
const wmPs = psOf(wm, 0);
// S1 骑枪刺击 限时被动(PASSIVE dur27 攻速+110):技能期27s 高速普攻(无atk加成),非永久
const wmS1 = calculateOperator(wm, mk(wm, 0));
const wmInt = 1.0 / (1 + (L7(wm, 0).attack_speed || 0) / 100);
check('野鬃S1 限时被动间隔=1/2.1=0.476s', near(wmS1.realInterval, wmInt, 0.01));
check('野鬃S1 总伤=P(atk)×56击(27s/0.476)', near(wmS1.skillTotalDamage, P(wmPs.panelAtk) * Math.floor(27 / wmInt), 12));
// S2 夹枪冲锋 dur20 atk+65%(L7)(范围扩大/推开不计)
const wmS2 = calculateOperator(wm, mk(wm, 1));
check('野鬃S2 总伤=P(skillAtk)×20击', near(wmS2.skillTotalDamage, P(skillAtkOf(wm, 1)) * 20));

console.log(`冲锋手验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
