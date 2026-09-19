// 校验模块拆分后的 import/export 链是否闭合、无循环依赖
import * as ui from '../../src/frontend/js/ui.js';
import * as dc from '../../src/frontend/js/damage-calc.js';
import * as st from '../../src/frontend/js/state.js';
import * as mc from '../../src/frontend/js/medic-calc.js';
import * as doc from '../../src/frontend/js/damage-ops-calc.js';

let ok = true;
const check = (label, cond) => { if (!cond) ok = false; console.log(label + ': ' + (cond ? 'OK' : 'FAIL')); };

console.log('ui.js 导出:', Object.keys(ui).join(', '));
console.log('damage-calc.js 导出:', Object.keys(dc).join(', '));
console.log('state.js 导出:', Object.keys(st).join(', '));
console.log('medic-calc.js 导出:', Object.keys(mc).join(', '));
console.log('damage-ops-calc.js 导出:', Object.keys(doc).join(', '));

const uiNeed = ['initOperatorSlots', 'renderSlot', 'updateResults', 'showOperatorPicker', 'initEnemyPanel', 'renderPanelStats'];
check('ui.js 导出齐全', uiNeed.every(k => k in ui));
check('damage-calc.js 导出 calculateOperator 函数', typeof dc.calculateOperator === 'function');
check('state.js 不再导出 initEnemyPanel', !('initEnemyPanel' in st));

console.log(ok ? '✅ 全部通过' : '❌ 存在失败');
process.exit(ok ? 0 : 1);
