// 验证搜索框：输入关键字应显示所有匹配干员下拉框，而非直接添加
import { bindEvents } from '../../src/frontend/js/ui.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
globalThis.fetch = async (url) => {
  const p = BASE + '/' + url.replace(/^data\//, '');
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
};

let dropdown = null;
const searchInput = {
  value: '',
  parentElement: { appendChild: (c) => { dropdown = c; }, contains: () => false },
  _handlers: {},
  addEventListener(type, fn) { this._handlers[type] = fn; },
};

globalThis.document = {
  getElementById: (id) => (id === 'operator-search' ? searchInput : null),
  createElement: () => ({ innerHTML: '', className: '', dataset: {}, style: {}, addEventListener() {} }),
  addEventListener() {},
};

state.slots = [null, null, null, null];
bindEvents();

// 输入 "闪" → 应列出所有名字含"闪"的干员（闪灵），且不自动添加到槽位
searchInput.value = '闪';
await searchInput._handlers.input();
console.log('输入"闪"后 dropdown 显示:', dropdown.style.display);
console.log('dropdown 内容含 闪灵:', dropdown.innerHTML.includes('闪灵') ? 'OK' : 'FAIL');
console.log('槽位未被自动填充:', state.slots.every(s => s === null) ? 'OK' : 'FAIL');

// 输入 "安" → 应列出多个含"安"的干员（安洁莉娜、安赛尔）
searchInput.value = '安';
await searchInput._handlers.input();
const items = (dropdown.innerHTML.match(/dropdown-item/g) || []).length;
console.log('\n输入"安"匹配项数:', items);
console.log('列出多个干员:', items > 1 ? 'OK' : 'FAIL');
console.log('含 安洁莉娜:', dropdown.innerHTML.includes('安洁莉娜') ? 'OK' : 'FAIL');
console.log('含 安赛尔:', dropdown.innerHTML.includes('安赛尔') ? 'OK' : 'FAIL');

// 输入无匹配 → 显示"无匹配干员"
searchInput.value = 'zzzz';
await searchInput._handlers.input();
console.log('\n输入"zzzz"显示无匹配:', dropdown.innerHTML.includes('无匹配干员') ? 'OK' : 'FAIL');

// 清空 → 隐藏
searchInput.value = '';
await searchInput._handlers.input();
console.log('清空后隐藏:', dropdown.style.display === 'none' ? 'OK' : 'FAIL');
