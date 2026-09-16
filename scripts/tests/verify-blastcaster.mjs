// 轰击术师(blastcaster)引擎断言 —— 干员:谬因/伊芙利特/阿罗玛/蚀清/协律
// 口径(用户 2026-09-16):
//  - 特性「攻击造成超远距离的群体法术伤害」:单目标模型按 1 个目标计;S2 类技能期间本体不再普攻
//  - 协律「律脉同构」加成对象为友方(不含自身) → 自身输出不吃,不入表
//  - 谬因「取样优化」无视 10(潜6 13) 法抗 → 入法穿表;「链路协议」按技能期才生效算(SKILL_TALENT_ATK_ONLY,中继器在场)
//  - 谬因 S2 光束 = 8s/0.5s = 16 跳,每跳 1.3×atk(专一);S3 弹药 20 发,经中继器额外 0.3×atk 法伤(吃满)
//  - 伊芙利特「精神融解」范围内敌军法抗 -40% 常驻计入;炎爆灼烧 3.01s×面板 33%;灼地 = 每秒 1.2×atk 持续场
//  - 阿罗玛浮空增伤(每敌首次)不计;蚀清 S1 技能后眩晕 10s/技能 30s → 该槽常态 ×2/3
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const idx = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
const byId = {};
for (const e of idx) byId[e.id] = e;

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else { fail++; console.log('FAIL: ' + name + (extra ? ' => ' + extra : '')); } };
const near = (a, b, tol = 0.02) => a !== null && a !== undefined && Math.abs(a - b) <= tol;
const A = (atk, res = 50) => atk * (1 - res / 100);

const load = (id) => {
  const e = byId[id];
  return JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8'));
};
const mk = (o, si, module = null) => {
  const elite = o.phases.length - 1;
  return { elite, level: o.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module };
};
const MOD = (o, moduleId, lv) => ({ moduleId, moduleLevel: lv });

// ============ 协律(天赋加成对象为友方,不含自身 → 不入表) ============
{
  const o = load('char_4051_akkord');
  const r0 = calculateOperator(o, mk(o, -1));
  check('协律 常态 = A(740)/2.9(天赋不含自身,面板 740)', near(r0.normalDps, A(740) / 2.9), `got ${r0.normalDps}`);
  const r1 = calculateOperator(o, mk(o, 0));
  check('协律 S1(AUTO sp9) 强化击 = A(740×180%)', near(r1.skillTotalDamage, A(740 * 1.8)), `got ${r1.skillTotalDamage}`);
  check('协律 S1 cycleDps = (3 次普攻 + 强化击)/9s', near(r1.cycleDps, (3 * A(740) + A(740 * 1.8)) / 9, 0.05), `got ${r1.cycleDps}`);
  check('协律 S1 常态行 = 无技能态', near(r1.normalDps, r0.normalDps), `got ${r1.normalDps}`);
  const r2 = calculateOperator(o, mk(o, 1));
  check('协律 S2 每击 = A(740×(1+0.5)) 且 32s 内 11 击(周围敌人段不计)', near(r2.skillTotalDamage, 11 * A(740 * 1.5)), `got ${r2.skillTotalDamage}`);
  check('协律 S2 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);
  const r0x = calculateOperator(o, mk(o, -1, MOD(o, 'uniequip_002_akkord', 2)));
  check('协律 X模组 L2 仅取模组常驻 atk+45(天赋不入表)', near(r0x.normalDps, A(740 + 45) / 2.9), `got ${r0x.normalDps}`);
}

// ============ 谬因 ============
{
  const o = load('char_4229_aphris');
  const r0 = calculateOperator(o, mk(o, -1));
  check('谬因 常态 = A(986,40)/2.9(取样优化法穿10)', near(r0.normalDps, A(986, 40) / 2.9), `got ${r0.normalDps}`);
  const r1 = calculateOperator(o, mk(o, 0));
  // 链路协议 +25% 仅技能期(SKILL_TALENT_ATK_ONLY):skillAtk = 986×(1+1.35)×1.25 → 技能期 DPS = A(该ATK,40)/2.9
  check('谬因 S1(永续) 技能期 DPS = A(986×(1+1.35)×1.25,40)/2.9', near(r1.skillDps, A(986 * 2.35 * 1.25, 40) / 2.9), `got ${r1.skillDps}`);
  check('谬因 S1(永续) 技能期 DPS = A(该ATK,40)/2.9', near(r1.skillDps, A(986 * 2.35 * 1.25, 40) / 2.9), `got ${r1.skillDps}`);
  check('谬因 S1 常态行 = 无技能态(链路协议不进常态行)', near(r1.normalDps, r0.normalDps), `got ${r1.normalDps}`);
  const r2 = calculateOperator(o, mk(o, 1));
  // S2 光束:8s/0.5s = 16 跳,每跳 A(986×1.3×1.25, 40)
  check('谬因 S2 光束 16 跳(8s÷0.5s)且不受普攻间隔限制', near(r2.skillTotalDamage, 16 * A(986 * 1.3 * 1.25, 40)), `got ${r2.skillTotalDamage}`);
  check('谬因 S2 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);
  const r3 = calculateOperator(o, mk(o, 2));
  // S3 弹药 20 发:每发 A(986×(1+1.25)×1.25×1.7) + A(986×(1+1.25)×1.25×0.3)(中继器吃满)
  const s3Base = 986 * 2.25 * 1.25;
  check('谬因 S3 弹药 20 发(每发含中继器额外 0.3×atk)', near(r3.skillTotalDamage, 20 * (A(s3Base * 1.7, 40) + A(s3Base * 0.3, 40))), `got ${r3.skillTotalDamage}`);
  check('谬因 S3 弹药槽:常态行保持 null', r3.normalDps === null, `got ${r3.normalDps}`);
}

// ============ 伊芙利特 ============
{
  const o = load('char_134_ifrit');
  const r0 = calculateOperator(o, mk(o, -1));
  check('伊芙利特 常态 = A(980,30)/2.9(精神融解 -40% 生效)', near(r0.normalDps, A(980, 30) / 2.9), `got ${r0.normalDps}`);
  const r1 = calculateOperator(o, mk(o, 0));
  check('伊芙利特 S1 攻速 +70 → 间隔 2.9/1.7', near(r1.realInterval, 2.9 * 100 / 170, 0.001), `got ${r1.realInterval}`);
  check('伊芙利特 S1 每击 A(980×1.2,30) 且 20s 内 11 击', near(r1.skillTotalDamage, Math.floor(20 / (2.9 * 100 / 170)) * A(980 * 1.2, 30)), `got ${r1.skillTotalDamage}`);
  const r2 = calculateOperator(o, mk(o, 1));
  check('伊芙利特 S2(炎爆 AUTO) = A(980×2.15,30) + 3.01×A(980×0.33,30)', near(r2.skillTotalDamage, A(980 * 2.15, 30) + 3.01 * A(980 * 0.33, 30)), `got ${r2.skillTotalDamage}`);
  check('伊芙利特 S2 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);
  const r3 = calculateOperator(o, mk(o, 2));
  check('伊芙利特 S3 灼地 每秒跳伤 A(980×1.2,17) 共 20 跳', near(r3.skillTotalDamage, 20 * A(980 * 1.2, 17)), `got ${r3.skillTotalDamage}`);
  check('伊芙利特 S3 技能期 DPS = 单跳值(每秒一跳)', near(r3.skillDps, A(980 * 1.2, 17), 0.05), `got ${r3.skillDps}`);
  check('伊芙利特 S3 常态行 = 无技能态(技能级减抗不污染常态行)', near(r3.normalDps, r0.normalDps), `got ${r3.normalDps}`);
  // 未装备模组：无元素损伤(Δ/D 模组专属)
  check('伊芙利特 未装备 Δ/D 模组时无元素损伤', near(r0.normalDps, A(980, 30) / 2.9), `got ${r0.normalDps}`);
}

// ============ 伊芙利特 Δ/D 模组「灼燃损伤」元素条 ============
{
  const o = load('char_134_ifrit');
  const D3 = MOD(o, 'uniequip_003_ifrit', 3);
  const r0 = calculateOperator(o, mk(o, -1, D3));
  // L3:atk+70、element_atk_scale 0.5;EP 每击 = 1050×0.5 = 525 → 2 击爆条,周期 = 2.9 + 10 = 12.9s,
  // 稳态元素 DPS = 7000/12.9 = 542.64;常态法伤再乘爆条窗口(法抗 30→10)加权修正 ≈ ×1.2214
  check('伊芙利特 D模L3 常态 = 法伤×窗口修正 + 元素 7000/12.9', near(r0.normalDps, 852.4058, 0.05), `got ${r0.normalDps}`);
  check('伊芙利特 D模L3 常态高于无窗口口径(爆条降抗期间按降低后法抗算)', r0.normalDps > A(1050, 30) / 2.9 + 7000 / (2.9 + 10), `got ${r0.normalDps}`);
  const r1 = calculateOperator(o, mk(o, 0, D3));
  check('伊芙利特 D模L3 S1 常态行 = 无技能态', near(r1.normalDps, r0.normalDps), `got ${r1.normalDps}`);
  check('伊芙利特 D模L3 S1 总伤 = 11 击法伤×窗口修正 + 2×7000', near(r1.skillTotalDamage, 25970, 0.5), `got ${r1.skillTotalDamage}`);
  const r2 = calculateOperator(o, mk(o, 1, D3));
  // 灼烧 3 跳同样造成损伤:强化击 EP 525 + 灼烧 3×525 → 第 2 跳爆条 1 次(仅靠强化击不足 1000)
  check('伊芙利特 D模L3 S2 总伤(灼烧跳伤损伤参与爆条) = 法伤×窗口修正 + 7000', near(r2.skillTotalDamage, 9518.44, 0.5), `got ${r2.skillTotalDamage}`);
  check('伊芙利特 D模L3 S2 已发生爆条(仅强化击 525 EP 不足以爆条)', r2.skillTotalDamage > 7000, `got ${r2.skillTotalDamage}`);
  const r3 = calculateOperator(o, mk(o, 2, D3));
  check('伊芙利特 D模L3 S3 总伤 = 20 跳(法抗 17)×窗口修正 + 2×7000', near(r3.skillTotalDamage, 39452, 0.5), `got ${r3.skillTotalDamage}`);
  check('伊芙利特 D模L3 S3 常态行 = 无技能态', near(r3.normalDps, r0.normalDps), `got ${r3.normalDps}`);
}

// ============ 阿罗玛 / 蚀清 ============
{
  const a = load('char_446_aroma');
  const a0 = calculateOperator(a, mk(a, -1));
  check('阿罗玛 常态 = A(840)/2.9(浮空增伤不计)', near(a0.normalDps, A(840) / 2.9), `got ${a0.normalDps}`);
  const a1 = calculateOperator(a, mk(a, 0));
  check('阿罗玛 S1(强效清洁 AUTO) 强化击 = A(840×1.9)', near(a1.skillTotalDamage, A(840 * 1.9)), `got ${a1.skillTotalDamage}`);
  check('阿罗玛 S1 常态行 = 无技能态', near(a1.normalDps, a0.normalDps), `got ${a1.normalDps}`);
  const a2 = calculateOperator(a, mk(a, 1));
  check('阿罗玛 S2 每击 = A(840×1.9) 且 23s 内 7 击(浮空结束段不计)', near(a2.skillTotalDamage, 7 * A(840 * 1.9)), `got ${a2.skillTotalDamage}`);

  const s = load('char_489_serum');
  const s0 = calculateOperator(s, mk(s, -1));
  check('蚀清 常态 = A(850)/2.9', near(s0.normalDps, A(850) / 2.9), `got ${s0.normalDps}`);
  const s1 = calculateOperator(s, mk(s, 0));
  check('蚀清 S1 每击 = A(850×2.1) 且 30s 内 10 击', near(s1.skillTotalDamage, Math.floor(30 / 2.9) * A(850 * 2.1)), `got ${s1.skillTotalDamage}`);
  check('蚀清 S1 常态行 = 无技能态 ×2/3(技能后眩晕 10s/技能 30s)', near(s1.normalDps, (A(850) / 2.9) * 2 / 3), `got ${s1.normalDps}`);
  const s2 = calculateOperator(s, mk(s, 1));
  check('蚀清 S2 每击 = A(850×1.8) 且 25s 内 8 击', near(s2.skillTotalDamage, Math.floor(25 / 2.9) * A(850 * 1.8)), `got ${s2.skillTotalDamage}`);
  check('蚀清 S2 常态行 = 无技能态(仅 S1 有技能后眩晕)', near(s2.normalDps, s0.normalDps), `got ${s2.normalDps}`);
}

console.log(`${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
