// 疗养师(healer)子职业验证：清流(瞬抬+乘算间隔)/锡兰(默认天赋+触发+持续)/絮雨(攻回触发+永续)/诺威尔(常规+12sHOT)/流明(沐雨auraHOT+沛霖瞬抬)
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/MEDIC/healer/';
const load = p => JSON.parse(fs.readFileSync(BASE + p, 'utf8'));
let ok = true;
const check = (label, cond) => { if (!cond) ok = false; console.log(label + ': ' + (cond ? 'OK' : 'FAIL')); };
const near = (a, b, eps = 0.5) => Math.abs(a - b) < eps;

// ===== 清流 E2 满级 信赖100 无潜能 =====
const fin = load('char_385_finlpp.json');
const fBase = { elite: 2, level: 70, trustPercent: 100, potentialRank: 0, module: null };
const fPs = calcPanelStats(fin, fBase);
console.log('  清流 E2面板 ATK=' + fPs.panelAtk);
const f1 = calculateOperator(fin, { ...fBase, skillIndex: 0, skillLevel: 9 });
check('清流S1 治愈水波 单次瞬抬 = 面板×3.5', near(f1.totalHeal, fPs.panelAtk * 3.5));
check('清流S1 周期 HPS = (普攻20s+3.5面板)/20', near(f1.cycleHps, (fPs.panelAtk / 2.85 * 20 + fPs.panelAtk * 3.5) / 20));
const f2 = calculateOperator(fin, { ...fBase, skillIndex: 1, skillLevel: 9 });
console.log('  清流S2 涌泉: 间隔=' + f2.realInterval.toFixed(3) + 's 总治=' + f2.totalHeal.toFixed(0));
check('清流S2 间隔 = 2.85×0.12 = 0.342s（乘算）', near(f2.realInterval, 0.342, 1e-3));
check('清流S2 每次治疗 = 面板×0.5', near(f2.skillHps * f2.realInterval, fPs.panelAtk * 0.5));
check('清流S2 总治疗 = 0.5面板×floor(25/0.342)', near(f2.totalHeal, fPs.panelAtk * 0.5 * Math.floor(25 / 0.342)));

// ===== 锡兰 E2 满级（天赋默认档 +5%）=====
const cey = load('char_348_ceylon.json');
const cBase = { elite: 2, level: 80, trustPercent: 100, potentialRank: 0, module: null };
const cPs = calcPanelStats(cey, cBase);
const cWhite = cey.phases[2].atk[1] + cey.trustBonus.atk; // 满级白值 + 信赖100
console.log('  锡兰 E2面板 ATK=' + cPs.panelAtk + '（白值' + cWhite + '×1.05）');
check('锡兰天赋只取默认档 +5%（非水地形15%+）', near(cPs.panelAtk, cWhite * 1.05));
const c1 = calculateOperator(cey, { ...cBase, skillIndex: 0, skillLevel: 9 });
check('锡兰S1 集中式水疗 触发单次 = 技能期攻击×2', near(c1.totalHeal, c1.panelAtk * 2));
const c2 = calculateOperator(cey, { ...cBase, skillIndex: 1, skillLevel: 9 });
check('锡兰S2 技能期攻击 = 白值×1.65（天赋5%+技能60%）', near(c2.panelAtk, cWhite * 1.65, 1));
check('锡兰S2 总治疗 = 技能期攻击×floor(40/2.85)', near(c2.totalHeal, c2.panelAtk * Math.floor(40 / 2.85)));

// ===== 絮雨 E2（天赋HOT不算）=====
const whis = load('char_436_whispr.json');
const wBase = { elite: 2, level: 80, trustPercent: 100, potentialRank: 0, module: null };
const wPs = calcPanelStats(whis, wBase);
console.log('  絮雨 E2面板 ATK=' + wPs.panelAtk);
const w1 = calculateOperator(whis, { ...wBase, skillIndex: 0, skillLevel: 9 });
check('絮雨S1 攻回触发 触发单次 = 面板×1.3', near(w1.totalHeal, wPs.panelAtk * 1.3));
check('絮雨S1 周期HPS = (2普攻+0.3面板增量)/5.7s', near(w1.cycleHps, (wPs.panelAtk * 2 + wPs.panelAtk * 0.3) / 5.7));
const w2 = calculateOperator(whis, { ...wBase, skillIndex: 1, skillLevel: 9 });
console.log('  絮雨S2 永续: 间隔=' + w2.realInterval.toFixed(3) + 's HPS=' + w2.skillHps.toFixed(1));
check('絮雨S2 永续间隔 = 2.85-0.2 = 2.65s', near(w2.realInterval, 2.65, 1e-3));
check('絮雨S2 技能期HPS = 面板/2.65', near(w2.skillHps, wPs.panelAtk / 2.65));

// ===== 诺威尔 E2（天赋精准配镜不算）=====
const now = load('char_4173_nowell.json');
const nBase = { elite: 2, level: 80, trustPercent: 100, potentialRank: 0, module: null };
const nPs = calcPanelStats(now, nBase);
console.log('  诺威尔 E2面板 ATK=' + nPs.panelAtk);
const n1 = calculateOperator(now, { ...nBase, skillIndex: 0, skillLevel: 9 });
const n1Atk = nPs.panelAtk * 1.4; // atk+40%
const n1Int = 2.85 * 100 / 140;   // aspd+40
check('诺威尔S1 间隔 = 2.85×100/140', near(n1.realInterval, n1Int, 1e-3));
check('诺威尔S1 总治疗 = 技能期攻击×floor(30/间隔)', near(n1.totalHeal, n1Atk * Math.floor(30 / n1Int)));
const n2 = calculateOperator(now, { ...nBase, skillIndex: 1, skillLevel: 9 });
console.log('  诺威尔S2 HOT: totalHeal=' + n2.totalHeal.toFixed(0) + ' cycleHps=' + (n2.cycleHps || 0).toFixed(1));
check('诺威尔S2 12sHOT总量 = 面板×0.45×12', near(n2.totalHeal, nPs.panelAtk * 0.45 * 12));
check('诺威尔S2 周期HPS = (普攻32s+5.4面板)/32', near(n2.cycleHps, (nPs.panelAtk / 2.85 * 32 + nPs.panelAtk * 0.45 * 12) / 32));

// ===== 流明 E2（天赋不算）=====
const lum = load('char_4042_lumen.json');
const lBase = { elite: 2, level: 90, trustPercent: 100, potentialRank: 0, module: null };
const lPs = calcPanelStats(lum, lBase);
console.log('  流明 E2面板 ATK=' + lPs.panelAtk);
const l1 = calculateOperator(lum, { ...lBase, skillIndex: 0, skillLevel: 9 });
console.log('  流明S1 沐雨: totalHeal=' + l1.totalHeal.toFixed(0) + ' cycleHps=' + (l1.cycleHps || 0).toFixed(1));
check('流明S1 总治疗量 = 普攻 + HOT总量(面板×1 + 面板×0.55×5)', near(l1.totalHeal, lPs.panelAtk + lPs.panelAtk * 0.55 * 5));
check('流明S1 周期HPS 含普攻全程+HOT(不重复计触发普攻)', near(l1.cycleHps, (lPs.panelAtk / 2.85 * 16.4 + lPs.panelAtk * 0.55 * 5) / 16.4));
const l2 = calculateOperator(lum, { ...lBase, skillIndex: 1, skillLevel: 9 });
check('流明S2 沛霖 瞬抬 = 面板×2.6', near(l2.totalHeal, lPs.panelAtk * 2.6));
check('流明S2 周期HPS = (普攻13s+2.6面板)/13', near(l2.cycleHps, (lPs.panelAtk / 2.85 * 13 + lPs.panelAtk * 2.6) / 13));
const l3 = calculateOperator(lum, { ...lBase, skillIndex: 2, skillLevel: 9 });
console.log('  流明S3 灯火不灭: skillAtk=' + l3.panelAtk.toFixed(0) + ' 间隔=' + l3.realInterval.toFixed(3) + 's HPS=' + (l3.skillHps || 0).toFixed(1));
check('流明S3 永续开启 技能期攻击 = 面板×1.55（耗弹×2强化不计）', near(l3.panelAtk, lPs.panelAtk * 1.55, 1));
check('流明S3 间隔 = 2.85×100/130（攻速+30）', near(l3.realInterval, 2.85 * 100 / 130, 1e-3));
check('流明S3 技能期HPS = 技能期攻击/间隔（永续无限持续）', near(l3.skillHps, lPs.panelAtk * 1.55 / (2.85 * 100 / 130)));
check('流明S3 无总治疗量（永续开关型）', l3.totalHeal === null || l3.totalHeal === undefined);

console.log(ok ? '✅ 全部通过' : '❌ 存在失败');
process.exit(ok ? 0 : 1);
