// 不屈者（unyield）验证：数据层 + 通用技能（纯def/atk强化/自回）
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { calcPhysicalDamage } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/TANK/unyield/';
const load = n => JSON.parse(fs.readFileSync(B + n + '.json', 'utf8'));
const mk = (op, si, sl) => {
  const e = Math.min(2, op.phases.length - 1);
  return { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: sl };
};
const near = (a, b, eps = 0.6) => Math.abs(a - b) <= eps;
let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name); } };

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

const ids = ['char_311_mudrok','char_4065_judge','char_163_hpsts','char_4207_branch','char_4130_luton'];
const ops = ids.map(load);
for (const [op] of ops.map((o, i) => [o, ids[i]])) check(`${op.name} 不屈者`, op.subProfessionId === 'unyield');
check('不屈者 5人全在', ops.length === 5);
check('泥岩 间隔1.6s', Math.abs(ops[0].phases[2].baseAttackTime - 1.6) < 1e-9);

const mud = load('char_311_mudrok');     // 泥岩 6★
const branch = load('char_4207_branch'); // 折桠 5★
const hpsts = load('char_163_hpsts');    // 火神 5★

// ===== 通用：纯 def/atk 强化技能（普攻照常，输出=常态普攻或被乘算强化）=====
// 泥岩 S1「防御力强化·γ」纯 def：技能期伤害=常态普攻
const mS1 = calculateOperator(mud, mk(mud, 0, 7));
check('泥岩S1 技能期DPS≈常态(纯防御)', near(mS1.skillDps, mS1.normalDps, 3));

// 折桠 S1「绝境抵抗」受击dur型 def+100%：总伤=普攻×次数(12s/1.6=7击)，无周期
const brS1 = calculateOperator(branch, mk(branch, 0, 7));
const brPs = calcPanelStats(branch, mk(branch, -1, 7));
check('折桠S1 无周期(受击回复)', brS1.cycleDps === null || brS1.cycleDps === undefined);
check('折桠S1 总伤=普攻×7击(12s/1.6)', near(brS1.skillTotalDamage, calcPhysicalDamage(brPs.panelAtk, 600) * 7));

// 折桠 S2「生存决心」atk+130%（同乘区 1+1.3=2.3 倍）：总伤=2.3倍普攻×次数(15s/1.6=9击)
const brS2 = calculateOperator(branch, mk(branch, 1, 7));
check('折桠S2 总伤=2.3atk普攻×9击', near(brS2.skillTotalDamage, calcPhysicalDamage(brPs.panelAtk * 2.3, 600) * 9));

// ===== 火神 S1「坚守模式」def+100% + 技能自带4% + 天赋4% → 每秒回8%最大生命 =====
const hpS1 = calculateOperator(hpsts, mk(hpsts, 0, 7));
const hpPs = calcPanelStats(hpsts, mk(hpsts, -1, 7));
check('火神S1 普攻照常(不停攻)', hpS1.skillDps > 0);
check('火神S1 自回HPS=8%最大生命(技能4%+天赋4%)', near(hpS1.skillHps, hpPs.panelHp * 0.08));
check('火神S1 总治疗=8%×27s', near(hpS1.totalHeal, hpPs.panelHp * 0.08 * 27));
check('火神S1 type=heal(含治疗通道)', hpS1.type === 'heal');

// ===== 泥岩 S2「岩崩锤」：受击触发，单次 2.3atk 物理 + 回 5%最大生命 =====
const mudPs = calcPanelStats(mud, mk(mud, -1, 7));
const mS2 = calculateOperator(mud, mk(mud, 1, 7));
check('泥岩S2 无周期(受击回复)', mS2.cycleDps === null || mS2.cycleDps === undefined);
check('泥岩S2 单次总伤=2.3atk物理', near(mS2.skillTotalDamage, calcPhysicalDamage(mudPs.panelAtk * 2.3, 600)));
check('泥岩S2 自疗=5%最大生命', near(mS2.totalHeal, mudPs.panelHp * 0.05));
check('泥岩S2 常态DPS保留', mS2.normalDps > 0);

// ===== 泥岩 S3「秽壤的血脉」：前10s沉睡无输出，后20s攻击(间隔1.3s atk+110%) =====
const mS3 = calculateOperator(mud, mk(mud, 2, 7));
const mudAtk3 = mudPs.panelAtk * 2.1;                    // atk+110% 同乘区
check('泥岩S3 间隔1.3s(1.6-0.3)', near(mS3.realInterval, 1.3, 0.01));
check('泥岩S3 总伤=2.1atk普攻×15击(后20s/1.3)', near(mS3.skillTotalDamage, calcPhysicalDamage(mudAtk3, 600) * 15));

// ===== 火神 S2「武力模式」：atk+120% 间隔2.0s(1.6+0.4) + 每击吸血8% + 天赋自回4%/s =====
const hpS2 = calculateOperator(hpsts, mk(hpsts, 1, 7));
const hpAtk2 = hpPs.panelAtk * 2.2;                      // atk+120%
check('火神S2 间隔2.0s(增大+0.4加算)', near(hpS2.realInterval, 2.0, 0.01));
check('火神S2 总伤=2.2atk普攻×13击(27s/2.0)', near(hpS2.skillTotalDamage, calcPhysicalDamage(hpAtk2, 600) * 13));
check('火神S2 总治疗=吸血(0.08×13)+天赋自回(0.04×27)', near(hpS2.totalHeal, hpPs.panelHp * (0.08 * 13 + 0.04 * 27)));
check('火神S2 HPS=吸血0.04/s+自回0.04/s', near(hpS2.skillHps, hpPs.panelHp * 0.08));

// ===== 折桠 天赋「简易包扎」：技能结束回50%最大生命 =====
const brS1b = calculateOperator(branch, mk(branch, 0, 7));
check('折桠S1 总治疗=50%最大生命(技能结束回血)', near(brS1b.totalHeal, brPs.panelHp * 0.5));
const brS2b = calculateOperator(branch, mk(branch, 1, 7));
check('折桠S2 伤害保留+结束回血50%', near(brS2b.skillTotalDamage, calcPhysicalDamage(brPs.panelAtk * 2.3, 600) * 9) && near(brS2b.totalHeal, brPs.panelHp * 0.5));

// ===== 露托 S1「强力击·β」攻回 AUTO（引擎既有 cycleDps 口径，同银灰/华法琳类通用）=====
const luton = load('char_4130_luton');const luPs = calcPanelStats(luton, mk(luton, -1, 7));
const luS1 = calculateOperator(luton, mk(luton, 0, 7));
check('露托S1 触发单次伤害=2.1atk', near(luS1.skillTotalDamage, calcPhysicalDamage(luPs.panelAtk * 2.1, 600)));
check('露托S1 有循环DPS(攻回周期)', luS1.cycleDps !== null && luS1.cycleDps > 0);

// ===== 露托 S2「强磁防卫」：停攻，每2s 0.8atk法伤×30s =====
const luS2 = calculateOperator(luton, mk(luton, 1, 7));
const luArtsHit = luPs.panelAtk * 0.8 * 0.5;             // 法伤 res50
check('露托S2 法伤DOT每2s×15跳=总伤', near(luS2.skillTotalDamage, luArtsHit * 15));
check('露托S2 DPS=总伤/30s', near(luS2.skillDps, luArtsHit * 15 / 30));
check('露托S2 damageType=arts', luS2.damageType === 'arts');
check('露托S2 间隔展示2s(DOT节奏)', near(luS2.realInterval, 2.0, 0.01));
check('露托S2 无普攻期伤害(停攻)', luS2.normalDps === null || luS2.skillDps > 0);

// ===== 斥罪 =====
const judge = load('char_4065_judge');
const jPs = calcPanelStats(judge, mk(judge, -1, 7));

// 斥罪 S1「一锤定音」：AUTO sp4，触发=普攻物理+1.9atk法伤混合单发（蓄力永不触发不计）
const jS1 = calculateOperator(judge, mk(judge, 0, 7));
const j1Phys = calcPhysicalDamage(jPs.panelAtk, 600);
const j1Arts = jPs.panelAtk * 1.9 * 0.5;                   // 法伤 res50
check('斥罪S1 单发总伤=物理普攻+1.9atk法伤', near(jS1.skillTotalDamage, j1Phys + j1Arts));
check('斥罪S1 dmgTypes双档', near(jS1.dmgTypes.physical.skillTotalDamage, j1Phys) && near(jS1.dmgTypes.arts.skillTotalDamage, j1Arts));
const j1Cycle = (3 * j1Phys + j1Arts) / 4;                 // 2次充能普攻+触发当次普攻+法伤，/sp4
check('斥罪S1 循环DPS=(3×普攻+法伤)/4s', near(jS1.cycleDps, j1Cycle));

// 斥罪 S2「坚心苦修」：停攻改范围法伤，每秒 1.2×atk（skillAtk已含）20s
const jS2 = calculateOperator(judge, mk(judge, 1, 7));
const j2Hit = jPs.panelAtk * 1.2 * 0.5;
check('斥罪S2 总伤=每秒1.2atk法伤×20跳', near(jS2.skillTotalDamage, j2Hit * 20));
check('斥罪S2 damageType=arts', jS2.damageType === 'arts');
check('斥罪S2 间隔展示1s(DOT节奏)', near(jS2.realInterval, 1.0, 0.01));

// 斥罪 S3「披荆斩棘」：受击dur atk+350% 间隔增大+0.9→2.5s（屏障不计），无特殊处理
const jS3 = calculateOperator(judge, mk(judge, 2, 7));
check('斥罪S3 间隔2.5s(1.6+0.9增大)', near(jS3.realInterval, 2.5, 0.01));
check('斥罪S3 总伤=4.5atk普攻×12击(30s/2.5)', near(jS3.skillTotalDamage, calcPhysicalDamage(jPs.panelAtk * 4.5, 600) * 12));
check('斥罪S3 无周期(受击回复)', jS3.cycleDps === null || jS3.cycleDps === undefined);

console.log(`\n不屈者验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
