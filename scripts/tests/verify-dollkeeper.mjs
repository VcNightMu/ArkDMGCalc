// 傀儡师(dollkeeper,特种)验证:精二满级/满信赖/潜0/专一(技能等级 7),敌 hp50000 atk800 def600 res50
// 口径(2026-09-18 用户拍板 4 条,notes.json 逐字):
//   1) 所有傀儡师:替身的数据独立显示。若替身有技能则可以选择技能 → 替身按「特殊-干员附带单位」独立成条,
//      选择器紧随本体;替身面板=本体面板(结城理人格面具按天赋「不羁之力」×1.8 攻击 / ×1.35 生命、攻击间隔 1.6s)。
//   2) 归溟幽灵鲨:技能“生存的重压”的额外物理伤害不计算(attack@atk_scale_ex 不计,仅普通攻击)。
//   3) 若叶睦:技能“破坏与滋养”默认攻击同一个目标(三连发全部命中同一目标)。
//   4) 结城理:技能“开辟明日的剑刃”的替身默认不切换为俄尔普斯(取塔纳托斯)。
// 自定口径(待用户验收,详见 tools/dollkeeper-report.md):
//   - 替身「不攻击」者(归溟幽灵鲨光环/若叶睦)常态不记攻击;归溟幽灵鲨常态=天赋光环(40%攻击力/秒法术, X 模组 60/80%);
//   - 双月本体不攻击(诱饵)→ 本体常态与技能期均 0,输出归替身;纸偶出现时的一次性群体法伤(折纸生花 270%/+X%)计入无技能态总伤字段;
//   - 替身的模组按本体同档可选,X/Y 模组的「替身攻击/生命增幅」按 traitEnhance 计入。
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

const PAIRS = [
  ['char_1023_ghost2', 'token_1023_ghost2_shadow'],
  ['char_369_bena', 'token_369_bena_shadow'],
  ['char_4016_kazema', 'token_10022_kazema_shadow'],
  ['char_4107_vrdant', 'token_4107_vrdant_shadow'],
  ['char_4124_iana', 'token_4124_iana_shadow'],
  ['char_4183_mortis', 'token_4183_mortis_shadow'],
  ['char_4217_makoto', 'token_4217_makoto_shadow'],
];

// ---- 归溟幽灵鲨(char_1023_ghost2):物理,面板 817;S3 额外物理不计 ----
{
  const o = loadOp('char_1023_ghost2');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.damageType, 'physical', '归溟幽灵鲨 常态伤害类型=物理');
  near(r0.panelAtk, 817, 0.01, '归溟幽灵鲨 面板攻击力(737+信赖80)');
  near(r0.realInterval, 1.2, 0.001, '归溟幽灵鲨 攻击间隔');
  near(r0.normalDps, 180.833, 0.01, '归溟幽灵鲨 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.panelAtk, 1879.1, 0.01, '归溟幽灵鲨 S1 攻击力(+130%)');
  near(s1.skillTotalDamage, 25582, 0.5, '归溟幽灵鲨 S1 总伤(20 击)');
  near(s1.skillDps, 1023.28, 0.1, '归溟幽灵鲨 S1 技能期 DPS');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.realInterval, 0.869565, 0.0001, '归溟幽灵鲨 S2 攻击间隔(攻速+38)');
  near(s2.skillTotalDamage, 22314, 0.5, '归溟幽灵鲨 S2 总伤(20 击)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.panelAtk, 2614.4, 0.01, '归溟幽灵鲨 S3 攻击力(+220%)');
  near(s3.realInterval, 2.2, 0.001, '归溟幽灵鲨 S3 攻击间隔(1.2+1.0)');
  near(s3.skillTotalDamage, 22158.4, 0.5, '归溟幽灵鲨 S3 总伤(口径2:额外物理不计, 11 击)');
  near(s3.skillDps, 886.336, 0.1, '归溟幽灵鲨 S3 技能期 DPS');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_ghost2', 3)));
  near(x3.panelAtk, 900, 0.01, '归溟幽灵鲨 X3 面板((737+83)+信赖80)');
  near(x3.normalDps, 250, 0.01, '归溟幽灵鲨 X3 常态 DPS');
}

// ---- 归溟幽灵鲨·替身:不普攻,常态=天赋光环(40%攻击力/秒法术);X 模组替身攻击+15%、光环 80% ----
{
  const at = INDEX.findIndex((x) => x.id === 'char_1023_ghost2');
  eq(INDEX[at + 1] && INDEX[at + 1].id, 'token_1023_ghost2_shadow', '归溟幽灵鲨替身 索引紧随本体');
  const o = loadOp('token_1023_ghost2_shadow');
  eq(o.ownerOperatorId, 'char_1023_ghost2', '归溟幽灵鲨替身 owner');
  eq(o.profession, 'TOKEN', '归溟幽灵鲨替身 职业=TOKEN');
  eq((o.skills || []).length, 0, '归溟幽灵鲨替身 无技能(光环由天赋提供)');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.damageType, 'arts', '归溟幽灵鲨替身 常态伤害类型=法术');
  near(r0.panelAtk, 817, 0.01, '归溟幽灵鲨替身 面板=本体面板');
  near(r0.normalDps, 163.4, 0.01, '归溟幽灵鲨替身 常态 DPS(40%×817×0.5)');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_ghost2', 3)));
  near(x3.normalDps, 414, 0.01, '归溟幽灵鲨替身 X3 常态 DPS(80%×900×1.15×0.5)');
}

// ---- 贝娜(char_369_bena):物理,面板 742;S1 攻击+85% 且无视 35% 防御 ----
{
  const o = loadOp('char_369_bena');
  near(calculateOperator(o, mk(o, -1)).normalDps, 118.333, 0.01, '贝娜 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.panelAtk, 1372.7, 0.01, '贝娜 S1 攻击力(+85%)');
  near(s1.skillTotalDamage, 15723.2, 0.5, '贝娜 S1 总伤(无视 35% 防御, 16 击)');
  near(s1.skillDps, 786.16, 0.1, '贝娜 S1 技能期 DPS');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.realInterval, 0.75, 0.001, '贝娜 S2 攻击间隔(攻速+60)');
  near(s2.skillTotalDamage, 19180.6, 0.5, '贝娜 S2 总伤(29 击)');
  const y3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_bena', 3)));
  near(y3s1.skillTotalDamage, 17351.2, 0.5, '贝娜 Y3 S1 总伤');
}
// ---- 贝娜·替身:法术普攻 ----
{
  const at = INDEX.findIndex((x) => x.id === 'char_369_bena');
  eq(INDEX[at + 1] && INDEX[at + 1].id, 'token_369_bena_shadow', '贝娜替身 索引紧随本体');
  const o = loadOp('token_369_bena_shadow');
  eq((o.skills || []).length, 0, '贝娜替身 无技能');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.damageType, 'arts', '贝娜替身 常态伤害类型=法术');
  near(r0.normalDps, 309.167, 0.01, '贝娜替身 常态 DPS(742×0.5/1.2)');
}

// ---- 风丸(char_4016_kazema):物理,面板 772;S1 下次攻击 300%(专一);S2 攻击+100% ----
{
  const o = loadOp('char_4016_kazema');
  near(calculateOperator(o, mk(o, -1)).normalDps, 143.333, 0.01, '风丸 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 1716, 0.5, '风丸 S1 总伤(300% 单发)');
  near(s1.normalDps, 143.333, 0.01, '风丸 S1 常态化列=无技能态');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.panelAtk, 1544, 0.01, '风丸 S2 攻击力(+100%)');
  near(s2.skillTotalDamage, 15104, 0.5, '风丸 S2 总伤(16 击)');
  const x3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_kazema', 3)));
  near(x3s2.skillTotalDamage, 17184, 0.5, '风丸 X3 S2 总伤');
}
// ---- 风丸·纸偶:物理普攻 + 出现时 270% 攻击力群体法伤 ----
{
  const at = INDEX.findIndex((x) => x.id === 'char_4016_kazema');
  eq(INDEX[at + 1] && INDEX[at + 1].id, 'token_10022_kazema_shadow', '纸偶 索引紧随本体');
  const o = loadOp('token_10022_kazema_shadow');
  eq(o.name, '纸偶', '纸偶名称');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.damageType, 'physical', '纸偶 常态伤害类型=物理');
  near(r0.normalDps, 143.333, 0.01, '纸偶 常态 DPS');
  near(r0.skillTotalDamage, 1042.2, 0.5, '纸偶 出现爆发总伤(270%×772 法伤)');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_kazema', 3)));
  near(x3.normalDps, 302.125, 0.01, '纸偶 X3 常态 DPS(替身攻击+15%)');
  near(x3.skillTotalDamage, 1371.634, 0.5, '纸偶 X3 出现爆发(285%×962.55)');
}

// ---- 维荻(char_4107_vrdant):物理,面板 732;S1 被动(S2 攻速+60) ----
{
  const o = loadOp('char_4107_vrdant');
  near(calculateOperator(o, mk(o, -1)).normalDps, 110, 0.01, '维荻 常态 DPS');
  eq(calculateOperator(o, mk(o, 0)).skillTotalDamage, 0, '维荻 S1 总伤 0(仅生命/法抗被动)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.realInterval, 0.75, 0.001, '维荻 S2 攻击间隔');
  near(s2.skillTotalDamage, 3960, 0.5, '维荻 S2 总伤(30 击)');
}
{
  const at = INDEX.findIndex((x) => x.id === 'char_4107_vrdant');
  eq(INDEX[at + 1] && INDEX[at + 1].id, 'token_4107_vrdant_shadow', '维荻替身 索引紧随本体');
  const o = loadOp('token_4107_vrdant_shadow');
  near(calculateOperator(o, mk(o, -1)).normalDps, 110, 0.01, '维荻替身 常态 DPS(物理普攻)');
}

// ---- 双月(char_4124_iana):本体不攻击(诱饵)→ 0;替身承伤作战 ----
{
  const o = loadOp('char_4124_iana');
  eq(calculateOperator(o, mk(o, -1)).normalDps, 0, '双月本体 常态 DPS 0(不攻击)');
  eq(calculateOperator(o, mk(o, 0)).skillTotalDamage, 0, '双月本体 S1 总伤 0(切换替身的爆发归替身)');
  eq(calculateOperator(o, mk(o, 1)).skillTotalDamage, 0, '双月本体 S2 总伤 0(切换替身)');
  const at = INDEX.findIndex((x) => x.id === 'char_4124_iana');
  eq(INDEX[at + 1] && INDEX[at + 1].id, 'token_4124_iana_shadow', '双月替身 索引紧随本体');
  const s = loadOp('token_4124_iana_shadow');
  eq((s.skills || []).length, 2, '双月替身 有 2 个技能可选');
  near(calculateOperator(s, mk(s, -1)).normalDps, 131.667, 0.01, '双月替身 常态 DPS');
  const b1 = calculateOperator(s, mk(s, 0));
  near(b1.skillTotalDamage, 2128.8, 0.5, '双月替身 S1 总伤(切换 360% 物理)');
  near(b1.skillDps, 1774, 0.5, '双月替身 S1 技能期 DPS');
  near(b1.normalDps, 131.667, 0.01, '双月替身 S1 常态化列=无技能态');
  const b2 = calculateOperator(s, mk(s, 1));
  near(b2.realInterval, 0.324324, 0.0001, '双月替身 S2 攻击间隔(攻速+270)');
  near(b2.skillTotalDamage, 4740, 0.5, '双月替身 S2 总伤(30 击)');
  near(b2.skillDps, 474, 0.5, '双月替身 S2 技能期 DPS');
}

// ---- 若叶睦(char_4183_mortis):本体物理;S2 三连发(口径3:默认同一目标) ----
{
  const o = loadOp('char_4183_mortis');
  near(calculateOperator(o, mk(o, -1)).normalDps, 160, 0.01, '若叶睦 常态 DPS');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.damageType, 'arts', '若叶睦 S2 伤害类型=法术');
  near(s2.realInterval, 0.9, 0.001, '若叶睦 S2 攻击间隔(1.2-0.3)');
  near(s2.skillTotalDamage, 19008, 0.5, '若叶睦 S2 总伤(三连发同目标, 16 轮 ×3 击)');
  near(s2.skillDps, 1267.2, 0.1, '若叶睦 S2 技能期 DPS');
  near(s2.normalDps, 160, 0.01, '若叶睦 S2 常态化列=无技能态');
  const at = INDEX.findIndex((x) => x.id === 'char_4183_mortis');
  eq(INDEX[at + 1] && INDEX[at + 1].id, 'token_4183_mortis_shadow', '若叶睦替身 索引紧随本体');
  const s = loadOp('token_4183_mortis_shadow');
  eq(calculateOperator(s, mk(s, -1)).normalDps, 0, '若叶睦替身 常态 DPS 0(不攻击)');
}

// ---- 结城理(char_4217_makoto):本体技能=切换替身(本体技能期 0);替身=人格面具 ----
{
  const o = loadOp('char_4217_makoto');
  near(calculateOperator(o, mk(o, -1)).normalDps, 187.5, 0.01, '结城理本体 常态 DPS');
  for (let si = 0; si < 3; si++) {
    const r = calculateOperator(o, mk(o, si));
    eq(r.skillTotalDamage, 0, '结城理本体 S' + (si + 1) + ' 总伤 0(切换替身)');
    near(r.normalDps, 187.5, 0.01, '结城理本体 S' + (si + 1) + ' 常态化列=无技能态');
  }
  const at = INDEX.findIndex((x) => x.id === 'char_4217_makoto');
  eq(INDEX[at + 1] && INDEX[at + 1].id, 'token_4217_makoto_shadow', '结城理替身 索引紧随本体');
  const s = loadOp('token_4217_makoto_shadow');
  eq(s.name, '人格面具', '结城理替身名称');
  eq((s.skills || []).length, 3, '结城理替身 有 3 个技能可选');
  const r0 = calculateOperator(s, mk(s, -1));
  near(r0.panelAtk, 1485, 0.01, '结城理替身 面板攻击力(825×1.8)');
  near(r0.realInterval, 1.6, 0.001, '结城理替身 攻击间隔(1.2+0.4)');
  eq(r0.normalDps, 0, '结城理替身 常态 DPS 0(未选技能不召唤面具)');
  const s1 = calculateOperator(s, mk(s, 0));
  near(s1.panelAtk, 1485, 0.01, '结城理替身 S1 面板');
  near(s1.skillTotalDamage, 20493, 0.5, '结城理替身 S1 总伤(俄耳甫斯 230% 法伤 ×12)');
  near(s1.skillDps, 1024.65, 0.5, '结城理替身 S1 技能期 DPS');
  const s2 = calculateOperator(s, mk(s, 1));
  near(s2.skillTotalDamage, 20493, 0.5, '结城理替身 S2 总伤(塔纳托斯,单目标模型)');
  const s3 = calculateOperator(s, mk(s, 2));
  near(s3.realInterval, 1.066667, 0.0001, '结城理替身 S3 攻击间隔(攻速+50)');
  near(s3.skillTotalDamage, 28066.5, 0.5, '结城理替身 S3 总伤(口径4:默认塔纳托斯, 18 击)');
  near(s3.skillDps, 1403.325, 0.5, '结城理替身 S3 技能期 DPS');
  const y3s1 = calculateOperator(s, mk(s, 0, mod(s, 'uniequip_002_makoto', 3)));
  near(y3s1.skillTotalDamage, 21337.56, 1, '结城理替身 Y3 S1 总伤');
}

// ---- 新条目登记 ----
{
  for (const [opId, subId] of PAIRS) {
    const e = INDEX.find((x) => x.id === subId);
    eq(!!e, true, subId + ' 已入 index');
    if (e) { eq(e.profession, 'TOKEN', subId + ' profession=TOKEN'); eq(e.subProfessionId, 'notchar1', subId + ' subProfessionId=notchar1'); eq(e.ownerOperatorId, opId, subId + ' owner=' + opId); }
  }
}

// ---- 不变量:各技能槽常态化列 = 无技能态(仅傀儡师本体/替身;触发型 AUTO 已回填) ----
{
  const ids = [];
  for (const [opId, subId] of PAIRS) ids.push(opId, subId);
  for (const id of ids) {
    const o = loadOp(id);
    const mods = [null];
    for (const m of (o.modules || [])) if (m.type === 'ADVANCED') for (const lv of (m.levels || [])) mods.push(mod(o, m.id, lv.level));
    for (const mm of mods) {
      const n0 = calculateOperator(o, mk(o, -1, mm)).normalDps;
      for (let si = 0; si < (o.skills || []).length; si++) {
        const r = calculateOperator(o, mk(o, si, mm));
        near(r.normalDps, n0, 0.02, `${o.name} S${si + 1} 常态化列=无技能态`);
      }
    }
  }
}

console.log('傀儡师: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
