// ArkDMGCalc - State Management
const state = {
  slots: [null, null, null, null],
  enemy: { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' } // grade: normal/elite/leader（决定元素损伤 EP 容量 1000/1000/2000）
};

export { state };
