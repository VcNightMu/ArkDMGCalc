// 尖兵全量 dump:检查 16 人各槽位输出
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/PIONEER/pioneer/';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };
const names = fs.readdirSync(B).filter(f => f.endsWith('.json')).sort();
for (const f of names) {
  const op = JSON.parse(fs.readFileSync(B + f, 'utf8'));
  const e = Math.min(2, op.phases.length - 1);
  const slot = { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7 };
  const ps = calcPanelStats(op, slot);
  console.log(`===== ${op.name} (${op.id}) | 面板 atk=${ps.panelAtk} def=${ps.panelDef} 间隔=${ps.attackInterval.toFixed(3)}`);
  for (let si = 0; si < op.skills.length; si++) {
    const s = op.skills[si];
    try {
      const r = calculateOperator(op, { ...slot, skillIndex: si });
      console.log(`  S${si + 1} ${s.name}: 间隔=${(r.realInterval || 0).toFixed(3)} | 技能DPS=${(r.skillDps ?? '-').toString().slice(0, 8)} | 总伤=${(r.skillTotalDamage ?? '-').toString().slice(0, 10)} | cycle=${(r.cycleDps ?? '-') ? (r.cycleDps ?? '-').toString().slice(0, 8) : '-'} | 常态DPS=${(r.normalDps ?? '-').toString().slice(0, 8)} | 类型=${r.damageType}${r.dmgTypes ? ' | 分档:' + Object.keys(r.dmgTypes).map(k => `${k}:${JSON.stringify(r.dmgTypes[k])}`).join(' ') : ''}`);
    } catch (err) {
      console.log(`  S${si + 1} ${s.name}: ERROR ${err.message.slice(0, 80)}`);
    }
  }
}
