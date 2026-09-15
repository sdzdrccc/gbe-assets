'use strict';

/**
 * @gbe/schema —— GBE 双库共用的契约校验包（CONVENTIONS §0.2）。
 *
 * 单一来源原则：**语法校验只有这一份实现**。Studio 出包前调用一次、Assets 入库时再调用一次，
 * 两侧不写第二套校验器；业务门禁的判据全部聚合自真源（catalog/schema、kit.json、catalog.config.json）。
 *
 * 用法（Node 内置模块，零依赖）：
 *   const gbe = require('@gbe/schema');
 *   const r = gbe.validateAsset(assetJson);
 *   const p = gbe.checkPackage('F:/zxc/Project/gbe-assets/inbox/xx@1.0.0');
 *   if (!p.ok) console.error(p.errors);
 *
 * CLI：
 *   node index.js asset           path/to/asset.json
 *   node index.js source          path/to/source.json
 *   node index.js assembly        path/to/assembly.json         （语法）
 *   node index.js assembly-check  path/to/assembly.json         （§19.5 语义，需真源库）
 *   node index.js package         path/to/inbox/<id>@<version>/
 */

const fs = require('fs');
const path = require('path');
const { validateAgainst } = require('./validate');
const asm = require('./assembly');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCHEMA_DIR = path.join(REPO_ROOT, 'catalog', 'schema');

const SCHEMA_FILES = {
  asset: 'asset.v2.schema.json',
  source: 'source.v2.schema.json',
  assembly: 'assembly.v2.schema.json',
  kit: 'kit.schema.json',
  collection: 'collection.schema.json',
};

const CURRENT_SCHEMA_VERSION = '2';
const PREVIEW_SIZE_PX = 512;
const EPS = 1e-6;

const schemaCache = new Map();

function loadSchema(name) {
  const file = SCHEMA_FILES[name];
  if (!file) throw new Error(`未知 schema 名：${name}（可选：${Object.keys(SCHEMA_FILES).join(' / ')}）`);
  const full = path.join(SCHEMA_DIR, file);
  if (schemaCache.has(full)) return schemaCache.get(full);
  const schema = JSON.parse(fs.readFileSync(full, 'utf8'));
  schemaCache.set(full, schema);
  return schema;
}

function validate(schemaName, data) {
  const schema = loadSchema(schemaName);
  const { valid, errors } = validateAgainst(schema, data);
  return { valid, errors, schemaName, schemaFile: SCHEMA_FILES[schemaName] };
}

const validateAsset = (a) => validate('asset', a);
const validateSource = (s) => validate('source', s);
const validateAssembly = (a) => validate('assembly', a);
const validateKit = (k) => validate('kit', k);
const validateCollection = (c) => validate('collection', c);

// ---------------------------------------------------------------------------
// 门禁 1：契约版本闸门（ADR-0001 —— v1 一律拒收，不静默兼容）
// ---------------------------------------------------------------------------

function gateSchemaVersion(data, label = 'package') {
  const errors = [];
  if (data === null || typeof data !== 'object') {
    errors.push({ path: '$', message: `${label}: 不是合法的 JSON 对象` });
    return { valid: false, errors };
  }
  const v = data.schema_version;
  if (v === undefined) {
    errors.push({
      path: '$.schema_version',
      message:
        `${label}: 缺少 schema_version —— v1 契约已废弃，原型资产不迁移，请用 v2 重新出包（ADR-0001）`,
    });
  } else if (String(v) !== CURRENT_SCHEMA_VERSION) {
    errors.push({
      path: '$.schema_version',
      message: `${label}: schema_version 必须为 "${CURRENT_SCHEMA_VERSION}"，实际为 "${v}"（不静默兼容）`,
    });
  }
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// 门禁 2：目录名不变式（CONVENTIONS §2.2 —— 目录名严格等于 id 第三段）
// ---------------------------------------------------------------------------

function checkDirectoryName(asset, dirName) {
  const errors = [];
  if (!asset || typeof asset.id !== 'string') return { valid: true, errors };
  const segs = asset.id.split('.');
  if (segs.length !== 3) {
    errors.push({ path: '$.id', message: `id 必须为 <kit>.<category-leaf>.<name> 三段，实际 ${segs.length} 段` });
    return { valid: false, errors };
  }
  const expected = segs[2];
  if (dirName !== expected) {
    errors.push({
      path: '$dir',
      message: `目录名必须严格等于 id 第三段："${expected}"，实际为 "${dirName}"（不得带类别前缀，CONVENTIONS §2.2）`,
    });
  }
  return { valid: errors.length === 0, errors };
}

/**
 * inbox 投递目录名不变式（CONVENTIONS §2.3）：`inbox/<asset-id>@<version>/`
 * 注意与 kits 目录区分：kits 用 id 第三段，inbox 用【完整 id】。
 */
function checkInboxDirName(asset, base, versionPart) {
  const errors = [];
  const warnings = [];
  if (!asset || typeof asset.id !== 'string') return { valid: true, errors, warnings };
  if (base !== asset.id) {
    errors.push({
      path: '$dir',
      message: `inbox 目录名必须是完整 asset id："${asset.id}"，实际为 "${base}"（CONVENTIONS §2.3）`,
    });
  }
  if (versionPart !== undefined && versionPart !== '' && asset.version !== versionPart) {
    errors.push({
      path: '$dir',
      message: `inbox 目录的 @<version> 与 asset.version 不一致：目录 "${versionPart}" vs 清单 "${asset.version}"`,
    });
  }
  if (!versionPart) {
    warnings.push({
      path: '$dir',
      message: '目录名未带 @<version>，按 0.0.0-draft 处理（CONVENTIONS §2.3）',
    });
  }
  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// 门禁 3：面数预算（真源 kit.json.budgets > catalog.config.json）
// ---------------------------------------------------------------------------

function loadKitBudgets(kitId) {
  if (!kitId) return null;
  const kitFile = path.join(REPO_ROOT, 'kits', kitId, 'kit.json');
  if (!fs.existsSync(kitFile)) return null;
  const kit = JSON.parse(fs.readFileSync(kitFile, 'utf8'));
  return { budgets: kit.budgets || null, grid: kit.grid || null, source: kitFile };
}

function loadDefaultConfig() {
  const f = path.join(REPO_ROOT, 'catalog.config.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
}

function resolveBudgets(kitId) {
  const kit = loadKitBudgets(kitId);
  if (kit && kit.budgets) return { budgets: kit.budgets, source: kit.source };
  const cfg = loadDefaultConfig();
  return { budgets: cfg.budgets || {}, source: 'catalog.config.json' };
}

function resolveGrid(kitId) {
  const kit = loadKitBudgets(kitId);
  if (kit && kit.grid) return { grid: kit.grid, source: kit.source };
  const cfg = loadDefaultConfig();
  return { grid: cfg.grid_default || {}, source: 'catalog.config.json' };
}

function checkBudget(asset) {
  const errors = [];
  const warnings = [];
  if (!asset || !asset.tier || !asset.geometry) return { valid: true, errors, warnings };
  const { budgets, source } = resolveBudgets(asset.kit);
  const limit = budgets[asset.tier];
  if (limit === undefined) {
    warnings.push({ path: '$.tier', message: `未找到 tier "${asset.tier}" 的面数预算（真源：${source}）` });
    return { valid: true, errors, warnings };
  }
  const poly = asset.geometry.polycount;
  if (typeof poly === 'number' && poly > limit) {
    errors.push({
      path: '$.geometry.polycount',
      message: `面数 ${poly} 超出 tier "${asset.tier}" 预算 ${limit}（三角面；真源：${source}）——请减面或提升 tier`,
    });
  }
  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// 门禁 4：模数对齐（CONVENTIONS §19.2 —— 两级网格）
//    定位网格 snap_m：插槽位置【必须】为整数倍（硬）
//    造型网格 snap_m / 2：构件水平尺寸（软，仅警告）
// ---------------------------------------------------------------------------

function nearMultiple(value, step) {
  const q = value / step;
  return Math.abs(q - Math.round(q)) < 1e-6;
}

function checkGridAlignment(asset) {
  const errors = [];
  const warnings = [];
  if (!asset || !asset.geometry) return { valid: true, errors, warnings };
  if (asset.grid_exempt === true) {
    warnings.push({ path: '$', message: 'grid_exempt = true，已跳过模数对齐检查（须附理由）' });
    return { valid: true, errors, warnings };
  }

  const { grid, source } = resolveGrid(asset.kit);
  const snap = grid.snap_m;
  if (!snap) {
    warnings.push({ path: '$.kit', message: `未找到 kit 的 snap_m（真源：${source}），跳过模数检查` });
    return { valid: true, errors, warnings };
  }

  // 4a 插槽位置 —— 硬约束
  const sockets = Array.isArray(asset.sockets) ? asset.sockets : [];
  sockets.forEach((s, i) => {
    if (!s || s.type === 'attach') return;
    if (!Array.isArray(s.position_m)) return;
    s.position_m.forEach((v, axis) => {
      if (typeof v !== 'number') return;
      if (!nearMultiple(v, snap)) {
        errors.push({
          path: `$.sockets[${i}].position_m[${axis}]`,
          message: `插槽 "${s.name}" 的位置 ${v} 未落在定位网格 ${snap}m 上（CONVENTIONS §19.2：定位一松，跨构件拼装就散了）`,
        });
      }
    });
  });

  // 4b 水平尺寸 —— 软约束（造型网格）
  const dims = asset.geometry.dimensions_m;
  if (Array.isArray(dims) && dims.length === 3) {
    const fine = snap / 2;
    [0, 2].forEach((axis) => {
      const name = axis === 0 ? 'x 宽' : 'z 深';
      if (typeof dims[axis] === 'number' && !nearMultiple(dims[axis], fine)) {
        warnings.push({
          path: `$.geometry.dimensions_m[${axis}]`,
          message: `水平尺寸 ${name} = ${dims[axis]} 未落在造型网格 ${fine}m 上（软约束；细部构件可接受，结构件建议归整）`,
        });
      }
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// 门禁 5：插槽完备（L1–L3 至少有 1 个插槽；L2+ 必须有 direction）
// ---------------------------------------------------------------------------

function checkSocketsCompleteness(asset) {
  const errors = [];
  const warnings = [];
  if (!asset || !asset.granularity) return { valid: true, errors, warnings };
  const g = asset.granularity;
  const sockets = Array.isArray(asset.sockets) ? asset.sockets : [];

  const needsSocket = g === 'L1' || g === 'L2' || g === 'L3';
  if (needsSocket && sockets.length === 0) {
    errors.push({
      path: '$.sockets',
      message: `${g} 构件必须声明至少 1 个插槽（CONVENTIONS §19.3）；无插槽者只能作为装饰件`,
    });
  }
  if ((g === 'L1' || g === 'L2') && sockets.length > 0 && sockets.every((s) => s.type === 'attach')) {
    warnings.push({
      path: '$.sockets',
      message: `${g} 构件只有 attach 类插槽——它无法参与结构对齐，请确认这是刻意的`,
    });
  }
  sockets.forEach((s, i) => {
    if (!s || !s.direction && s.type !== 'attach') {
      warnings.push({
        path: `$.sockets[${i}].direction`,
        message: `插槽 "${s && s.name}" 未声明 direction（对接件将无从判断接入方向）`,
      });
    }
  });
  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// PNG 尺寸读取（校验 preview.png 是否为 512×512）
// ---------------------------------------------------------------------------

function readPngSize(file) {
  try {
    const buf = Buffer.alloc(24);
    const fd = fs.openSync(file, 'r');
    fs.readSync(fd, buf, 0, 24, 0);
    fs.closeSync(fd);
    if (buf.readUInt32BE(0) !== 0x89504e47) return null; // PNG magic
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 综合校验：一个 inbox 投递包
// ---------------------------------------------------------------------------

/**
 * @param {string} dir 形如 <gbe-assets>/inbox/<asset-id>@<version>/
 * @returns {{ok: boolean, errors: any[], warnings: any[], asset?: object}}
 */
function checkPackage(dir) {
  const errors = [];
  const warnings = [];
  const push = (label, res) => {
    if (res && Array.isArray(res.errors)) {
      res.errors.forEach((e) => errors.push({ ...e, path: `${label}${e.path.replace(/^\$/, '')}` }));
    }
    if (res && Array.isArray(res.warnings)) {
      res.warnings.forEach((w) => warnings.push({ ...w, path: `${label}${w.path.replace(/^\$/, '')}` }));
    }
  };

  if (!fs.existsSync(dir)) {
    return { ok: false, errors: [{ path: '$dir', message: `目录不存在：${dir}` }], warnings: [] };
  }

  const assetFile = path.join(dir, 'asset.json');
  const sourceFile = path.join(dir, 'source.json');

  if (!fs.existsSync(assetFile)) {
    errors.push({ path: '$dir/asset.json', message: '缺少 asset.json' });
    return { ok: false, errors, warnings };
  }
  if (!fs.existsSync(sourceFile)) {
    errors.push({ path: '$dir/source.json', message: '缺少 source.json' });
  }

  let asset;
  try {
    asset = JSON.parse(fs.readFileSync(assetFile, 'utf8'));
  } catch (e) {
    errors.push({ path: 'asset.json', message: `JSON 解析失败：${e.message}` });
    return { ok: false, errors, warnings };
  }

  // ⓪ 契约版本闸门 —— 最先跑，v1 直接拒收
  const gateA = gateSchemaVersion(asset, 'asset.json');
  if (!gateA.valid) {
    push('asset.json', gateA);
    return { ok: false, errors, warnings, asset };
  }

  // ① 语法校验
  push('asset.json', validateAsset(asset));
  if (fs.existsSync(sourceFile)) {
    let source;
    try {
      source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
    } catch (e) {
      errors.push({ path: 'source.json', message: `JSON 解析失败：${e.message}` });
    }
    if (source) {
      push('source.json', gateSchemaVersion(source, 'source.json'));
      push('source.json', validateSource(source));
    }
  }

  // ② 业务门禁
  const base = path.basename(dir);
  const at = base.lastIndexOf('@');
  const dirBase = at >= 0 ? base.slice(0, at) : base;
  const dirVersion = at >= 0 ? base.slice(at + 1) : '';
  push('', checkInboxDirName(asset, dirBase, dirVersion));
  push('', checkBudget(asset));
  push('', checkGridAlignment(asset));
  push('', checkSocketsCompleteness(asset));

  // ③ 预览图
  const preview = path.join(dir, 'preview.png');
  if (!fs.existsSync(preview)) {
    errors.push({ path: 'preview.png', message: '缺少 preview.png（512×512，白底 3/4 视角）' });
  } else {
    const size = readPngSize(preview);
    if (!size) {
      warnings.push({ path: 'preview.png', message: '无法解析 PNG 头部，跳过尺寸校验' });
    } else if (size.width !== PREVIEW_SIZE_PX || size.height !== PREVIEW_SIZE_PX) {
      errors.push({
        path: 'preview.png',
        message: `预览图必须为 ${PREVIEW_SIZE_PX}×${PREVIEW_SIZE_PX}，实际 ${size.width}×${size.height}`,
      });
    }
  }

  // ④ 模型文件存在性
  const lods = (asset.files && asset.files.model) || {};
  for (const [k, rel] of Object.entries(lods)) {
    if (typeof rel === 'string' && !fs.existsSync(path.join(dir, rel))) {
      errors.push({ path: `asset.json.files.model.${k}`, message: `文件不存在：${rel}` });
    }
  }

  return { ok: errors.length === 0, errors, warnings, asset };
}

// ---------------------------------------------------------------------------
// 综合校验：一条装配清单（先语法，后 §19.5 语义）
// ---------------------------------------------------------------------------

/**
 * @param {object|string} manifest 装配清单对象，或其 JSON 文件路径
 * @param {object} [opts] { strict }
 * @returns {{ok:boolean, errors:any[], warnings:any[], flags:string[], stats:any}}
 */
function checkAssemblyFull(manifest, opts = {}) {
  let m = manifest;
  if (typeof manifest === 'string') {
    try {
      m = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    } catch (e) {
      return {
        ok: false,
        errors: [{ path: '$', message: `JSON 读取失败：${e.message}` }],
        warnings: [],
        flags: [],
        stats: {},
      };
    }
  }

  const gate = gateSchemaVersion(m, 'assembly');
  if (!gate.valid) return { ok: false, errors: gate.errors, warnings: [], flags: [], stats: {} };

  const syntax = validateAssembly(m);
  if (!syntax.valid) return { ok: false, errors: syntax.errors, warnings: syntax.warnings || [], flags: [], stats: {} };

  const res = asm.checkAssembly(m, { repoRoot: REPO_ROOT, ...opts });
  return {
    ok: res.ok,
    errors: [...(syntax.errors || []), ...res.errors],
    warnings: [...(syntax.warnings || []), ...res.warnings],
    flags: res.flags,
    stats: res.stats,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv) {
  const [kind, target] = argv;
  if (!kind) {
    console.log('用法：');
    console.log('  node index.js asset|source|assembly|kit|collection <file.json>');
    console.log('  node index.js package <dir>');
    return 2;
  }
  const report = (res) => {
    if (res.valid === undefined && res.ok !== undefined) res.valid = res.ok;
    (res.errors || []).forEach((e) => console.error(`  ✗ ${e.path}  ${e.message}`));
    (res.warnings || []).forEach((w) => console.warn(`  ! ${w.path}  ${w.message}`));
    if (res.valid) console.log(`✓ 通过（${(res.warnings || []).length} 条警告）`);
    return res.valid ? 0 : 1;
  };

  if (kind === 'package') return report(checkPackage(target));
  if (kind === 'assembly-check') return report(checkAssemblyFull(target, { strict: argv.includes('--strict') }));
  if (!SCHEMA_FILES[kind]) {
    console.error(`未知类型：${kind}`);
    return 2;
  }
  const data = JSON.parse(fs.readFileSync(target, 'utf8'));
  const gate = gateSchemaVersion(data, path.basename(target));
  if (!gate.valid) return report(gate);
  return report(validate(kind, data));
}

module.exports = {
  // 常量
  REPO_ROOT,
  SCHEMA_DIR,
  SCHEMA_FILES,
  CURRENT_SCHEMA_VERSION,
  PREVIEW_SIZE_PX,
  // 基础
  loadSchema,
  validate,
  validateAsset,
  validateSource,
  validateAssembly,
  validateKit,
  validateCollection,
  gateSchemaVersion,
  // 业务门禁
  checkDirectoryName,
  checkInboxDirName,
  checkBudget,
  checkGridAlignment,
  checkSocketsCompleteness,
  checkPackage,
  checkAssemblyFull,
  assembly: asm,
  resolveBudgets,
  resolveGrid,
  readPngSize,
};

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
