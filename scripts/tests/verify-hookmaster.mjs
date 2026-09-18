// 钩索师(hookmaster,特种)验证:精二满级/满信赖/潜0/专一(技能等级 7),敌 hp50000 atk800 def600 res50
// 口径(2026-09-18 用户):
//   所有钩索师:模组的「拖拽期间敌人受到正比于距离的法术伤害」均不计算
//   崖心:天赋「雪境猎手」的攻击力增幅默认不计算
//   歌蕾蒂娅:天赋「弱肉强食」的攻击力增幅默认不计算
// 引擎:
//   · 歌蕾蒂娅 S2 缺水的掌握怒海:攻击间隔增大(+50%) → base_attack_time 0.5 走 INTERVAL_GROW_OVERRIDES(1.8×1.5=2.7s);
//     每击倍率 attack@atk_scale 走 ATK_SCALE_REWRITE(顶层无 atk)
//   · 歌蕾蒂娅 S3 缺水的碎漩狂舞:每 interval(1.5s)法术伤害,龙卷风 hit_duration(9s)共 6 次 → 专用分支
//   · 崖心 S1 法术(SKILL_ARTS_OVERRIDES)/S2 真伤(SKILL_TRUE_DAMAGE);雪雉 S2 法术
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

// ---- 歌蕾蒂娅(char_474_glady) ----
{
  const o = loadOp('char_474_glady');
  const r0 = calculateOperator(o, mk(o, -1));
  eq(r0.damageType, 'physical', '歌蕾蒂娅 常态伤害类型=物理');
  near(r0.panelAtk, 851, 0.01, '歌蕾蒂娅 面板攻击力(弱肉强食不计)');
  near(r0.normalDps, 139.444, 0.05, '歌蕾蒂娅 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 1016.9, 0.5, '歌蕾蒂娅 S1 缺水的大洋裂断 总伤(190% 物理,可充能 3 次不改稳态)');
  near(s1.cycleDps, 303.78, 0.1, '歌蕾蒂娅 S1 循环 DPS(自动回 sp5)');
  eq(s1.normalDps, null, '歌蕾蒂娅 S1 常态列为 null(触发型)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.realInterval, 2.7, 0.001, '歌蕾蒂娅 S2 攻击间隔(增大 +50%:1.8×1.5)');
  near(s2.skillTotalDamage, 5331.2, 1, '歌蕾蒂娅 S2 总伤(每击 160% ×7 次,20s 窗口)');
  near(s2.skillDps, 266.56, 0.2, '歌蕾蒂娅 S2 技能期 DPS');
  near(s2.normalDps, 139.444, 0.05, '歌蕾蒂娅 S2 常态普攻保留');
  const s3 = calculateOperator(o, mk(o, 2));
  eq(s3.damageType, 'arts', '歌蕾蒂娅 S3 缺水的碎漩狂舞 伤害类型=法术');
  near(s3.realInterval, 1.5, 0.001, '歌蕾蒂娅 S3 龙卷风伤害间隔(1.5s)');
  near(s3.skillTotalDamage, 2808.3, 1, '歌蕾蒂娅 S3 总伤(110% 法术 ×6 次:hit_duration 9s/1.5)');
  near(s3.skillDps, 351.038, 0.2, '歌蕾蒂娅 S3 技能期 DPS(总伤/8s)');
  // X 模组(白值 atk+70)
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_glady', 3)));
  near(x3.panelAtk, 921, 0.01, '歌蕾蒂娅 X3 面板攻击力(851+70)');
  near(x3.normalDps, 178.333, 0.05, '歌蕾蒂娅 X3 常态 DPS');
  const x3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_glady', 3)));
  near(x3s2.skillTotalDamage, 6115.2, 1, '歌蕾蒂娅 X3 S2 总伤');
  const x3s3 = calculateOperator(o, mk(o, 2, mod(o, 'uniequip_002_glady', 3)));
  near(x3s3.skillTotalDamage, 3039.3, 1, '歌蕾蒂娅 X3 S3 总伤');
  // Y 模组(白值 atk+74;弱肉强食增幅不计)
  const y3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_003_glady', 3)));
  near(y3.panelAtk, 925, 0.01, '歌蕾蒂娅 Y3 面板攻击力(851+74)');
  const y3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_003_glady', 3)));
  near(y3s2.skillTotalDamage, 6160, 1, '歌蕾蒂娅 Y3 S2 总伤(弱肉强食 140%/145% 不计)');
  const y3s3 = calculateOperator(o, mk(o, 2, mod(o, 'uniequip_003_glady', 3)));
  near(y3s3.skillTotalDamage, 3052.5, 1, '歌蕾蒂娅 Y3 S3 总伤');
}

// ---- 崖心(char_173_slchan) ----
{
  const o = loadOp('char_173_slchan');
  near(calculateOperator(o, mk(o, -1)).normalDps, 130.556, 0.05, '崖心 常态 DPS(雪境猎手不计)');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.damageType, 'arts', '崖心 S1 锁链勾爪 伤害类型=法术');
  near(s1.skillTotalDamage, 626.25, 0.5, '崖心 S1 总伤(150% 法术)');
  near(s1.cycleDps, 219.25, 0.1, '崖心 S1 循环 DPS(自动回 sp5)');
  eq(s1.normalDps, null, '崖心 S1 常态列为 null(触发型)');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.damageType, 'true', '崖心 S2 束缚链 伤害类型=真实伤害');
  near(s2.skillTotalDamage, 1503, 0.5, '崖心 S2 总伤(180% 真实伤害,无视防御法抗)');
  near(s2.cycleDps, 214.056, 0.1, '崖心 S2 循环 DPS(自动回 sp18)');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_slchan', 3)));
  near(x3.panelAtk, 875, 0.01, '崖心 X3 面板攻击力(835+40)');
  near(x3.normalDps, 152.778, 0.05, '崖心 X3 常态 DPS');
  const x3s2 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_slchan', 3)));
  near(x3s2.skillTotalDamage, 1575, 0.5, '崖心 X3 S2 总伤(真伤)');
}

// ---- 雪雉(char_383_snsant) ----
{
  const o = loadOp('char_383_snsant');
  near(calculateOperator(o, mk(o, -1)).normalDps, 80.556, 0.05, '雪雉 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  eq(s1.damageType, 'physical', '雪雉 S1 倒刺钩爪 伤害类型=物理');
  near(s1.skillTotalDamage, 517.5, 0.5, '雪雉 S1 总伤(150% 物理)');
  near(s1.cycleDps, 161.5, 0.1, '雪雉 S1 循环 DPS(自动回 sp5)');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.damageType, 'arts', '雪雉 S2 伸缩式电捕网 伤害类型=法术');
  near(s2.skillTotalDamage, 633.25, 0.5, '雪雉 S2 总伤(170% 法术)');
  near(s2.cycleDps, 111.412, 0.1, '雪雉 S2 循环 DPS(自动回 sp20)');
}

// ---- 杏仁(char_4105_almond) ----
{
  const o = loadOp('char_4105_almond');
  near(calculateOperator(o, mk(o, -1)).normalDps, 52.778, 0.05, '杏仁 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 442.5, 0.5, '杏仁 S1 磁力抓取 总伤(150% 物理)');
  near(s1.cycleDps, 126.5, 0.1, '杏仁 S1 循环 DPS(自动回 sp5)');
  const s2 = calculateOperator(o, mk(o, 1));
  eq(s2.damageType, 'physical', '杏仁 S2 强力牵引 伤害类型=物理');
  near(s2.skillTotalDamage, 1024, 0.5, '杏仁 S2 总伤(160% ×2 次:hit_duration 4s/1.5s)');
  near(s2.skillDps, 256, 0.2, '杏仁 S2 技能期 DPS(总伤/4s)');
  near(s2.normalDps, 52.778, 0.05, '杏仁 S2 常态普攻保留');
}

// ---- 暗索(char_236_rope) ----
{
  const o = loadOp('char_236_rope');
  near(calculateOperator(o, mk(o, -1)).normalDps, 71.111, 0.05, '暗索 常态 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 637.6, 0.5, '暗索 S1 勾爪发射 总伤(170% 物理)');
  near(s1.cycleDps, 178.72, 0.1, '暗索 S1 循环 DPS(自动回 sp5)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 819.6, 0.5, '暗索 S2 复式勾爪 总伤(195% 物理)');
  near(s2.cycleDps, 116.644, 0.1, '暗索 S2 循环 DPS(自动回 sp18)');
  const x3 = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_rope', 3)));
  near(x3.panelAtk, 759, 0.01, '暗索 X3 面板攻击力(728+31)');
  near(x3.normalDps, 88.333, 0.05, '暗索 X3 常态 DPS');
}

// ---- 不变量:非永久/非触发槽的常态化列 = 无技能态 ----
{
  const ids = ['char_474_glady', 'char_173_slchan', 'char_383_snsant', 'char_4105_almond', 'char_236_rope'];
  for (const id of ids) {
    const o = loadOp(id);
    const mods = [null];
    for (const m of (o.modules || [])) if (m.type === 'ADVANCED') for (const lv of (m.levels || [])) mods.push(mod(o, m.id, lv.level));
    for (const mm of mods) {
      const n0 = calculateOperator(o, mk(o, -1, mm)).normalDps;
      for (let si = 0; si < (o.skills || []).length; si++) {
        const r = calculateOperator(o, mk(o, si, mm));
        if (r.normalDps === null || r.isPermanent) continue;
        near(r.normalDps, n0, 0.02, `${o.name} S${si + 1} 常态=无技能态`);
      }
    }
  }
}
console.log('钩索师: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
