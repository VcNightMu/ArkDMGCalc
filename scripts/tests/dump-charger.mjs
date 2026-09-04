// 冲锋手 dump:7人各槽位输出
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/PIONEER/charger/';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };
for (const f of fs.readdirSync(B).filter(f => f.endsWith('.json')).sort()) {
  const op = JSON.parse(fs.readFileSync(B + f, 'utf8'));
  const e = Math.min(2, op.phases.length - 1);
  const slot = { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7 };
  const ps = calcPanelStats(op, slot);
  console.log(`===== ${op.name} (${op.id}) | atk=${ps.panelAtk} 间隔=${ps.attackInterval.toFixed(3)}`);
  for (let si = 0; si < op.skills.length; si++) {
    const s = op.skills[si];
    try {
      const r = calculateOperator(op, { ...slot, skillIndex: si });
      const dt = r.dmgTypes ? Object.keys(r.dmgTypes).map(k => `${k}:${JSON.stringify(r.dmgTypes[k])}`).join(' | ') : '';
      console.log(`  S${si + 1} ${s.name}: 间隔=${(r.realInterval || 0).toFixed(3)} | DPS=${(r.skillDps ?? '-').toString().slice(0, 7)} | 总伤=${(r.skillTotalDamage ?? '-').toString().slice(0, 9)} | cycle=${(r.cycleDps ?? '-') ? (r.cycleDps === null ? '-' : r.cycleDps.toFixed(1)) : '-'} | 常态DPS=${(r.normalDps ?? '-') ? (r.normalDps === null ? '-' : r.normalDps.toFixed(2)) : '-'} | ${r.damageType}${dt ? ' [' + dt + ']' : ''}`);
    } catch (err) {
      console.log(`  S${si + 1} ${s.name}: ERROR ${err.message.slice(0, 90)}`);
    }
  }
}
