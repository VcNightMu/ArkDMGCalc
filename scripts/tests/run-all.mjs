// run-all.mjs — 全量回归 runner
// 逐个执行 scripts/tests/verify-*.mjs 子进程,统一判定:
//   ① 退出码 ② 输出中是否含失败字样(FAIL/✗/✘/断言不通过/存在失败/非零失败计数/最终:失败)
// 任一脚本真失败时,runner 以非零退出码结束。
// 用法: node scripts/tests/run-all.mjs            (全量)
//       node scripts/tests/run-all.mjs picker instructor   (只跑名字含关键字的脚本)
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

// 失败行判定规则(逐行)。注意历史脚本的字样约定:
//   - 逐条打印型: 'OK'/'FAIL'、'✅ 全部通过'/'❌ 存在失败'、'最终: 通过/失败'
//   - 计数汇总型: 'N 通过, M 失败'(M>0 才算失败,避免 '0 失败' 误伤)
const FAIL_PATTERNS = [
  /FAIL/,
  /✗|✘/,
  /断言不通过/,
  /存在失败/,
  /最终[:：]\s*失败/,
  /(?:^|[^\d])([1-9]\d*)\s*(?:个)?\s*失败/, // 非零失败计数汇总
];

function findFailingLines(out) {
  const hits = [];
  for (const raw of out.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (FAIL_PATTERNS.some((re) => re.test(line))) hits.push(line);
  }
  return hits;
}

const VERBOSE = process.argv.includes('--verbose');
const filters = process.argv.slice(2).filter((a) => !a.startsWith('-'));
let files = readdirSync(HERE)
  .filter((f) => /^verify-.*\.mjs$/.test(f))
  .sort();
if (filters.length) files = files.filter((f) => filters.some((k) => f.includes(k)));

const rows = [];
let failed = 0;

for (const f of files) {
  const r = spawnSync(process.execPath, [join(HERE, f)], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const code = r.status === null ? -1 : r.status;
  const failLines = findFailingLines(out);
  const exitOk = code === 0;
  const textOk = failLines.length === 0;
  const ok = exitOk && textOk;
  if (!ok) failed++;
  rows.push({ f, code, ok, exitOk, textOk, failLines, out });
  const mark = ok ? 'PASS' : 'FAIL';
  const notes = [];
  if (!exitOk) notes.push(`exit=${code}`);
  if (!textOk) notes.push(`${failLines.length} 条失败行`);
  console.log(`[${mark}] ${f}${notes.length ? '  (' + notes.join(', ') + ')' : ''}`);
  for (const l of failLines) console.log(`        ↳ ${l}`);
  if (!ok && VERBOSE) {
    console.log('        --- 完整输出 ---');
    for (const l of out.split(/\r?\n/)) console.log('        | ' + l);
  }
}

console.log('\n================ 汇总 ================');
const width = Math.max(...rows.map((r) => r.f.length), 8);
console.log('脚本'.padEnd(width) + ' | 退出码 | 判定');
console.log('-'.repeat(width + 18));
for (const r of rows) {
  console.log(r.f.padEnd(width) + ' | ' + String(r.code).padStart(6) + ' | ' + (r.ok ? 'PASS' : 'FAIL'));
}
console.log('-'.repeat(width + 18));
console.log(`共 ${rows.length} 个脚本, ${rows.length - failed} PASS, ${failed} FAIL`);

if (failed) {
  console.log('\n失败脚本一览:');
  for (const r of rows.filter((x) => !x.ok)) console.log('  - ' + r.f);
}

process.exit(failed ? 1 : 0);
