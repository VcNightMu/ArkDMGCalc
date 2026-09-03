// 守护者（guardian）验证：治疗模式型/急救族AUTO/治疗天赋倍率/特殊技能 + 数据层
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { calcPhysicalDamage, calcArtsDamage, calcRealInterval } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/TANK/guardian/';
const load = n => JSON.parse(fs.readFileSync(B + n + '.json', 'utf8'));
const mk = (op, si, sl) => {
  const e = Math.min(2, op.phases.length - 1);
  return { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: sl };
};
const near = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;
let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name); } };

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

const ids = ['char_202_demkni','char_423_blemsh','char_2025_shu','char_148_nearl','char_226_hmau','char_4109_baslin','char_4143_sensi','char_196_sunbr','char_284_spot'];
const ops = ids.map(load);
for (const [op] of ops.map((o, i) => [o, ids[i]])) check(`${op.name} 守护者`, op.subProfessionId === 'guardian');
check('守护者 9人全在', ops.length === 9);

const nearl = load('char_148_nearl');   // 临光 5★（治疗天赋×1.1）
const baslin = load('char_4109_baslin');// 深律 5★（无法伤抗天赋）
const hmau = load('char_226_hmau');     // 吽 5★（def天赋，heal_scale条件不计）
const sensi = load('char_4143_sensi');  // 森西 5★（def+heal 双天赋）
const sunbr = load('char_196_sunbr');   // 古米 4★（S2 前10s烹饪）
const spot = load('char_284_spot');     // 斑点 3★
const demkni = load('char_202_demkni'); // 塞雷娅 6★
const blemsh = load('char_423_blemsh'); // 瑕光 6★
const shu = load('char_2025_shu');      // 黍 6★

// ===== 治疗天赋入表 =====
const nPs = calcPanelStats(nearl, mk(nearl, -1, 7));
const sPs = calcPanelStats(sensi, mk(sensi, -1, 7));
const hPs = calcPanelStats(hmau, mk(hmau, -1, 7));
check('临光 治疗天赋×1.1（经急救族验证于下）', true);
check('森西 面板def含天赋×1.10', near(sPs.panelDef, (sensi.phases[2].def[1] + sensi.trustBonus.def) * 1.10, 1));
check('吽 面板def含天赋×1.06', near(hPs.panelDef, (hmau.phases[2].def[1] + hmau.trustBonus.def) * 1.06, 1));

// ===== A. 治疗模式型：临光 S2「急救模式」atk+60% dur40，间隔2.5s，停攻转治疗 =====
const nS2 = calculateOperator(nearl, mk(nearl, 1, 7));
const nearAtk = nPs.panelAtk;
const n2Single = nearAtk * 1.6 * 1.1;              // 技能期攻击力×100%×治疗天赋
check('临光S2 技能期无伤害(停攻转治疗)', nS2.skillDps === 0 && nS2.skillTotalDamage === 0);
check('临光S2 治疗HPS=1.6atk×1.1/2.5s', near(nS2.skillHps, n2Single / 2.5));
check('临光S2 总治疗=单次×16(40s/2.5)', near(nS2.totalHeal, n2Single * Math.floor(40 / 2.5)));
check('临光S2 type=heal', nS2.type === 'heal');

// ===== A. 斑点 S1「次级治疗模式」atk+45% dur25（3星 sl6，无治疗天赋）=====
const spS1 = calculateOperator(spot, mk(spot, 0, 6));
const spotAtk = calcPanelStats(spot, mk(spot, -1, 6)).panelAtk;
const spSingle = spotAtk * 1.45;
check('斑点S1 总治疗=1.45atk×10次(25s/2.5)', near(spS1.totalHeal, spSingle * 10));
check('斑点S1 治疗HPS', near(spS1.skillHps, spSingle / 2.5));

// ===== A. 古米 S2「食粮烹制」dur30 前10s烹饪(disarm)后20s治疗 atk+60% =====
const suS2 = calculateOperator(sunbr, mk(sunbr, 1, 7));
const sunAtk = calcPanelStats(sunbr, mk(sunbr, -1, 7)).panelAtk;
check('古米S2 总治疗=1.6atk×8次(仅后20s/2.5)', near(suS2.totalHeal, sunAtk * 1.6 * Math.floor(20 / 2.5)));

// ===== A. 吽 S2「反制医疗模式」atk+65% dur26（治疗天赋条件不计→×1.0）=====
const hS2 = calculateOperator(hmau, mk(hmau, 1, 7));
const hmauAtk = hPs.panelAtk;
check('吽S2 总治疗=1.65atk×10次(26s/2.5,无1.75条件加成)', near(hS2.totalHeal, hmauAtk * 1.65 * Math.floor(26 / 2.5)));

// ===== B. 急救族 AUTO：临光 S1 sp4 heal1.6×1.1 → normalHps；深律 S1 无天赋×1.0 对照 =====
const nS1 = calculateOperator(nearl, mk(nearl, 0, 7));
const bS1 = calculateOperator(baslin, mk(baslin, 0, 7));
const basAtk = calcPanelStats(baslin, mk(baslin, -1, 7)).panelAtk;
check('临光S1 周期治疗HPS=1.6atk×1.1/4s', near(nS1.normalHps, nearAtk * 1.6 * 1.1 / 4));
check('临光S1 普攻伤害归常态', nS1.normalDps > 0 && near(nS1.normalDps, calcPhysicalDamage(nearAtk, 600) / 1.2));
check('临光S1 type=heal(含normalHps)', nS1.type === 'heal');
check('深律S1 周期治疗HPS=1.6atk/4s(无天赋)', near(bS1.normalHps, basAtk * 1.6 / 4));

// ===== B. 塞雷娅 S2「药物配置」AUTO sp8 heal1.2 群奶 → 单目标口径 =====
const dS2 = calculateOperator(demkni, mk(demkni, 1, 7));
const demAtk = calcPanelStats(demkni, mk(demkni, -1, 7)).panelAtk;
check('塞雷娅S2 周期治疗HPS=1.2atk/8s', near(dS2.normalHps, demAtk * 1.2 / 8));

// ===== B. 吽 S1 受击回复（无自然周期）：仅单次触发量 =====
const hS1 = calculateOperator(hmau, mk(hmau, 0, 7));
check('吽S1 单次触发治疗=1.5atk(受击型无周期)', near(hS1.totalHeal, hmauAtk * 1.5));
check('吽S1 无周期HPS', hS1.normalHps === null || hS1.normalHps === undefined);

// ===== 塞雷娅 天赋1「莱茵充能护服」按满层：atk+25% def+20%（E2 pot0，单层×5）=====
const dPs = calcPanelStats(demkni, mk(demkni, -1, 7));
const dRaw = demkni.phases[2].atk[1] + demkni.trustBonus.atk;
const dRawDef = demkni.phases[2].def[1] + demkni.trustBonus.def;
check('塞雷娅 面板atk含满层天赋×1.25', near(dPs.panelAtk, dRaw * 1.25, 1));
check('塞雷娅 面板def含满层天赋×1.20', near(dPs.panelDef, dRawDef * 1.20, 1));

// ===== 塞雷娅 S3「钙质化」：技能期只会治疗，每秒 0.25×atk 范围HOT 24s =====
const dS3 = calculateOperator(demkni, mk(demkni, 2, 7));
const demAtkFull = dPs.panelAtk;
check('塞雷娅S3 无攻击伤害', dS3.skillDps === 0 && dS3.skillTotalDamage === 0);
check('塞雷娅S3 HOT每秒=0.25×满层atk', near(dS3.skillHps, demAtkFull * 0.25));
check('塞雷娅S3 总治疗=0.25×atk×24s', near(dS3.totalHeal, dS3.panelAtk * 0.25 * 24));

// ===== 瑕光 S1「光芒涌动」：AUTO双通道，触发2.3atk物理(sp4) + 1.3atk治疗 =====
const blS1 = calculateOperator(blemsh, mk(blemsh, 0, 7));
const blPs = calcPanelStats(blemsh, mk(blemsh, -1, 7));
check('瑕光S1 触发伤害周期DPS=2.3atk/4s', near(blS1.cycleDps, calcPhysicalDamage(blPs.panelAtk * 2.3, 600) / 4));
check('瑕光S1 触发治疗HPS=1.3atk/4s', near(blS1.normalHps, blPs.panelAtk * 1.3 / 4));

// ===== 瑕光 S2「慑敌辉光」：必睡→普攻×仁慈1.4；每秒0.18×技能atk HOT；受击无周期 =====
const blS2 = calculateOperator(blemsh, mk(blemsh, 1, 7));
const blAtk2 = blPs.panelAtk * 1.8;                       // atk+80%
const bl2Per = calcPhysicalDamage(blAtk2 * 1.4, 600);     // 仁慈 ×1.4（E2 pot0）
check('瑕光S2 无周期(受击回复)', blS2.cycleDps === null || blS2.cycleDps === undefined);
check('瑕光S2 总伤=1.8atk×仁慈1.4×8次(10s/1.2)', near(blS2.skillTotalDamage, bl2Per * Math.floor(10 / 1.2)));
check('瑕光S2 HOT每秒=0.18×技能atk', near(blS2.skillHps, blAtk2 * 0.18));
check('瑕光S2 总治疗=0.18×技能atk×10s', near(blS2.totalHeal, blAtk2 * 0.18 * 10));

// ===== 瑕光 S3「先贤化身」：每击物理+0.8atk法伤+治疗0.9atk；物法混合 =====
const blS3 = calculateOperator(blemsh, mk(blemsh, 2, 7));
const blAtk3 = blPs.panelAtk * 1.9;                       // atk+90%
const bl3Phys = calcPhysicalDamage(blAtk3, 600);
const bl3Arts = calcArtsDamage(blAtk3 * 0.8, 50);
const bl3N = Math.floor(27 / 1.2);                        // 22 击
check('瑕光S3 damageType=mixed', blS3.damageType === 'mixed');
check('瑕光S3 物伤拆分=每击物理×22', near(blS3.dmgTypes.physical.skillTotalDamage, bl3Phys * bl3N));
check('瑕光S3 法伤拆分=每击0.8atk法×22', near(blS3.dmgTypes.arts.skillTotalDamage, bl3Arts * bl3N));
check('瑕光S3 总治疗=0.9×技能atk×22', near(blS3.totalHeal, blAtk3 * 0.9 * bl3N));

// ===== 黍 S3「离离枯荣」：攻击+治疗双轨，自身吃播种e_atk/攻速增益 =====
const shuS3 = calculateOperator(shu, mk(shu, 2, 7));
const shuPs = calcPanelStats(shu, mk(shu, -1, 7));
const shuEff = shuPs.panelAtk * (1 + 0.38 + 0.2);         // atk+38% 且播种自身也+20%
const shuInt = calcRealInterval(1.2, 100 + 20);           // e_attack_speed+20 → 1.0s
const shuN = Math.floor(30 / shuInt);                     // 30 击
check('黍S3 总伤=每击物理×30(间隔1.0s)', near(shuS3.skillTotalDamage, calcPhysicalDamage(shuEff, 600) * shuN));
check('黍S3 总治疗=每击atk×30', near(shuS3.totalHeal, shuEff * shuN));
check('黍S3 间隔1.0s', near(shuS3.realInterval, 1.0, 0.01));

// ===== 森西 S2「团体魔物大餐」：停攻，每秒0.4atk×1.1 HOT 10s + 收尾1.6atk×1.1 =====
const seS2 = calculateOperator(sensi, mk(sensi, 1, 7));
const seAtk = sPs.panelAtk;
check('森西S2 停攻无伤害', seS2.skillDps === 0 && seS2.skillTotalDamage === 0);
check('森西S2 HOT每秒=0.4×atk×1.1', near(seS2.skillHps, seAtk * 0.4 * 1.1));
check('森西S2 总治疗=(0.4×10+1.6)×atk×1.1', near(seS2.totalHeal, (0.4 * 10 + 1.6) * seAtk * 1.1));

console.log(`\n守护者特殊验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);

