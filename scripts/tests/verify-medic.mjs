// 验证医疗干员技能等级是否影响 HPS / 总治疗量
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc';
function load(id, sub) {
  return JSON.parse(fs.readFileSync(`${BASE}/src/frontend/data/MEDIC/${sub}/${id}.json`, 'utf8'));
}

const shining = load('char_147_shining', 'physician');
const plosis = load('char_128_plosis', 'ringhealer');

function run(label, op, skillIndex) {
  const maxLevel = op.phases[op.phases.length - 1].maxLevel;
  const slotData = { elite: 2, level: maxLevel, trustPercent: 100, potentialRank: 0, skillIndex };
  console.log(`\n=== ${label} (技能${skillIndex}: ${op.skills[skillIndex].name}) ===`);
  for (const lv of [0, 3, 6, 9]) {
    const r = calculateOperator(op, { ...slotData, skillLevel: lv });
    console.log(
      `  Lv${lv}: 面板ATK=${r.panelAtk.toFixed(1)}  间隔=${r.realInterval.toFixed(3)}s  ` +
      `常态HPS=${r.normalHps.toFixed(1)}  技能期HPS=${r.skillHps.toFixed(1)}  总治疗量=${(r.totalHeal ?? 0).toFixed(1)}`
    );
  }
}

run('闪灵', shining, 0);   // 信条：atk 加成
run('白面鸮', plosis, 0);  // 治疗强化·γ型：atk 加成
run('白面鸮', plosis, 1);  // 脑啡肽：base_attack_time 缩短间隔
