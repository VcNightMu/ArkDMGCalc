// ArkDMGCalc - Main Application
import { calcPhysicalDamage, calcArtsDamage, calcRealInterval, interpolateAttr, calcAttribute } from './calculator.js';
import { getPopularOperators, getOperatorData, getProfessionCN, getSubProfessionCN, Operator, SkillType } from './operators.js';

// ======== State ========
const state = {
  slots: [null, null, null, null, null],
  enemy: { hp: 50000, atk: 800, def: 600, res: 50 }
};

// ======== Init ========
document.addEventListener('DOMContentLoaded', () => {
  initEnemyPanel();
  initOperatorSlots();
  bindEvents();
});

// ======== Enemy Panel ========
function initEnemyPanel() {
  const inputs = {
    hp: document.getElementById('enemy-hp'),
    atk: document.getElementById('enemy-atk'),
    def: document.getElementById('enemy-def'),
    res: document.getElementById('enemy-res')
  };
  Object.entries(inputs).forEach(([key, input]) => {
    input.addEventListener('input', () => {
      state.enemy[key] = Number(input.value) || 0;
      updateResults();
    });
  });
}

// ======== Operator Slots ========
function initOperatorSlots() {
  const container = document.getElementById('operator-slots');
  container.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const slot = document.createElement('div');
    slot.className = 'operator-slot empty';
    slot.dataset.index = i;
    slot.innerHTML = '<span>+ 添加干员</span>';
    slot.addEventListener('click', (e) => {
      if (!slot.classList.contains('empty')) return;
      showOperatorPicker(i);
    });
    container.appendChild(slot);
  }
}

async function showOperatorPicker(slotIndex) {
  const operators = await getPopularOperators();
  const rarityLabels = { 6: '六星', 5: '五星', 4: '四星', 3: '三星', 2: '二星', 1: '一星' };

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:100;display:flex;align-items:center;justify-content:center;';

  const picker = document.createElement('div');
  picker.style.cssText = 'background:#16213e;border-radius:12px;padding:20px;max-width:500px;width:90%;max-height:70vh;overflow-y:auto;border:1px solid #2a2a4a;';

  let html = '<h3 style="margin-bottom:16px;color:#eaeaea;">选择干员</h3>';
  html += '<input type="text" id="picker-search" placeholder="搜索..." style="width:100%;padding:8px 12px;background:#1e1e3a;border:1px solid #2a2a4a;border-radius:6px;color:#eaeaea;font-size:14px;margin-bottom:12px;outline:none;">';
  html += '<div class="picker-list">';
  for (const op of operators) {
    const rNum = typeof op.rarity === 'number' ? op.rarity : parseInt(String(op.rarity).match(/\d/)?.[1] || '1');
    html += `<div class="picker-item" data-id="${op.id}" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;cursor:pointer;border:1px solid transparent;margin-bottom:4px;">`;
    html += `<span class="rarity-${rNum}" style="font-size:13px;min-width:30px;">${rarityLabels[rNum] || ''}</span>`;
    html += `<span style="color:#eaeaea;">${op.name}</span>`;
    html += '</div>';
  }
  html += '</div>';
  picker.innerHTML = html;
  overlay.appendChild(picker);
  document.body.appendChild(overlay);

  const searchInput = picker.querySelector('#picker-search');
  searchInput.addEventListener('input', () => {
    const keyword = searchInput.value.toLowerCase();
    picker.querySelectorAll('.picker-item').forEach(item => {
      item.style.display = item.textContent.toLowerCase().includes(keyword) ? 'flex' : 'none';
    });
  });

  picker.querySelectorAll('.picker-item').forEach(item => {
    item.addEventListener('click', async () => {
      const opId = item.dataset.id;
      const opData = await getOperatorData(opId);
      if (opData) {
        const maxElite = opData.phases.length - 1;
        state.slots[slotIndex] = {
          operatorId: opId,
          elite: maxElite,
          level: opData.phases[maxElite].maxLevel,
          trustPercent: 100,
          potentialRank: 0,
          skillLevel: 9
        };
        await renderSlot(slotIndex);
        updateResults();
      }
      overlay.remove();
    });
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  searchInput.focus();
}

async function renderSlot(index) {
  const container = document.getElementById('operator-slots');
  const slots = container.querySelectorAll('.operator-slot');
  const slot = slots[index];
  const data = state.slots[index];

  if (!data) {
    slot.className = 'operator-slot empty';
    slot.innerHTML = '<span>+ 添加干员</span>';
    return;
  }

  const op = await getOperatorData(data.operatorId);
  if (!op) return;

  const phase = op.phases[data.elite] || op.phases[op.phases.length - 1];
  const maxLevel = phase.maxLevel;
  const rarityNum = typeof op.rarity === 'number' ? op.rarity : parseInt(String(op.rarity).match(/\d/)?.[1] || '1');
  const subProfName = await getSubProfessionCN(op.subProfessionId);

  slot.className = 'operator-slot';
  let html = '';
  html += '<div class="slot-header">';
  html += '<div class="slot-avatar">&#9876;&#65039;</div>';
  html += '<div class="slot-info">';
  html += '<h3 class="rarity-' + rarityNum + '">' + op.name + '</h3>';
  html += '<span class="profession">' + getProfessionCN(op.profession) + ' \u00B7 ' + subProfName + '</span>';
  html += '</div>';
  html += '<button class="btn btn-remove" data-action="remove" data-index="' + index + '" style="margin-left:auto;">&#10005;</button>';
  html += '</div>';

  html += '<div class="slot-config">';
  // elite
  html += '<div class="form-group"><label>\u7CBE\u82F1\u5316</label>';
  html += '<select data-index="' + index + '" data-field="elite">';
  for (let i = 0; i < op.phases.length; i++) {
    const p = op.phases[i];
    const sel = i === data.elite ? ' selected' : '';
    html += '<option value="' + i + '"' + sel + '>E' + p.eliteLevel + '</option>';
  }
  html += '</select></div>';
  // level
  html += '<div class="form-group"><label>\u7B49\u7EA7</label>';
  html += '<input type="number" data-index="' + index + '" data-field="level" value="' + data.level + '" min="1" max="' + maxLevel + '">';
  html += '</div>';
  // trust
  html += '<div class="form-group"><label>\u4FE1\u8D56%</label>';
  html += '<input type="number" data-index="' + index + '" data-field="trustPercent" value="' + data.trustPercent + '" min="0" max="100">';
  html += '</div>';
  // skill
  html += '<div class="form-group"><label>\u6280\u80FD</label>';
  // skill index - restricted by elite: E0=skill1, E1=skill1-2, E2=skill1-3
  const maxSiForElite = data.elite === 0 ? 0 : data.elite === 1 ? 1 : 2;
  const skillCount = Math.min(op.skills.length, maxSiForElite + 1);
  html += '<select data-index="' + index + '" data-field="skillIndex">';
  for (let i = 0; i < skillCount; i++) {
    const sel = i === (data.skillIndex || 0) ? ' selected' : '';
    html += '<option value="' + i + '"' + sel + '>' + op.skills[i].name + '</option>';
  }
  html += '</select></div>';
  // skill level
  html += '<div class="form-group"><label>\u6280\u80FD\u7B49\u7EA7</label>';
  html += '<select data-index="' + index + '" data-field="skillLevel">';
  const maxSkillIdx = data.elite === 0 ? 3 : data.elite === 1 ? 6 : 9;
  const allSlOpts = [[0,'Lv1'],[1,'Lv2'],[2,'Lv3'],[3,'Lv4'],[4,'Lv5'],[5,'Lv6'],[6,'Lv7'],[7,'\u4E13\u4E00'],[8,'\u4E13\u4E8C'],[9,'\u4E13\u4E09']];
  const slOpts = allSlOpts.filter(function(x) { return x[0] <= maxSkillIdx; });
  for (const [v, lbl] of slOpts) {
    const sel = data.skillLevel === v ? ' selected' : '';
    html += '<option value="' + v + '"' + sel + '>' + lbl + '</option>';
  }
  html += '</select></div>';
  // potential
  html += '<div class="form-group"><label>\u6F5C\u80FD</label>';
  html += '<select data-index="' + index + '" data-field="potentialRank">';
  const pots = op.potentialRanks || [];
  for (let i = 0; i < pots.length; i++) {
    const sel = data.potentialRank === i + 1 ? ' selected' : '';
    html += '<option value="' + (i + 1) + '"' + sel + '>' + (i + 1) + '\u9636 - ' + pots[i].description + '</option>';
  }
  const selNone = data.potentialRank === 0 ? ' selected' : '';
  html += '<option value="0"' + selNone + '>\u65E0\u6F5C\u80FD</option>';
  html += '</select></div>';
  html += '</div>';

  slot.innerHTML = html;

  // bind events
  slot.querySelector('[data-action="remove"]').addEventListener('click', (e) => {
    e.stopPropagation();
    state.slots[index] = null;
    renderSlot(index);
    updateResults();
  });

  slot.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('change', async (e) => {
      const field = e.target.dataset.field;
      const value = e.target.type === 'number' ? Number(e.target.value) : Number(e.target.value);
      state.slots[index][field] = value;
      if (field === 'elite') {
        const newPhase = op.phases[value] || op.phases[op.phases.length - 1];
        state.slots[index].level = Math.min(state.slots[index].level, newPhase.maxLevel);
        const maxSl = value === 0 ? 3 : value === 1 ? 6 : 9;
        if (state.slots[index].skillLevel > maxSl) state.slots[index].skillLevel = maxSl;
        const maxSi = value === 0 ? 0 : value === 1 ? 1 : 2;
        if (state.slots[index].skillIndex > maxSi) state.slots[index].skillIndex = maxSi;
        await renderSlot(index);
      }
      updateResults();
    });
  });
}

// ======== Results ========
async function updateResults() {
  const container = document.getElementById('result-comparison');
  const filledSlots = state.slots.filter(s => s !== null);

  if (filledSlots.length === 0) {
    container.innerHTML = '<p class="placeholder-text">\u9009\u62E9\u5E72\u5458\u540E\u663E\u793A\u8BA1\u7B97\u7ED3\u679C</p>';
    return;
  }

  container.innerHTML = '';

  for (const slotData of filledSlots) {
    const op = await getOperatorData(slotData.operatorId);
    if (!op) continue;

    const result = calculateOperator(op, slotData);
    const card = document.createElement('div');
    card.className = 'result-card';
    const rarityNum = typeof op.rarity === 'number' ? op.rarity : parseInt(String(op.rarity).match(/\d/)?.[1] || '1');
    const skillName = op.skills[slotData.skillIndex || 0]?.name || '';

    let metricsHtml = '';
    if (result.type === 'heal') {
      metricsHtml = '<div class="metric"><span class="label">HPS</span><span class="value heal">' + result.hps.toFixed(0) + '</span></div>';
      metricsHtml += '<div class="metric"><span class="label">\u603B\u6CBB\u7597\u91CF</span><span class="value heal">' + result.totalHeal.toFixed(0) + '</span></div>';
    } else {
      metricsHtml = '<div class="metric"><span class="label">\u6280\u80FD\u671F DPS</span><span class="value dps">' + result.skillDps.toFixed(0) + '</span></div>';
      metricsHtml += '<div class="metric"><span class="label">\u6280\u80FD\u671F\u603B\u4F24</span><span class="value damage">' + result.skillTotalDamage.toFixed(0) + '</span></div>';
      metricsHtml += '<div class="metric"><span class="label">\u5FAA\u73AF DPS</span><span class="value dps">' + result.cycleDps.toFixed(0) + '</span></div>';
      metricsHtml += '<div class="metric"><span class="label">\u653B\u51FB\u95F4\u9694</span><span class="value">' + result.realInterval.toFixed(2) + 's</span></div>';
      metricsHtml += '<div class="metric"><span class="label">\u9762\u677F ATK</span><span class="value">' + result.panelAtk.toFixed(0) + '</span></div>';
    }

    card.innerHTML = '<div class="result-header">' +
      '<span class="rarity-' + rarityNum + '" style="font-size:13px;">\u2605' + rarityNum + '</span>' +
      '<h3>' + op.name + '</h3>' +
      '<span style="font-size:12px;color:#a0a0b0;margin-left:auto;">' + skillName + '</span>' +
      '</div><div class="result-metrics">' + metricsHtml + '</div>';
    container.appendChild(card);
  }
}

function calculateOperator(op, slotData) {
  const phase = op.phases[slotData.elite] || op.phases[op.phases.length - 1];
  const maxLevel = phase.maxLevel;

  const baseAtk = interpolateAttr(phase.atk[0], phase.atk[1], slotData.level, maxLevel);
  const baseDef = interpolateAttr(phase.def[0], phase.def[1], slotData.level, maxLevel);
  const baseHp = interpolateAttr(phase.maxHp[0], phase.maxHp[1], slotData.level, maxLevel);

  const trustAtk = op.trustBonus.atk * (slotData.trustPercent / 100);
  const trustDef = op.trustBonus.def * (slotData.trustPercent / 100);

  // potential bonuses
  let potAtk = 0, potDef = 0, potHp = 0;
  const potRank = slotData.potentialRank || 0;
  if (potRank > 0 && op.potentialRanks) {
    for (let i = 0; i < Math.min(potRank, op.potentialRanks.length); i++) {
      for (const m of (op.potentialRanks[i].modifiers || [])) {
        if (m.attr === 'ATK' && m.formula === 'ADDITION') potAtk += m.value;
        if (m.attr === 'DEF' && m.formula === 'ADDITION') potDef += m.value;
        if (m.attr === 'MAX_HP' && m.formula === 'ADDITION') potHp += m.value;
      }
    }
  }

  let panelAtk = baseAtk + trustAtk + potAtk;
  let panelDef = baseDef + trustDef + potDef;
  const panelHp = baseHp + (op.trustBonus.maxHp || 0) * (slotData.trustPercent / 100) + potHp;

  const skillIndex = slotData.skillIndex || 0;
  const skill = op.skills[skillIndex];
  if (!skill) return { type: 'unknown', skillDps: 0, skillTotalDamage: 0, cycleDps: 0, realInterval: phase.baseAttackTime, panelAtk };

  const levelData = getSkillLevelData(skill, slotData.skillLevel);

  let skillAtk = panelAtk;
  let skillDef = panelDef;
  let skillInterval = phase.baseAttackTime;
  let skillDuration = levelData.duration || 0;
  let attackTargets = 1;

  const modifiers = [];
  // atk key = ATK百分比加成 (direct_mul)
  if (levelData.atk !== undefined) modifiers.push({ value: levelData.atk, operator: 'direct_mul' });
  // def key = DEF百分比减益 (final_mul)
  if (levelData.def !== undefined) modifiers.push({ value: levelData.def, operator: 'final_mul' });
  // atk_scale = ATK倍率 (直接乘算到面板)
  if (levelData.atk_scale !== undefined) skillAtk = panelAtk * levelData.atk_scale;
  // attack@max_target / max_target = 攻击目标数
  if (levelData['attack@max_target']) attackTargets = levelData['attack@max_target'];
  else if (levelData.max_target) attackTargets = levelData.max_target;
  // attack_speed = 攻击速度
  if (levelData.attack_speed) skillInterval = calcRealInterval(phase.baseAttackTime, 100 + levelData.attack_speed);
  // base_attack_time = 攻击间隔覆盖
  if (levelData.base_attack_time) skillInterval = levelData.base_attack_time;

  if (modifiers.length > 0) {
    skillAtk = calcAttribute(panelAtk, modifiers.filter(m => m.operator === 'direct_mul'));
    skillDef = calcAttribute(panelDef, modifiers.filter(m => m.operator === 'final_mul'));
  }

  const enemy = state.enemy;
  const isArts = op.damageType === 'arts';
  const singleHitDamage = isArts ? calcArtsDamage(skillAtk, enemy.res) : calcPhysicalDamage(skillAtk, enemy.def);

  const realInterval = skillInterval;
  const skillAttacks = skillDuration > 0 ? Math.floor(skillDuration / realInterval) : 1;
  const skillTotalDamage = singleHitDamage * skillAttacks;
  const skillDps = skillDuration > 0 ? skillTotalDamage / skillDuration : 0;

  const spCost = levelData.spCost || 0;
  const cycleTime = skillDuration + (spCost * realInterval);
  const cycleDps = cycleTime > 0 ? skillTotalDamage / cycleTime : skillDps;

  if (skill.type === SkillType.HEAL) {
    const healPercent = levelData.heal_percent || 0;
    const hps = panelHp * (1 + healPercent) / (levelData.duration || 1);
    const totalHeal = hps * (levelData.duration || 1);
    return { type: 'heal', hps, totalHeal, panelAtk };
  }

  return { type: 'damage', skillDps, skillTotalDamage, cycleDps, realInterval, panelAtk: skillAtk };
}

function getSkillLevelData(skill, level) {
  const levels = skill.levels;
  return levels[level] || levels[levels.length - 1];
}

// ======== Events ========
function bindEvents() {
  const searchInput = document.getElementById('operator-search');
  searchInput.addEventListener('input', async () => {
    const keyword = searchInput.value.toLowerCase();
    if (!keyword) return;
    const operators = await getPopularOperators();
    const match = operators.find(op => op.name.toLowerCase().includes(keyword));
    if (match) {
      const emptyIndex = state.slots.findIndex(s => s === null);
      if (emptyIndex !== -1) {
        const opData = await getOperatorData(match.id);
        if (opData) {
          const maxElite = opData.phases.length - 1;
          state.slots[emptyIndex] = {
            operatorId: match.id,
            elite: maxElite,
            level: opData.phases[maxElite].maxLevel,
            trustPercent: 100,
            potentialRank: 0,
            skillLevel: 9
          };
          await renderSlot(emptyIndex);
          updateResults();
          searchInput.value = '';
        }
      }
    }
  });
}
