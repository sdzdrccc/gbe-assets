'use strict';

/**
 * @gbe/schema 装配校验冒烟测试（CONVENTIONS §19.4 / §19.5）
 * 零测试框架：node test/assembly.js
 *
 * 刻意用**临时夹具库**（os.tmpdir 下的最小 kit），不依赖 kits/ 里真实资产的当前状态 ——
 * 否则以后每入库一件构件，这个测试都可能无辜变红。
 *
 * 正向：好清单全绿。
 * 反向：八条判据**逐条**得有能把它打红的最小反例。校验器抓不到错的"全绿"是假绿。
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
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

function eq(actual, expected, label) {
  assert.strictEqual(actual, expected, `${label}: 期望 ${expected}，实际 ${actual}`);
}

function hasErr(res, re, label) {
  const hit = res.errors.filter((e) => re.test(e.message));
  assert.ok(hit.length > 0, `${label}: 未报预期错误。实际错误：\n      ${res.errors.map((e) => e.message).join('\n      ') || '（无）'}`);
}

function hasWarn(res, re, label) {
  const hit = res.warnings.filter((w) => re.test(w.message));
  assert.ok(hit.length > 0, `${label}: 未报预期警告。实际警告：\n      ${res.warnings.map((w) => w.message).join('\n      ') || '（无）'}`);
}

// ---------------------------------------------------------------------------
// 夹具库
// ---------------------------------------------------------------------------

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'gbe-asm-'));
const KIT = 'tkit';

function asset(over) {
  const base = {
    schema_version: '2',
    name: '夹具构件',
    version: '1.0.0',
    status: 'published',
    flags: [],
    kit: KIT,
    tier: 'primitive',
    granularity: 'L2',
    tags: ['fixture'],
    geometry: {
      dimensions_m: [2, 3, 0.5],
      pivot: 'bottom-center',
      axis: { up: '+Y', forward: '-Z' },
      polycount: 36,
      vertices: 24,
    },
    files: { model: { lod0: 'lod0.glb' }, preview: ['preview.png'], collision: null },
    materials: { slots: [{ slot: 'wall', ref: 'earth/qing-zhuan' }], embedded_textures: 0 },
    collision: 'box',
    license: 'CC0-1.0',
    author: 'test',
  };
  return Object.assign(base, over);
}

function put(kit, category, name, over) {
  const dir = path.join(ROOT, 'kits', kit, ...category.split('/'), name);
  fs.mkdirSync(dir, { recursive: true });
  const leaf = category.split('/').pop();
  fs.writeFileSync(
    path.join(dir, 'asset.json'),
    JSON.stringify(asset(Object.assign({ id: `${kit}.${leaf}.${name}`, category }, over)), null, 2)
  );
  return dir;
}

function setupFixtures() {
  fs.mkdirSync(path.join(ROOT, 'kits', KIT), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'kits', KIT, 'kit.json'),
    JSON.stringify(
      {
        id: KIT,
        name: '夹具套件',
        version: '1.0.0',
        categories: ['components/wall', 'components/ornament'],
        grid: { snap_m: 0.5, wall_module_m: 2, story_heights_m: [3, 4], pillar_spacing_m: [2, 4], ground_tile_m: 2 },
        budgets: { primitive: 5000, component: 20000, mass: 50000, hero: 100000 },
        materials: { earth: ['qing-zhuan'] },
        axis: { up: '+Y', forward: '-Z', dimensions_order: ['x_width', 'y_height', 'z_depth'] },
        pivot: 'bottom-center',
      },
      null,
      2
    )
  );

  // 直墙段 2×3×0.5：两端 wall-line 落在端面
  put(KIT, 'components/wall', 'wall-a', {
    sockets: [
      { name: 'bottom', type: 'ground-foot', position_m: [0, 0, 0], direction: '-y', mate_types: ['stack-up', 'roof-seat'], grid_locked: true },
      { name: 'top', type: 'stack-up', position_m: [0, 3, 0], direction: '+y', mate_types: ['ground-foot'], grid_locked: true },
      { name: 'end-west', type: 'wall-line', position_m: [-1, 0, 0], direction: '-x', mate_types: ['wall-line'], grid_locked: true },
      { name: 'end-east', type: 'wall-line', position_m: [1, 0, 0], direction: '+x', mate_types: ['wall-line'], grid_locked: true },
    ],
  });

  // 枢轴式角墩 0.5×3×0.5：四向插槽落轴心
  put(KIT, 'components/wall', 'pier-a', {
    geometry: {
      dimensions_m: [0.5, 3, 0.5],
      pivot: 'bottom-center',
      axis: { up: '+Y', forward: '-Z' },
      polycount: 36,
      vertices: 24,
    },
    sockets: [
      { name: 'bottom', type: 'ground-foot', position_m: [0, 0, 0], direction: '-y', mate_types: ['stack-up', 'roof-seat'], grid_locked: true },
      { name: 'top', type: 'stack-up', position_m: [0, 3, 0], direction: '+y', mate_types: ['ground-foot'], grid_locked: true },
      { name: 'end-west', type: 'wall-line', position_m: [0, 0, 0], direction: '-x', mate_types: ['wall-line'], grid_locked: true },
      { name: 'end-east', type: 'wall-line', position_m: [0, 0, 0], direction: '+x', mate_types: ['wall-line'], grid_locked: true },
      { name: 'end-south', type: 'wall-line', position_m: [0, 0, 0], direction: '-z', mate_types: ['wall-line'], grid_locked: true },
      { name: 'end-north', type: 'wall-line', position_m: [0, 0, 0], direction: '+z', mate_types: ['wall-line'], grid_locked: true },
    ],
  });

  // 装饰钉 0.25×0.1×0.25：只有 attach
  put(KIT, 'components/ornament', 'stud-a', {
    geometry: {
      dimensions_m: [0.25, 0.1, 0.25],
      pivot: 'bottom-center',
      axis: { up: '+Y', forward: '-Z' },
      polycount: 12,
      vertices: 8,
    },
    sockets: [
      { name: 'mount', type: 'attach', position_m: [0, 0, 0], direction: '-y', mate_types: ['wall-line', 'stack-up', 'roof-seat'] },
    ],
  });

  // 悬空件（无 ground-foot）—— 用于承重链反例
  put(KIT, 'components/ornament', 'floater-a', {
    geometry: {
      dimensions_m: [0.25, 0.25, 0.25],
      pivot: 'bottom-center',
      axis: { up: '+Y', forward: '-Z' },
      polycount: 12,
      vertices: 8,
    },
    sockets: [{ name: 'seat', type: 'roof-seat', position_m: [0, 0, 0], direction: '+y', mate_types: ['roof-seat'] }],
  });
}

setupFixtures();

// ---------------------------------------------------------------------------
// 基准好清单：枢轴角墩 + 两向直墙 + 墙顶装饰钉
// ---------------------------------------------------------------------------

function goodManifest(over = {}) {
  const base = {
    schema_version: '2',
    id: `${KIT}.assembly.demo`,
    name: '夹具装配',
    kit: KIT,
    category: 'assemblies/building',
    granularity: 'L0',
    grid_snap_m: 0.5,
    instances: [
      {
        instance_id: 'pier-01',
        asset: { id: `${KIT}.wall.pier-a`, version: '^1.0.0' },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
      },
      {
        instance_id: 'wall-x-01',
        asset: { id: `${KIT}.wall.wall-a`, version: '^1.0.0' },
        transform: { position: [1, 0, 0], rotation: [0, 0, 0], scale: 1 },
        sockets: { 'end-west': 'pier-01::end-east' },
      },
      {
        instance_id: 'wall-z-01',
        asset: { id: `${KIT}.wall.wall-a`, version: '^1.0.0' },
        transform: { position: [0, 0, 1], rotation: [0, -Math.PI / 2, 0], scale: 1 },
        sockets: { 'end-west': 'pier-01::end-north' },
      },
      {
        instance_id: 'stud-01',
        asset: { id: `${KIT}.ornament.stud-a`, version: '^1.0.0' },
        transform: { position: [2, 0, 0], rotation: [0, 0, 0], scale: 1 },
        sockets: { mount: 'wall-x-01::end-east' },
      },
    ],
    scene_budget: { lod0: 100000, lod1: 30000, proxy: 5000 },
  };
  return JSON.parse(JSON.stringify(Object.assign(base, over)));
}

const run = (m) => gbe.checkAssemblyFull(m, { repoRoot: ROOT });

function mutate(fn) {
  const m = goodManifest();
  fn(m);
  return run(m);
}

// ---------------------------------------------------------------------------
console.log('\n[1] 正向：好清单一遍全绿');
// ---------------------------------------------------------------------------

ok('夹具清单 4 实例全绿，0 错误 0 警告', () => {
  const r = run(goodManifest());
  assert.ok(r.ok, `未通过：\n      ${r.errors.map((e) => e.message).join('\n      ')}`);
  eq(r.warnings.length, 0, '警告数');
  eq(r.stats.instances, 4, '实例数');
  eq(r.stats.distinct, 3, '独特构件数');
  eq(r.stats.socketsMated, 3, '对接数');
  eq(r.stats.polys, 36 * 2 + 36 + 12, '面数');
});

ok('枢轴角墩与直墙互嵌被识别为「收容式嵌入」而非穿插', () => {
  const r = run(goodManifest());
  assert.ok(r.stats.buriedOverlaps >= 1, `收容式嵌入数 = ${r.stats.buriedOverlaps}`);
});

ok('attach 单向挂接通过（不做 direction 反向要求）', () => {
  const r = run(goodManifest());
  eq(r.errors.length, 0, '错误数');
});

// ---------------------------------------------------------------------------
console.log('\n[2] 反向：① 引用存在且 published');
// ---------------------------------------------------------------------------

ok('引用不存在的 asset.id → 报错', () => {
  hasErr(mutate((m) => (m.instances[1].asset.id = 'tkit.wall.nope-a')), /库中不存在/, '①');
});

ok('版本范围无匹配 → 报错', () => {
  hasErr(mutate((m) => (m.instances[1].asset.version = '^9.0.0')), /无满足版本范围/, '①');
});

ok('kit 不存在 → 报错', () => {
  hasErr(mutate((m) => (m.kit = 'nokit')), /不存在/, '①');
});

// ---------------------------------------------------------------------------
console.log('\n[3] 反向：② 插槽两端存在 + mate_types 互认');
// ---------------------------------------------------------------------------

ok('本件插槽名写错 → 报错', () => {
  hasErr(mutate((m) => (m.instances[1].sockets['end-westtt'] = 'pier-01::end-east')), /无名为 "end-westtt" 的插槽/, '②');
});

ok('对端实例不存在 → 报错', () => {
  hasErr(mutate((m) => (m.instances[1].sockets['end-west'] = 'ghost-01::end-east')), /对端实例 "ghost-01" 不在本清单中/, '②');
});

ok('对端插槽名写错 → 报错', () => {
  hasErr(mutate((m) => (m.instances[1].sockets['end-west'] = 'pier-01::end-eastt')), /无名为 "end-eastt" 的插槽/, '②');
});

ok('映射不是 <instance_id>::<插槽> 形态 → 报错', () => {
  hasErr(mutate((m) => (m.instances[1].sockets['end-west'] = 'pier-01')), /不是/, '②');
});

ok('mate_types 不互认（wall-line ↔ stack-up）→ 报错', () => {
  hasErr(
    mutate((m) => {
      m.instances[1].sockets = { 'end-west': 'pier-01::top' };
      m.instances[1].transform.position = [0, -3, 0];
    }),
    /mate_types 不互认/,
    '②'
  );
});

ok('attach 的 mate_types 不含对端 type → 报错', () => {
  hasErr(
    mutate((m) => {
      m.instances[3].asset.id = 'tkit.ornament.floater-a';
      m.instances[3].sockets = { seat: 'wall-x-01::end-east' };
    }),
    /mate_types 不互认|attach/,
    '②'
  );
});

// ---------------------------------------------------------------------------
console.log('\n[4] 反向：③ direction 互为反向');
// ---------------------------------------------------------------------------

ok('两端同向（+x ↔ +x）→ 报错', () => {
  hasErr(
    mutate((m) => {
      m.instances[1].sockets = { 'end-east': 'pier-01::end-east' };
      m.instances[1].transform.position = [2, 0, 0];
    }),
    /direction 未互为反向/,
    '③'
  );
});

// ---------------------------------------------------------------------------
console.log('\n[5] 反向：④ position 重合 / ⑤ 网格对齐');
// ---------------------------------------------------------------------------

ok('对接面错开 0.25 m → 警告（不是报错）', () => {
  const r = mutate((m) => (m.instances[1].transform.position = [1.25, 0, 0]));
  assert.ok(r.ok, '应仍判定通过（该判据只警告）');
  hasWarn(r, /对接面未重合/, '④');
});

ok('grid_snap_m 与 kit.json 不一致 → 报错', () => {
  hasErr(mutate((m) => (m.grid_snap_m = 1)), /与 kit\.json\.grid\.snap_m/, '⑤');
});

ok('rotation 疑似角度制（-90 而非 -π/2）→ 警告', () => {
  hasWarn(mutate((m) => (m.instances[2].transform.rotation = [0, -90, 0])), /疑似按角度书写/, '⑤');
});

ok('instance_id 重复 → 报错', () => {
  hasErr(mutate((m) => (m.instances[1].instance_id = 'pier-01')), /重复/, '⑤');
});

// ---------------------------------------------------------------------------
console.log('\n[6] 反向：⑥ 无几何穿插');
// ---------------------------------------------------------------------------

ok('两件非对接件实打实交叠 → 警告', () => {
  const r = mutate((m) => {
    m.instances.push({
      instance_id: 'wall-x-02',
      asset: { id: `${KIT}.wall.wall-a`, version: '^1.0.0' },
      transform: { position: [1.4, 0, 0], rotation: [0, 0, 0], scale: 1 },
    });
  });
  hasWarn(r, /几何穿插/, '⑥');
});

// ---------------------------------------------------------------------------
console.log('\n[7] 反向：⑦ 承重链落地闭合');
// ---------------------------------------------------------------------------

ok('无 ground-foot 又没对接 → 报错（悬空）', () => {
  hasErr(
    mutate((m) => {
      m.instances.push({
        instance_id: 'float-01',
        asset: { id: `${KIT}.ornament.floater-a`, version: '^1.0.0' },
        transform: { position: [0, 6, 0], rotation: [0, 0, 0], scale: 1 },
      });
    }),
    /承重链未闭合/,
    '⑦'
  );
});

ok('孤立件只要有未对接的 ground-foot，就算坐在 terrain 上 → 通过', () => {
  // 这是契约的**有意解释**（见 CONVENTIONS §19.5 注）：判据要的是"可追溯至一个
  // ground-foot 承接面"，不是"y 必须等于 0"。清单是建筑片段，地形标高不在它管辖内——
  // 一件带未对接底面的构件，等价于"它所处的地面就在它脚下"。
  const r = mutate((m) => {
    m.instances = [
      {
        instance_id: 'wall-x-01',
        asset: { id: `${KIT}.wall.wall-a`, version: '^1.0.0' },
        transform: { position: [0, 6, 0], rotation: [0, 0, 0], scale: 1 },
      },
    ];
  });
  assert.ok(r.ok, `应通过：\n      ${r.errors.map((e) => e.message).join('\n      ')}`);
});

ok('承重链沿 +y/−y 逐级上溯（墙面 → 墙墩 → 角墩顶面）', () => {
  // 把墙抬到角墩顶上：墙面底面对接角墩顶面 → 墙面接地
  const r = mutate((m) => {
    m.instances = [
      {
        instance_id: 'pier-01',
        asset: { id: `${KIT}.wall.pier-a`, version: '^1.0.0' },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
      },
      {
        instance_id: 'wall-x-01',
        asset: { id: `${KIT}.wall.wall-a`, version: '^1.0.0' },
        transform: { position: [0, 3, 0], rotation: [0, 0, 0], scale: 1 },
        sockets: { bottom: 'pier-01::top' },
      },
    ];
  });
  assert.ok(r.ok, `应通过：\n      ${r.errors.map((e) => e.message).join('\n      ')}`);
});

// ---------------------------------------------------------------------------
console.log('\n[8] 反向：⑧ 场景预算 / strict');
// ---------------------------------------------------------------------------

ok('面数超 LOD0 预算 → 警告', () => {
  hasWarn(mutate((m) => (m.scene_budget = { lod0: 100 })), /超出场景预算/, '⑧');
});

ok('未声明 scene_budget → 提示跳过该判据', () => {
  hasWarn(mutate((m) => delete m.scene_budget), /未声明 scene_budget/, '⑧');
});

ok('strict 模式把警告升级为错误', () => {
  const m = goodManifest();
  m.instances[1].transform.position = [1.25, 0, 0];
  const r = gbe.checkAssemblyFull(m, { repoRoot: ROOT, strict: true });
  assert.ok(!r.ok, 'strict 下应判定失败');
  hasErr(r, /\[strict\].*对接面未重合/, 'strict');
});

// ---------------------------------------------------------------------------
console.log('\n[9] 语法闸门');
// ---------------------------------------------------------------------------

ok('schema_version 缺失 → 被版本闸门拒收', () => {
  const r = run(mutate((m) => delete m.schema_version));
  assert.ok(!r.ok, '应失败');
  hasErr(r, /缺少 schema_version/, '语法');
});

ok('instances 为空数组 → 被语法校验拒收', () => {
  const r = run(mutate((m) => (m.instances = [])));
  assert.ok(!r.ok, '应失败');
});

ok('category 不在枚举内 → 被语法校验拒收', () => {
  const r = run(mutate((m) => (m.category = 'buildings/palace')));
  assert.ok(!r.ok, '应失败');
});

// ---------------------------------------------------------------------------

try {
  fs.rmSync(ROOT, { recursive: true, force: true });
} catch (e) {
  /* 临时目录清理失败不影响结论 */
}

console.log(`\n装配校验冒烟：通过 ${passed} · 失败 ${failed}\n`);
process.exit(failed ? 1 : 0);
