// [path-fix] 仓库内相对定位
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = path.join(REPO_ROOT, 'src', 'frontend', 'data');
const rel = (...p) => path.join(ROOT, ...p);
const D = (...p) => rel(p.map((s) => String(s).replace(/^[/\\]+|[/\\]+$/g, '')).filter(Boolean).join('/'));

// 调度者(dispatcher,特种,2026-11 新增子职业)验证:精二满/满信赖/潜0/专一档/敌 def600 res50
// 特性「开启技能后可以造成超远距离的群体物理伤害」(单目标模型 = 1 目标全额)
// 口径(2026-11):
//   天赋「驮兽边界感」未阻挡敌人时攻击力+10%(精2) → 条件类(未阻挡)默认不建模,面板按无加成;
//   S1 花椰菜冲击:AUTO 自回触发型,atk_scale 单次强化(推力=控制不计);
//   S2 蔬菜大拼盘:MANUAL 36s,atk 加成 + 每次攻击倍率递增(attack@delta_atk_scale,上限 attack@max_atk_scale)。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.2) => Math.abs(a - b) <= tol;
const op = JSON.parse(fs.readFileSync(D('/SPECIAL/dispatcher/char_4170_hdbell.json'), 'utf8'));
const e = op.phases.length - 1;
const run = (si) => calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7 });

let r = run(-1);
ok(near(r.panelAtk, 1500), '行铃 面板 1500(1450+信赖50;天赋未阻挡+10% 条件类不计) 实=' + r.panelAtk);
ok(near(r.normalDps, 257.143), '行铃 常态物理 DPS((1500-600)/3.5) 实=' + r.normalDps);
r = run(0);
ok(near(r.skillTotalDamage, 2700.0), '行铃 S1 花椰菜冲击 2700.0(触发型 atk_scale 2.2) 实=' + r.skillTotalDamage);
ok(near(r.cycleDps, 450.0), '行铃 S1 循环 DPS 450.0 实=' + r.cycleDps);
r = run(1);
ok(near(r.skillTotalDamage, 19800.0), '行铃 S2 蔬菜大拼盘 19800.0(atk 加成 1.5×；递增倍率按距离默认不生效) 实=' + r.skillTotalDamage);
ok(near(r.skillDps, 550.0), '行铃 S2 技能期 DPS 550.0 实=' + r.skillDps);
console.log('调度者: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
