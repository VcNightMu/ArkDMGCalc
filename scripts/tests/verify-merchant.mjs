// 行商(merchant,特种)验证:精二满级/满信赖/潜0/技能等级 7(=专一档),敌 hp50000 atk800 def600 res50
// 用户口径(2026-09-18):
//   孑:天赋「解剖高手」(攻击【感染生物】时攻击力提升至145%)不计算;S2 的治疗给出治疗量
//   乌有:天赋「出其不意」(4 秒未攻击则下次攻击力提升至150%)不计算;技能「阴晴圆缺」的攻击速度增幅(+25)不计算
//   老鲤:天赋「和气生财」(自身攻速+14,条件类)不计算;S2 标记引爆只计 5 次叠层(标记只存在 5 秒 paper_duration,用户口径 2026-09-18 晚)
//   裁度:天赋「谨慎择客」(攻击未被自身阻挡的敌人伤害+20%)不计算
//   琳琅诗怀雅:天赋「大买家」技能期叠攻击不计;S2 = 放置香槟炸弹(按陷阱:技能期 DPS 0、总伤=攻击力×atk_scale 物理);S3 = 二连击 + 关闭金币爆发(按上限 10 枚)
// 特性(再部署减少、撤退不返费、在场每 3 秒消耗 3 费)非输出,不建模。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
function loadOp(id) { return JSON.parse(fs.readFileSync(path.join(DATA, 'SPECIAL', 'merchant', id + '.json'), 'utf8')); }
function mk(op, si, module) {
  const elite = op.phases.length - 1;
  return { elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module };
}
function mod(id, level) { return { moduleId: id, moduleLevel: level }; }
let pass = 0, fail = 0;
const near = (a, e, tol, label) => {
  if (typeof a !== 'number' || Math.abs(a - e) > tol) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); }
  else pass++;
};
const eq = (a, e, label) => { if (a !== e) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); } else pass++; };

// ---- 孑(char_272_strong) 4★ 攻击 674+40=714 间隔 1.0 ----
{
  const o = loadOp('char_272_strong');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 714, 0.01, '孑 面板攻击力(解剖高手不计)');
  near(r0.normalDps, 114, 0.01, '孑 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.panelAtk, 714 * 1.5, 0.01, '孑 S1 断螯 技能期攻击力(+50%)');
  near(s1.skillDps, (714 * 1.5 - 600), 0.01, '孑 S1 技能期 DPS');
  eq(s1.skillTotalDamage, 0, '孑 S1 永续型总伤 0');
  eq(s1.isPermanent, true, '孑 S1 永续');
  eq(s1.skillHps, null, '孑 S1 无治疗');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.panelAtk, 714 * 1.5, 0.01, '孑 S2 刺身拼盘 技能期攻击力(+50%)');
  near(s2.skillDps, (714 * 1.5 - 600), 0.01, '孑 S2 技能期 DPS');
  near(s2.skillHps, (714 * 1.5 - 600) * 0.4, 0.01, '孑 S2 技能期 HPS(治疗=造成伤害 40%)');
  eq(s2.type, 'heal', '孑 S2 治疗型展示');
  const x3 = calculateOperator(o, mk(o, -1, mod('uniequip_002_strong', 3)));
  near(x3.panelAtk, 714 + 50, 0.01, '孑 X3 面板攻击力');
  near(calculateOperator(o, mk(o, 1, mod('uniequip_002_strong', 3))).skillHps, ((714 + 50) * 1.5 - 600) * 0.4, 0.01, '孑 X3 S2 技能期 HPS');
}

// ---- 乌有(char_455_nothin) 5★ 攻击 725+40=765 间隔 1.0 ----
{
  const o = loadOp('char_455_nothin');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 765, 0.01, '乌有 面板攻击力(出其不意不计)');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.type, 'heal', '乌有 S1 知难而退 治疗型');
  near(s1.skillHps, 2598 * 0.13, 0.05, '乌有 S1 技能期 HPS(每秒回 13% 最大生命)');
  near(s1.totalHeal, 2598 * 0.13 * 5, 0.2, '乌有 S1 总治疗量(dur5)');
  near(s1.normalDps, 165, 0.01, '乌有 S1 常态化列=自身普攻');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.panelAtk, 765 * 1.5, 0.01, '乌有 S2 阴晴圆缺 技能期攻击力(+50%)');
  near(s2.realInterval, 1.0, 0.001, '乌有 S2 攻击间隔(攻速增幅不计 → 仍 1.0)');
  near(s2.skillDps, 765 * 1.5 - 600, 0.01, '乌有 S2 技能期 DPS');
  eq(s2.isPermanent, true, '乌有 S2 永续');
  near(calculateOperator(o, mk(o, -1, mod('uniequip_002_nothin', 3))).panelAtk, 765 + 65, 0.01, '乌有 X3 面板攻击力');
  near(calculateOperator(o, mk(o, 1, mod('uniequip_002_nothin', 3))).skillDps, (765 + 65) * 1.5 - 600, 0.01, '乌有 X3 S2 技能期 DPS');
}

// ---- 老鲤(char_322_lmlee) 6★ 攻击 789+55=844 间隔 1.0 ----
{
  const o = loadOp('char_322_lmlee');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 844, 0.01, '老鲤 面板攻击力(和气生财攻速不计)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.panelAtk, 844 * 1.45, 0.01, '老鲤 S1 小惩大诫 技能期攻击力(+45%)');
  near(s1.skillDps, 844 * 1.45 - 600, 0.01, '老鲤 S1 技能期 DPS');
  const s2 = calculateOperator(o, mk(o, 1));   // 2.7 + 0.15×5 = 3.45(标记只存在 5 秒 → 只计 5 次叠层)
  near(s2.skillTotalDamage, 844 * 3.45 * (1 - 50 / 100), 0.5, '老鲤 S2 驱凶辟邪 标记引爆(法术,5 次叠层)');
  eq(s2.damageType, 'arts', '老鲤 S2 引爆为法术伤害');
  near(s2.realInterval, 1 * 100 / (100 + 20), 0.001, '老鲤 S2 间隔(被动攻速+20)');
  near(s2.cycleDps, (10 * (844 - 600) + 844 * 3.45 * 0.5) / 9, 0.05, '老鲤 S2 循环 DPS');
  near(s2.normalDps, 244, 0.01, '老鲤 S2 常态化列=自身普攻');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.panelAtk, 844 * 1.4, 0.01, '老鲤 S3 贵客盈门 技能期攻击力(+40%)');
  near(s3.skillDps, 844 * 1.4 - 600, 0.01, '老鲤 S3 技能期 DPS');
  const x3 = calculateOperator(o, mk(o, 1, mod('uniequip_002_lmlee', 3)));
  near(x3.panelAtk, 844 + 74, 0.01, '老鲤 X3 面板攻击力');
  near(x3.skillTotalDamage, (844 + 74) * 3.45 * 0.5, 0.5, '老鲤 X3 S2 引爆');
}

// ---- 裁度(char_4155_talr) 5★ 攻击 741+25=766 间隔 1.0 ----
{
  const o = loadOp('char_4155_talr');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 766, 0.01, '裁度 面板攻击力(谨慎择客伤害增幅不计)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.panelAtk, 766 * 1.5, 0.01, '裁度 S1 量衣尺 技能期攻击力(+50%)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.panelAtk, 766 * 1.4, 0.01, '裁度 S2 缝线缠身 技能期攻击力(atk_scale 1.4)');
  near(s2.skillDps, 766 * 1.4 - 600, 0.01, '裁度 S2 每秒束缚伤害 DPS');
  near(s2.skillTotalDamage, (766 * 1.4 - 600) * 8, 0.5, '裁度 S2 总伤(dur8)');
  near(s2.normalDps, 166, 0.01, '裁度 S2 常态化列=自身普攻');
  const x3 = calculateOperator(o, mk(o, -1, mod('uniequip_002_talr', 3)));
  near(x3.panelAtk, 766 + 70, 0.01, '裁度 X3 面板攻击力');
}

// ---- 琳琅诗怀雅(char_1033_swire2) 6★ 攻击 810+55=865 间隔 1.0 ----
{
  const o = loadOp('char_1033_swire2');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 865, 0.01, '琳琅诗怀雅 面板攻击力(大买家叠层不计)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.normalDps, 265, 0.01, '琳琅诗怀雅 S1 仗义疏财 归常态(普攻转治疗不建模)');
  eq(s1.skillDps, 0, '琳琅诗怀雅 S1 技能期 0');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.skillDps, 0, '琳琅诗怀雅 S2 见面礼 技能期 DPS 0(陷阱)');
  near(s2.skillTotalDamage, 865 * 1.8 - 600, 0.5, '琳琅诗怀雅 S2 香槟炸弹陷阱总伤(攻击力×180% 物理)');
  near(s2.normalDps, 265, 0.01, '琳琅诗怀雅 S2 常态化列=自身普攻');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillDps, 2 * (865 - 600), 0.01, '琳琅诗怀雅 S3 千金一掷 二连击 DPS');
  near(s3.skillTotalDamage, (865 * 1.3 - 600) * 10, 0.5, '琳琅诗怀雅 S3 关闭金币爆发(10 枚 × 130%)');
  eq(s3.isPermanent, false, '琳琅诗怀雅 S3 按有界技能期展示(关闭爆发可见)');
  const x3 = calculateOperator(o, mk(o, 2, mod('uniequip_002_swire2', 3)));
  near(x3.panelAtk, 865 + 40, 0.01, '琳琅诗怀雅 X3 面板攻击力');
  near(x3.skillDps, 2 * (865 + 40 - 600), 0.01, '琳琅诗怀雅 X3 S3 二连击 DPS');
  near(calculateOperator(o, mk(o, 1, mod('uniequip_002_swire2', 3))).skillTotalDamage, (865 + 40) * 1.8 - 600, 0.5, '琳琅诗怀雅 X3 S2 陷阱总伤');
  const y3 = calculateOperator(o, mk(o, 2, mod('uniequip_003_swire2', 3)));
  near(y3.skillTotalDamage, ((865 + 81) * 1.3 - 600) * 10, 0.5, '琳琅诗怀雅 Y3 S3 关闭爆发');
}

// ---- 不变量:非永续、非触发型的常态化列 = 无技能态 ----
{
  for (const id of ['char_272_strong', 'char_455_nothin', 'char_322_lmlee', 'char_4155_talr', 'char_1033_swire2']) {
    const o = loadOp(id);
    const mods = [null];
    for (const m of (o.modules || [])) if (m.type === 'ADVANCED') for (const lv of (m.levels || [])) mods.push(mod(m.id, lv.level));
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
console.log('行商: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
