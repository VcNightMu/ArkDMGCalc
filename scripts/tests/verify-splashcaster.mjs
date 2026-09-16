// 扩散术士(splashcaster)引擎验证:12F常态/炎狱炎熔S2火环周期/天火S2间隔增大+陨石改写/夕S3间隔增大/
// 莫S2荒时之锁周期/寒檀天赋+女巫之泪改写/复奏S2瞬发+DOT/莱恩哈特S2减抗/通用加攻与攻速通道
// 口径:M1档(levels[7]=游戏L8/专一),E2满级 trust100 pot0,敌人 def600 res50
// 法伤 A(x)=max(x*0.5, x*0.05);面板寒檀含天赋×1.15
import { calculateOperator, calcPanelStats } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DIR = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/CASTER/splashcaster/';
const load = n => JSON.parse(fs.readFileSync(DIR + n + '.json', 'utf8'));
const mkFor = (o, si, sl = 7, module = null, pot = 0) => {
  const ph = o.phases[o.phases.length - 1];
  return { elite: o.phases.length - 1, level: ph.maxLevel, trustPercent: 100, potentialRank: pot, skillIndex: si, skillLevel: sl, module };
};
const A = atk => Math.max(atk * 0.5, atk * 0.05);
const near = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;
let pass = 0, fail = 0;
const check = (name, actual, expect, eps = 0.5) => {
  const ok = typeof actual === 'string' || typeof expect === 'string' ? actual === expect : near(actual, expect, eps);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} actual=${actual} expect=${expect}`);
};

// ===== 12F:无技能常态 =====
const f2 = load('char_009_12fce');
const f2n = calculateOperator(f2, mkFor(f2, -1));
check('12F 常态DPS=A(atk)/2.9', f2n.normalDps, A(482) / 2.9, 0.01);

// ===== 炎熔:战术咏唱α(攻速+50) =====
const lv1 = load('char_121_lava');
const lv1s = calculateOperator(lv1, mkFor(lv1, 0));
check('炎熔S1 间隔=2.9×100/150', lv1s.realInterval, 2.9 * 100 / 150, 0.001);

// ===== 远山:S2 命运 atk+80% dur30 / S1 战术咏唱β =====
const fm = load('char_109_fmout');
const fmPs = calcPanelStats(fm, mkFor(fm, -1));
const fmS1 = calculateOperator(fm, mkFor(fm, 0));
check('远山S1 间隔=2.9×100/155', fmS1.realInterval, 2.9 * 100 / 155, 0.001);
const fmS2 = calculateOperator(fm, mkFor(fm, 1));
const fmHits = Math.floor(30 / 2.9);
check('远山S2 总伤=N击×A(atk×1.8)', fmS2.skillTotalDamage, fmHits * A(fmPs.panelAtk * 1.8), 1);

// ===== 天火:S2 天坠之火 间隔×1.7 + 每击 2.2×atk 改写 / S1 通用 =====
const sf = load('char_166_skfire');
const sfPs = calcPanelStats(sf, mkFor(sf, -1));
const sfS1 = calculateOperator(sf, mkFor(sf, 0));
check('天火S1 总伤=A(atk×1.75)×10击', sfS1.skillTotalDamage, A(sfPs.panelAtk * 1.75) * Math.floor(30 / 2.9), 1);
const sfS2 = calculateOperator(sf, mkFor(sf, 1));
check('天火S2 间隔增大=2.9×1.7', sfS2.realInterval, 2.9 * 1.7, 0.01);
const sfHits = Math.floor(33 / (2.9 * 1.7));
check('天火S2 每击=A(atk×2.2)×N击', sfS2.skillTotalDamage, sfHits * A(sfPs.panelAtk * 2.2), 1);

// ===== 莫斯提马:S2 荒时之锁 每秒1.3×atk×6跳 / S3 通用 =====
const mo = load('char_213_mostma');
const moPs = calcPanelStats(mo, mkFor(mo, -1));
const moS2 = calculateOperator(mo, mkFor(mo, 1));
check('莫S2 周期DOT 每秒1.3×atk×6跳', moS2.skillTotalDamage, 6 * A(moPs.panelAtk * 1.3), 1);
check('莫S2 跳间隔1s', moS2.realInterval, 1, 0.01);
const moS3 = calculateOperator(mo, mkFor(mo, 2));
check('莫S3 总伤=8击×A(atk×2.35)', moS3.skillTotalDamage, Math.floor(25 / 2.9) * A(moPs.panelAtk * 2.35), 1);

// ===== 格雷伊:S2 静电释放 攻速+70 =====
const gr = load('char_253_greyy');
const grS2 = calculateOperator(gr, mkFor(gr, 1));
check('格雷伊S2 间隔=2.9×100/170', grS2.realInterval, 2.9 * 100 / 170, 0.001);

// ===== 寒檀:天赋生于冰寒(驻场20s,atk+15%)+S2 女巫之泪(0.5s间隔,每击0.8×atk) =====
const sn = load('char_341_sntlla');
const snPs = calcPanelStats(sn, mkFor(sn, -1));
check('寒檀 面板含生于冰寒×1.15', snPs.panelAtk, 860 * 1.15, 0.5);
const snS2 = calculateOperator(sn, mkFor(sn, 1));
check('寒檀S2 间隔-2.4→0.5s', snS2.realInterval, 0.5, 0.001);
const snHits = Math.floor(15 / 0.5);
check('寒檀S2 每击0.8×atk×30跳', snS2.skillTotalDamage, snHits * A(snPs.panelAtk * 0.8), 1);
// Y 模组覆盖(生于冰寒 15s/atk+20%)
const snY = sn.modules.find(x => x.typeName2 === 'Y');
const snY3 = calcPanelStats(sn, mkFor(sn, -1, 7, { moduleId: snY.id, moduleLevel: 3 }));
check('寒檀Y3 天赋覆盖+20%', snY3.panelAtk, 930 * 1.2, 0.5);

// ===== 莱恩哈特:S2 解构与爆破(2.1×atk+减抗13%先效果再命中) =====
const lh = load('char_373_lionhd');
const lhPs = calcPanelStats(lh, mkFor(lh, -1));
const lhS2 = calculateOperator(lh, mkFor(lh, 1));
const lhBurst = Math.max(lhPs.panelAtk * 2.1 * (100 - 50 * 0.87) / 100, lhPs.panelAtk * 2.1 * 0.05);
check('莱恩S2 单发含减抗13%', lhS2.skillTotalDamage, lhBurst, 1);
check('莱恩S2 有cycle(充能周期)', lhS2.cycleDps !== null && lhS2.cycleDps > 0, true);

// ===== 炎狱炎熔:S1 通用 / S2 狱火之环 周期0.4×37跳 =====
const lv2 = load('char_1011_lava2');
const lv2Ps = calcPanelStats(lv2, mkFor(lv2, -1));
const lv2S1 = calculateOperator(lv2, mkFor(lv2, 0));
check('炎狱S1 总伤=A(atk×1.16)×N击', lv2S1.skillTotalDamage, Math.floor(32 / 2.9) * A(lv2Ps.panelAtk * 1.16), 1);
const lv2S2 = calculateOperator(lv2, mkFor(lv2, 1));
check('炎狱S2 火环 每秒0.4×atk×37跳', lv2S2.skillTotalDamage, 37 * A(lv2Ps.panelAtk * 0.4), 1);
check('炎狱S2 跳间隔1s', lv2S2.realInterval, 1, 0.01);

// ===== 夕:S1 AUTO cycle / S2 通用 / S3 间隔×1.4 =====
const dk = load('char_2015_dusk');
const dkPs = calcPanelStats(dk, mkFor(dk, -1));
const dkS1 = calculateOperator(dk, mkFor(dk, 0));
check('夕S1 触发单发=A(atk×2.2)', dkS1.skillTotalDamage, A(dkPs.panelAtk * 2.2), 1);
const dkS2 = calculateOperator(dk, mkFor(dk, 1));
check('夕S2 总伤=9击×A(atk×1.45)', dkS2.skillTotalDamage, Math.floor(18 / (2.9 * 100 / 145)) * A(dkPs.panelAtk * 1.45), 1);
const dkS3 = calculateOperator(dk, mkFor(dk, 2));
check('夕S3 间隔增大=2.9×1.4', dkS3.realInterval, 2.9 * 1.4, 0.01);
const dkHits = Math.floor(60 / (2.9 * 1.4));
check('夕S3 总伤=N击×A(atk×2.1)', dkS3.skillTotalDamage, dkHits * A(dkPs.panelAtk * 2.1), 1);

// ===== 复奏:S1 AUTO cycle / S2 瞬发1.7×+DOT 0.3×6s =====
const ri = load('char_4031_liesel');
const riPs = calcPanelStats(ri, mkFor(ri, -1));
const riS1 = calculateOperator(ri, mkFor(ri, 0));
check('复奏S1 触发单发=A(atk×1.9)', riS1.skillTotalDamage, A(riPs.panelAtk * 1.9), 1);
const riS2 = calculateOperator(ri, mkFor(ri, 1));
const riDot = 6 * A(riPs.panelAtk * 0.3);
check('复奏S2 总伤=1.7×单发+DOT6跳', riS2.skillTotalDamage, A(riPs.panelAtk * 1.7) + riDot, 1);

// ===== 莱恩哈特:碎片杀伤单层入表(用户口径:范围内敌人单目标默认 1 层)+X 模组每层 5% =====
const lhPs2 = calcPanelStats(lh, mkFor(lh, -1));
check('莱恩 面板含碎片杀伤单层4%', lhPs2.panelAtk, 863 * 1.04, 0.5);
const lhXm = lh.modules.find(x => x.typeName2 === 'X');
const lhXm3 = calcPanelStats(lh, mkFor(lh, -1, 7, { moduleId: lhXm.id, moduleLevel: 3 }));
check('莱恩X3 模组每层5%', lhXm3.panelAtk, 980, 0.5);

// ===== 玛露西尔:天赋1有魔力atk+20%(pot0)+三技能简化口径 =====
const mr = load('char_4141_marcil');
const mrRaw = 1024;  // E2 无天赋面板(914+trust110)
const mrPs = calcPanelStats(mr, mkFor(mr, -1));
check('玛露 面板含天赋1有魔力×1.2', mrPs.panelAtk, mrRaw * 1.2, 0.5);
const mrS1 = calculateOperator(mr, mkFor(mr, 0));
check('玛露S1 弹药40击总伤=40×A(2.2×raw)', mrS1.skillTotalDamage, 40 * A(mrRaw * 2.2), 1);
check('玛露S1 弹药DPS=总伤/116s', mrS1.skillDps, 40 * A(mrRaw * 2.2) / (40 * 2.9), 0.5);
check('玛露S1 间隔2.9(弹药期间)', mrS1.realInterval, 2.9, 0.01);
const mrS2 = calculateOperator(mr, mkFor(mr, 1));
check('玛露S2 永续DPS=A(2.0×raw)/1.933', mrS2.skillDps, A(mrRaw * 2.0) / (2.9 * 100 / 150), 0.5);
const mrS3 = calculateOperator(mr, mkFor(mr, 2));
check('玛露S3 满魔10爆×A(3.5×atk)', mrS3.skillTotalDamage, 10 * A(mrRaw * 1.2 * 3.5), 1);

// ===== 夕小自在召唤物(静态面板 398/1.9s 法伤,无技能常态) =====
const xz = JSON.parse(fs.readFileSync('F:/ArkCodes/ArkDMGCalc/src/frontend/data/TOKEN/notchar1/token_10015_dusk_drgn.json', 'utf8'));
const xzN = calculateOperator(xz, { elite: 2, level: 90, trustPercent: 0, potentialRank: 0, skillIndex: -1, skillLevel: 7, module: null });
check('小自在 常态DPS=A(398)/1.9法伤', xzN.normalDps, A(398) / 1.9, 0.01);

console.log(`\n扩散术士验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
