// 情报官(agent)验证:线性模拟(伊内丝S2攻速逐击/寻澜S2偷防/谜图S2叠层DOT) + 伊内丝偷攻天赋 + 晓歌弹药/攻速
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { calcPhysicalDamage, calcArtsDamage, calcRealInterval } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/PIONEER/agent/';
const load = n => JSON.parse(fs.readFileSync(B + n + '.json', 'utf8'));
const mk = (op, si, elite = 2) => ({ elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7 });
const P = atk => calcPhysicalDamage(atk, 600);
const A = atk => calcArtsDamage(atk, 50);
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else { fail++; console.log('FAIL: ' + name + (extra ? ' => ' + extra : '')); } };
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

// ===== 伊内丝(6★):偷攻天赋必然生效(E2 +90,伤害含白值不含) =====
const ines = load('char_4087_ines');
const inesPs = calcPanelStats(ines, mk(ines, 0));
check('伊内丝 白值面板不含偷攻(639)', inesPs.panelAtk === 639, String(inesPs.panelAtk));
// S1 淬影突袭:触发普攻 P(729)+DOT 3跳 A(0.65×729)
const in1 = calculateOperator(ines, mk(ines, 0));
const in1Phys = P(729), in1Dot = A(729 * 0.65) * 3;
check('伊内丝S1 触发普攻含偷攻 P(729)', Math.abs(in1.dmgTypes.physical.skillTotalDamage - in1Phys) <= 1, `${in1.dmgTypes.physical.skillTotalDamage} vs ${in1Phys}`);
check('伊内丝S1 DOT=3跳A(0.65×729)', Math.abs(in1.dmgTypes.arts.skillTotalDamage - in1Dot) <= 1, `${in1.dmgTypes.arts.skillTotalDamage} vs ${in1Dot}`);
check('伊内丝S1 cycleDps(4击周期)', Math.abs(in1.cycleDps - (4 * in1Phys + in1Dot) / 4) <= 0.5, String(in1.cycleDps));
check('伊内丝 常态DPS含偷攻 P(729)/1s', Math.abs(in1.normalDps - in1Phys) <= 0.5, String(in1.normalDps));
// S2 暗夜无明:线性攻速爬升 17击 × P(729×1.9)(锁定回归值)
const in2 = calculateOperator(ines, mk(ines, 1));
const in2Hit = P(729 * 1.9);
check('伊内丝S2 线性模拟 17击×P(729×1.9)', Math.abs(in2.skillTotalDamage - in2Hit * 17) <= 1, `${in2.skillTotalDamage} vs ${in2Hit * 17}`);
check('伊内丝S2 DPS=总/12s', Math.abs(in2.skillDps - in2.skillTotalDamage / 12) <= 0.1);
// S3 独影归途:普攻14击×P(729×2.4)+影哨单发 P(729×2.4×1.6)
const in3 = calculateOperator(ines, mk(ines, 2));
const in3Norm = P(729 * 2.4) * 14, in3Flag = P(729 * 2.4 * 1.6);
check('伊内丝S3 普攻14击+P影哨单发(1.6×)', Math.abs(in3.skillTotalDamage - (in3Norm + in3Flag)) <= 2, `${in3.skillTotalDamage} vs ${in3Norm + in3Flag}`);

// ===== 寻澜(5★):S1 限时被动 / S2 偷防线性(600→375,14击) =====
const sur = load('char_4052_surfer');
const sur1 = calculateOperator(sur, mk(sur, 0));
check('寻澜S1 限时被动18s atk+80%', Math.abs(sur1.skillTotalDamage - P(600 * 1.8) * 18) <= 2, String(sur1.skillTotalDamage));
const sur2 = calculateOperator(sur, mk(sur, 1));
let expSur = 0; for (let k = 0; k < 14; k++) expSur += calcPhysicalDamage(600, 600 - Math.min(225, 45 * k));
check('寻澜S2 偷防线性 14击 def逐降', Math.abs(sur2.skillTotalDamage - expSur) <= 2, `${sur2.skillTotalDamage} vs ${expSur}`);

// ===== 谜图(5★):S1 攻回单发 / S2 攻速+DOT叠层(普攻13击+DOT整秒层跳) =====
const pz = load('char_4017_puzzle');
const pz1 = calculateOperator(pz, mk(pz, 0));
check('谜图S1 攻回触发 2.5×atk', Math.abs(pz1.skillTotalDamage - P(606 * 2.5)) <= 1, String(pz1.skillTotalDamage));
const pz2 = calculateOperator(pz, mk(pz, 1));
const pz2Int = calcRealInterval(1.0, 163);
const pz2Hits = Math.floor(8 / pz2Int);
check('谜图S2 13击普攻(攻速+63)', Math.abs(pz2.dmgTypes.physical.skillTotalDamage - P(606) * pz2Hits) <= 1, `${pz2.dmgTypes.physical.skillTotalDamage} vs ${P(606) * pz2Hits}`);
let expDot = 0;
const tEndP = (pz2Hits - 1) * pz2Int + 16;
for (let sec = 1; sec <= Math.ceil(tEndP); sec++) {
  let layers = 0;
  for (let i = 0; i < pz2Hits; i++) if (i * pz2Int < sec && sec <= i * pz2Int + 16) layers = Math.min(10, i + 1);
  if (layers > 0) expDot += A(606 * 0.13 * layers);
}
check('谜图S2 DOT叠层整秒跳', Math.abs(pz2.dmgTypes.arts.skillTotalDamage - expDot) <= 2, `${pz2.dmgTypes.arts.skillTotalDamage} vs ${expDot}`);

// ===== 晓歌(5★):天赋万全攻速档 / S1 限时被动 / S2 弹药16发 =====
const xg = load('char_497_ctable');
const xgPs = calcPanelStats(xg, mk(xg, 0));
check('晓歌 E2 万全攻速+12 → 间隔0.893', Math.abs(xgPs.attackInterval - calcRealInterval(1.0, 112)) <= 0.01, String(xgPs.attackInterval));
const xg1 = calculateOperator(xg, mk(xg, 0));
check('晓歌S1 观火 18s atk+80%', Math.abs(xg1.skillTotalDamage - P(590 * 1.8) * Math.floor(18 / (1 / 1.12))) <= 3, String(xg1.skillTotalDamage));
const xg2 = calculateOperator(xg, mk(xg, 1));
const xg2Int = calcRealInterval(1.0, 100 + 38 + 12);
check('晓歌S2 浮光 16发×P(590×1.32)', Math.abs(xg2.skillTotalDamage - P(590 * 1.32) * 16) <= 2, `${xg2.skillTotalDamage} vs ${P(590 * 1.32) * 16}`);
check('晓歌S2 弹药间隔0.667(38+12攻速)', Math.abs(xg2.realInterval - xg2Int) <= 0.01);

// ===== 冬时(4★):天赋条件苛刻不生效 / S1 攻回 / S2 攻速普攻 =====
const ds = load('char_4208_wintim');
const dsPs = calcPanelStats(ds, mk(ds, 0));
check('冬时 天赋疾笔撰录默认不生效(间隔1.0)', Math.abs(dsPs.attackInterval - 1.0) <= 0.01, String(dsPs.attackInterval));
const ds1 = calculateOperator(ds, mk(ds, 0));
check('冬时S1 攻回 2.3×atk', Math.abs(ds1.skillTotalDamage - P(537 * 2.3)) <= 1, String(ds1.skillTotalDamage));
const ds2 = calculateOperator(ds, mk(ds, 1));
const ds2Int = calcRealInterval(1.0, 130);
const ds2Exp = P(537) * Math.floor(9 / ds2Int);
check('冬时S2 攻速+30 dur9 普攻', Math.abs(ds2.skillTotalDamage - ds2Exp) <= 1, `${ds2.skillTotalDamage} vs ${ds2Exp}`);

// ===== 齐尔查克(5★):S1 特殊回费归常态 / S2 攻速普攻 =====
const qz = load('char_4144_chilc');
const qz1 = calculateOperator(qz, mk(qz, 0));
check('齐尔查克S1 归常态(技能期0)', qz1.skillDps === 0 && qz1.skillTotalDamage === 0 && qz1.normalDps > 0);
const qz2 = calculateOperator(qz, mk(qz, 1));
const qz2Int = calcRealInterval(1.0, 154);
check('齐尔查克S2 攻速+54 dur10 普攻', Math.abs(qz2.skillTotalDamage - P(560) * Math.floor(10 / qz2Int)) <= 1, String(qz2.skillTotalDamage));

console.log(`情报官验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
