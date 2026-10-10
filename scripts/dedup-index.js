// [path-fix] 仓库内相对定位
const path = require('path');
const REPO_ROOT = path.resolve(__dirname, '..');
const ROOT = path.join(REPO_ROOT, 'src', 'frontend', 'data');
const rel = (...p) => path.join(ROOT, ...p);
const D = (...p) => rel(p.map((s) => String(s).replace(/^[/\\]+|[/\\]+$/g, '')).filter(Boolean).join('/'));

// 去重 index.json：按 id 去重，保留首次出现
const fs = require('fs');
const INDEX_FILE = rel('index.json');

const raw = fs.readFileSync(INDEX_FILE, 'utf8');
const list = JSON.parse(raw);

const seen = new Set();
const dupes = new Map();
for (const op of list) {
  if (seen.has(op.id)) {
    dupes.set(op.id, (dupes.get(op.id) || 0) + 1);
  } else {
    seen.add(op.id);
  }
}

console.log('总条数:', list.length);
console.log('去重后条数:', seen.size);
console.log('重复项:');
for (const [id, n] of dupes) {
  const name = list.find(o => o.id === id).name;
  console.log('  -', id, name, '重复', n, '次');
}

const deduped = [];
for (const op of list) {
  if (!deduped.some(o => o.id === op.id)) deduped.push(op);
}

fs.writeFileSync(INDEX_FILE, JSON.stringify(deduped, null, 2) + '\n', 'utf8');
console.log('已写回 index.json，去重完成');
