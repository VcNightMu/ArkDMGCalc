// 模组同名增强接线防护:对覆盖层(calcTalentXxx 经 talentCandSource 消费模组 talentEnhance)
// 的每一对「已入表天赋 × 同名增强 te」做两态对比(无模组 vs 装增强档,均 pot0/满级/满信赖):
//   1) te 增强值方向必须正确(正值增强→装后 ≥ 装前,防负增长/断线)
//   2) 装后必须发生实际变化(防表项丢失/覆盖层回归)
// 覆盖返回值确定的表族:ATK(数值)/HP_DEF({defMul,hpMul})/SPD(数值)/HEAL(数值)。
// 其余族(DMG_MUL/SELF_AURA/RES_PEN/STEAL_ATK/...)由 verify-snapshot 全模组全档快照兜底。
import { calcTalentAtkBonus, calcTalentHpDefMul, calcTalentAttackSpeed, calcTalentHealScale } from '../../src/frontend/js/damage-calc.js';
import fs from 'fs';
import path from 'path';

const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const idx = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));

// [族名, te.bb 消费键, calc 函数, 取值器]
const FAMILIES = [
  ['ATK', 'atk', calcTalentAtkBonus, (r) => r],
  ['DEF', 'def', calcTalentHpDefMul, (r) => r.defMul],
  ['HP', 'max_hp', calcTalentHpDefMul, (r) => r.hpMul],
  ['SPD', 'attack_speed', calcTalentAttackSpeed, (r) => r],
  ['HEAL', 'heal_scale', calcTalentHealScale, (r) => r],
];

// te 与基础天赋「同值」、实际改动在其它 blackboard 键(非本族值)→ 允许本族无变化:
// 洛洛 X「立于磐石」改叠层间隔 15→10,atk 0.04 / max_stack_cnt 4 与基础同名同值
const TE_SAME_VALUE_OK = new Set(['char_4040_rockr']);
// te 与「自身」无关(自身不满足条件)→ 允许本族无变化:
//  安洁莉娜 X「实验用反重力模块」加速力场 te(attack_speed 3/5)是「自身攻击范围内友方额外」,自身不在自身攻击范围内(见 MODULE_TE_IGNORE/MODULE_TE_SPD_SKIP)
const TE_SELF_EXCLUDED = new Set(['char_291_aglina']);

let pass = 0, fail = 0, skip = 0;
const failList = [];
const opCache = {};
function loadOp(e) {
  if (opCache[e.id]) return opCache[e.id];
  const p = path.join(DATA, e.profession, e.subProfessionId, e.id + '.json');
  if (!fs.existsSync(p)) return null;
  let o; try { o = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  opCache[e.id] = o;
  return o;
}
function slotOf(o, module) {
  const elite = o.phases.length - 1;
  return { elite, level: o.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, module };
}
function talentNameSet(o) {
  const s = new Set();
  (o.talents || []).forEach(t => { for (const c of (t.candidates || [])) if (c && c.name) s.add(c.name); });
  return s;
}

for (const e of idx) {
  const o = loadOp(e);
  if (!o) continue;
  const mods = (o.modules || []).filter(m => m.type === 'ADVANCED');
  if (mods.length === 0) continue;
  const tNames = talentNameSet(o);
  for (const mod of mods) {
    for (const lv of (mod.levels || [])) {
      for (const te of (lv.talentEnhance || [])) {
        if (!te || !te.name || !tNames.has(te.name)) continue;
        if ((te.requiredPotentialRank ?? te.potentialRank ?? 0) !== 0) continue;  // pot0 档统一对比
        const bb = te.blackboard || {};
        const slot0 = slotOf(o, null);
        const slotM = slotOf(o, { moduleId: mod.id, moduleLevel: lv.level });
        for (const [fam, bbKey, fn, pick] of FAMILIES) {
          if (typeof bb[bbKey] !== 'number') continue;
          const v0 = pick(fn(o, slot0));
          const vM = pick(fn(o, slotM));
          const teVal = bb[bbKey];
          const label = `${o.name}(${e.id}) ${mod.typeName2 || 'M'}L${lv.level}「${te.name}」${fam}+${teVal}: ${v0} → ${vM}`;
          // 若该天赋不在该族表:无模输出=族默认(0 或 1),增强后若仍默认 → 未接线族,跳过(不误报)
          if (vM === v0 && (fam === 'HEAL' ? v0 === 1 : v0 === 0)) { skip++; continue; }
          const samePlaceholder = Math.abs(v0 - teVal) < 0.005 || TE_SAME_VALUE_OK.has(e.id) || TE_SELF_EXCLUDED.has(e.id);  // 同名同值占位 te / te 与自身无关 允许无变化
          const okDir = teVal > 0 ? vM >= v0 : vM <= v0;
          const okChange = Math.abs(vM - v0) > 1e-9;
          if (!okDir) { fail++; failList.push('FAIL 方向: ' + label); }
          else if (!okChange && !samePlaceholder) { fail++; failList.push('FAIL 无变化: ' + label); }
          else { pass++; }
        }
      }
    }
  }
}
console.log(`模组接线两态验证: ${pass} 通过, ${skip} 跳过(未入该族表), ${fail} 失败`);
for (const f of failList.slice(0, 40)) console.log('  ' + f);
process.exit(fail > 0 ? 1 : 0);
