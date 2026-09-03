// 驭法铁卫（artsprotector）验证：特性=技能开启时普攻变法术伤害（常态物理）
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { calcArtsDamage, calcPhysicalDamage } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/TANK/artsprotector/';
const load = n => JSON.parse(fs.readFileSync(B + n + '.json', 'utf8'));
const mk = (op, si, sl) => {
  const e = Math.min(2, op.phases.length - 1);
  return { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: sl };
};
const near = (a, b, eps = 0.8) => Math.abs(a - b) <= eps;
const A = (atk) => calcArtsDamage(atk, 50);   // res50 → ×0.5
const P = (atk) => calcPhysicalDamage(atk, 600);
let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name); } };

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

const ids = ['char_260_durnar','char_378_asbest','char_4025_aprot2','char_4047_pianst','char_1044_hsgma2'];
const ops = ids.map(load);
for (const o of ops) check(`${o.name} 驭法铁卫`, o.subProfessionId === 'artsprotector');
check('驭法铁卫 5人全在', ops.length === 5);

const dn = load('char_260_durnar');    // 坚雷 4★
const ab = load('char_378_asbest');    // 石棉 5★
const ap = load('char_4025_aprot2');   // 暮落 5★
const pn = load('char_4047_pianst');   // 车尔尼 5★
const hs = load('char_1044_hsgma2');   // 斩业星熊 6★
const ps = op => calcPanelStats(op, mk(op, -1, 7));
const sk = (op, si) => calculateOperator(op, mk(op, si, 7));

// ===== 坚雷：天赋攻守兼备 atk/def+7% 常驻入表 =====
const dPs = ps(dn);
const dRaw = dn.phases[2].atk[1] + dn.trustBonus.atk;
check('坚雷 面板atk含天赋×1.07', near(dPs.panelAtk, dRaw * 1.07, 1));
// S1 攻击强化·β atk+60% dur25：技能期法伤
const dS1 = sk(dn, 0);
check('坚雷S1 技能期伤害=法术(特性)', dS1.damageType === 'arts');
check('坚雷S1 总伤=1.67atk法伤×15击', near(dS1.skillTotalDamage, A(dS1.panelAtk) * Math.floor(25 / 1.6)));
check('坚雷S1 常态DPS=物理(特性不改常态)', near(dS1.normalDps, P(dPs.panelAtk) / 1.6));
// S2 起盾回击 atk+60% dur30 受击：无周期
const dS2 = sk(dn, 1);
check('坚雷S2 总伤=1.67atk法伤×18击(受击dur无周期)', near(dS2.skillTotalDamage, A(dS2.panelAtk) * Math.floor(30 / 1.6)) && (dS2.cycleDps === null || dS2.cycleDps === undefined));

// ===== 石棉：S1 固守纯防御(普攻照常法伤)；S2 火电 atk+70% 间隔增大+0.4→2.0s =====
const aPs = ps(ab);
const aS1 = sk(ab, 0);
check('石棉S1 总伤=常态法伤×12击(20s/1.6)', near(aS1.skillTotalDamage, A(aPs.panelAtk) * 12));
const aS2 = sk(ab, 1);
check('石棉S2 间隔2.0s(1.6+0.4增大)', near(aS2.realInterval, 2.0, 0.01));
check('石棉S2 总伤=1.7atk法伤×23击(47s/2.0)', near(aS2.skillTotalDamage, A(aS2.panelAtk) * 23));

// ===== 暮落：S1 速战速决 间隔-0.35→1.25s；S2 燃命狂欢 0.7×6连发 受击dur =====
const aPS = ps(ap);
const apS1 = sk(ap, 0);
check('暮落S1 间隔1.25s(1.6-0.35)', near(apS1.realInterval, 1.25, 0.01));
check('暮落S1 总伤=法伤×20击(26s/1.25)', near(apS1.skillTotalDamage, A(aPS.panelAtk) * 20));
const apS2 = sk(ap, 1);
check('暮落S2 每击=0.7×6连发法伤', near(apS2.skillTotalDamage, A(aPS.panelAtk) * 0.7 * 6 * Math.floor(20 / 1.6)));
check('暮落S2 无周期(受击回复)', apS2.cycleDps === null || apS2.cycleDps === undefined);

// ===== 车尔尼：S1 atk+60%；S2 受击叠攻默认0层+结束2.1atk法伤爆炸 =====
const pPs = ps(pn);
const pS1 = sk(pn, 0);
check('车尔尼S1 总伤=1.6atk法伤×19击', near(pS1.skillTotalDamage, A(pS1.panelAtk) * Math.floor(31 / 1.6)));
const pS2 = sk(pn, 1);
const pS2Atk = pPs.panelAtk;                              // 无叠攻 → 常态面板
const pS2Norm = A(pS2Atk) * Math.floor(20 / 1.6);          // 普攻 12 击
const pS2Burst = A(pS2Atk * 2.1);                          // 结束爆炸
check('车尔尼S2 技能期普攻=常态法伤(叠攻0层)', near(pS2.skillTotalDamage, pS2Norm + pS2Burst));
check('车尔尼S2 总伤含结束2.1atk爆炸', pS2.skillTotalDamage > pS2Norm);

// ===== 斩业星熊：S1 常驻(受击触发即开无限) atk+60% 法伤；S2 投盾不计算；S3 二连击 atk+190% =====
const hPs = ps(hs);
const hS1 = sk(hs, 0);
check('斩业S1 常驻DPS=1.6atk法伤/1.6s', near(hS1.skillDps, A(hS1.panelAtk) / 1.6));
const hS2 = sk(hs, 1);
check('斩业S2 不计算(投盾系):技能期0伤害', hS2.skillDps === 0 && hS2.skillTotalDamage === 0);
check('斩业S2 常态DPS展示', hS2.normalDps > 0);
const hS3 = sk(hs, 2);
check('斩业S3 总伤=2.9atk法伤×2连击×20攻击', near(hS3.skillTotalDamage, A(hS3.panelAtk) * 2 * Math.floor(32 / 1.6)));
check('斩业S3 技能期法术', hS3.damageType === 'arts');

console.log(`\n驭法铁卫验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
