// 干员数据 - 从 JSON 文件动态加载
// 数据来源: Kengxxiao/ArknightsGameData

// 技能类型枚举
export const SkillType = {
  DURATION_BUFF: 'DurationBuff',
  TRIGGERED_ATTACK: 'TriggeredAttack',
  PASSIVE_AURA: 'PassiveAura',
  HEAL: 'Heal',
  MULTI_HIT: 'MultiHit',
  SPECIAL: 'Special',
  UNKNOWN: 'Unknown'
};

// 属性修饰符运算符
export const Operator = {
  DIRECT_ADD: 'direct_add',
  DIRECT_MUL: 'direct_mul',
  FINAL_ADD: 'final_add',
  FINAL_MUL: 'final_mul',
};

// 职业中文映射（主职业，固定8个）
const PROFESSION_CN = {
  WARRIOR: '近卫', SNIPER: '狙击', CASTER: '术师', TANK: '重装',
  PIONEER: '先锋', MEDIC: '医疗', SUPPORT: '辅助', SPECIAL: '特种',
  TOKEN: '特殊'
};

// 缓存
let _index = null;
let _subProfDict = null;
const _cache = {};

function parseRarity(r) {
  if (typeof r === 'number') return r;
  const m = String(r).match(/(\d)/);
  return m ? parseInt(m[1]) : 1;
}

async function loadSubProfDict() {
  if (_subProfDict) return _subProfDict;
  const resp = await fetch('data/sub-professions.json');
  _subProfDict = await resp.json();
  return _subProfDict;
}

async function loadIndex() {
  if (_index) return _index;
  const resp = await fetch('data/index.json');
  _index = await resp.json();
  return _index;
}

async function loadOperator(id) {
  if (_cache[id]) return _cache[id];
  const index = await loadIndex();
  const entry = index.find(e => e.id === id);
  if (!entry) return null;
  const resp = await fetch(`data/${entry.profession}/${entry.subProfessionId}/${id}.json`);
  if (!resp.ok) return null;
  _cache[id] = await resp.json();
  return _cache[id];
}

export async function getPopularOperators() {
  const index = await loadIndex();
  return index.map(op => ({
    id: op.id,
    name: op.name,
    rarity: parseRarity(op.rarity),
    profession: op.profession,
    subProfessionId: op.subProfessionId,
    ownerName: op.ownerName || null
  }));
}

export async function getOperatorData(id) {
  if (_cache[id]) return _cache[id];
  const index = await loadIndex();
  const entry = index.find(e => e.id === id);
  if (entry) return loadOperator(id);
  return null;
}

export function getProfessionCN(profession) {
  return PROFESSION_CN[profession] || profession;
}

export async function getSubProfessionCN(subProfessionId) {
  const dict = await loadSubProfDict();
  return dict[subProfessionId]?.subProfessionName || subProfessionId;
}
