'use strict';

/**
 * tools/intake.js —— inbox 投递包入库（CONVENTIONS §2.2 / §2.3 / §8）
 *
 * 职责单一：**把 `inbox/<asset-id>@<version>/` 搬进 `kits/<kit>/<category>/<id 第三段>/`**。
 *
 * ── 三条铁律 ──────────────────────────────────────────────────────────────
 *  ① 先校验后入库：每包跑一遍 `@gbe/schema` 的 checkPackage（门禁双跑的第二次；
 *     第一次在 studio 出包前）。错误包 / 带 warning 的包**原地不动**，只报不搬
 *     （契约 DoD：无 error 且无 warning，无豁免通道 —— CONVENTIONS §17 第 4 条（`docs/CONVENTIONS.md:467`））。
 *  ② 只 move，不删：`fs.renameSync`。仓库内同盘，不跨设备。
 *     目标已存在（同 id 的旧版本）→ 先把旧目录 **move 到 `_archive/`**，再落新包。
 *     ★ **同 id 同 version 但内容不同 → 拒绝**（必须升 version，或显式 `--force`）；
 *       同版本同内容 → 跳过（幂等重跑）。任何情况下都不用 `rm`（CONVENTIONS 硬性禁令）。
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
 *   node tools/intake.js --reindex       # 只刷 kits/<kit>/kit.json 的 coverage.done；不跑入库、不碰 inbox/kits 内容
 *                                        # （--dry-run/--quiet 对它同样有效；--only 只筛 inbox 包，对 reindex 无效）
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

/** 纯函数：把磁盘计数并入 coverage（派生快照）——不读盘，便于自测。
 *  不变式：coverage 的键 **等于** kit.categories（`$` 开头的注释键除外）。
 *  声明了但还没有计划的类目补 `{ done, planned: 0 }`；已有条目只改 `done`，不碰 `planned`。 */
function mergeCoverage(kit, counts) {
  const coverage = kit.coverage && typeof kit.coverage === 'object' ? kit.coverage : {};
  const declared = Array.isArray(kit.categories) ? kit.categories : [];
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
  for (const key of declared) {
    if (Object.prototype.hasOwnProperty.call(coverage, key)) continue;
    coverage[key] = { done: counts.get(key) || 0, planned: 0 };
    changed = true;
  }
  // $comment 里别留会过期的话
  if (coverage.$comment && !coverage.$comment.includes('tools/intake.js')) {
    coverage.$comment = '派生快照（可重建）。由 tools/intake.js 入库时刷新，等价于 gbe reindex；禁止手工维护。';
    changed = true;
  }
  return { coverage, changed };
}

/** 纯函数（除读盘外无反作用）：按磁盘实况统计各类目资产数。 */
function countKitCoverage(kitId) {
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
  return counts;
}

function refreshCoverage(kitId, opts) {
  const kitFile = path.join(KITS, kitId, 'kit.json');
  if (!fs.existsSync(kitFile)) return null;
  const kit = JSON.parse(fs.readFileSync(kitFile, 'utf8'));
  if (!kit.coverage || typeof kit.coverage !== 'object') return null;

  const { coverage, changed } = mergeCoverage(kit, countKitCoverage(kitId));
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
    // X-0032 A-4：契约 DoD（CONVENTIONS §17 第 4 条（`docs/CONVENTIONS.md:467`））要求入库「无 error 且无 warning」，
    // 无豁免通道 —— 曾经这里只看 res.ok，带 warning 的包也能进 kits，弱于契约。
    // 现在 warnings 非空同样拒收；warning 明细保留在 row.warnings 里单列展示（见 main 的 `!` 行）。
    if (!res.ok || row.warnings.length > 0) {
      row.action = 'rejected';
      row.errors = (res.errors || []).map((e) => `${e.path}  ${e.message}`);
      if (row.warnings.length > 0) {
        row.errors.push(
          `契约 DoD（CONVENTIONS §17 第 4 条 · docs/CONVENTIONS.md:467）：入库要求无 error 且无 warning（无豁免通道）—— 以下 ${row.warnings.length} 条 warning 按拒收处理`
        );
      }
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
      const sameContent =
        String(old || '') === String(asset.version || '') && dirDigest(t.dir) === dirDigest(src);
      const d = decideExisting(old, asset.version, sameContent, !!opts.force);
      if (d.action === 'skipped') {
        row.action = 'skipped';
        row.note = d.reason;
        rows.push(row);
        continue;
      }
      if (d.action === 'rejected') {
        row.action = 'rejected';
        row.errors.push(d.reason);
        rows.push(row);
        continue;
      }
      const archName = `${t.name}@${old || '0.0.0'}`;
      const archPath = path.join(ARCHIVE, archName);
      let finalArch = archPath;
      let n = 2;
      while (fs.existsSync(finalArch)) finalArch = path.join(ARCHIVE, `${archName}+${n++}`);
      row.action = 'replace';
      row.note = `旧版本 → _archive/${path.basename(finalArch)}/${d.reason ? ' · ' + d.reason : ''}`;
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

/** 目录内容摘要（相对路径 + 文件字节；排序保证确定性）。用于判「同版本是否同内容」。 */
function dirDigest(dir) {
  const h = crypto.createHash('sha256');
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { h.update('D ' + r + '\n'); walk(path.join(d, e.name), r); }
      else { h.update('F ' + r + '\n'); h.update(fs.readFileSync(path.join(d, e.name))); }
    }
  })(dir, '');
  return h.digest('hex');
}

/**
 * 纯函数：目标已存在时该怎么处理（ADR：同版本重投必须拒绝，覆盖需显式 --force）。
 * ★ 同版本同内容 = 幂等重跑，跳过；同版本异内容 = 静默换代风险，拒绝；不同版本 = 正常换代。
 */
function decideExisting(oldVersion, newVersion, sameContent, force) {
  if (sameContent) return { action: 'skipped', reason: '同版本同内容 → 跳过（幂等）' };
  if (String(oldVersion || '') === String(newVersion || '') && !force) {
    return { action: 'rejected', reason: `同版本 ${newVersion} 但内容不同 —— 必须升 version，或显式加 --force` };
  }
  return { action: 'replace', reason: force ? '--force 覆盖同版本' : '' };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv) {
  const opts = { dryRun: false, quiet: false, only: null, reindex: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--quiet') opts.quiet = true;
    else if (a === '--reindex') opts.reindex = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--only') opts.only = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('用法：node tools/intake.js [--dry-run] [--only <asset-id>] [--force] [--reindex] [--quiet]');
      console.log('  --force    同 id 同 version 但内容不同时，仍允许覆盖（旧包进 _archive）');
      console.log('  --reindex  只刷 kits/*/kit.json 的 coverage.done，不跑入库、不碰 inbox/kits 内容');
      return 0;
    } else {
      console.error(`未知参数：${a}`);
      return 2;
    }
  }

  // ── --reindex：只刷 coverage.done（X-0032 A-3）────────────────────────────
  // 文档承诺「--reindex 只刷 coverage.done」—— 此处必须【跳过 intake(opts)】。
  // 曾经这里无条件先跑完整入库：inbox 里若有包，会被连带搬进 kits，
  // 与「只重建派生快照」的语义完全相反（派生动作不许有副作用，CONVENTIONS §11）。
  if (opts.reindex) {
    const kits = [];
    if (fs.existsSync(KITS)) {
      for (const ent of fs.readdirSync(KITS, { withFileTypes: true })) {
        if (ent.isDirectory()) kits.push(ent.name);
      }
    }
    kits.sort();
    let refreshed = 0;
    for (const kit of kits) {
      const cov = refreshCoverage(kit, opts);
      if (cov && cov.changed) {
        refreshed++;
        if (!opts.quiet) console.log(`· ${kit}: coverage.done 已刷新`);
      }
    }
    if (!opts.quiet) {
      console.log(`kits ：${KITS}${opts.dryRun ? '   （--dry-run：未动盘）' : ''}`);
      console.log('─'.repeat(96));
    }
    console.log(
      `reindex：${kits.length} 个 kit，${refreshed} 个 coverage.done 有变化${opts.dryRun ? ' · dry-run' : ''}`
    );
    return 0;
  }

  const rows = intake(opts);
  const ok = rows.filter((r) => r.action === 'intake' || r.action === 'replace');
  const bad = rows.filter((r) => r.action === 'rejected');
  const skipped = rows.filter((r) => r.action === 'skipped');

  if (!opts.quiet) {
    console.log(`inbox：${INBOX}`);
    console.log(`kits ：${KITS}${opts.dryRun ? '   （--dry-run：未动盘）' : ''}`);
    console.log('─'.repeat(96));
    for (const r of rows) {
      const mark = r.action === 'rejected' ? '✗' : r.action === 'replace' ? '↻' : r.action === 'skipped' ? '=' : '✓';
      const tail =
        r.action === 'rejected' ? '' : r.action === 'skipped' ? `   ${r.note}` : `→ ${r.target}${r.note ? '   ' + r.note : ''}`;
      console.log(`${mark} ${r.id}@${r.version}   ${r.action}   ${tail}`);
      r.errors.forEach((e) => console.log(`    ✗ ${e}`));
      r.warnings.forEach((w) => console.log(`    ! ${w.path}  ${w.message}`));
    }
    console.log('─'.repeat(96));
  }

  const kits = new Set(ok.map((r) => r.id.split('.')[0]));
  if (kits.size === 0) {
    // inbox 没有成功入库的包时，仍顺带刷新全部 kit 的 coverage（等价一次 reindex）。
    // 注意：--reindex 已在上面单独分支处理，不会走到这里。
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
    }）· 拒收 ${bad.length} 件 · 跳过 ${skipped.length} 件${opts.dryRun ? ' · dry-run' : ''}`
  );
  return bad.length ? 1 : 0;
}

function selfTest() {
  const cases = [];
  const t = (name, got, want) => cases.push([name, got === want, `得 ${JSON.stringify(got)} / 期 ${JSON.stringify(want)}`]);
  t('同版本同内容 → skipped', decideExisting('1.0.0', '1.0.0', true, false).action, 'skipped');
  t('同版本异内容 → rejected', decideExisting('1.0.0', '1.0.0', false, false).action, 'rejected');
  t('同版本异内容 + force → replace', decideExisting('1.0.0', '1.0.0', false, true).action, 'replace');
  t('不同版本 → replace', decideExisting('1.0.0', '1.0.1', false, false).action, 'replace');
  t('旧包无版本 → replace', decideExisting(null, '1.0.0', false, false).action, 'replace');

  // coverage 派生合并：键必须等于 kit.categories
  const base = () => ({ categories: ['components/roof', 'buildings/palace'], coverage: { $comment: '由 tools/intake.js 刷新', 'components/roof': { done: 0, planned: 5 } } });
  const m1 = mergeCoverage(base(), new Map([['components/roof', 2]]));
  t('coverage · 已有键只更新 done', m1.coverage['components/roof'].done, 2);
  t('coverage · planned 不被改写', m1.coverage['components/roof'].planned, 5);
  t('coverage · 声明但无计划 → planned 0', m1.coverage['buildings/palace'].planned, 0);
  t('coverage · 声明但无计划 → done 0', m1.coverage['buildings/palace'].done, 0);
  t('coverage · 补键算变更', m1.changed, true);
  t('coverage · 注释键保留', m1.coverage.$comment.includes('tools/intake.js'), true);
  const full = base();
  full.coverage['buildings/palace'] = { done: 0, planned: 0 };
  t('coverage · 键齐且 done 一致 → changed=false', mergeCoverage(full, new Map()).changed, false);
  t('coverage · 未在 categories 里出现 → 不新增键', Object.keys(mergeCoverage(full, new Map([['props/x', 3]])).coverage).includes('props/x'), false);
  let bad = 0;
  console.log('  [intake] 反向测试（--self-test）');
  for (const [name, ok, detail] of cases) {
    console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(30)} ${detail}`);
    if (!ok) bad++;
  }
  console.log(`  结果：${bad ? '不通过（' + bad + '）' : '通过（' + cases.length + ' / ' + cases.length + '）'}`);
  return bad ? 1 : 0;
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) process.exit(selfTest());
  process.exit(main(process.argv.slice(2)));
}

module.exports = { intake, targetDirFor, parseInboxName, refreshCoverage, decideExisting, dirDigest, mergeCoverage, countKitCoverage };
