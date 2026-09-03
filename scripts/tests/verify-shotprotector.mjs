// 哨戒铁卫（shotprotector）验证：涤火杰西卡/雷蛇/深巡/信仰搅拌机/机械师/闪击，interval 1.2s 物理
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { calcPhysicalDamage, calcArtsDamage, calcRealInterval } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/TANK/shotprotector/';
const load = n => JSON.parse(fs.readFileSync(B + n, 'utf8'));
const mk = (op, si) => {
  const e = Math.min(2, op.phases.length - 1);
  return { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7 };
};
const near = (a, b, eps = 1) => Math.abs(a - b) <= eps;
const P = atk => calcPhysicalDamage(atk, 600);
const A = atk => calcArtsDamage(atk, 50);
const rawOf = op => op.phases[Math.min(2, op.phases.length - 1)].atk[1] + (op.trustBonus.atk || 0);
let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name); } };

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

// ===== 涤火杰西卡 6★（盾牌属召唤物体系本轮不计；无 atk 天赋）=====
const jc = load('char_1034_jesca2.json');
const jRaw = rawOf(jc);
const jc1 = calculateOperator(jc, mk(jc, 0));
check('杰西卡S1 永续DPS=P(1.6atk)/1.2', near(jc1.skillDps, P(jRaw * 1.6) / 1.2));
const jc2 = calculateOperator(jc, mk(jc, 1));
check('杰西卡S2 间隔0.3s', near(jc2.realInterval, 0.3, 0.01));
check('杰西卡S2 总伤=P(1.65atk)×50击', near(jc2.skillTotalDamage, P(jRaw * 1.65) * Math.floor(15 / 0.3)));
const jc3 = calculateOperator(jc, mk(jc, 2));
check('杰西卡S3 间隔1.8s(BAT_ADD)', near(jc3.realInterval, 1.8, 0.01));
check('杰西卡S3 总伤=20发弹药+P(3.8atk×2.5)首炮', near(jc3.skillTotalDamage, P(jRaw * 3.8) * 20 + P(jRaw * 3.8 * 2.5)));

// ===== 雷蛇 5★ =====
const ls = load('char_107_liskam.json');
const lRaw = rawOf(ls);
const ls1 = calculateOperator(ls, mk(ls, 0));
check('雷蛇S1 纯防御归常态 normalDps=P(atk)/1.2', near(ls1.normalDps, P(lRaw) / 1.2));
const ls2 = calculateOperator(ls, mk(ls, 1));
check('雷蛇S2 法伤类型', ls2.damageType === 'arts');
check('雷蛇S2 间隔1.9s(BAT_ADD)', near(ls2.realInterval, 1.9, 0.01));
check('雷蛇S2 总伤=A(2.5atk)×10击', near(ls2.skillTotalDamage, A(lRaw * 2.5) * Math.floor(20 / 1.9)));

// ===== 深巡 5★（天赋 DOT 恒 80/s 法伤=40/s @res50）=====
const ud = load('char_4137_udflow.json');
const uRaw = rawOf(ud);
const dotDps = A(80);
const ud1 = calculateOperator(ud, mk(ud, 0));
check('深巡S1 常态DPS=P(atk)/1.2+dot', near(ud1.normalDps, P(uRaw) / 1.2 + dotDps));
check('深巡S1 物理总伤=P(1.42atk)×25击', near(ud1.dmgTypes.physical.skillTotalDamage, P(uRaw * 1.42) * Math.floor(30 / 1.2)));
check('深巡S1 DOT档总伤=dot×30s', near(ud1.dmgTypes.arts.skillTotalDamage, dotDps * 30));
const ud2 = calculateOperator(ud, mk(ud, 1));
check('深巡S2 物理总伤=P(1.43atk)×(15/间隔)', near(ud2.dmgTypes.physical.skillTotalDamage, P(uRaw * 1.43) * Math.floor(15 / (1.2 / 1.36))));
check('深巡S2 DOT档总伤=dot×15s', near(ud2.dmgTypes.arts.skillTotalDamage, dotDps * 15));

// ===== 信仰搅拌机 6★（天赋1 攻速不计入（用户口径）；天赋2 屏障不计）=====
const rm = load('char_4194_rmixer.json');
const rRaw = rawOf(rm);
const rm1 = calculateOperator(rm, mk(rm, 0));
check('搅拌机S1 受击AUTO 无周期', rm1.cycleDps === null);
check('搅拌机S1 单次=三连击3×P(1.7atk)', near(rm1.skillTotalDamage, 3 * P(rRaw * 1.7)));
const rm2 = calculateOperator(rm, mk(rm, 1));
check('搅拌机S2 总伤=P(2.2atk)×47发', near(rm2.skillTotalDamage, P(rRaw * 2.2) * 47));
const rm3 = calculateOperator(rm, mk(rm, 2));
check('搅拌机S3 停攻反击不计 skillDps=0', rm3.skillDps === 0 && rm3.skillTotalDamage === 0);

// ===== 机械师 6★（召唤物/冲锋口径召唤物轮）=====
const mc = load('char_4230_mcnist.json');
const mRaw = rawOf(mc);
const mc1 = calculateOperator(mc, mk(mc, 0));
check('机械师S1 间隔2.5s(1.3加算)', near(mc1.realInterval, 2.5, 0.01));
check('机械师S1 有攻回循环', mc1.cycleDps !== null && mc1.cycleDps > 0);
const mc2 = calculateOperator(mc, mk(mc, 1));
check('机械师S2 永续DPS=P(2.3atk)/1.2', near(mc2.skillDps, P(mRaw * 2.3) / 1.2));
const mc3 = calculateOperator(mc, mk(mc, 2));
check('机械师S3 法伤档=A(3.4×2.4atk)×11击(L7)', near(mc3.dmgTypes.arts.skillTotalDamage, A(mRaw * 3.4 * 2.4) * 11));
check('机械师S3 冲锋物理档=P(3.4×3atk)', near(mc3.dmgTypes.physical.skillTotalDamage, P(mRaw * 3.4 * 3)));
check('机械师S3 总伤=法伤+冲锋', near(mc3.skillTotalDamage, A(mRaw * 3.4 * 2.4) * 11 + P(mRaw * 3.4 * 3)));

// ===== 闪击 5★ =====
const bl = load('char_457_blitz.json');
const bRaw = rawOf(bl);
const bl1 = calculateOperator(bl, mk(bl, 0));
check('闪击S1 控制归常态 normalDps=P(atk)/1.2', near(bl1.normalDps, P(bRaw) / 1.2));
const bl2 = calculateOperator(bl, mk(bl, 1));
const stunInt = calcRealInterval(1.2, 300);
const stunAtt = Math.floor(6 / stunInt);
check('闪击S2 先手1.8+眩晕击×N', near(bl2.skillTotalDamage, P(bRaw * 1.8) + P(bRaw * 2.4) * stunAtt));

// ===== 召唤物独立查询（TOKEN/notchar1）=====
const TB = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/TOKEN/notchar1/';
const loadTok = n => JSON.parse(fs.readFileSync(TB + n, 'utf8'));
const shield = loadTok('token_10032_jesca2_jckshd.json');
const shCalc = calculateOperator(shield, { elite: 2, level: shield.phases[2].maxLevel, trustPercent: 0, potentialRank: 0, skillIndex: 0, skillLevel: 7 });
check('机动盾牌 无技能无输出', shield.skills.length === 0 && shield.ownerOperatorId === 'char_1034_jesca2');
check('机动盾牌 面板ATK=0', shCalc.panelAtk === 0);
const prn = loadTok('token_10069_mcnist_mcgraf.json');
const prCalc = calculateOperator(prn, { elite: 2, level: prn.phases[2].maxLevel, trustPercent: 0, potentialRank: 0, skillIndex: 0, skillLevel: 7 });
check('结构性原理 owner=机械师', prn.ownerOperatorId === 'char_4230_mcnist');
check('结构性原理 常态DPS=P(600)/1.5', near(prCalc.normalDps, P(600) / 1.5));
check('结构性原理 无技能', prn.skills.length === 0);

console.log(`\n哨戒铁卫验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
