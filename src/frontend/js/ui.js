// ArkDMGCalc - UI Rendering
import { getPopularOperators, getOperatorData, getProfessionCN, getSubProfessionCN } from './operators.js';
import { state } from './state.js';
import { calculateOperator } from './damage-calc.js';

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
  html += '<span class="profession">' + getProfessionCN(op.profession) + ' · ' + subProfName + '</span>';
  html += '</div>';
  html += '<button class="btn btn-remove" data-action="remove" data-index="' + index + '" style="margin-left:auto;">&#10005;</button>';
  html += '</div>';

  html += '<div class="slot-config">';
  html += '<div class="form-group"><label>精英化</label>';
  html += '<select data-index="' + index + '" data-field="elite">';
  for (let i = 0; i < op.phases.length; i++) {
    const p = op.phases[i];
    const sel = i === data.elite ? ' selected' : '';
    html += '<option value="' + i + '"' + sel + '>E' + p.eliteLevel + '</option>';
  }
  html += '</select></div>';
  html += '<div class="form-group"><label>等级</label>';
  html += '<input type="number" data-index="' + index + '" data-field="level" value="' + data.level + '" min="1" max="' + maxLevel + '">';
  html += '</div>';
  html += '<div class="form-group"><label>信赖%</label>';
  html += '<input type="number" data-index="' + index + '" data-field="trustPercent" value="' + data.trustPercent + '" min="0" max="100">';
  html += '</div>';
  if (op.skills.length > 0) {
    html += '<div class="form-group"><label>技能</label>';
    const maxSiForElite = data.elite === 0 ? 0 : data.elite === 1 ? 1 : 2;
    const skillCount = Math.min(op.skills.length, maxSiForElite + 1);
    html += '<select data-index="' + index + '" data-field="skillIndex">';
    for (let i = 0; i < skillCount; i++) {
      const sel = i === (data.skillIndex || 0) ? ' selected' : '';
      html += '<option value="' + i + '"' + sel + '>' + op.skills[i].name + '</option>';
    }
    html += '</select></div>';
    html += '<div class="form-group"><label>技能等级</label>';
    html += '<select data-index="' + index + '" data-field="skillLevel">';
    const maxSkillIdx = data.elite === 0 ? 3 : data.elite === 1 ? 6 : 9;
    const allSlOpts = [[0,'Lv1'],[1,'Lv2'],[2,'Lv3'],[3,'Lv4'],[4,'Lv5'],[5,'Lv6'],[6,'Lv7'],[7,'专一'],[8,'专二'],[9,'专三']];
    const slOpts = allSlOpts.filter(function(x) { return x[0] <= maxSkillIdx; });
    for (const [v, lbl] of slOpts) {
      const sel = data.skillLevel === v ? ' selected' : '';
      html += '<option value="' + v + '"' + sel + '>' + lbl + '</option>';
    }
    html += '</select></div>';
  }
  html += '<div class="form-group"><label>潜能</label>';
  html += '<select data-index="' + index + '" data-field="potentialRank">';
  const pots = op.potentialRanks || [];
  for (let i = 0; i < pots.length; i++) {
    const sel = data.potentialRank === i + 1 ? ' selected' : '';
    html += '<option value="' + (i + 1) + '"' + sel + '>' + (i + 1) + '阶 - ' + pots[i].description + '</option>';
  }
  const selNone = data.potentialRank === 0 ? ' selected' : '';
  html += '<option value="0"' + selNone + '>无潜能</option>';
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
      let value = e.target.type === 'number' ? Number(e.target.value) : Number(e.target.value);
      state.slots[index][field] = value;
      if (field === 'level') {
        const phase = op.phases[state.slots[index].elite] || op.phases[op.phases.length - 1];
        value = Math.min(Math.max(1, value), phase.maxLevel);
        state.slots[index].level = value;
        e.target.value = value;
      }
      if (field === 'trustPercent') {
        value = Math.min(Math.max(0, value), 100);
        state.slots[index].trustPercent = value;
        e.target.value = value;
      }
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

async function updateResults() {
  const container = document.getElementById('result-comparison');
  const filledSlots = state.slots.filter(s => s !== null);

  if (filledSlots.length === 0) {
    container.innerHTML = '<p class="placeholder-text">选择干员后显示计算结果</p>';
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
      if (result.normalHps !== null && result.normalHps !== undefined) {
        metricsHtml += '<div class="metric"><span class="label">常态 HPS</span><span class="value heal">' + result.normalHps.toFixed(0) + '</span></div>';
      }
      if (result.skillHps !== null && result.skillHps !== undefined && result.skillHps > 0) {
        metricsHtml += '<div class="metric"><span class="label">技能期 HPS</span><span class="value heal">' + result.skillHps.toFixed(0) + '</span></div>';
      }
      if (result.totalHeal !== null && result.totalHeal !== undefined) {
        metricsHtml += '<div class="metric"><span class="label">总治疗量</span><span class="value heal">' + result.totalHeal.toFixed(0) + '</span></div>';
      }
      if (result.skillDps > 0) {
        metricsHtml += '<div class="metric"><span class="label">DPS</span><span class="value dps">' + result.skillDps.toFixed(0) + '</span></div>';
      }
      metricsHtml += '<div class="metric"><span class="label">攻击间隔</span><span class="value">' + result.realInterval.toFixed(2) + 's</span></div>';
      metricsHtml += '<div class="metric"><span class="label">技能期 ATK</span><span class="value">' + result.panelAtk.toFixed(0) + '</span></div>';
    } else if (result.isToggle || result.isPermanent) {
      metricsHtml = '<div class="metric"><span class="label">DPS</span><span class="value dps">' + result.skillDps.toFixed(0) + '</span></div>';
      metricsHtml += '<div class="metric"><span class="label">攻击间隔</span><span class="value">' + result.realInterval.toFixed(2) + 's</span></div>';
      metricsHtml += '<div class="metric"><span class="label">技能期 ATK</span><span class="value">' + result.panelAtk.toFixed(0) + '</span></div>';
    } else if (result.cycleDps !== null) {
      metricsHtml = '<div class="metric"><span class="label">总伤</span><span class="value damage">' + result.skillTotalDamage.toFixed(0) + '</span></div>';
      metricsHtml += '<div class="metric"><span class="label">循环 DPS</span><span class="value dps">' + result.cycleDps.toFixed(0) + '</span></div>';
      metricsHtml += '<div class="metric"><span class="label">攻击间隔</span><span class="value">' + result.realInterval.toFixed(2) + 's</span></div>';
      metricsHtml += '<div class="metric"><span class="label">技能期 ATK</span><span class="value">' + result.panelAtk.toFixed(0) + '</span></div>';
    } else {
      metricsHtml = '<div class="metric"><span class="label">技能期 DPS</span><span class="value dps">' + result.skillDps.toFixed(0) + '</span></div>';
      metricsHtml += '<div class="metric"><span class="label">技能期总伤</span><span class="value damage">' + result.skillTotalDamage.toFixed(0) + '</span></div>';
      metricsHtml += '<div class="metric"><span class="label">常态 DPS</span><span class="value dps">' + result.normalDps.toFixed(0) + '</span></div>';
      metricsHtml += '<div class="metric"><span class="label">攻击间隔</span><span class="value">' + result.realInterval.toFixed(2) + 's</span></div>';
      metricsHtml += '<div class="metric"><span class="label">技能期 ATK</span><span class="value">' + result.panelAtk.toFixed(0) + '</span></div>';
    }

    card.innerHTML = '<div class="result-header">' +
      '<span class="rarity-' + rarityNum + '" style="font-size:13px;">★' + rarityNum + '</span>' +
      '<h3>' + op.name + '</h3>' +
      '<span style="font-size:12px;color:#a0a0b0;margin-left:auto;">' + skillName + '</span>' +
      '</div><div class="result-metrics">' + metricsHtml + '</div>';
    container.appendChild(card);
  }
}

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

export { initOperatorSlots, renderSlot, updateResults, showOperatorPicker, initEnemyPanel, bindEvents };
