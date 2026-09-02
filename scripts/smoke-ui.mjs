// ui.js 冒烟测试：mock DOM，验证初始化/渲染函数不抛错
import * as ui from '../src/frontend/js/ui.js';
import { state } from '../src/frontend/js/state.js';

function makeEl(tag) {
  return {
    tagName: (tag || 'div').toUpperCase(),
    innerHTML: '',
    className: '',
    dataset: {},
    style: {},
    value: '',
    classList: { add() {}, remove() {}, contains: () => false },
    addEventListener() {},
    appendChild() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    focus() {},
  };
}

const els = {};
globalThis.document = {
  getElementById: (id) => (els[id] || (els[id] = makeEl(id))),
  createElement: (tag) => makeEl(tag),
  addEventListener() {},
  body: makeEl('body'),
};

// 重置状态
state.slots = [null, null, null, null, null];

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('OK  ', name); pass++; }
  catch (e) { console.log('FAIL', name, '->', e.message); fail++; }
}

t('initEnemyPanel', () => ui.initEnemyPanel());
t('initOperatorSlots', () => ui.initOperatorSlots());
t('updateResults(空状态)', () => ui.updateResults());

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
