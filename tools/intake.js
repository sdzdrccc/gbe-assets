'use strict';

/**
 * tools/intake.js —— inbox 投递包入库（CONVENTIONS §2.2 / §2.3 / §8）
 *
 * 职责单一：**把 `inbox/<asset-id>@<version>/` 搬进 `kits/<kit>/<category>/<id 第三段>/`**。
 *
 * ── 三条铁律 ──────────────────────────────────────────────────────────────
 *  ① 先校验后入库：每包跑一遍 `@gbe/schema` 的 checkPackage（门禁双跑的第二次；
 *     第一次在 studio 出包前）。错误包**原地不动**，只报不搬。
 *  ② 只 move，不删：`fs.renameSync`。仓库内同盘，不跨设备。
 *     目标已存在（同 id 的旧版本）→ 先把旧目录 **move 到 `_archive/`**，再落新包。
 *     任何情况下都不用 `rm`（CONVENTIONS 硬性禁令）。
 *  ③ 目录名不变式：kits 侧目录名**严格等于 id 第三段**，不带类别前缀（§2.2）。
 *     错例：`kits/cn-ancient/components/roof/roof-xuanshan-single-a/`。
 *
 * 附带动作：刷新 `kits/<kit>/kit.json` 的 `coverage.done`（派生快照，可重建）。
 *
 * 用法：
 *   node tools/intake.js                 # 入库 inbox 全部通过门禁的包
 *   node tools/intake.js --dry-run       # 只报告将要做什么，不动盘
 *   node tools/intake.js --only <asset-id>
 *   node tools/intake.js --quiet
 */

const fs = require('fs');
const path = require('path');
const gbe = require('../packages/schema');

const REPO = path.resolve(__dirname, '..');
const INBOX = path.join(REPO, 'inbox');
const KITS = path.join(REPO, 'kits');
const ARCHIVE = path.join(REPO, '_archive');

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** 递归 move：同盘用 renameSync（原子）；跨设备才退化为 copy + 空目录清理（仍不删文件） */
function moveDir(from, to) {
  mkdirp(path.dirname(to));
  try {
    fs.renameSync(from, to);
    return 'rename';
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    copyDir(from, to);
    return 'copy';
  }
}

function copyDir(from, to) {
  mkdirp(to);
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, ent.name);
    const d = path.join(to, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function parseInboxName(base) {
  const at = base.lastIndexOf('@');
  if (at < 0) return { id: base, version: '' };
  return { id: base.slice(0, at), version: base.slice(at + 1) };
}

/** kits 侧目标目录：kits/<kit>/<category>/<id 第三段>/ */
function targetDirFor(asset) {
  const segs = String(asset.id).split('.');
  if (segs.length !== 3) {
    return { error: `id 必须为 <kit>.<category-leaf>.<name> 三段，实际 ${segs.length} 段` };
  }
  const [kit, leaf, name] = segs;
  if (asset.kit && asset.kit !== kit) {
    return { error: `asset.kit "${asset.kit}" 与 id 首段 "${kit}" 不一致` };
  }
  const category = asset.category;
  if (typeof category !== 'string' || !category.includes('/')) {
    return { error: `category 必须是 <group>/<leaf> 形态，实际 "${category}"` };
  }
  if (category.split('/')[1] !== leaf) {
    return {
      error: `category "${category}" 的叶子与 id 第二段 "${leaf}" 不一致（目录名不变式的上游，§2.2）`,
    };
  }
  return { kit, name, category, dir: path.join(KITS, kit, ...category.split('/'), name) };
}

// ---------------------------------------------------------------------------
// kit.json coverage 刷新（派生快照）
// ---------------------------------------------------------------------------

function refreshCoverage(kitId, opts) {
  const kitFile = path.join(KITS, kitId, 'kit.json');
  if (!fs.existsSync(kitFile)) return null;
  const kit = JSON.parse(fs.readFileSync(kitFile, 'utf8'));
  const coverage = kit.coverage;
  if (!coverage || typeof coverage !== 'object') return null;

  const counts = new Map();
  const bump = (category, n = 1) => counts.set(category, (counts.get(category) || 0) + n);

  // (a) 构件类：kits/<kit>/<category>/<name>/asset.json —— 计数键是**资产目录的父级路径**
  const kitDir = path.join(KITS, kitId);
  const walk = (dir, rel) => {
    let ents;
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    if (ents.some((e) => e.isFile() && e.name === 'asset.json')) {
      const category = rel.split('/').slice(0, -1).join('/');
      if (category) bump(category);
      return; // 资产目录不再往下钻
    }
    for (const ent of ents) {
      if (!ent.isDirectory()) continue;
      if (ent.name.startsWith('_')) continue; // _archive / _tmp 不计
      walk(path.join(dir, ent.name), rel ? `${rel}/${ent.name}` : ent.name);
    }
  };
  walk(kitDir, '');

  // (b) 装配类：assemblies/<kit>/<category>/<name>.json 不在 kits 树里（§19.4），单独扫并按 kit 过滤
  const asmDir = path.join(REPO, 'assemblies');
  const walkAsm = (dir) => {
    let ents;
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const ent of ents) {
      if (ent.isDirectory()) {
        if (!ent.name.startsWith('_')) walkAsm(path.join(dir, ent.name));
        continue;
      }
      if (!ent.name.endsWith('.json')) continue;
      try {
        const m = JSON.parse(fs.readFileSync(path.join(dir, ent.name), 'utf8'));
        if (m.kit === kitId && typeof m.category === 'string' && m.category.startsWith('assemblies/')) {
          bump(m.category);
        }
      } catch (e) {
        /* 坏清单由校验器报，这里不吞错也不中断 */
      }
    }
  };
  if (fs.existsSync(asmDir)) walkAsm(asmDir);

  let changed = false;
  for (const key of Object.keys(coverage)) {
    if (key.startsWith('$')) continue;
    const entry = coverage[key];
    if (!entry || typeof entry !== 'object') continue;
    const done = counts.get(key) || 0;
    if (entry.done !== done) {
      entry.done = done;
      changed = true;
    }
  }
  // $comment 里别留会过期的话
  if (coverage.$comment && !coverage.$comment.includes('tools/intake.js')) {
    coverage.$comment = '派生快照（可重建）。由 tools/intake.js 入库时刷新，等价于 gbe reindex；禁止手工维护。';
    changed = true;
  }
  if (changed && !opts.dryRun) {
    fs.writeFileSync(kitFile, JSON.stringify(kit, null, 2) + '\n', 'utf8');
  }
  return { changed, coverage };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function intake(opts) {
  const rows = [];
  if (!fs.existsSync(INBOX)) return rows;

  const entries = fs
    .readdirSync(INBOX, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  for (const base of entries) {
    const { id, version } = parseInboxName(base);
    if (opts.only && id !== opts.only) continue;

    const src = path.join(INBOX, base);
    const row = { dir: base, id, version, action: '', errors: [], warnings: [], note: '' };

    const res = gbe.checkPackage(src);
    row.warnings = res.warnings || [];
    if (!res.ok) {
      row.action = 'rejected';
      row.errors = (res.errors || []).map((e) => `${e.path}  ${e.message}`);
      rows.push(row);
      continue;
    }

    const asset = res.asset;
    if (asset.status !== 'published') {
      row.action = 'rejected';
      row.errors.push(`status = "${asset.status}"，只有 published 可入库`);
      rows.push(row);
      continue;
    }

    const t = targetDirFor(asset);
    if (t.error) {
      row.action = 'rejected';
      row.errors.push(t.error);
      rows.push(row);
      continue;
    }
    row.target = path.relative(REPO, t.dir).replace(/\\/g, '/');

    if (fs.existsSync(t.dir)) {
      const old = readAssetVersion(t.dir);
      const archName = `${t.name}@${old || '0.0.0'}`;
      const archPath = path.join(ARCHIVE, archName);
      let finalArch = archPath;
      let n = 2;
      while (fs.existsSync(finalArch)) finalArch = path.join(ARCHIVE, `${archName}+${n++}`);
      row.action = 'replace';
      row.note = `旧版本 → _archive/${path.basename(finalArch)}/`;
      if (!opts.dryRun) {
        moveDir(t.dir, finalArch);
      }
    } else {
      row.action = 'intake';
    }

    if (!opts.dryRun) {
      moveDir(src, t.dir);
    }
    rows.push(row);
  }

  return rows;
}

function readAssetVersion(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'asset.json'), 'utf8')).version;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv) {
  const opts = { dryRun: false, quiet: false, only: null, reindex: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--quiet') opts.quiet = true;
    else if (a === '--reindex') opts.reindex = true;
    else if (a === '--only') opts.only = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('用法：node tools/intake.js [--dry-run] [--only <asset-id>] [--reindex] [--quiet]');
      return 0;
    } else {
      console.error(`未知参数：${a}`);
      return 2;
    }
  }

  const rows = intake(opts);
  const ok = rows.filter((r) => r.action === 'intake' || r.action === 'replace');
  const bad = rows.filter((r) => r.action === 'rejected');

  if (!opts.quiet) {
    console.log(`inbox：${INBOX}`);
    console.log(`kits ：${KITS}${opts.dryRun ? '   （--dry-run：未动盘）' : ''}`);
    console.log('─'.repeat(96));
    for (const r of rows) {
      const mark = r.action === 'rejected' ? '✗' : r.action === 'replace' ? '↻' : '✓';
      const tail = r.action === 'rejected' ? '' : `→ ${r.target}${r.note ? '   ' + r.note : ''}`;
      console.log(`${mark} ${r.id}@${r.version}   ${r.action}   ${tail}`);
      r.errors.forEach((e) => console.log(`    ✗ ${e}`));
      r.warnings.forEach((w) => console.log(`    ! ${w.path}  ${w.message}`));
    }
    console.log('─'.repeat(96));
  }

  const kits = new Set(ok.map((r) => r.id.split('.')[0]));
  if (opts.reindex || kits.size === 0) {
    if (fs.existsSync(KITS)) {
      for (const ent of fs.readdirSync(KITS, { withFileTypes: true })) {
        if (ent.isDirectory()) kits.add(ent.name);
      }
    }
  }
  for (const kit of kits) {
    const cov = refreshCoverage(kit, opts);
    if (cov && cov.changed && !opts.quiet) console.log(`· ${kit}: coverage.done 已刷新`);
  }

  console.log(
    `入库 ${ok.length} 件（新建 ${ok.filter((r) => r.action === 'intake').length} / 换代 ${
      ok.filter((r) => r.action === 'replace').length
    }）· 拒收 ${bad.length} 件${opts.dryRun ? ' · dry-run' : ''}`
  );
  return bad.length ? 1 : 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { intake, targetDirFor, parseInboxName, refreshCoverage };
