// 落地点火 / 开局定时触发天赋(★1/★2 无技能槽干员)数值验证
// 虎狼丸(伤害型):技能期 DPS/总伤;Lancet-2(治疗型):瞬发只给总治疗量,无技能期 HPS;常态均只留普攻/普攻治疗
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const BASE = 'F:/ArkCodes/ArkDMGCalc';
const load = (prof, sub, id) => JSON.parse(fs.readFileSync(`${BASE}/src/frontend/data/${prof}/${sub}/${id}.json`, 'utf8'));

let pass = 0, fail = 0;
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('FAIL: ' + msg); } };
function run(op, si, pot = 0) {
  const elite = op.phases.length - 1;
  const level = op.phases[elite].maxLevel;
  return calculateOperator(op, { elite, level, trustPercent: 100, potentialRank: pot, skillIndex: si, skillLevel: 7 });
}

// 虎狼丸:常态=普攻;天赋 6 次斩击(5×atk_scale + 1×final_atk_scale)移入技能期
const kormr = load('WARRIOR', 'sword', 'char_4220_kormr');
let r = run(kormr, -1);
ok(r.deploySkill === true, '虎狼丸 应标记 deploySkill');
ok(near(r.normalDps, 10.462, 0.02), '虎狼丸 常态=普攻 10.462 实=' + r.normalDps);
ok(near(r.skillTotalDamage, 952, 0.5), '虎狼丸 技能期总伤 952 实=' + r.skillTotalDamage);
ok(near(r.skillDps, 122.051, 0.05), '虎狼丸 技能期 DPS 122.051 实=' + r.skillDps);
ok(r.dmgTypes && r.dmgTypes.arts && near(r.dmgTypes.arts.skillDps, 122.051, 0.05), '虎狼丸 dmgTypes.arts 技能期 DPS');
ok(near(r.realInterval, 1.3, 0.001), '虎狼丸 攻击间隔 1.3 实=' + r.realInterval);

// Lancet-2:常态 HPS=普攻治疗;天赋「救援喷雾」部署回血 200(潜0)为瞬发一次性给量 → 只有总治疗量
const lancet = load('MEDIC', 'physician', 'char_285_medic2');
r = run(lancet, -1);
ok(r.type === 'heal', 'Lancet-2 结果为治疗型 实=' + r.type);
ok(r.deploySkill !== true, 'Lancet-2 不应标记 deploySkill(非攻击序列)');
ok(r.skillHps === null, 'Lancet-2 无技能期 HPS 概念 实=' + r.skillHps);
ok(near(r.totalHeal, 200, 0.5), 'Lancet-2 总治疗量 200 实=' + r.totalHeal);
ok(near(r.normalHps, 38.596, 0.05), 'Lancet-2 常态 HPS 38.596 实=' + r.normalHps);
ok(near(r.realInterval, 2.85, 0.001), 'Lancet-2 攻击间隔 2.85 实=' + r.realInterval);
// 潜力档:潜5 天赋值 500
r = run(lancet, -1, 5);
ok(near(r.totalHeal, 500, 0.5), 'Lancet-2 潜5 总治疗量 500 实=' + r.totalHeal);
ok(r.skillHps === null, 'Lancet-2 潜5 仍无技能期 HPS');

console.log(`${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
