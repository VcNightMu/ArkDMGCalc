// 伏击客(stalker,特种)验证:精二满级/满信赖/潜0/专一(技能等级 7),敌 hp50000 atk800 def600 res50
// 口径(2026-09-18 用户):
//   绮良:天赋「离群独守」的回复生命值按基础计算
//   水月:天赋「反移情」的攻击力增幅不计算
//   阿斯卡纶:天赋「死亡拘审」层数默认叠满,天赋「噬光残影」攻速增幅按基础计算(条件 +6 不计)
//   八幡海铃:技能「颤栗之弦」不考虑其他 Ave Mujica 成员触发的额外释放
// 引擎:
//   · 特性(对范围内所有敌人造成伤害/0 阻挡/3.5s 间隔/50% 物法闪避)按单目标模型,闪避非输出不建模
//   · 水月「创伤性癔症」每击附加 攻击力×scale 法术伤害(技能期 talent_scale 放大)
//   · 阿斯卡纶「死亡拘审」常驻 DOT:每秒 攻击力×atk_ratio×叠满层数 法术伤害;「噬光残影」攻速 +8 入 TALENT_SPD_DRIVERS
//   · 伊桑 S1「花式回旋」为被动技能:普攻附带每秒 attack@poison_damage 法术伤害(等效常驻,不叠层)
//   · 领域型技能(绮良 S2 锚点捕捉 / 八幡海铃 S2 无存之所)技能期间停止普攻,仅每秒领域法伤
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const INDEX = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
function loadOp(id) {
  const e = INDEX.find((x) => x.id === id);
  return JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8'));
}
function mk(op, si, module) {
  const elite = op.phases.length - 1;
  return { elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module };
}
function mod(op, id, level) { return { moduleId: id, moduleLevel: level }; }
let pass = 0, fail = 0;
const near = (a, e, tol, label) => {
  if (typeof a !== 'number' || Math.abs(a - e) > tol) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); }
  else pass++;
};
const eq = (a, e, label) => { if (a !== e) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); } else pass++; };

// ---- 狮蝎(char_215_mantic) ----
{
  const o = loadOp('char_215_mantic');
  near(calculateOperator(o, mk(o, -1)).normalDps, 77.429, 0.02, '狮蝎 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.skillDps, 0, '狮蝎 S1 蝎毒 技能期 DPS 0(被动:敌方减速,无自身输出)');
  near(s1.normalDps, 77.429, 0.02, '狮蝎 S1 常态化列=普攻');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.realInterval, 5.2, 0.001, '狮蝎 S2 攻击间隔(3.5+1.7)');
  near(s2.skillTotalDamage, 9213.4, 0.6, '狮蝎 S2 蓄力毒尾击 总伤(220% 物理 ×7:70% 技能+50% 隐匿必然触发)');
  near(s2.skillDps, 242.458, 0.02, '狮蝎 S2 技能期 DPS');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_mantic', 3)));
  near(x3.panelAtk, 956, 0.01, '狮蝎 X3 面板攻击力(871+85)');
  near(x3.normalDps, 101.714, 0.02, '狮蝎 X3 常态 DPS');
  near(calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_mantic', 3))).skillTotalDamage, 11191.6, 0.6, '狮蝎 X3 S2 总伤(230%:70%+60% 隐匿)');
}

// ---- 伊桑(char_355_ethan) ----
{
  const o = loadOp('char_355_ethan');
  near(calculateOperator(o, mk(o, -1)).normalDps, 40.571, 0.02, '伊桑 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.skillDps, 0, '伊桑 S1 花式回旋(被动)技能期 0');
  near(s1.normalDps, 80.571, 0.02, '伊桑 S1 常态化列=普攻+毒素 DOT');
  near(s1.normalTypes.arts.dps, 40, 0.02, '伊桑 S1 常态毒素法术段(80×0.5)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 3850.7, 0.6, '伊桑 S2 十字悬挂 总伤(155% 物理 ×7)');
  near(s2.skillDps, 148.104, 0.02, '伊桑 S2 技能期 DPS');
  near(s2.normalDps, 40.571, 0.02, '伊桑 S2 常态化列=普攻(无被动毒素)');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_ethan', 3)));
  near(x3.panelAtk, 802, 0.01, '伊桑 X3 面板攻击力(742+60)');
}

// ---- 阿斯卡纶(char_4132_ascln) ----
{
  const o = loadOp('char_4132_ascln');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 954, 0.01, '阿斯卡纶 面板攻击力');
  near(r0.realInterval, 3.241, 0.002, '阿斯卡纶 攻击间隔(攻速 +8)');
  near(r0.normalTypes.arts.dps, 143.1, 0.05, '阿斯卡纶 常态 DOT(3×10%×954 法伤)');
  near(r0.normalDps, 252.334, 0.05, '阿斯卡纶 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 2234.4, 0.6, '阿斯卡纶 S1 追袭 单次总伤(180%×2 连击)');
  near(s1.cycleDps, 510.9, 0.1, '阿斯卡纶 S1 循环 DPS(含 DOT)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 23097, 1, '阿斯卡纶 S2 恩赐 总伤(物理+DOT)');
  near(s2.dmgTypes.arts.skillTotalDamage, 10017, 1, '阿斯卡纶 S2 法术段(DOT 35s)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.realInterval, 1.852, 0.002, '阿斯卡纶 S3 攻击间隔(-1.5s 后含攻速)');
  near(s3.skillTotalDamage, 23736.15, 1, '阿斯卡纶 S3 降临 总伤');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_ascln', 3)));
  near(x3.normalTypes.arts.dps, 3 * 0.11 * 1007 * 0.5, 0.1, '阿斯卡纶 X3 DOT(11% 叠满)');
  near(x3.normalDps, 291.744, 0.05, '阿斯卡纶 X3 常态 DPS');
  const y3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_003_ascln', 3)));
  near(y3.panelAtk, 1034, 0.01, '阿斯卡纶 Y3 面板攻击力(954+80)');
}

// ---- 八幡海铃(char_4186_tmoris) ----
{
  const o = loadOp('char_4186_tmoris');
  near(calculateOperator(o, mk(o, -1)).normalDps, 68.286, 0.02, '八幡海铃 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.damageType, 'arts', '八幡海铃 S1 颤栗之弦 伤害类型=法术');
  near(s1.skillTotalDamage, 1405.325, 0.5, '八幡海铃 S1 总伤(5 连击 ×67% 法伤)');
  near(s1.cycleDps, 134.933, 0.05, '八幡海铃 S1 循环 DPS(攻回 sp4)');
  near(s1.normalDps, 68.286, 0.02, '八幡海铃 S1 常态化列=普攻');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.damageType, 'arts', '八幡海铃 S2 无存之所 伤害类型=法术');
  near(s2.skillDps, 385.94, 0.05, '八幡海铃 S2 每秒法伤(92% 攻击力)');
  near(s2.skillTotalDamage, 5789.1, 0.5, '八幡海铃 S2 总伤(15s)');
  const y3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_tmoris', 3)));
  near(y3.panelAtk, 909, 0.01, '八幡海铃 Y3 面板攻击力(839+70)');
}

// ---- 水月(char_437_mizuki) ----
{
  const o = loadOp('char_437_mizuki');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 975, 0.01, '水月 面板攻击力(反移情不计)');
  near(r0.normalTypes.arts.dps, 69.643, 0.02, '水月 常态每击附加法伤(12 次攻击)');
  near(r0.normalDps, 176.786, 0.02, '水月 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 2446.875, 0.5, '水月 S1 唤醒 总伤(250% 物理 + 天赋 125% 法伤)');
  near(s1.cycleDps, 460.547, 0.05, '水月 S1 循环 DPS');
  near(s1.dmgTypes.arts.skillTotalDamage, 609.375, 0.5, '水月 S1 天赋法伤段');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.realInterval, 2.3, 0.001, '水月 S2 攻击间隔(3.5-1.2)');
  near(s2.skillTotalDamage, 7192.5, 0.5, '水月 S2 囚徒困境 总伤');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillTotalDamage, 16650, 0.5, '水月 S3 镜花水月 总伤');
  // A 模组(特限证章)含空 blackboard 占位档,合并后不丢第一天每击附加法伤
  const a3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_004_mizuki', 3)));
  near(a3.panelAtk, 1100, 0.01, '水月 A3 面板攻击力(975+125)');
  near(a3.normalTypes.arts.dps, 0.5 * 1100 * 0.5 / 3.5, 0.05, '水月 A3 常态附加法伤保留(空 blackboard 合并)');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_mizuki', 3)));
  near(x3.normalTypes.arts.dps, 0.6 * 1065 * 0.5 / 3.5, 0.05, '水月 X3 常态附加法伤(60%)');
}

// ---- 绮良(char_478_kirara) ----
{
  const o = loadOp('char_478_kirara');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.normalDps, 73.714, 0.02, '绮良 常态 DPS');
  eq(r0.type, 'heal', '绮良 常态含回血 → heal 型');
  near(r0.normalHps, 0.02 * 1980, 0.2, '绮良 常态 HPS(离群独守基础 2%)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 772.8, 0.5, '绮良 S1 锚击 总伤(普攻 258 物理 + 120% 法伤 514.8)');
  near(s1.cycleDps, 110.486, 0.05, '绮良 S1 循环 DPS(攻回 sp3)');
  near(s1.dmgTypes.arts.skillTotalDamage, 514.8, 0.5, '绮良 S1 法术段');
  near(s1.normalHps, 0.02 * 1980, 0.2, '绮良 S1 常态化列 HPS=基础 2%');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.damageType, 'arts', '绮良 S2 锚点捕捉 伤害类型=法术');
  near(s2.skillDps, 343.2, 0.05, '绮良 S2 每秒法伤(80% 攻击力)');
  near(s2.skillTotalDamage, 2745.6, 0.5, '绮良 S2 总伤(8s)');
  near(s2.normalHps, 0.02 * 1980, 0.2, '绮良 S2 常态化列 HPS=基础 2%(天赋效果提升不叠进回血)');
  near(calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_kirara', 3))).panelAtk, 858, 0.01, '绮良 X3 面板攻击力(白值仅生命/防御)');
  near(calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_kirara', 3))).normalHps, 0.025 * (1980 + 330), 0.3, '绮良 X3 常态 HPS(2.5%)');
}

// ---- 不变量:非被动技能槽的常态化列 = 无技能态 ----
{
  const ids = ['char_215_mantic', 'char_4132_ascln', 'char_4186_tmoris', 'char_437_mizuki', 'char_478_kirara'];
  for (const id of ids) {
    const o = loadOp(id);
    const mods = [null];
    for (const m of (o.modules || [])) if (m.type === 'ADVANCED') for (const lv of (m.levels || [])) mods.push(mod(o, m.id, lv.level));
    for (const mm of mods) {
      const n0 = calculateOperator(o, mk(o, -1, mm)).normalDps;
      for (let si = 0; si < (o.skills || []).length; si++) {
        const r = calculateOperator(o, mk(o, si, mm));
        if (r.normalDps === null || r.isPermanent) continue;
        near(r.normalDps, n0, 0.02, `${o.name} S${si + 1} 常态化列=无技能态`);
      }
    }
  }
}
console.log('伏击客: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
