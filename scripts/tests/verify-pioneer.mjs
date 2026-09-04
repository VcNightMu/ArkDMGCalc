// 尖兵(pioneer)验证：16 人冲锋号令系归常态、瞬发/持续技能口径、天赋入表
import { calcPanelStats, calculateOperator, calcTalentAtkBonus } from '../../src/frontend/js/damage-calc.js';
import { calcArtsDamage, calcPhysicalDamage } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/PIONEER/pioneer/';
const load = n => JSON.parse(fs.readFileSync(B + n + '.json', 'utf8'));
const mk = (op, si) => {
  const e = Math.min(2, op.phases.length - 1);
  return { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7 };
};
const near = (a, b, eps = 6) => Math.abs(a - b) <= eps;
const A = atk => calcArtsDamage(atk, 50);
const P = atk => calcPhysicalDamage(atk, 600);
let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name); } };

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

const ids = ['char_102_texas', 'char_112_siege', 'char_115_headbr', 'char_123_fang', 'char_149_scave', 'char_198_blackd', 'char_240_wyvern', 'char_349_chiave', 'char_362_saga', 'char_4023_rfalcn', 'char_4026_vulpis', 'char_4188_confes', 'char_420_flamtl', 'char_488_buildr', 'char_502_nblade'];
const ops = {};
for (const id of ids) ops[id] = load(id);
const L7 = (op, si) => { const ls = op.skills[si].levels; return ls[7] || ls[ls.length - 1]; };
// 期望重建辅助：panelPs 面板攻击力(引擎口径,含天赋直接乘算)；rawAtk=panelAtk/(1+talentAtk)
const psOf = (op, si) => calcPanelStats(op, mk(op, si));
const talentAtkOf = op => calcTalentAtkBonus(op, mk(op, 0));
const skillAtkOf = (op, si) => {
  const ps = psOf(op, si);
  const ta = talentAtkOf(op);
  const lv = L7(op, si);
  return (ps.panelAtk / (1 + ta)) * (1 + ta + (lv.atk || 0) + (lv['attack@atk'] || 0));
};

check('尖兵 16人数据在位', ids.every(id => ops[id] && ops[id].subProfessionId === 'pioneer'));

// ===== 冲锋号令系(NORMAL_ATK 归常态) =====
const chargeOps = [['char_123_fang', 0], ['char_149_scave', 0], ['char_198_blackd', 0], ['char_198_blackd', 1], ['char_115_headbr', 0], ['char_102_texas', 0], ['char_112_siege', 0], ['char_349_chiave', 0], ['char_362_saga', 0], ['char_4023_rfalcn', 0], ['char_488_buildr', 0], ['char_420_flamtl', 0]];
for (const [id, si] of chargeOps) {
  const r = calculateOperator(ops[id], mk(ops[id], si));
  check(`${ops[id].name} S${si + 1} 归常态(技能期0伤+常态普攻)`, r.skillDps === 0 && r.skillTotalDamage === 0 && (r.normalDps || 0) > 0);
}

// ===== 香草(天赋 攻击提升 E1+ atk+8%) =====
const wy = ops['char_240_wyvern'];
const wyPs = psOf(wy, 0);
const wyRaw = wy.phases[1].atk[1] + wy.trustBonus.atk;
check('香草 面板atk×1.08(天赋最高档)', near(wyPs.panelAtk, wyRaw * 1.08, 2));
const wyS1 = calculateOperator(wy, mk(wy, 0));
check('香草S1 总伤=P(skillAtk)×9击', near(wyS1.skillTotalDamage, P(skillAtkOf(wy, 0)) * Math.floor(10 / 1.05), 8));
check('香草S1 DPS=总伤/10s', near(wyS1.skillDps, wyS1.skillTotalDamage / 10, 1));

// ===== 清道夫(单独行动者 E2潜0 atk/def+11%) =====
const sc = ops['char_149_scave'];
const scPs = psOf(sc, 0);
const scRaw = sc.phases[2].atk[1] + sc.trustBonus.atk;
check('清道夫 面板atk×1.11(E2潜0档)', near(scPs.panelAtk, scRaw * 1.11, 2));
const scS2 = calculateOperator(sc, mk(sc, 1));
check('清道夫S2 总伤=P(skillAtk)×14击', near(scS2.skillTotalDamage, P(skillAtkOf(sc, 1)) * Math.floor(15 / 1.05), 8));

// ===== 德克萨斯 S2 剑雨(两次×atk 法伤) =====
const tx = ops['char_102_texas'];
const txPs = psOf(tx, 1);
const txS2 = calculateOperator(tx, mk(tx, 1));
check('剑雨 总伤=2段法伤', near(txS2.skillTotalDamage, A(txPs.panelAtk * L7(tx, 1).atk_scale) * 2));
check('剑雨 类型=arts', txS2.damageType === 'arts');
check('剑雨 自然回周期存在', txS2.cycleDps !== null && txS2.cycleDps > 0);

// ===== 推进之王(万兽之王 E2潜0 atk/def+8%) =====
const sg = ops['char_112_siege'];
const sgPs = psOf(sg, 0);
const sgRaw = sg.phases[2].atk[1] + sg.trustBonus.atk;
check('推进之王 面板atk×1.08(E2潜0档)', near(sgPs.panelAtk, sgRaw * 1.08, 2));
const sgS2 = calculateOperator(sg, mk(sg, 1));
check('跃空锤 单发=P(atk×3倍档)', near(sgS2.skillTotalDamage, P(sgPs.panelAtk * L7(sg, 1).atk_scale)));
check('跃空锤 周期DPS存在', sgS2.cycleDps !== null && sgS2.cycleDps > 0);
const sgS3 = calculateOperator(sg, mk(sg, 2));
const sgS3Lv = L7(sg, 2);
check('碎颅击 间隔2.05s', near(sgS3.realInterval, 2.05, 0.01));
const sgS3Hits = Math.floor(sgS3Lv.skillDuration / 2.05);
check('碎颅击 总伤=改写倍率×N击', near(sgS3.skillTotalDamage, P(sgPs.panelAtk * sgS3Lv['attack@atk_scale']) * sgS3Hits, 8));
check('碎颅击 DPS=总伤/技能时长', near(sgS3.skillDps, sgS3.skillTotalDamage / sgS3Lv.skillDuration, 3));

// ===== 凛冬 S2 乌萨斯战吼 =====
const hb = ops['char_115_headbr'];
const hbS2 = calculateOperator(hb, mk(hb, 1));
check('乌萨斯战吼 总伤=P(skillAtk)×9击', near(hbS2.skillTotalDamage, P(skillAtkOf(hb, 1)) * Math.floor(10 / 1.05), 8));

// ===== 贾维 S2 火焰剥离(法伤瞬发) =====
const cv = ops['char_349_chiave'];
const cvPs = psOf(cv, 1);
const cvS2 = calculateOperator(cv, mk(cv, 1));
check('火焰剥离 单发=A(atk×倍率)', near(cvS2.skillTotalDamage, A(cvPs.panelAtk * L7(cv, 1).atk_scale)));
check('火焰剥离 类型=arts', cvS2.damageType === 'arts');

// ===== 嵯峨 =====
const sa = ops['char_362_saga'];
const saPs = psOf(sa, 1);
const saS2 = calculateOperator(sa, mk(sa, 1));
check('除恶 单发=P(atk×倍率)', near(saS2.skillTotalDamage, P(saPs.panelAtk * L7(sa, 1).atk_scale)));
const saS3 = calculateOperator(sa, mk(sa, 2));
check('怒目 间隔1.55s', near(saS3.realInterval, 1.55, 0.01));
check('怒目 总伤=P(skillAtk)×12击', near(saS3.skillTotalDamage, P(skillAtkOf(sa, 2)) * Math.floor(20 / 1.55), 8));
check('怒目 半血追加不计(单段)', near(saS3.skillTotalDamage, saS3.dmgTypes.physical.skillTotalDamage));

// ===== 红隼 S2 醉刃乱舞 =====
const rf = ops['char_4023_rfalcn'];
const rfS2 = calculateOperator(rf, mk(rf, 1));
const rfLv = L7(rf, 1);
const rfInterval = 1.05 / (1 + (rfLv.attack_speed || 0) / 100);
check('醉刃乱舞 间隔=1.05/(1+攻速)', near(rfS2.realInterval, rfInterval, 0.01));
check('醉刃乱舞 总伤=P(skillAtk)×N击', near(rfS2.skillTotalDamage, P(skillAtkOf(rf, 1)) * Math.floor(15 / rfInterval), 8));

// ===== 忍冬 =====
const vp = ops['char_4026_vulpis'];
const vpPs = psOf(vp, 0);
const vpS1 = calculateOperator(vp, mk(vp, 0));
check('小施惩戒 物理档=当次普攻', near(vpS1.dmgTypes.physical.skillTotalDamage, P(vpPs.panelAtk)));
check('小施惩戒 法伤档=extra_damage_ratio×atk', near(vpS1.dmgTypes.arts.skillTotalDamage, A(vpPs.panelAtk * L7(vp, 0).extra_damage_ratio)));
check('小施惩戒 法伤分档cycle存在', vpS1.dmgTypes.arts.cycleDps !== null && vpS1.dmgTypes.arts.cycleDps > 0);
const vpS2 = calculateOperator(vp, mk(vp, 1));
check('坠刃拷问 单发=A(atk×倍率)', near(vpS2.skillTotalDamage, A(vpPs.panelAtk * L7(vp, 1).atk_scale)));
check('坠刃拷问 类型=arts', vpS2.damageType === 'arts');
const vpS3 = calculateOperator(vp, mk(vp, 2));
check('隐狐之艺 间隔0.553s(攻速平均+90覆盖)', near(vpS3.realInterval, 0.5526, 0.01));
check('隐狐之艺 总伤=P(skillAtk)×18击', near(vpS3.skillTotalDamage, P(skillAtkOf(vp, 2)) * Math.floor(10 / 0.5526), 8));

// ===== 焰尾 =====
const fl = ops['char_420_flamtl'];
const flPs = psOf(fl, 1);
const flS2 = calculateOperator(fl, mk(fl, 1));
check('红松林 总伤=2段物伤', near(flS2.skillTotalDamage, P(flPs.panelAtk * L7(fl, 1).atk_scale) * 2));
const flS3 = calculateOperator(fl, mk(fl, 2));
check('焰心 间隔0.735s(×0.7 乘算)', near(flS3.realInterval, 0.735, 0.01));
check('焰心 总伤=P(skillAtk)×10击', near(flS3.skillTotalDamage, P(skillAtkOf(fl, 2)) * Math.floor(8 / 0.735), 8));

// ===== 青枳 S2 工程者之愿(数据 isPermanent → 永续DPS) =====
const bd = ops['char_488_buildr'];
const bdS2 = calculateOperator(bd, mk(bd, 1));
check('工程者之愿 永续DPS展示(总伤0)', bdS2.skillDps > 0 && bdS2.skillTotalDamage === 0);
check('工程者之愿 永续标记', bdS2.isPermanent === true);

// ===== 无技能干员 =====
for (const id of ['char_502_nblade', 'char_4188_confes']) {
  const r = calculateOperator(ops[id], mk(ops[id], 0));
  check(`${ops[id].name} 常态DPS正常`, (r.normalDps || 0) > 0 && r.skillTotalDamage === 0);
}

console.log(`尖兵验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
