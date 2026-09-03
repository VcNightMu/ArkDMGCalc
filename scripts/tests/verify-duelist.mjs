// 决战者（duelist）验证：森蚺/极光/洋灰，interval 1.6s 物理，单阻挡决战
import { calcPanelStats, calculateOperator, calcTalentDmgMul } from '../../src/frontend/js/damage-calc.js';
import { calcPhysicalDamage } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/TANK/duelist/';
const load = n => JSON.parse(fs.readFileSync(B + n, 'utf8'));
const mk = (op, si) => {
  const e = Math.min(2, op.phases.length - 1);
  return { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7 };
};
const near = (a, b, eps = 1) => Math.abs(a - b) <= eps;
const P = atk => calcPhysicalDamage(atk, 600);
let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name); } };

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

const zumama = load('char_416_zumama.json');
const aurora = load('char_422_aurora.json');
const cement = load('char_464_cement.json');
check('决战者 3人', [zumama, aurora, cement].every(o => o.subProfessionId === 'duelist'));
check('森蚺 天赋乘区=1.15(满血必触发)', near(calcTalentDmgMul(zumama, mk(zumama, -1)), 1.15));

// ===== 森蚺（天赋1 勇冠三军 ×1.15；S1 轻型挂斧 PASSIVE atk/def+20% 仅装备 S1 时常驻）=====
const zBase = zumama.phases[2].atk[1] + zumama.trustBonus.atk;   // 1077（无 passive）
const zMul = 1.15;
const zS1 = calculateOperator(zumama, mk(zumama, 0));
check('森蚺S1 被动面板atk×1.2', near(zS1.panelAtk, zBase * 1.2, 1));
check('森蚺S1 常态DPS=P(1.2atk)×1.15/1.6', near(zS1.normalDps, P(zBase * 1.2) * zMul / 1.6));
// S2 震慑劈砍：atk+145% 17s 间隔+0.4→2.0s，8击（装S2 时无 passive）
const zS2 = calculateOperator(zumama, mk(zumama, 1));
check('森蚺S2 间隔2.0s', near(zS2.realInterval, 2.0, 0.01));
check('森蚺S2 总伤=P(2.45atk)×1.15×8击', near(zS2.skillTotalDamage, P(zBase * (1 + 1.45)) * zMul * Math.floor(17 / 2.0)));
// S3 钢铁意志：atk+190% 33s 每秒回4%maxHp（自回通道）
const zS3 = calculateOperator(zumama, mk(zumama, 2));
check('森蚺S3 总伤=P(2.9atk)×1.15×20击', near(zS3.skillTotalDamage, P(zBase * (1 + 1.9)) * zMul * Math.floor(33 / 1.6)));
check('森蚺S3 自回HPS=4%maxHp/s', near(zS3.skillHps, zumama.phases[2].maxHp[1] * 0.04));

// ===== 极光（天赋 低温休憩 待机自回不计）=====
const aPs = calcPanelStats(aurora, mk(aurora, -1));
const aRaw = aurora.phases[2].atk[1] + aurora.trustBonus.atk;
// S1 固守家园：纯防御 dur30 普攻照常
const aS1 = calculateOperator(aurora, mk(aurora, 0));
check('极光S1 总伤=普攻×18击(30s/1.6)', near(aS1.skillTotalDamage, P(aPs.panelAtk) * Math.floor(30 / 1.6)));
// S2 人工降雪：9发弹药 间隔1.85s，6发普通(1.65atk)+3发暴击(3.1atk)
const aS2 = calculateOperator(aurora, mk(aurora, 1));
check('极光S2 间隔1.85s', near(aS2.realInterval, 1.85, 0.01));
const aNorm = P(aRaw * 1.65);
const aCrit = P(aRaw * 3.1);
check('极光S2 总伤=1.65atk×6+3.1atk×3', near(aS2.skillTotalDamage, aNorm * 6 + aCrit * 3));
check('极光S2 DPS=总伤/16.65s', near(aS2.skillDps, (aNorm * 6 + aCrit * 3) / 16.65));

// ===== 洋灰（天赋 图纸校正 减伤向不计）=====
const cPs = calcPanelStats(cement, mk(cement, -1));
const cRaw = cement.phases[2].atk[1] + cement.trustBonus.atk;
// S1 突破矿层：手动充能 sp8/3 一发 2.5atk（自然回周期折算）
const cS1 = calculateOperator(cement, mk(cement, 0));
check('洋灰S1 单发=2.5atk', near(cS1.skillTotalDamage, P(cRaw * 2.5)));
check('洋灰S1 有自然回周期', cS1.cycleDps !== null && cS1.cycleDps > 0);
// S2 结构加固：纯防御 dur60（开启与否对输出无影响）普攻照常 37击
const cS2 = calculateOperator(cement, mk(cement, 1));
check('洋灰S2 总伤=普攻×37击(60s/1.6)', near(cS2.skillTotalDamage, P(cPs.panelAtk) * Math.floor(60 / 1.6)));

console.log(`\n决战者验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
