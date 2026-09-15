'use strict';

/**
 * @gbe/schema 冒烟测试 —— 零测试框架，直接 node test/smoke.js。
 * 覆盖：正例通过 · 负例被拦 · v1 契约版本闸门 · 模数/预算/插槽门禁 · 目录名不变式。
 */

const assert = require('assert');
const path = require('path');
const gbe = require('../index');

let passed = 0;
let failed = 0;

function ok(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n      ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// 测试夹具
// ---------------------------------------------------------------------------

function makeAsset(overrides = {}) {
  const base = {
    schema_version: '2',
    id: 'cn-ancient.roof.xuanshan-single-a',
    name: '悬山顶·单檐 A',
    version: '1.0.0',
    status: 'published',
    flags: [],
    kit: 'cn-ancient',
    category: 'components/roof',
    tier: 'component',
    granularity: 'L2',
    tags: ['悬山顶', '单檐'],
    geometry: {
      dimensions_m: [6.0, 4.0, 2.5],
      pivot: 'bottom-center',
      axis: { up: '+Y', forward: '-Z' },
      polycount: 15000,
      vertices: 7800,
    },
    files: { model: { lod0: 'model.glb' }, preview: ['preview.png'], collision: null },
    shell: { has_uv: true, manifold: true, solidified: true },
    materials: { slots: [{ slot: 'roof', ref: 'roof-tile/qingwa' }], embedded_textures: 0 },
    collision: 'box',
    sockets: [
      { name: 'base-center', type: 'roof-seat', position_m: [0, 0, 0], direction: '-y', grid_locked: true },
      { name: 'ridge-west', type: 'ridge-point', position_m: [-3, 4.0, 0], direction: '-x' },
    ],
    engines: { unreal: { scale: 100, rotation: [0, 0, 0], up_axis: 'z' } },
    license: 'CC0-1.0',
    author: 'sdzdrccc',
  };
  return deepMerge(base, overrides);
}

function makeSource(overrides = {}) {
  const base = {
    schema_version: '2',
    provenance: {
      provider: 'hunyuan3d',
      channel: 'tokenhub',
      model: 'hy-3d-3.1',
      mode: 'text',
      prompt: '中国古代建筑屋顶构件——悬山顶单檐',
      task_id: null,
      cost: { value: 30, unit: 'credit', usd_est: 0.33 },
      raw_ref: 'raw/hunyuan3d_out.glb',
    },
    refine: {
      recipe_id: 'cn-ancient/roof-component',
      recipe_hash: 'a1b2c3d4e5f60718',
      blender: '4.5',
    },
    created_at: '2026-09-15T20:00:00+08:00',
  };
  return deepMerge(base, overrides);
}

function deepMerge(a, b) {
  if (b === null || typeof b !== 'object' || Array.isArray(b)) return b;
  const out = Array.isArray(a) ? [...a] : { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && a && typeof a[k] === 'object'
      ? deepMerge(a[k], v)
      : v;
  }
  return out;
}

function pathsOf(res) {
  return res.errors.map((e) => e.path);
}

// ---------------------------------------------------------------------------
console.log('\n[1] asset.v2 语法校验');
// ---------------------------------------------------------------------------

ok('正例：完整 L2 构件通过', () => {
  const r = gbe.validateAsset(makeAsset());
  assert.ok(r.valid, JSON.stringify(r.errors, null, 2));
});

ok('负例：缺 granularity 被拦', () => {
  const a = makeAsset();
  delete a.granularity;
  const r = gbe.validateAsset(a);
  assert.ok(!r.valid);
  assert.ok(r.errors.some((e) => /granularity/.test(e.message)));
});

ok('负例：dimensions_m 轴序长度不为 3 被拦', () => {
  const r = gbe.validateAsset(makeAsset({ geometry: { dimensions_m: [6.0, 4.0, 2.5, 1.0] } }));
  assert.ok(!r.valid);
  assert.ok(r.errors.some((e) => /dimensions_m/.test(e.path)));
});

ok('负例：id 带大写 / 结构错误被拦', () => {
  assert.ok(!gbe.validateAsset(makeAsset({ id: 'CN-Ancient.roof.Xuan' })).valid);
  assert.ok(!gbe.validateAsset(makeAsset({ id: 'cn-ancient' })).valid);
});

ok('负例：category 不在真源枚举内被拦', () => {
  const r = gbe.validateAsset(makeAsset({ category: 'components/roof-tile' }));
  assert.ok(!r.valid);
  assert.ok(r.errors.some((e) => /category/.test(e.path)));
});

ok('负例：axis.forward 被改成 +Z 被拦', () => {
  const r = gbe.validateAsset(makeAsset({ geometry: { axis: { up: '+Y', forward: '+Z' } } }));
  assert.ok(!r.valid);
});

ok('负例：未知字段（additionalProperties=false）被拦', () => {
  const r = gbe.validateAsset(makeAsset({ surprise: 1 }));
  assert.ok(!r.valid);
  assert.ok(r.errors.some((e) => /surprise/.test(e.path)));
});

ok('负例：材料槽名不在词表内被拦', () => {
  const r = gbe.validateAsset(makeAsset({ materials: { slots: [{ slot: 'roofTile', ref: 'roof-tile/qingwa' }] } }));
  assert.ok(!r.valid);
});

ok('status=deprecated 无 by/reason 被拦；带 reason 通过', () => {
  assert.ok(!gbe.validateAsset(makeAsset({ status: 'deprecated' })).valid);
  assert.ok(gbe.validateAsset(makeAsset({ status: 'deprecated', deprecated_reason: '形制错误' })).valid);
  assert.ok(gbe.validateAsset(makeAsset({ status: 'deprecated', deprecated_by: 'cn-ancient.roof.xuanshan-single-b' })).valid);
});

// ---------------------------------------------------------------------------
console.log('\n[2] sockets 约束（oneOf 恰好匹配 1 个分支）');
// ---------------------------------------------------------------------------

ok('continue 插槽缺 step_m 被拦', () => {
  const r = gbe.validateAsset(makeAsset({
    sockets: [{ name: 'eave-line', type: 'continue', position_m: [0, 4, 0], direction: '+x' }],
  }));
  assert.ok(!r.valid);
});

ok('continue 插槽带 step_m 通过', () => {
  const r = gbe.validateAsset(makeAsset({
    sockets: [{ name: 'eave-line', type: 'continue', position_m: [0, 4, 0], direction: '+x', step_m: 0.4 }],
  }));
  assert.ok(r.valid, JSON.stringify(r.errors));
});

ok('非法 socket type 被拦', () => {
  const r = gbe.validateAsset(makeAsset({
    sockets: [{ name: 'x', type: 'roof-seat-body', position_m: [0, 0, 0] }],
  }));
  assert.ok(!r.valid);
});

// ---------------------------------------------------------------------------
console.log('\n[3] 业务门禁');
// ---------------------------------------------------------------------------

ok('目录名不变式：带类别前缀被拦', () => {
  const a = makeAsset();
  assert.ok(!gbe.checkDirectoryName(a, 'roof-xuanshan-single-a').valid);
  assert.ok(gbe.checkDirectoryName(a, 'xuanshan-single-a').valid);
});

ok('inbox 目录名不变式：用【完整 id】而非第三段（§2.3）', () => {
  const a = makeAsset();
  assert.ok(gbe.checkInboxDirName(a, 'cn-ancient.roof.xuanshan-single-a', '1.0.0').valid);
  assert.ok(!gbe.checkInboxDirName(a, 'xuanshan-single-a', '1.0.0').valid);
  assert.ok(!gbe.checkInboxDirName(a, 'cn-ancient.roof.xuanshan-single-a', '2.0.0').valid);
});

ok('面数预算：component 超 20000 被拦', () => {
  const r = gbe.checkBudget(makeAsset({ kit: '__no_such_kit__', geometry: { polycount: 25000 } }));
  assert.ok(!r.valid);
});

ok('模数对齐：插槽位置 0.3 不在 0.5 网格上 —— 报错', () => {
  const r = gbe.checkGridAlignment(makeAsset({
    kit: '__no_such_kit__',
    sockets: [{ name: 'a', type: 'roof-seat', position_m: [0.3, 0, 0], direction: '-y' }],
  }));
  assert.ok(!r.valid);
  assert.ok(pathsOf(r).some((p) => /sockets\[0\]/.test(p)));
});

ok('模数对齐：插槽位置落网格 —— 通过', () => {
  const r = gbe.checkGridAlignment(makeAsset({
    kit: '__no_such_kit__',
    sockets: [{ name: 'a', type: 'roof-seat', position_m: [0.5, 4.0, -1.0], direction: '-y' }],
  }));
  assert.ok(r.valid, JSON.stringify(r.errors));
});

ok('模数对齐：grid_exempt 豁免检查（降级为警告）', () => {
  const r = gbe.checkGridAlignment(makeAsset({
    kit: '__no_such_kit__',
    grid_exempt: true,
    sockets: [{ name: 'a', type: 'roof-seat', position_m: [0.3, 0, 0], direction: '-y' }],
  }));
  assert.ok(r.valid);
  assert.strictEqual(r.warnings.length, 1);
});

ok('插槽完备：L2 构件无插槽被拦', () => {
  const r = gbe.checkSocketsCompleteness(makeAsset({ sockets: [] }));
  assert.ok(!r.valid);
});

ok('插槽完备：L3 装饰件只有 attach —— 仅警告', () => {
  const r = gbe.checkSocketsCompleteness(makeAsset({
    granularity: 'L3',
    category: 'components/ornament',
    sockets: [{ name: 'mount', type: 'attach' }],
  }));
  assert.ok(r.valid);
});

// ---------------------------------------------------------------------------
console.log('\n[4] source.v2 与契约版本闸门');
// ---------------------------------------------------------------------------

ok('正例：source 通过', () => {
  const r = gbe.validateSource(makeSource());
  assert.ok(r.valid, JSON.stringify(r.errors, null, 2));
});

ok('正例：web 通道 task_id=null 允许', () => {
  const r = gbe.validateSource(makeSource({
    provenance: { provider: 'manual', channel: 'web', mode: 'manual', task_id: null },
  }));
  assert.ok(r.valid, JSON.stringify(r.errors));
});

ok('负例：非 manual 精修缺 recipe_hash 被拦', () => {
  const s = makeSource();
  delete s.refine.recipe_hash;
  assert.ok(!gbe.validateSource(s).valid);
});

ok('正例：manual=true 时豁免 recipe_hash', () => {
  const s = makeSource({ refine: { manual: true, note: '人工修形' } });
  delete s.refine.recipe_hash;
  assert.ok(gbe.validateSource(s).valid, JSON.stringify(gbe.validateSource(s).errors));
});

ok('负例：rodin 已从 provider 枚举移除（ADR-0002）', () => {
  const s = makeSource({ provenance: { provider: 'rodin' } });
  assert.ok(!gbe.validateSource(s).valid);
});

ok('契约版本闸门：v1 包（无 schema_version）被拒收（ADR-0001）', () => {
  const legacy = { id: 'cn-ancient.roof.xuanshan-single-a', name: '悬山顶' };
  const r = gbe.gateSchemaVersion(legacy, 'asset.json');
  assert.ok(!r.valid);
  assert.ok(/v1 契约已废弃/.test(r.errors[0].message));
});

ok('契约版本闸门：schema_version="1" 被拒收', () => {
  const r = gbe.gateSchemaVersion({ schema_version: '1' }, 'asset.json');
  assert.ok(!r.valid);
});

// ---------------------------------------------------------------------------
console.log('\n[5] assembly.v2 / kit / collection');
// ---------------------------------------------------------------------------

ok('正例：装配清单通过', () => {
  const asm = {
    schema_version: '2',
    id: 'cn-ancient.assembly.wanan-hall-main',
    name: '万安城主殿·装配清单',
    kit: 'cn-ancient',
    category: 'assemblies/building',
    granularity: 'L0',
    grid_snap_m: 0.5,
    instances: [
      {
        instance_id: 'base-01',
        asset: { id: 'cn-ancient.base.podium-three-step-a', version: '^1.0.0' },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
        sockets: { 'top-center': 'colonnade-01::foot' },
      },
      {
        instance_id: 'roof-01',
        asset: { id: 'cn-ancient.roof.xieshan-double-a', version: '^1.0.0' },
        transform: { position: [0, 6, 0] },
        sockets: { 'roof-foot': 'colonnade-01::roof-seat' },
      },
    ],
    params: { bays: 5, bay_width_m: 4 },
    derived_from: 'cn-ancient/tpl-hall-xieshan-double',
  };
  const r = gbe.validateAssembly(asm);
  assert.ok(r.valid, JSON.stringify(r.errors, null, 2));
});

ok('负例：装配 granularity 必须为 L0', () => {
  const r = gbe.validateAssembly({
    schema_version: '2',
    id: 'cn-ancient.assembly.a-b',
    name: 'x',
    kit: 'cn-ancient',
    category: 'assemblies/building',
    granularity: 'L2',
    instances: [{ instance_id: 'a-1', asset: { id: 'x.y.z' }, transform: {} }],
  });
  assert.ok(!r.valid);
});

ok('负例：instance_id 不得用下划线', () => {
  const r = gbe.validateAssembly({
    schema_version: '2',
    id: 'cn-ancient.assembly.a-b',
    name: 'x',
    kit: 'cn-ancient',
    category: 'assemblies/building',
    granularity: 'L0',
    instances: [{ instance_id: 'base_01', asset: { id: 'x.y.z' }, transform: {} }],
  });
  assert.ok(!r.valid);
});

ok('正例：kit.json 通过（grid 与 budgets 齐备）', () => {
  const r = gbe.validateKit({
    id: 'cn-ancient',
    name: '中国传统古建',
    grid: { snap_m: 0.5, wall_module_m: 2, story_heights_m: [3, 4], pillar_spacing_m: [2, 4], ground_tile_m: 2 },
    budgets: { primitive: 5000, component: 20000, mass: 50000, hero: 100000 },
    materials: { 'roof-tile': ['qingwa', 'liuli-huang'] },
  });
  assert.ok(r.valid, JSON.stringify(r.errors));
});

ok('负例：kit 缺 budgets 被拦', () => {
  const r = gbe.validateKit({ id: 'x', name: 'x', grid: { snap_m: 0.5, wall_module_m: 2 } });
  assert.ok(!r.valid);
});

ok('正例：collection 通过', () => {
  const r = gbe.validateCollection({
    schema_version: '2',
    id: 'wanan-street-mvp',
    name: '万安城 - 街景 MVP 30 件',
    items: [{ id: 'cn-ancient.roof.xuanshan-single-a', version: '^1.0.0' }],
  });
  assert.ok(r.valid, JSON.stringify(r.errors));
});

// ---------------------------------------------------------------------------
console.log('\n[6] checkPackage（目录级综合校验）');
// ---------------------------------------------------------------------------

ok('负例：目录不存在', () => {
  const r = gbe.checkPackage(path.join(__dirname, '__nope__'));
  assert.ok(!r.ok);
});

ok('负例：v1 包被拒收（最先命中契约版本闸门）', () => {
  const fs = require('fs');
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbe-v1-'));
  const sub = path.join(dir, 'cn-ancient.roof.xuanshan-single-a@0.0.0');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'asset.json'), JSON.stringify({ id: 'cn-ancient.roof.xuanshan-single-a' }));
  fs.writeFileSync(path.join(sub, 'source.json'), JSON.stringify({}));
  const r = gbe.checkPackage(sub);
  assert.ok(!r.ok);
  assert.ok(r.errors.some((e) => /v1 契约已废弃/.test(e.message)));
  fs.rmSync(dir, { recursive: true, force: true });
});

ok('正例：v2 包（含 512 预览图）通过全部检查', () => {
  const fs = require('fs');
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbe-v2-'));
  const sub = path.join(dir, 'cn-ancient.roof.xuanshan-single-a@1.0.0');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'asset.json'), JSON.stringify(makeAsset(), null, 2));
  fs.writeFileSync(path.join(sub, 'source.json'), JSON.stringify(makeSource(), null, 2));

  // 造一个 512×512 的最小合法 PNG 头
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.writeUInt32BE(13, 8);
  Buffer.from('IHDR').copy(png, 12);
  png.writeUInt32BE(512, 16);
  png.writeUInt32BE(512, 20);
  fs.writeFileSync(path.join(sub, 'preview.png'), png);

  // 占位模型文件（只验证存在性）
  fs.writeFileSync(path.join(sub, 'model.glb'), '');

  const r = gbe.checkPackage(sub);
  assert.ok(r.ok, JSON.stringify(r.errors, null, 2));
  fs.rmSync(dir, { recursive: true, force: true });
});

ok('负例：预览图尺寸不对被拦', () => {
  const fs = require('fs');
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbe-prev-'));
  const sub = path.join(dir, 'cn-ancient.roof.xuanshan-single-a@1.0.0');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'asset.json'), JSON.stringify(makeAsset()));
  fs.writeFileSync(path.join(sub, 'source.json'), JSON.stringify(makeSource()));
  fs.writeFileSync(path.join(sub, 'model.glb'), '');
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.writeUInt32BE(13, 8);
  Buffer.from('IHDR').copy(png, 12);
  png.writeUInt32BE(300, 16); // 存量尺寸：300×300
  png.writeUInt32BE(300, 20);
  fs.writeFileSync(path.join(sub, 'preview.png'), png);

  const r = gbe.checkPackage(sub);
  assert.ok(!r.ok);
  assert.ok(r.errors.some((e) => /512/.test(e.message)));
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
console.log(`\n结果：${passed} 通过 / ${failed} 失败\n`);
process.exit(failed === 0 ? 0 : 1);
