// ArkDMGCalc - Main Application
import { getPopularOperators, getOperatorData } from './operators.js';
import { state, initEnemyPanel } from './state.js';
import { initOperatorSlots, renderSlot, updateResults } from './ui.js';

// ======== Init ========
document.addEventListener('DOMContentLoaded', () => {
  initEnemyPanel();
  initOperatorSlots();
  bindEvents();
});

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
