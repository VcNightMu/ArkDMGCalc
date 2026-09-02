// 验证 fetch-operators.js 重构后的嵌套结构展平结果
const fs = require('fs');
const src = fs.readFileSync('F:/ArkCodes/ArkDMGCalc/scripts/fetch-operators.js', 'utf8');

const start = src.indexOf('const OPERATORS = {');
const endMark = src.indexOf('// 展平嵌套结构', start);
const end = src.lastIndexOf('}', endMark);
if (start < 0 || end < 0) { console.log('未匹配到 OPERATORS 定义'); process.exit(1); }

const block = src.slice(start + 'const OPERATORS = '.length, end + 1);
const OPERATORS = eval('(' + block + ')');

function flattenOperators() {
  const ids = [];
  for (const prof of Object.values(OPERATORS)) {
    for (const subList of Object.values(prof)) {
      ids.push(...subList);
    }
  }
  return ids;
}

const ids = flattenOperators();
console.log('主职业数:', Object.keys(OPERATORS).length);
console.log('展平后干员数:', ids.length);
console.log('唯一 id 数:', new Set(ids).size);
console.log('重复 id:', ids.filter((v, i) => ids.indexOf(v) !== i).join(',') || '无');
