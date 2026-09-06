// 全干员数值快照防护网:对 index 全部条目(含召唤物)满练配置,遍历全技能位+无技能态+效果模组L3档,
// 计算关键数值落盘 baseline.json。运行模式: node verify-snapshot.mjs        → 重算比对,有差异即失败
//                                                  node verify-snapshot.mjs --update → 重算并覆盖基线
import { calculateOperator, calcPanelStats } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const BASE_FILE = 'F:/ArkCodes/ArkDMGCalc/scripts/tests/snapshots/baseline.json';
const UPDATE = process.argv.includes('--update');
const idx = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));

const R3 = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
const snapTypes = (t) => {
  if (!t) return null;
  const out = {};
  for (const k of Object.keys(t)) {
    out[k] = { sd: R3(t[k].skillDps), st: R3(t[k].skillTotalDamage), cd: R3(t[k].cycleDps), dps: R3(t[k].dps) };
  }
  return out;
};

function calcEntry(e) {
  const p = path.join(DATA, e.profession, e.subProfessionId, e.id + '.json');
  if (!fs.existsSync(p)) return null;
  let o; try { o = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  const elite = o.phases.length - 1;
  const level = o.phases[elite].maxLevel;
  const skills = o.skills || [];
  const mk = (si, module) => ({ elite, level, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module });
  const entries = {};
  for (let si = -1; si < skills.length; si++) {
    const r = calculateOperator(o, mk(si, null));
    entries['s' + (si + 1)] = {
      type: r.type, dt: r.damageType, atk: R3(r.panelAtk), int: R3(r.realInterval),
      sDps: R3(r.skillDps), sTot: R3(r.skillTotalDamage), cDps: R3(r.cycleDps),
      nDps: R3(r.normalDps), sHps: R3(r.skillHps), nHps: R3(r.normalHps), tHeal: R3(r.totalHeal),
      dmg: snapTypes(r.dmgTypes), nm: snapTypes(r.normalTypes),
    };
  }
  // 效果模组全档(L1/L2/L3 均有机制引入点:特性追加在 traitEnhance、天赋增强在 talentEnhance,
  // L1 即有特性追加/白值、L2 起常含天赋增强)——每模组每档独立分键防多模组互覆(X+Y 干员曾只存后一个):
  // 键格式 m<typeName2>L<档>s<技能位>,如 mXL3s1 = X 模组 L3 技能1、mYL2s0 = Y 模组 L2 无技能态。
  for (const mod of (o.modules || [])) {
    if (mod.type !== 'ADVANCED') continue;
    const tag = mod.typeName2 || 'M';
    for (const lv of (mod.levels || [])) {
      const slotMod = { moduleId: mod.id, moduleLevel: lv.level };
      for (let si = -1; si < skills.length; si++) {
        const r = calculateOperator(o, mk(si, slotMod));
        const mKey = 'm' + tag + 'L' + lv.level + 's' + (si + 1);
        entries[mKey] = {
          type: r.type, dt: r.damageType, atk: R3(r.panelAtk), int: R3(r.realInterval),
          sDps: R3(r.skillDps), sTot: R3(r.skillTotalDamage), cDps: R3(r.cycleDps),
          nDps: R3(r.normalDps), sHps: R3(r.skillHps), nHps: R3(r.normalHps), tHeal: R3(r.totalHeal),
          dmg: snapTypes(r.dmgTypes), nm: snapTypes(r.normalTypes),
        };
      }
    }
  }
  return { name: o.name, skills: skills.map(s => s.name), entries };
}

const result = {};
let fail = 0, pass = 0;
for (const e of idx) {
  const c = calcEntry(e);
  if (!c) continue;
  result[e.id] = c;
  pass++;
}
console.log('计算条目: ' + pass);

if (UPDATE) {
  fs.mkdirSync(path.dirname(BASE_FILE), { recursive: true });
  fs.writeFileSync(BASE_FILE, JSON.stringify(result, null, 1), 'utf8');
  console.log('基线已更新: ' + BASE_FILE);
  process.exit(0);
}
// 比对模式
if (!fs.existsSync(BASE_FILE)) { console.log('基线不存在,先跑 --update'); process.exit(2); }
const base = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8'));
const KEYS = ['type', 'dt', 'atk', 'int', 'sDps', 'sTot', 'cDps', 'nDps', 'sHps', 'nHps', 'tHeal'];
const diffList = [];
for (const id of Object.keys(result)) {
  const cur = result[id];
  const old = base[id];
  if (!old) { diffList.push(id + ': 新增干员无基线'); continue; }
  for (const sk of Object.keys(cur.entries)) {
    const ce = cur.entries[sk], oe = (old.entries || {})[sk];
    if (!oe) { diffList.push(id + '/' + sk + ': 新增技能位无基线'); continue; }
    for (const k of KEYS) {
      if (ce[k] !== oe[k]) diffList.push(id + '/' + sk + ' ' + k + ': ' + oe[k] + ' → ' + ce[k]);
    }
    for (const sub of ['dmg', 'nm']) {
      const a = JSON.stringify(ce[sub]) !== JSON.stringify(oe[sub]);
      if (a && (ce[sub] || oe[sub])) diffList.push(id + '/' + sk + ' ' + sub + ': ' + JSON.stringify(oe[sub]) + ' → ' + JSON.stringify(ce[sub]));
    }
  }
}
if (diffList.length === 0) { console.log('快照全等: ' + pass + ' 干员 无差异'); process.exit(0); }
console.log('差异 ' + diffList.length + ' 条:');
for (const d of diffList.slice(0, 40)) console.log('  ' + d);
process.exit(1);
