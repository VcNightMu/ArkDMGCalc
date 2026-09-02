// ArkDMGCalc - 应用入口
// 仅负责初始化编排。计算逻辑：damage-calc.js（总入口）/ medic-calc.js / damage-ops-calc.js；
// UI 渲染与交互：ui.js；状态：state.js；数据加载：operators.js；核心公式：calculator.js。
import { initEnemyPanel, initOperatorSlots, bindEvents } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initEnemyPanel();
  initOperatorSlots();
  bindEvents();
});
