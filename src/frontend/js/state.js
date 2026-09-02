// ArkDMGCalc - State Management
const state = {
  slots: [null, null, null, null, null],
  enemy: { hp: 50000, atk: 800, def: 600, res: 50 }
};

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

export { state, initEnemyPanel };
