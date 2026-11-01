// ArkDMGCalc - State Management
const state = {
  slots: [null, null, null, null],
  enemy: { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal', attackInterval: 2 } // grade: normal/elite/leader（决定元素损伤 EP 容量 1000/1000/2000）；attackInterval=敌方攻击间隔(秒,决定受击回复 SP 充能速度)
};

export { state };
