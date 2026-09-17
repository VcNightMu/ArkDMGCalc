// 回环射手(loopshooter)验证:特性(回旋投射物,不改间隔)、娜仁图亚偷取攻击力默认满层、
// 跃跃「乐趣加倍」二连击、娜仁图亚「吞日」三连击、水灯心「可驯服的」五连击
// 参数:精二满级/满信赖/潜0/专一档(levels[7])/敌 def600 res50
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.15) => Math.abs(a - b) <= tol;
const load = (id) => JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/SNIPER/loopshooter/' + id + '.json', import.meta.url), 'utf8'));
const idx = JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/index.json', import.meta.url), 'utf8'));

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (op, si) => {
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module: null });
};

for (const id of ['char_4138_narant', 'char_4177_brigid', 'char_4100_caper']) ok(idx.some(o => o.id === id), 'index 含 ' + id);

// 娜仁图亚:偷取攻击力默认满层(E2 潜0 = +250) → 常态 (675+90+250-600)=415
const na = load('char_4138_narant');
let r = run(na, -1); ok(near(r.normalDps, 415), '娜仁图亚常态 DPS=415(含偷取满层+250) 实=' + r.normalDps);
r = run(na, 0); ok(near(r.skillDps, 1125.5), '娜仁图亚 S1 旋刃 每击 170% → 1125.5 实=' + r.skillDps);
r = run(na, 1); ok(near(r.skillTotalDamage, 88845) && near(r.skillDps, 2961.5), '娜仁图亚 S2 恶魇 命中230%+折返180% ×30 = 88845 实=' + r.skillTotalDamage);
r = run(na, 2); ok(near(r.skillTotalDamage, 81920) && near(r.skillDps, 4096), '娜仁图亚 S3 吞日 (三连击×165% + 回收145%)×20 = 81920 实=' + r.skillTotalDamage);

// 水灯心:天赋结绳老手(无模组)不提供攻击力 → 常态 115;S2 五连击
const br = load('char_4177_brigid');
r = run(br, -1); ok(near(r.normalDps, 115), '水灯心常态 DPS=115 实=' + r.normalDps);
r = run(br, 0); ok(near(r.skillTotalDamage, 258) && near(r.cycleDps, 150.8), '水灯心 S1 所熟知的 单发 258 / 循环 150.8 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run(br, 1); ok(near(r.skillTotalDamage, 50125) && near(r.skillDps, 2005), '水灯心 S2 可驯服的 五连击×25 = 50125 实=' + r.skillTotalDamage);

// 跃跃:戏耍随心(25% 概率)不计算;S2 二连击
const ca = load('char_4100_caper');
r = run(ca, -1); ok(near(r.normalDps, 65), '跃跃常态 DPS=65 实=' + r.normalDps);
r = run(ca, 0); ok(near(r.skillTotalDamage, 796.5) && near(r.cycleDps, 211.3), '跃跃 S1 强力击β 796.5 / 循环 211.3 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run(ca, 1); ok(near(r.skillTotalDamage, 13113) && near(r.skillDps, 728.5), '跃跃 S2 乐趣加倍 二连击×18 = 13113 实=' + r.skillTotalDamage);

console.log('回环射手: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
