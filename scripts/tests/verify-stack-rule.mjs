// 叠层天赋/模组 te 口径(用户 2026-09-17):
//   攻击次数型 / 时间型 / 必定触发型 → 按叠满计入;击杀型 / 受击型 / 概率与敌方状态型 → 不计
import fs from 'fs';
import path from 'path';
const DC = await import('file:///F:/ArkCodes/ArkDMGCalc/src/frontend/js/damage-calc.js');
const { state } = await import('file:///F:/ArkCodes/ArkDMGCalc/src/frontend/js/state.js');
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const idx = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
let pass = 0, fail = 0;
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= Math.max(tol, Math.abs(b) * 0.002);
const ok = (v, m) => { if (v) pass++; else { fail++; console.log('FAIL: ' + m); } };
const load = (id) => { const e = idx.find((x) => x.id === id); return JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8')); };
const slot = (op, mod) => { const elite = op.phases.length - 1; return { elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: -1, skillLevel: 7, module: mod || null }; };
// 按模组 id 片段与档位取 module 选项
const modKey = (op, frag, lv) => { const m = (op.modules || []).find((x) => x.type === 'ADVANCED' && x.id.includes(frag)); return m ? { moduleId: m.id, moduleLevel: lv } : null; };
const r3 = (v) => Math.round(v * 1000) / 1000;

// ---- 能天使:Y「连续造成伤害逐渐无视防御」(攻击次数型,叠满 150/250);攻速 +12 为平值不可 ×25 ----
const angel = load('char_103_angel');
ok(near(r3(DC.calcTalentAttackSpeed(angel, slot(angel))), 12), '能天使基础攻速天赋 12 实=' + r3(DC.calcTalentAttackSpeed(angel, slot(angel))));
ok(near(r3(DC.calcTalentAttackSpeed(angel, slot(angel, modKey(angel, '_003_', 3)))), 12), '能天使 Y3 攻速仍 12(不 ×25 层) 实=' + r3(DC.calcTalentAttackSpeed(angel, slot(angel, modKey(angel, '_003_', 3)))));
const angelN = (mod) => DC.calculateOperator(angel, slot(angel, mod)).normalDps;
ok(near(r3(angelN(null)), 75.936), '能天使无模组常态 DPS 75.936 实=' + r3(angelN(null)));
ok(near(r3(angelN(modKey(angel, '_003_', 2))), 287.862), '能天使 Y2 常态 DPS 287.862(无视 150 防) 实=' + r3(angelN(modKey(angel, '_003_', 2))));
ok(near(r3(angelN(modKey(angel, '_003_', 3))), 406.986), '能天使 Y3 常态 DPS 406.986(无视 250 防) 实=' + r3(angelN(modKey(angel, '_003_', 3))));
const angelS2 = DC.calculateOperator(angel, Object.assign(slot(angel, modKey(angel, '_003_', 3)), { skillIndex: 1 }));
ok(near(r3(angelS2.normalDps), 406.986), '能天使 Y3 S2 槽常态列与无技能同值(穿防同口径) 实=' + r3(angelS2.normalDps));

// ---- 莱伊:入神「攻击相同目标每次 +8%」(攻击次数型,3/4 层 → 24%/32%/36%) ----
const ray = load('char_4117_ray');
ok(near(r3(DC.calcTalentAtkBonus(ray, slot(ray))), 0.24), '莱伊 入神 3 层 → +24% 实=' + r3(DC.calcTalentAtkBonus(ray, slot(ray))));
ok(near(r3(DC.calcTalentAtkBonus(ray, slot(ray, modKey(ray, '_003_', 2)))), 0.32), '莱伊 Y2 4 层 → +32% 实=' + r3(DC.calcTalentAtkBonus(ray, slot(ray, modKey(ray, '_003_', 2)))));
ok(near(r3(DC.calcTalentAtkBonus(ray, slot(ray, modKey(ray, '_003_', 3)))), 0.36), '莱伊 Y3 9%×4 → +36% 实=' + r3(DC.calcTalentAtkBonus(ray, slot(ray, modKey(ray, '_003_', 3)))));

// ---- W:Y 模组「部署后每秒 +1 层永久攻击力」(时间型,0.5%×20 / 1.25%×16) ----
const w = load('char_113_cqbw');
ok(near(r3(DC.calcTalentAtkBonus(w, slot(w))), 0), 'W 无模组天赋攻击 0 实=' + r3(DC.calcTalentAtkBonus(w, slot(w))));
ok(near(r3(DC.calcTalentAtkBonus(w, slot(w, modKey(w, '_003_', 2)))), 0.1), 'W Y2 每秒叠层叠满 → +10% 实=' + r3(DC.calcTalentAtkBonus(w, slot(w, modKey(w, '_003_', 2)))));
ok(near(r3(DC.calcTalentAtkBonus(w, slot(w, modKey(w, '_003_', 3)))), 0.2), 'W Y3 → +20% 实=' + r3(DC.calcTalentAtkBonus(w, slot(w, modKey(w, '_003_', 3)))));

// ---- 信仰搅拌机:扫射迎宾仪礼「每次造成伤害 10s 内攻速 +3」(攻击次数型,3 层 → 9;X 模组 12/15) ----
const rmx = load('char_4194_rmixer');
ok(near(r3(DC.calcTalentAttackSpeed(rmx, slot(rmx))), 9), '信仰搅拌机 3 层 → 攻速 +9 实=' + r3(DC.calcTalentAttackSpeed(rmx, slot(rmx))));
ok(near(r3(DC.calcTalentAttackSpeed(rmx, slot(rmx, modKey(rmx, '_002_', 2)))), 12), '信仰搅拌机 X2 → 攻速 +12 实=' + r3(DC.calcTalentAttackSpeed(rmx, slot(rmx, modKey(rmx, '_002_', 2)))));
ok(near(r3(DC.calcTalentAttackSpeed(rmx, slot(rmx, modKey(rmx, '_002_', 3)))), 15), '信仰搅拌机 X3 → 攻速 +15 实=' + r3(DC.calcTalentAttackSpeed(rmx, slot(rmx, modKey(rmx, '_002_', 3)))));

// ---- 不计入的三类:羽毛笔(击杀)、年(护盾破裂=受击)、珊比(敌方侵蚀爆发=敌方状态) ----
const crow = load('char_421_crow');
ok(DC.calcTalentAtkBonus(crow, slot(crow)) === 0 && DC.calcTalentAtkBonus(crow, slot(crow, modKey(crow, '_002_', 3))) === 0,
  '羽毛笔模组「叠满后攻击力+5/+8%」不计(击杀型)');
const nian = load('char_2014_nian');
ok(DC.calcTalentAtkBonus(nian, slot(nian, modKey(nian, '_002_', 3))) === 0, '年 X 模组盾破加攻不计(受击型)');
const thumpy = load('char_4235_thumpy');
ok(DC.calcTalentAtkBonus(thumpy, slot(thumpy, modKey(thumpy, '_002_', 3))) === 0, '珊比 X 模组叠满加攻不计(敌方状态型)');

console.log('叠层口径: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
