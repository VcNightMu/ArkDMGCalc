// 策士(counsellor)引擎验证:凛御银灰(S1回费归常态/S2瞬发AOE/S3直线普攻改写) + 松桐(S1回费归常态/S2前缀键atk+自回)
import { calculateOperator, calcPanelStats } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/PIONEER/counsellor/';
const load = n => JSON.parse(fs.readFileSync(B + n + '.json', 'utf8'));
const mkFor = (o, si, sl, elite = 2, pot = 0) => ({ elite, level: o.phases[elite].maxLevel, trustPercent: 100, potentialRank: pot, skillIndex: si, skillLevel: sl });
const P = atk => Math.max(atk - 600, atk * 0.05);   // 物理 600 防
let pass = 0, fail = 0;
const check = (name, actual, expect, eps = 0.5) => {
  const ok = typeof actual === 'string' || typeof expect === 'string'
    ? actual === expect
    : Math.abs(actual - expect) <= eps;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} actual=${actual} expect=${expect}`);
};

// ===== 凛御银灰(char_1045_svash2) 6★策士 =====
const sv = load('char_1045_svash2');
const svPs = calcPanelStats(sv, mkFor(sv, 0, 7));
const svAtk = 653;  // E2 满级 trust100: 618+35
check('凛御面板 atk=653', svPs.panelAtk, svAtk, 0.01);
check('凛御攻击间隔 1.2s', svPs.realInterval ?? svPs.baseAttackTime, 1.2, 0.01);
// 天赋2 雪境先驱(满层翻倍):E2 潜0 def+60×2=120(基础 397+trust40=437 → 557),每秒回 1.5%×2=3% 最大生命
check('凛御面板 def=557(雪境先驱满层+120)', svPs.panelDef, 557, 0.5);
// S1 周旋的谋略(AUTO 纯回费):归常态普攻
const sv1 = calculateOperator(sv, mkFor(sv, 0, 7));
check('凛御S1 技能期总伤=0', sv1.skillTotalDamage, 0);
check('凛御S1 cycleDps=null', sv1.cycleDps, null);
check('凛御S1 常态DPS=P(atk)/1.2', sv1.normalDps, P(svAtk) / 1.2, 0.01);
check('凛御S1 常态HPS=3%×maxHp(雪境先驱)', sv1.normalHps, 0.03 * svPs.panelHp, 1);
// S2 御敌的锋锐(MANUAL 瞬发 3.4×atk 物理,自然回 sp17):cycle 含充能期普攻
const sv2 = calculateOperator(sv, mkFor(sv, 1, 7));
const sv2Hit = svAtk * 3.4;                        // 专一档 340%
check('凛御S2 单发总伤=P(3.4×atk)', sv2.skillTotalDamage, P(sv2Hit), 1);
const sv2Cycle = (Math.floor(17 / 1.2) * P(svAtk) + P(sv2Hit)) / 17;
check('凛御S2 cycleDPS(含充能普攻)', sv2.cycleDps, sv2Cycle, 0.5);
// S3 变革已至(MANUAL dur48):普攻×bird_atk_scale 1.8 × 脆弱 damage_scale 1.25(必吃到)→40 击直线
const sv3 = calculateOperator(sv, mkFor(sv, 2, 7));
const sv3Hit = P(svAtk * 1.8 * 1.25);
check('凛御S3 总伤=40击×P(1.8×1.25×atk)', sv3.skillTotalDamage, sv3Hit * 40, 2);
check('凛御S3 DPS=总伤/48', sv3.skillDps, sv3Hit * 40 / 48, 1);

// ===== 松桐(char_4199_makiri) 5★策士 =====
const mk = load('char_4199_makiri');
const mkPs = calcPanelStats(mk, mkFor(mk, 0, 7));
const mkAtk = 650;  // E2 满级 trust100: 600+50
check('松桐面板 atk=650', mkPs.panelAtk, mkAtk, 0.01);
// S1 入场安排(AUTO 纯回费):归常态
const mk1 = calculateOperator(mk, mkFor(mk, 0, 7));
check('松桐S1 技能期总伤=0', mk1.skillTotalDamage, 0);
check('松桐S1 常态DPS=P(atk)/1.2', mk1.normalDps, P(mkAtk) / 1.2, 0.01);
// S2 万手成局(MANUAL dur15 atk+60% 前缀键 + 每秒 8% 最大生命自回)
const mk2 = calculateOperator(mk, mkFor(mk, 1, 7));
const mk2Hit = P(mkAtk * 1.6);
const mk2Hits = Math.floor(15 / 1.2);
check('松桐S2 总伤=12击×P(1.6×atk)', mk2.skillTotalDamage, mk2Hit * mk2Hits, 2);
check('松桐S2 DPS=总伤/15', mk2.skillDps, mk2Hit * mk2Hits / 15, 1);
check('松桐S2 技能期HPS=8%×maxHp', mk2.skillHps, 0.08 * mkPs.panelHp, 1);
check('松桐S2 总治疗=HPS×15', mk2.totalHeal, 0.08 * mkPs.panelHp * 15, 2);

console.log(`\n${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
