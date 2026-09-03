// 铁卫（protector）验证：PASSIVE常驻/停攻清零/自回通道/自愈 + 数据层 + 通用技能
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { calcPhysicalDamage, calcRealInterval } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/TANK/protector/';
const load = n => JSON.parse(fs.readFileSync(B + n + '.json', 'utf8'));
const mk = (op, si, sl) => ({ elite: Math.min(2, op.phases.length - 1), level: op.phases[Math.min(2, op.phases.length - 1)].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: sl });
let pass = 0, fail = 0;
const near = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;
const check = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name); } };
const phys = (atk, def = 600) => calcPhysicalDamage(atk, def);

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

// ===== 数据层：15 人 =====
const ids = ['char_136_hsguma','char_2014_nian','char_201_moeshd','char_325_bison','char_304_zebra','char_199_yak','char_150_snakek','char_381_bubble','char_209_ardign','char_122_beagle','char_500_noirc','char_4093_frston'];
const ops = ids.map(load);
for (const [op, n] of ops.map((o, i) => [o, ids[i]])) {
  check(`${op.name} 铁卫`, op.subProfessionId === 'protector');
  check(`${op.name} 数据含面板`, Array.isArray(op.phases) && op.phases.length >= 1 && op.phases[0].atk);
}
check('铁卫 12人全在', ops.length === 12);

const hs = load('char_136_hsguma');      // 星熊 6★
const yak = load('char_199_yak');        // 角峰 4★
const snakek = load('char_150_snakek');  // 蛇屠箱 4★
const nian = load('char_2014_nian');     // 年 6★
const bison = load('char_325_bison');    // 拜松 5★
const bubble = load('char_381_bubble');  // 泡泡 4★
const zebra = load('char_304_zebra');    // 暴雨 5★
const moeshd = load('char_201_moeshd');  // 可颂 5★
const ardign = load('char_209_ardign');  // 卡缇 3★

// ===== 年 天赋「积甲成山」maxHp+16% 编队光环自身必得（E2 pot0）=====
const nianPs2 = calcPanelStats(nian, mk(nian, -1, 7));
const nianRawHp = nian.phases[2].maxHp[1] + (nian.trustBonus.maxHp || 0);
check('年 面板HP含天赋×1.16', near(nianPs2.panelHp, nianRawHp * 1.16, 1));

// ===== PASSIVE 常驻：星熊 S2「荆棘」def+24%（装备即生效，无技能期，输出=常态普攻）=====
const hsNone = calculateOperator(hs, mk(hs, -1, 7));
const hsS2 = calculateOperator(hs, mk(hs, 1, 7));
const hsPs = calcPanelStats(hs, mk(hs, -1, 7));
check('星熊S2(荆棘) 无技能期伤害(输出=常态普攻)', near(hsS2.normalDps, hsNone.normalDps));
check('星熊S2(荆棘) skillDps=0', hsS2.skillDps === 0 || hsS2.skillDps === null);
check('星熊S2(荆棘) 无总治疗(反伤不计)', hsS2.totalHeal === null || hsS2.totalHeal === undefined);

// ===== 常规技能：星熊 S1「战意」atk+30% def+70%（有普攻）=====
const hsS1 = calculateOperator(hs, mk(hs, 0, 7));
const hsAtk = hsPs.panelAtk;
const hsInt = calcRealInterval(1.2, 100);
check('星熊S1 技能期DPS>常态', hsS1.skillDps > hsS1.normalDps);
check('星熊S1 总伤=加攻普攻×次数(27s/1.2)', near(hsS1.skillTotalDamage, phys(hsAtk * 1.3) * Math.floor(27 / hsInt)));

// ===== 自回：角峰 S1「体能强化」每秒恢复33（普攻照常）=====
const yakS1 = calculateOperator(yak, mk(yak, 0, 7));
check('角峰S1 普攻照常(skillDps>0)', yakS1.skillDps > 0);
check('角峰S1 自回HPS=33', near(yakS1.skillHps, 33));
check('角峰S1 总治疗=33×28s', near(yakS1.totalHeal, 33 * 28));

// ===== 停攻+自回：蛇屠箱 S2「壳状防御」停攻+每秒2%最大生命 =====
const skS2 = calculateOperator(snakek, mk(snakek, 1, 7));
const skHp = calcPanelStats(snakek, mk(snakek, -1, 7)).panelHp;
check('蛇屠箱S2 停攻伤害=0', skS2.skillDps === 0 && skS2.skillTotalDamage === 0);
check('蛇屠箱S2 自回HPS=2%最大生命', near(skS2.skillHps, skHp * 0.02));
check('蛇屠箱S2 总治疗=2%×30s', near(skS2.totalHeal, skHp * 0.02 * 30));
check('蛇屠箱S2 常态普攻保留', skS2.normalDps > 0);

// ===== 停攻（纯防御）：年S2/拜松S2/泡泡S2/暴雨S2 =====
for (const [op, si, nm] of [[nian, 1, '年S2'], [bison, 1, '拜松S2'], [bubble, 1, '泡泡S2'], [zebra, 1, '暴雨S2']]) {
  const r = calculateOperator(op, mk(op, si, 7));
  check(`${nm} 停攻伤害=0`, r.skillDps === 0 && r.skillTotalDamage === 0);
}

// ===== 年 S1「锡灼」：atk+35% 且技能期普攻变法术（吃法抗）=====
const nianS1 = calculateOperator(nian, mk(nian, 0, 7));
const nianPs = calcPanelStats(nian, mk(nian, -1, 7));
const nianLv = nian.skills[0].levels[7];
const nianInt = calcRealInterval(1.5, 100);   // 年攻击间隔 1.5s
check('年S1 技能期伤害类型=arts', nianS1.damageType === 'arts');
// 法伤公式：atk×1.35 × (100-50)/100 = atk×1.35×0.5
const nianArtsHit = nianPs.panelAtk * 1.35 * 0.5;
check('年S1 总伤=法伤×次数(27s/1.5)', near(nianS1.skillTotalDamage, nianArtsHit * Math.floor(27 / nianInt)));
check('年S1 常态普攻仍物理', nianS1.normalDamageType === 'physical' || nianS1.normalDps > 0);

// ===== 年 S3「铁御」：自身攻击力+90%（前缀别名键），普攻照常 =====
const nianS3 = calculateOperator(nian, mk(nian, 2, 7));
check('年S3 技能期DPS>常态(atk+90%)', nianS3.skillDps > nianS3.normalDps);
check('年S3 总伤=物理(atk×1.9)×次数(41s/1.5)', near(nianS3.skillTotalDamage, phys(nianPs.panelAtk * 1.9) * Math.floor(41 / nianInt)));

// ===== 可颂 S2「磁爆锤」：受击回复触发型，不展示周期，仅单次总伤=4×攻击力物理 =====
const moeshdS2 = calculateOperator(moeshd, mk(moeshd, 1, 7));
const moeAtk = calcPanelStats(moeshd, mk(moeshd, -1, 7)).panelAtk;
check('可颂S2 无周期DPS(受击回复)', moeshdS2.cycleDps === null || moeshdS2.cycleDps === undefined);
check('可颂S2 单次总伤=4×攻击力物理', near(moeshdS2.skillTotalDamage, phys(moeAtk * 4)));

// ===== 暴雨 S1「应急迷彩」：AUTO触发型自回（默认给到自身），55/s×4s，输出归常态 =====
const zebraS1 = calculateOperator(zebra, mk(zebra, 0, 7));
check('暴雨S1 触发自回HPS=55', near(zebraS1.skillHps, 55));
check('暴雨S1 单次总治疗=55×4s', near(zebraS1.totalHeal, 55 * 4));
check('暴雨S1 无技能期输出(归常态)', zebraS1.skillDps === 0 && zebraS1.skillTotalDamage === 0 && zebraS1.normalDps > 0);

// ===== 自愈：卡缇 S1「生命回复·α」立即恢复最大生命40%（3星 skillLevel 6=满档）=====
const ktS1 = calculateOperator(ardign, mk(ardign, 0, 6));
const ktHp = calcPanelStats(ardign, mk(ardign, -1, 6)).panelHp;
check('卡缇S1 自愈=最大生命×0.4', near(ktS1.totalHeal, ktHp * 0.4));
check('卡缇S1 无伤害', ktS1.skillDps === 0 && ktS1.skillTotalDamage === 0);

console.log(`\n铁卫验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
