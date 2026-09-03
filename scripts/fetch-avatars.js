// 批量下载干员头像，按 主职业/子职业 分类存放（与干员 JSON 数据目录同构），已存在则跳过。
// 头像文件在 PRTS wiki 上名为「文件:头像_<中文名>.png」；召唤物（TOKEN）名为「文件:头像_召唤物_<中文名>.png」。
// 通过 MediaWiki API 解析真实图片 URL 后下载。
// 用法：node scripts/fetch-avatars.js —— 会为 index.json 中所有干员（含召唤物）补齐头像，已存在的不重复下载。
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'frontend', 'data');
const AVATAR_ROOT = path.join(__dirname, '..', 'src', 'frontend', 'assets', 'avatars');
const API = 'https://prts.wiki/api.php';
const UA = { 'User-Agent': 'ArkDMGCalc/1.0' };

async function fetchJSON(url) {
  const resp = await fetch(url, { headers: UA });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

// 根据中文干员名解析头像真实图片 URL。召唤物（TOKEN）头像前缀为「头像_召唤物_」。
// 精确名查不到时回退前缀搜索（活动形态等命名带后缀的干员，如 Mechanist → 头像_Mechanist(卫戍协议).png）：
// 取前缀匹配中文件名最短且非皮肤（排除 _skin/_1+ 等）的候选（本体头像名最短）。
async function getAvatarUrl(name, isSummon) {
  const prefix = isSummon ? '头像_召唤物_' : '头像_';
  const title = `文件:${prefix}${name}.png`;
  const url = `${API}?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json`;
  const j = await fetchJSON(url);
  for (const p of Object.values(j.query?.pages || {})) {
    if (p.imageinfo?.[0]?.url) return p.imageinfo[0].url;
  }
  // 精确名不存在 → 前缀搜索兜底
  const search = `${API}?action=query&list=allimages&aiprefix=${encodeURIComponent(prefix + name)}&ailimit=10&format=json`;
  const sj = await fetchJSON(search);
  const hits = ((sj.query?.allimages) || [])
    .map(i => i.name)
    .filter(n => n.startsWith(prefix + name))
    .filter(n => !/_skin\d*|_\d\+/.test(n))   // 排除皮肤与潜能立绘
    .sort((a, b) => a.length - b.length);        // 本体头像最短
  if (hits.length === 0) return null;
  const hit = `文件:${hits[0]}`;
  const u = `${API}?action=query&titles=${encodeURIComponent(hit)}&prop=imageinfo&iiprop=url&format=json`;
  const uj = await fetchJSON(u);
  for (const p of Object.values(uj.query?.pages || {})) {
    if (p.imageinfo?.[0]?.url) return p.imageinfo[0].url;
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const index = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf8'));
  let ok = 0, skip = 0, fail = 0;

  for (const op of index) {
    const dir = path.join(AVATAR_ROOT, op.profession, op.subProfessionId);
    const out = path.join(dir, `${op.id}.png`);
    const rel = `${op.profession}/${op.subProfessionId}/${op.id}.png`;

    if (fs.existsSync(out)) { console.log(`[SKIP] ${op.name} 已存在`); skip++; continue; }

    try {
      const url = await getAvatarUrl(op.name, op.profession === 'TOKEN');
      if (!url) { console.log(`[SKIP] ${op.name} 无头像文件`); skip++; await sleep(200); continue; }
      const resp = await fetch(url, { headers: UA });
      if (!resp.ok) { console.log(`[FAIL] ${op.name} 下载失败 HTTP ${resp.status}`); fail++; await sleep(200); continue; }
      const buf = Buffer.from(await resp.arrayBuffer());
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(out, buf);
      console.log(`[OK] ${op.name} -> ${rel} (${buf.length} bytes)`);
      ok++;
    } catch (e) {
      console.log(`[FAIL] ${op.name} ${e.message}`); fail++;
    }
    await sleep(250);
  }

  console.log(`\n完成: ${ok} 成功, ${skip} 跳过, ${fail} 失败 → ${AVATAR_ROOT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
