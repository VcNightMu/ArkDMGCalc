// ArkDMGCalc - UI Rendering
import { getPopularOperators, getOperatorData, getProfessionCN, getSubProfessionCN, getNote } from './operators.js';
import { state } from './state.js';
import { calculateOperator, calcPanelStats } from './damage-calc.js';

// 形态技能位白名单:战术家召唤物 sktok_ 占位技能中带引擎形态结果的技能位(持有者技能激活态输出),
// UI 需显示技能选择与技能期(与 damage-calc.js 的 SUMMON_FORM_MODES 同步:眠兽 S2=夜半安眠期沉睡群攻法伤×1.7)
const TOKEN_FORM_SKILLS = {
  'token_10021_blkngt_hypnos': { 0: true, 1: true }, // 眠兽 S1(食梦·休眠):半醒期每秒回14%最大生命 / S2(食梦·安眠):5s群攻法伤×1.7
  'token_10028_vigil_wolf': { 1: true, 2: true },    // 狼群 S2(狼群·馈赠):×1.8单发 / S3(狼群·领袖):每击附加伺夜0.35×atk法伤
  'token_10037_mitm_trshrb': { 0: true, 1: true }, // 樱桃三号 S1(遥控解体:自爆,伤害源渡桥)/ S2(承压功率:停攻,结束销毁)
  'token_10030_mlyss_wtrman': { 0: true, 1: true, 2: true }, // 流形·远程(法伤):S1润化加速/S2耦合二连/S3适应束缚(缪尔赛思技能激活态)
  'token_10030_mlyss_melee': { 0: true, 1: true, 2: true },  // 流形·近战(物伤):S2 耦合自回每秒5%最大生命
};
// 形态技能需持有者面板的召唤物(伤害源=持有者干员,如樱桃三号 S1 自爆=渡桥攻击力×3.7):UI 计算时联动加载持有者数据
const TOKEN_SUMMON_OWNER_REF = {
  'token_10037_mitm_trshrb': 'char_4147_mitm',
};

function isModuleUnlocked(op, slotData) {
  const m = slotData.module;
  if (!m) return true; // 无模组恒可用
  const mod = (op.modules || []).find(x => x.id === m.moduleId);
  if (!mod || mod.type !== 'ADVANCED') return true; // 证章不受解锁限制
  return slotData.elite >= 2 && slotData.level >= mod.unlockLevel;
}

function dmgClass(damageType) {
  const map = { physical: 'dmg-physical', arts: 'dmg-arts', true: 'dmg-true', element: 'dmg-element' };
  return map[damageType] || 'dmg-physical';
}

// 伤害数值片段：规范化混合伤害（result.dmgTypes = {类型: {skillDps, skillTotalDamage, cycleDps}}）——
// 逐类型渲染各自色值（物理红/法术黄/真伤白/元素色），仅显示 >0 的档位，多档用 + 分隔；
// 无 dmgTypes 时回退单类型整数值（兼容旧结果）。
function dmgValHtml(result, field) {
  const types = result.dmgTypes;
  if (types) {
    const segs = [];
    for (const t of Object.keys(types)) {
      const v = types[t][field];
      if (typeof v === 'number' && v > 0) {
        segs.push('<span class="value ' + dmgClass(t) + '">' + Math.round(v) + '</span>');
      }
    }
    if (segs.length > 1) return '<span class="dmg-group">' + segs.join('<span style="color:#888;margin:0 2px;">+</span>') + '</span>';
    if (segs.length === 1) return segs[0];
  }
  return '<span class="value ' + dmgClass(result.damageType) + '">' + result[field].toFixed(0) + '</span>';
}

// 常态多档伤害（本源铁卫常态=物理普攻+天赋法伤+元素爆条均摊）：逐类型色值渲染
function normValHtml(result) {
  const types = result.normalTypes;
  if (types) {
    const segs = [];
    for (const t of Object.keys(types)) {
      const v = types[t].dps;
      if (typeof v === 'number' && v > 0) {
        segs.push('<span class="value ' + dmgClass(t) + '">' + Math.round(v) + '</span>');
      }
    }
    if (segs.length > 1) return '<span class="dmg-group">' + segs.join('<span style="color:#888;margin:0 2px;">+</span>') + '</span>';
    if (segs.length === 1) return segs[0];
  }
  if (result.normalDps !== null && result.normalDps !== undefined) {
    const cls = result.normalDamageType || result.damageType || 'physical';
    return '<span class="value ' + dmgClass(cls) + '">' + result.normalDps.toFixed(0) + '</span>';
  }
  return '';
}

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
  const gradeSel = document.getElementById('enemy-grade');
  if (gradeSel) {
    gradeSel.value = state.enemy.grade || 'normal';
    gradeSel.addEventListener('change', () => {
      state.enemy.grade = gradeSel.value;
      updateResults();
    });
  }
}

function initOperatorSlots() {
  const container = document.getElementById('operator-slots');
  container.innerHTML = '';
  for (let i = 0; i < 4; i++) {
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

  // 按 主职业 → 子职业 分组（只包含有数据的子职业）
  const profGroups = {};
  for (const op of operators) {
    if (!profGroups[op.profession]) profGroups[op.profession] = {};
    if (!profGroups[op.profession][op.subProfessionId]) profGroups[op.profession][op.subProfessionId] = [];
    profGroups[op.profession][op.subProfessionId].push(op);
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:100;display:flex;align-items:center;justify-content:center;';

  const picker = document.createElement('div');
  picker.style.cssText = 'background:#16213e;border-radius:12px;padding:20px;max-width:520px;width:90%;max-height:70vh;overflow-y:auto;border:1px solid #2a2a4a;';

  let html = '<h3 style="margin-bottom:16px;color:#eaeaea;">选择干员</h3>';
  html += '<div class="picker-selects">';
  html += '<select id="picker-profession"><option value="">主职业</option>';
  for (const prof of Object.keys(profGroups)) {
    html += '<option value="' + prof + '">' + getProfessionCN(prof) + '</option>';
  }
  html += '</select>';
  html += '<select id="picker-subprof"><option value="">子职业</option></select>';
  html += '</div>';
  html += '<div class="picker-list" id="picker-list"></div>';
  picker.innerHTML = html;
  overlay.appendChild(picker);
  document.body.appendChild(overlay);

  const profSelect = picker.querySelector('#picker-profession');
  const subSelect = picker.querySelector('#picker-subprof');
  const listEl = picker.querySelector('#picker-list');

  // 主职业变化 → 填充子职业下拉框（只显示有数据的子职业）
  profSelect.addEventListener('change', async () => {
    const prof = profSelect.value;
    subSelect.innerHTML = '<option value="">子职业</option>';
    listEl.innerHTML = '';
    if (!prof) return;
    for (const sub of Object.keys(profGroups[prof])) {
      const subName = await getSubProfessionCN(sub);
      subSelect.innerHTML += '<option value="' + sub + '">' + subName + '</option>';
    }
  });

  // 子职业变化 → 填充干员列表
  subSelect.addEventListener('change', () => {
    const prof = profSelect.value;
    const sub = subSelect.value;
    listEl.innerHTML = '';
    if (!prof || !sub) return;
    // 干员列表按星级降序(6→1)排列,同星级保持数据顺序
    const subOps = (profGroups[prof][sub] || []).slice().sort((a, b) => (b.rarity || 0) - (a.rarity || 0));
    for (const op of subOps) {
      const displayName = op.ownerName ? (op.ownerName + '·' + op.name) : op.name;
      listEl.innerHTML += '<div class="picker-item" data-id="' + op.id + '">' +
        '<span class="rarity-' + op.rarity + '" style="font-size:13px;min-width:36px;">' + (rarityLabels[op.rarity] || '') + '</span>' +
        '<span>' + displayName + '</span>' +
        '</div>';
    }
  });

  // 点击干员 → 添加
  listEl.addEventListener('click', async (e) => {
    const item = e.target.closest ? e.target.closest('.picker-item') : null;
    if (!item) return;
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
        skillLevel: 9,
        module: null
      };
      await renderSlot(slotIndex);
      updateResults();
    }
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

/**
 * 模组下拉选项构建：三星/无模组干员仅「无」；四星+ 恒有证章（INITIAL）；
 * 效果模组（ADVANCED）需精二且等级达 unlockLevel 后逐级可选，未解锁显示禁用提示。
 * value 编码 moduleId@level（证章 level=0，无模组 = ''）。
 */
function buildModuleSelect(op, data, index) {
  const mods = op.modules || [];
  let opts = '<option value="">无</option>';
  for (const mod of mods) {
    if (mod.type === 'INITIAL') {
      const sel = data.module && data.module.moduleId === mod.id ? ' selected' : '';
      opts += '<option value="' + mod.id + '@0"' + sel + '>' + mod.name + '</option>';
    } else {
      const unlocked = data.elite >= 2 && data.level >= mod.unlockLevel;
      if (!unlocked) {
        opts += '<option value="@" disabled>' + (mod.typeName2 || '') + '模组（精二' + mod.unlockLevel + '级解锁）</option>';
        continue;
      }
      for (const lv of mod.levels) {
        const v = mod.id + '@' + lv.level;
        const sel = data.module && data.module.moduleId === mod.id && data.module.moduleLevel === lv.level ? ' selected' : '';
        opts += '<option value="' + v + '"' + sel + '>' + (mod.typeName2 || '') + '模组' + lv.level + '级</option>';
      }
    }
  }
  return '<div class="form-group"><label>模组</label><select data-index="' + index + '" data-field="module">' + opts + '</select></div>';
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
  const rarityNum = typeof op.rarity === 'number' ? op.rarity : parseInt(String(op.rarity).match(/\d/)?.[0] || '1');
  const subProfName = await getSubProfessionCN(op.subProfessionId);

  slot.className = 'operator-slot';
  let html = '';
  html += '<div class="slot-header">';
  html += '<img class="slot-avatar" src="assets/avatars/' + op.profession + '/' + op.subProfessionId + '/' + op.id + '.png" alt="' + op.name + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">';
  html += '<div class="slot-avatar" style="display:none;align-items:center;justify-content:center;background:#0f3460;color:#a0a0b0;font-size:11px;">' + (op.profession === 'TOKEN' ? '召唤物' : (op.name || '').charAt(0)) + '</div>';
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
  // 技能选择器：干员有技能即显示（含 skcom_ 通用技能模板如迅捷打击/冲锋号令等主动技能）；
  // 召唤物若只有 skcom_ 通用被动如医疗探机则不显示（凯尔希·Mon3tr 这类带注入技能的攻击型召唤物正常显示 1/2/3 技能）
  const isTokenOp = op.profession === 'TOKEN';
  const hasSelectableSkills = isTokenOp
    ? op.skills.some(s => s.skillId && !String(s.skillId).startsWith('skcom_') && !String(s.skillId).startsWith('sktok_')) || (TOKEN_FORM_SKILLS[op.id] && op.skills.length > 0)
    : (op.skills || []).length > 0;
  if (hasSelectableSkills) {
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
  html += buildModuleSelect(op, data, index);
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
      if (field === 'module') {
        const raw = e.target.value;
        if (!raw || raw === '@') state.slots[index].module = null;
        else {
          const parts = raw.split('@');
          state.slots[index].module = { moduleId: parts[0], moduleLevel: Number(parts[1]) };
        }
        updateResults();
        return;
      }
      let value = e.target.type === 'number' ? Number(e.target.value) : Number(e.target.value);
      state.slots[index][field] = value;
      if (field === 'level') {
        const phase = op.phases[state.slots[index].elite] || op.phases[op.phases.length - 1];
        value = Math.min(Math.max(1, value), phase.maxLevel);
        state.slots[index].level = value;
        e.target.value = value;
        if (!isModuleUnlocked(op, state.slots[index])) state.slots[index].module = null;
        await renderSlot(index);
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
        if (!isModuleUnlocked(op, state.slots[index])) state.slots[index].module = null;
        await renderSlot(index);
      }
      updateResults();
    });
  });
}

async function updateResults() {
  await renderPanelStats();
  const container = document.getElementById('result-comparison');
  const filledSlots = state.slots.filter(s => s !== null);

  if (filledSlots.length === 0) {
    container.innerHTML = '<p class="placeholder-text">选择干员后显示计算结果</p>';
    document.getElementById('notes-list').innerHTML = '<p class="placeholder-text">选择干员后显示说明</p>';
    return;
  }

  container.innerHTML = '';
  const notes = [];      // 个人说明（按选择顺序）
  const subNotes = [];  // 子职业通用说明（渲染在个人说明之前，每子职业仅一条）
  const subShown = new Set();

  for (const slotData of filledSlots) {
    const op = await getOperatorData(slotData.operatorId);
    if (!op) continue;

    // 召唤物形态技能持有者联动:伤害源=持有者的模式(樱桃三号 S1 自爆=渡桥攻击力×3.7)需注入持有者满练面板
    const ctx = {};
    const ownerRefId = TOKEN_SUMMON_OWNER_REF[op.id];
    if (ownerRefId) {
      const ownerOp = await getOperatorData(ownerRefId);
      if (ownerOp) {
        const oph = ownerOp.phases[ownerOp.phases.length - 1];
        ctx.ownerOp = ownerOp;
        ctx.ownerSlot = { elite: ownerOp.phases.length - 1, level: oph.maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7 };
      }
    }
    const result = calculateOperator(op, slotData, ctx);
    const card = document.createElement('div');
    card.className = 'result-card';
    const rarityNum = typeof op.rarity === 'number' ? op.rarity : parseInt(String(op.rarity).match(/\d/)?.[0] || '1');
    const skillName = op.skills[slotData.skillIndex || 0]?.name || '';
    // 是否有技能期：当前槽位技能存在；召唤物的 skcom_ 通用被动(医疗探机等)与干员 PASSIVE 永久被动(星熊 S2「荆棘」装备即常驻)无技能期只显常态，
    // 干员 skcom_ 通用技能模板(迅捷打击/冲锋号令等)与限时被动(PASSIVE 且 duration>0，芬 S2 执守阵线：部署自动生效 N 秒)按正常技能处理——有技能期+有常态
    const equipped = op.skills[slotData.skillIndex || 0];
    const equippedLv = (equipped && equipped.levels) ? (equipped.levels[slotData.skillLevel || 0] || equipped.levels[equipped.levels.length - 1] || {}) : {};
    const hasSkill = !!equipped && !!equipped.skillId
      && !(op.profession === 'TOKEN' && (String(equipped.skillId).startsWith('skcom_') || String(equipped.skillId).startsWith('sktok_')) && !(TOKEN_FORM_SKILLS[op.id] || {})[slotData.skillIndex || 0])
      && !(equipped.levels && equipped.levels[0] && equipped.levels[0].skillType === 'PASSIVE' && !(equippedLv.skillDuration > 0) && !(TOKEN_FORM_SKILLS[op.id] || {})[slotData.skillIndex || 0]);
    const dmgCls = dmgClass(result.damageType);

    const subId = op.subProfessionId;
    if (subId && !subShown.has(subId)) {
      subShown.add(subId);
      const subText = await getNote('__subprof_' + subId);
      if (subText) subNotes.push({ kind: 'sub', name: await getSubProfessionCN(subId), text: subText });
    }
    const note = await getNote(op.id);
    if (note) notes.push({ name: op.name, rarity: rarityNum, text: note });

    let metricsHtml = '';
    if (result.type === 'heal') {
      const hpsLabel = op.profession === 'TOKEN' ? '治疗 HPS' : '常态 HPS';
      if (result.normalHps !== null && result.normalHps !== undefined) {
        metricsHtml += '<div class="metric"><span class="label">' + hpsLabel + '</span><span class="value heal">' + result.normalHps.toFixed(0) + '</span></div>';
      }
      if (result.normalDps !== null && result.normalDps !== undefined && result.normalDps > 0) {
        metricsHtml += '<div class="metric"><span class="label">常态 DPS</span>' + normValHtml(result) + '</div>';
      }
      if (result.skillHps !== null && result.skillHps !== undefined && result.skillHps > 0) {
        metricsHtml += '<div class="metric"><span class="label">技能期 HPS</span><span class="value heal">' + result.skillHps.toFixed(0) + '</span></div>';
      }
      if (result.totalHeal !== null && result.totalHeal !== undefined) {
        metricsHtml += '<div class="metric"><span class="label">总治疗量</span><span class="value heal">' + result.totalHeal.toFixed(0) + '</span></div>';
      }
      if (result.cycleHps !== null && result.cycleHps !== undefined) {
        metricsHtml += '<div class="metric"><span class="label">周期 HPS</span><span class="value heal">' + result.cycleHps.toFixed(0) + '</span></div>';
      }
      if (result.skillDps > 0) {
        metricsHtml += '<div class="metric"><span class="label">技能期 DPS</span>' + dmgValHtml(result, 'skillDps') + '</div>';
      }
      if (result.skillTotalDamage > 0) {
        metricsHtml += '<div class="metric"><span class="label">技能期总伤</span>' + dmgValHtml(result, 'skillTotalDamage') + '</div>';
      }
      if (hasSkill) {
        metricsHtml += '<div class="metric"><span class="label">技能期攻击间隔</span><span class="value stat">' + result.realInterval.toFixed(2) + 's</span></div>';
        metricsHtml += '<div class="metric"><span class="label">技能期 ATK</span><span class="value stat">' + result.panelAtk.toFixed(0) + '</span></div>';
      }
    } else if (result.isToggle || result.isPermanent) {
      metricsHtml = '<div class="metric"><span class="label">DPS</span>' + dmgValHtml(result, 'skillDps') + '</div>';
      metricsHtml += '<div class="metric"><span class="label">技能期攻击间隔</span><span class="value stat">' + result.realInterval.toFixed(2) + 's</span></div>';
      metricsHtml += '<div class="metric"><span class="label">技能期 ATK</span><span class="value stat">' + result.panelAtk.toFixed(0) + '</span></div>';
    } else if (result.cycleDps !== null) {
      metricsHtml = '<div class="metric"><span class="label">总伤</span>' + dmgValHtml(result, 'skillTotalDamage') + '</div>';
      metricsHtml += '<div class="metric"><span class="label">循环 DPS</span>' + dmgValHtml(result, 'cycleDps') + '</div>';
      metricsHtml += '<div class="metric"><span class="label">技能期攻击间隔</span><span class="value stat">' + result.realInterval.toFixed(2) + 's</span></div>';
      metricsHtml += '<div class="metric"><span class="label">技能期 ATK</span><span class="value stat">' + result.panelAtk.toFixed(0) + '</span></div>';
    } else {
      if (hasSkill) {
        metricsHtml += '<div class="metric"><span class="label">技能期 DPS</span>' + dmgValHtml(result, 'skillDps') + '</div>';
        metricsHtml += '<div class="metric"><span class="label">技能期总伤</span>' + dmgValHtml(result, 'skillTotalDamage') + '</div>';
      }
      if (result.normalDps !== null && result.normalDps !== undefined && result.normalDps > 0) {
        metricsHtml += '<div class="metric"><span class="label">常态 DPS</span>' + normValHtml(result) + '</div>';
      }
      if (hasSkill) {
        metricsHtml += '<div class="metric"><span class="label">技能期攻击间隔</span><span class="value stat">' + result.realInterval.toFixed(2) + 's</span></div>';
        metricsHtml += '<div class="metric"><span class="label">技能期 ATK</span><span class="value stat">' + result.panelAtk.toFixed(0) + '</span></div>';
      }
    }

    card.innerHTML = '<div class="result-header">' +
      '<span class="rarity-' + rarityNum + '" style="font-size:13px;">★' + rarityNum + '</span>' +
      '<h3>' + op.name + '</h3>' +
      '<span style="font-size:12px;color:#a0a0b0;margin-left:auto;">' + skillName + '</span>' +
      '</div><div class="result-metrics">' + metricsHtml + '</div>';
    container.appendChild(card);
  }

  renderNotes(subNotes.concat(notes));
}

function renderNotes(notes) {
  const container = document.getElementById('notes-list');
  if (notes.length === 0) {
    container.innerHTML = '<p class="placeholder-text">所选干员暂无说明</p>';
    return;
  }
  container.innerHTML = '';
  for (const n of notes) {
    const item = document.createElement('div');
    item.className = 'note-item';
    const headHtml = n.kind === 'sub'
      ? '<div class="note-head"><span class="note-sub-tag">' + n.name + '</span></div>'
      : '<div class="note-head"><span class="rarity-' + n.rarity + '" style="font-size:13px;">★' + n.rarity + '</span><span class="note-name">' + n.name + '</span></div>';
    item.innerHTML = headHtml + '<p class="note-text">' + n.text + '</p>';
    container.appendChild(item);
  }
}

async function renderPanelStats() {
  const container = document.getElementById('panel-stats');
  const filledSlots = state.slots.filter(s => s !== null);

  if (filledSlots.length === 0) {
    container.innerHTML = '<p class="placeholder-text">选择干员后显示基础属性</p>';
    return;
  }

  container.innerHTML = '';
  for (const slotData of filledSlots) {
    const op = await getOperatorData(slotData.operatorId);
    if (!op) continue;
    const ps = calcPanelStats(op, slotData);
    const rarityNum = typeof op.rarity === 'number' ? op.rarity : parseInt(String(op.rarity).match(/\d/)?.[0] || '1');
    const phaseLabel = 'E' + (op.phases[slotData.elite] ? op.phases[slotData.elite].eliteLevel : 0);

    const card = document.createElement('div');
    card.className = 'stats-card';
    card.innerHTML =
      '<div class="stats-header">' +
        '<span class="rarity-' + rarityNum + '" style="font-size:13px;">★' + rarityNum + '</span>' +
        '<h3>' + op.name + '</h3>' +
        '<span class="stats-config">' + phaseLabel + ' Lv' + slotData.level + ' · 信赖' + slotData.trustPercent + '%</span>' +
      '</div>' +
      '<div class="stats-list">' +
        '<div class="metric"><span class="label">生命值</span><span class="value stat">' + ps.panelHp + '</span></div>' +
        '<div class="metric"><span class="label">攻击力</span><span class="value stat">' + ps.panelAtk + '</span></div>' +
        '<div class="metric"><span class="label">防御力</span><span class="value stat">' + ps.panelDef + '</span></div>' +
        '<div class="metric"><span class="label">法术抗性</span><span class="value stat">' + ps.magicResistance + '</span></div>' +
        '<div class="metric"><span class="label">攻击间隔</span><span class="value stat">' + (ps.attackInterval !== undefined ? ps.attackInterval : ps.baseAttackTime).toFixed(2) + 's</span></div>' +
      '</div>';
    container.appendChild(card);
  }
}

export { initOperatorSlots, renderSlot, updateResults, showOperatorPicker, initEnemyPanel, renderPanelStats };
