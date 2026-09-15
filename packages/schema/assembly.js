'use strict';

/**
 * packages/schema/assembly.js —— 装配级校验（CONVENTIONS §19.4 / §19.5）
 *
 * 契约位置：`gbe assembly validate <id>`，与 `checkPackage` 同级——**门禁双跑**的装配版：
 * studio 投递清单前跑一次，assets 侧再跑一次（§10.2）。
 *
 * ── §19.5 八条判据（本文件逐条实现，失败处理照契约标注）────────────────────
 *   ① 引用的 asset.id + version 在库中存在且 published        → 报错
 *   ② 插槽映射两端存在 + mate_types 互认                       → 报错
 *   ③ 对接的 direction 互为反向                                → 报错
 *   ④ 对接后 position 重合（容差 1e-3 m）                      → 警告
 *   ⑤ 所有插槽 position_m 网格对齐（§19.2）                    → 打 socket-unverified
 *   ⑥ 装配后无几何穿插（AABB 相交）                            → 警告
 *   ⑦ 承重链落地闭合（可追溯至 ground-foot 承接面）            → 报错
 *   ⑧ 装配总面数在场景预算内                                   → 警告
 *
 * ── 四处契约未写明、由本实现显式定死的解释（均已回写 CONVENTIONS §19.5）──────
 *   · **rotation 单位 = 弧度**，XYZ 顺次旋转（与几何内核 rotXYZ、glTF/three 一致）。
 *     若某实例的三个分量恰为 90 / 180 / 270 的整数，本校验器会提示「疑似写了角度」——
 *     契约沉默处的歧义不靠猜，靠报警。
 *   · **mate_types 缺省 = 通配**（§9 把它标为可选字段，选而不填只能理解为不作限制）。
 *   · **attach 单向例外**：§9.1 明确 attach 是"单向挂接，不参与结构对齐"，故一端为
 *     attach 时只校验"挂接方的 mate_types 含对端 type"，且**跳过** direction 反向检查。
 *     否则 §19.5 的"互认"与 §9.1 的"单向"互相矛盾，装饰件永远挂不上去。
 *   · **榫接豁免**：已直接对接的对（mated pair）之间的嵌入，以及**完全被第三件
 *     AABB 包住**的嵌入，都属有意榫接或不可见，不计为穿插。可见的、非对接的
 *     交叠才报警——否则任何柱状节点件的榫卯都会被误报。
 */

const fs = require('fs');
const path = require('path');

const EPS_OVERLAP = 1e-3; // 体积意义上的相交阈值（m）
const EPS_COINCIDE = 1e-3; // §19.5 ④ 容差
const EPS_GRID = 1e-6;

// ---------------------------------------------------------------------------
// 极简 semver（只覆盖契约示例会出现的写法；不引依赖）
// ---------------------------------------------------------------------------

function parseVer(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v || ''));
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cmpVer(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/** 支持：* / x.y.z / ^x.y.z / ~x.y.z / >=x.y.z / >x.y.z / <= / < / = */
function satisfies(version, range) {
  const v = parseVer(version);
  if (!v) return false;
  const r = String(range === undefined || range === null || range === '' ? '*' : range).trim();
  if (r === '*' || r === 'latest') return true;

  const m = /^(\^|~|>=|<=|>|<|=)?\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(r);
  if (!m) return false;
  const op = m[1] || '^';
  const maj = Number(m[2]);
  const min = m[3] === undefined ? 0 : Number(m[3]);
  const pat = m[4] === undefined ? 0 : Number(m[4]);
  const base = [maj, min, pat];
  const partial = m[3] === undefined || m[4] === undefined;

  if (partial && (op === '^' || op === '=')) return v[0] === maj && (m[3] === undefined || v[1] === min);

  switch (op) {
    case '=':
      return cmpVer(v, base) === 0;
    case '>=':
      return cmpVer(v, base) >= 0;
    case '>':
      return cmpVer(v, base) > 0;
    case '<=':
      return cmpVer(v, base) <= 0;
    case '<':
      return cmpVer(v, base) < 0;
    case '~':
      return cmpVer(v, base) >= 0 && v[0] === base[0] && v[1] === base[1];
    case '^':
    default:
      // ^1.2.3 → 同 major 且 >= ；^0.2.3 → 同 minor（0.x 视为破坏性区间）
      if (base[0] === 0) return cmpVer(v, base) >= 0 && v[0] === 0 && v[1] === base[1];
      return cmpVer(v, base) >= 0 && v[0] === base[0];
  }
}

// ---------------------------------------------------------------------------
// 库解析：把 kits/ 扫成 id → 版本 → 目录
// ---------------------------------------------------------------------------

/**
 * @param {string} repoRoot gbe-assets 仓库根
 * @returns {{byId: Map<string, Array<{version:string, dir:string, asset:any}>>, problems: any[]}}
 */
function loadLibrary(repoRoot) {
  const byId = new Map();
  const problems = [];
  const kitsDir = path.join(repoRoot, 'kits');
  if (!fs.existsSync(kitsDir)) return { byId, problems };

  const walk = (dir) => {
    let ents;
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    const assetFile = path.join(dir, 'asset.json');
    if (ents.some((e) => e.isFile() && e.name === 'asset.json')) {
      try {
        const asset = JSON.parse(fs.readFileSync(assetFile, 'utf8'));
        if (!byId.has(asset.id)) byId.set(asset.id, []);
        byId.get(asset.id).push({ version: asset.version, dir, asset });
      } catch (e) {
        problems.push({ path: path.relative(repoRoot, assetFile), message: `解析失败：${e.message}` });
      }
      return;
    }
    for (const ent of ents) {
      if (!ent.isDirectory() || ent.name.startsWith('_')) continue;
      walk(path.join(dir, ent.name));
    }
  };
  walk(kitsDir);

  for (const list of byId.values()) {
    list.sort((a, b) => cmpVer(parseVer(b.version) || [0, 0, 0], parseVer(a.version) || [0, 0, 0]));
  }
  return { byId, problems };
}

/** 取满足版本范围的最高 published 版本（§19.4） */
function resolveAsset(lib, id, range) {
  const list = lib.byId.get(id);
  if (!list || list.length === 0) return { error: `库中不存在 asset.id = "${id}"` };
  const hit = list.filter((e) => e.asset.status === 'published' && satisfies(e.version, range));
  if (hit.length === 0) {
    const vers = list.map((e) => `${e.version}(${e.asset.status})`).join(', ');
    return { error: `"${id}" 无满足版本范围 "${range || '*'}" 的 published 版本（库中：${vers}）` };
  }
  return hit[0];
}

// ---------------------------------------------------------------------------
// 变换与几何
// ---------------------------------------------------------------------------

const DIR_VEC = {
  '+x': [1, 0, 0],
  '-x': [-1, 0, 0],
  '+y': [0, 1, 0],
  '-y': [0, -1, 0],
  '+z': [0, 0, 1],
  '-z': [0, 0, -1],
};

/** XYZ 顺次旋转，与 geom.js rotXYZ 同序（弧度） */
function rotXYZ(v, rot) {
  let [x, y, z] = v;
  const [rx, ry, rz] = rot;
  if (rx) {
    const c = Math.cos(rx);
    const s = Math.sin(rx);
    const ny = y * c - z * s;
    const nz = y * s + z * c;
    y = ny;
    z = nz;
  }
  if (ry) {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    const nx = x * c + z * s;
    const nz = -x * s + z * c;
    x = nx;
    z = nz;
  }
  if (rz) {
    const c = Math.cos(rz);
    const s = Math.sin(rz);
    const nx = x * c - y * s;
    const ny = x * s + y * c;
    x = nx;
    y = ny;
  }
  return [x, y, z];
}

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l < 1e-12 ? [0, 0, 0] : [v[0] / l, v[1] / l, v[2] / l];
}

function snapVec(v) {
  return v.map((c) => (Math.abs(c) < 1e-9 ? 0 : Math.abs(c - 1) < 1e-9 ? 1 : Math.abs(c + 1) < 1e-9 ? -1 : c));
}

function dirName(v) {
  const s = snapVec(v);
  for (const [k, d] of Object.entries(DIR_VEC)) {
    if (Math.abs(s[0] - d[0]) < 1e-6 && Math.abs(s[1] - d[1]) < 1e-6 && Math.abs(s[2] - d[2]) < 1e-6) return k;
  }
  return `[${s.map((c) => c.toFixed(3)).join(', ')}]`;
}

function xform(p, inst) {
  const { position, rotation, scale } = inst.tf;
  const r = rotXYZ(p, rotation);
  return [position[0] + r[0] * scale, position[1] + r[1] * scale, position[2] + r[2] * scale];
}

/** bottom-center 轴心 → 局部 AABB；随实例变换后取包围盒（保守） */
function worldAabb(dims, inst) {
  const [dx, dy, dz] = dims;
  const corners = [];
  for (const sx of [-dx / 2, dx / 2]) {
    for (const sy of [0, dy]) {
      for (const sz of [-dz / 2, dz / 2]) corners.push(xform([sx, sy, sz], inst));
    }
  }
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const c of corners) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], c[i]);
      hi[i] = Math.max(hi[i], c[i]);
    }
  }
  return { lo, hi };
}

function nearMultiple(v, step) {
  const q = v / step;
  return Math.abs(q - Math.round(q)) < EPS_GRID;
}

// ---------------------------------------------------------------------------
// 主校验
// ---------------------------------------------------------------------------

/**
 * @param {object} manifest 装配清单（assembly.v2）
 * @param {object} opts { repoRoot, lib, strict }
 * @returns {{ok:boolean, errors:any[], warnings:any[], stats:any, flags:string[]}}
 */
function checkAssembly(manifest, opts = {}) {
  const errors = [];
  const warnings = [];
  const flags = [];
  const repoRoot = opts.repoRoot;
  const lib = opts.lib || loadLibrary(repoRoot);
  const stats = { instances: 0, distinct: 0, polys: 0, socketsMated: 0, buriedOverlaps: 0 };

  // ── 前置：清单自身的语法由 validateAssembly 负责；这里只做语义 ─────────────
  if (!manifest || !Array.isArray(manifest.instances)) {
    errors.push({ path: '$.instances', message: 'instances 缺失或不是数组' });
    return { ok: false, errors, warnings, flags, stats };
  }

  // grid_snap_m 必须等于 kit.json.grid.snap_m（不在此处重新定义模数）
  let grid = null;
  const kitFile = path.join(repoRoot, 'kits', manifest.kit, 'kit.json');
  if (!fs.existsSync(kitFile)) {
    errors.push({ path: '$.kit', message: `kit "${manifest.kit}" 不存在（真源 ${path.relative(repoRoot, kitFile)}）` });
  } else {
    grid = JSON.parse(fs.readFileSync(kitFile, 'utf8')).grid || null;
    if (grid && manifest.grid_snap_m !== undefined && manifest.grid_snap_m !== grid.snap_m) {
      errors.push({
        path: '$.grid_snap_m',
        message: `grid_snap_m = ${manifest.grid_snap_m} 与 kit.json.grid.snap_m = ${grid.snap_m} 不一致（模数只有一份真源）`,
      });
    }
  }
  const snap = grid ? grid.snap_m : manifest.grid_snap_m;

  // ── ① 解析实例 ────────────────────────────────────────────────────────────
  const insts = [];
  const seenIds = new Set();
  manifest.instances.forEach((raw, i) => {
    const at = `$.instances[${i}]`;
    const id = raw.instance_id;
    if (seenIds.has(id)) {
      errors.push({ path: `${at}.instance_id`, message: `instance_id "${id}" 重复（清单内必须唯一）` });
    }
    seenIds.add(id);

    const tf = raw.transform || {};
    const inst = {
      raw,
      i,
      id,
      assetId: raw.asset && raw.asset.id,
      range: raw.asset && raw.asset.version,
      count: raw.count || 1,
      tf: {
        position: tf.position || [0, 0, 0],
        rotation: tf.rotation || [0, 0, 0],
        scale: tf.scale || 1,
      },
      sockets: raw.sockets || {},
      mated: new Map(), // 本件插槽名 → {to, toSocket}（对端）
    };

    // 疑似角度制
    const suspicious = inst.tf.rotation.some(
      (r) => Math.abs(Math.abs(r) - 90) < 1e-6 || Math.abs(Math.abs(r) - 180) < 1e-6 || Math.abs(Math.abs(r) - 270) < 1e-6
    );
    if (suspicious) {
      warnings.push({
        path: `${at}.transform.rotation`,
        message: `rotation = [${inst.tf.rotation.join(', ')}] 恰为 90/180/270 —— 契约单位为**弧度**，此值疑似按角度书写`,
      });
    }

    const hit = resolveAsset(lib, inst.assetId, inst.range);
    if (hit.error) {
      errors.push({ path: `${at}.asset`, message: hit.error });
      insts.push(inst);
      return;
    }
    inst.asset = hit.asset;
    inst.dir = hit.dir;
    inst.resolvedVersion = hit.version;
    insts.push(inst);
  });
  stats.instances = insts.length;
  stats.distinct = new Set(insts.map((i) => i.assetId)).size;
  stats.polys = insts.reduce((s, i) => s + (i.asset ? i.asset.geometry.polycount * i.count : 0), 0);

  const byInstance = new Map(insts.map((i) => [i.id, i]));
  const hasAsset = (i) => !!i.asset;

  // ── ② 插槽映射：两端存在 + 互认 + direction 反向 ─────────────────────────
  const pairs = []; // {a, aSock, b, bSock}
  for (const inst of insts) {
    if (!hasAsset(inst)) continue;
    const sockMap = new Map((inst.asset.sockets || []).map((s) => [s.name, s]));
    for (const [fromName, target] of Object.entries(inst.sockets)) {
      const at = `$.instances[${inst.i}].sockets.${fromName}`;
      const aSock = sockMap.get(fromName);
      if (!aSock) {
        errors.push({ path: at, message: `本件（${inst.assetId}）无名为 "${fromName}" 的插槽` });
        continue;
      }
      const m = /^(.+)::(.+)$/.exec(String(target));
      if (!m) {
        errors.push({ path: at, message: `"${target}" 不是 "<instance_id>::<插槽名>" 形态` });
        continue;
      }
      const b = byInstance.get(m[1]);
      if (!b) {
        errors.push({ path: at, message: `对端实例 "${m[1]}" 不在本清单中` });
        continue;
      }
      if (!hasAsset(b)) continue; // 对端资产未解析，已单独报错
      const bSock = (b.asset.sockets || []).find((s) => s.name === m[2]);
      if (!bSock) {
        errors.push({ path: at, message: `对端实例 "${m[1]}"（${b.assetId}）无名为 "${m[2]}" 的插槽` });
        continue;
      }
      if (inst.mated.has(fromName)) {
        warnings.push({ path: at, message: `本件插槽 "${fromName}" 被映射了多次，仅取首个` });
        continue;
      }
      inst.mated.set(fromName, { to: b, toSocket: m[2] });
      pairs.push({ a: inst, aSock, b, bSock, path: at });
      stats.socketsMated++;
    }
  }

  const dirVec = (s) => (DIR_VEC[s.direction] ? DIR_VEC[s.direction].slice() : null);

  for (const p of pairs) {
    const { a, aSock, b, bSock, path } = p;
    const attachPair = aSock.type === 'attach' || bSock.type === 'attach';

    // 互认（attach 单向例外）
    if (attachPair) {
      const att = aSock.type === 'attach' ? aSock : bSock;
      const other = aSock.type === 'attach' ? bSock : aSock;
      const list = Array.isArray(att.mate_types) && att.mate_types.length ? att.mate_types : null;
      if (list && !list.includes(other.type)) {
        errors.push({
          path,
          message: `attach 插槽 "${att.name}" 的 mate_types 不含对端 type "${other.type}"（§9.1 单向挂接：挂接方负责声明可挂面）`,
        });
      }
    } else {
      const na = Array.isArray(aSock.mate_types) && aSock.mate_types.length ? aSock.mate_types : null;
      const nb = Array.isArray(bSock.mate_types) && bSock.mate_types.length ? bSock.mate_types : null;
      if (na && !na.includes(bSock.type)) {
        errors.push({
          path,
          message: `mate_types 不互认：本件插槽 "${aSock.name}"(type=${aSock.type}) 的 mate_types 不含对端 type "${bSock.type}"`,
        });
      }
      if (nb && !nb.includes(aSock.type)) {
        errors.push({
          path,
          message: `mate_types 不互认：对端 "${b.id}" 插槽 "${bSock.name}"(type=${bSock.type}) 的 mate_types 不含本端 type "${aSock.type}"`,
        });
      }
    }

    // direction 互为反向（attach 跳过）
    const da = dirVec(aSock);
    const db = dirVec(bSock);
    if (!attachPair && da && db) {
      const wa = snapVec(rotXYZ(da, a.tf.rotation));
      const wb = snapVec(rotXYZ(db, b.tf.rotation));
      if (Math.abs(wa[0] + wb[0]) > 1e-6 || Math.abs(wa[1] + wb[1]) > 1e-6 || Math.abs(wa[2] + wb[2]) > 1e-6) {
        errors.push({
          path,
          message: `direction 未互为反向：本端世界向 ${dirName(wa)}，对端世界向 ${dirName(wb)}（${a.id}::${aSock.name} ↔ ${b.id}::${bSock.name}）`,
        });
      }
    }

    // position 重合
    const pa = aSock.position_m || [0, 0, 0];
    const pb = bSock.position_m || [0, 0, 0];
    const wa = xform(pa, a);
    const wb = xform(pb, b);
    const d = Math.hypot(wa[0] - wb[0], wa[1] - wb[1], wa[2] - wb[2]);
    if (d > EPS_COINCIDE) {
      warnings.push({
        path,
        message: `对接面未重合：${a.id}::${aSock.name} 世界坐标 [${wa.map((c) => c.toFixed(4)).join(', ')}] vs ${b.id}::${bSock.name} [${wb
          .map((c) => c.toFixed(4))
          .join(', ')}]，相距 ${d.toFixed(4)} m（容差 ${EPS_COINCIDE}）`,
      });
    }
  }

  // ── ⑤ 插槽网格对齐（socket-unverified）───────────────────────────────────
  if (snap) {
    for (const inst of insts) {
      if (!hasAsset(inst)) continue;
      if (inst.asset.grid_exempt === true) continue;
      (inst.asset.sockets || []).forEach((s, si) => {
        if (s.type === 'attach') return;
        (s.position_m || []).forEach((v, axis) => {
          if (typeof v === 'number' && !nearMultiple(v, snap)) {
            const key = `${inst.id}::${s.name}[${'xyz'[axis]}]`;
            const msg = `插槽 ${key} = ${v} 未落定位网格 ${snap}m（§19.2）`;
            flags.push('socket-unverified');
            warnings.push({ path: `$.instances[${inst.i}].asset.sockets[${si}]`, message: `socket-unverified：${msg}` });
          }
        });
      });
    }
  }

  // ── ⑥ 几何穿插（对接豁免 + 体内收容豁免）─────────────────────────────────
  const matedPair = (i, j) =>
    [...i.mated.values()].some((m) => m.to === j) || [...j.mated.values()].some((m) => m.to === i);

  const boxes = insts.map((i) => (hasAsset(i) ? worldAabb(i.asset.geometry.dimensions_m, i) : null));
  const contains = (outer, inner) => {
    for (let k = 0; k < 3; k++) {
      if (inner.lo[k] < outer.lo[k] - 1e-6 || inner.hi[k] > outer.hi[k] + 1e-6) return false;
    }
    return true;
  };

  for (let i = 0; i < insts.length; i++) {
    for (let j = i + 1; j < insts.length; j++) {
      if (!boxes[i] || !boxes[j]) continue;
      if (matedPair(insts[i], insts[j])) continue;
      const ov = { lo: [], hi: [] };
      let hit = true;
      for (let k = 0; k < 3; k++) {
        ov.lo[k] = Math.max(boxes[i].lo[k], boxes[j].lo[k]);
        ov.hi[k] = Math.min(boxes[i].hi[k], boxes[j].hi[k]);
        if (ov.hi[k] - ov.lo[k] <= EPS_OVERLAP) hit = false;
      }
      if (!hit) continue;
      const buried = boxes.some((b, k) => b && k !== i && k !== j && contains(b, ov));
      if (buried) {
        stats.buriedOverlaps++;
        continue;
      }
      warnings.push({
        path: `$.instances[${i}]`,
        message:
          `几何穿插：${insts[i].id} 与 ${insts[j].id} 重叠 ` +
          `[${ov.hi.map((v, k) => (v - ov.lo[k]).toFixed(3)).join(' × ')}] m（非对接件、且未被任何节点件包住）`,
      });
    }
  }

  // ── ⑦ 承重链落地闭合 ─────────────────────────────────────────────────────
  // 种子：bottom 为 ground-foot(-y) 且**未对接**者 —— 直接坐在 terrain 上。
  // 传播（迭代到不动点，对"对接对"而非"出向映射"做，因为映射只单侧声明）：
  //   · 规则 1（竖向承托）：A 的插槽世界向 +y 且与 B 的 −y 插槽对接 ⇒ A 托 B。
  //   · 规则 2（宿主承接）：**本件没有任何 ground-foot 插槽**时，按定义它不可能自立
  //     （檩、瓦、装饰钉都属此类），其落地由宿主提供 ⇒ 宿主接地则它接地。
  //     少了这条，任何"挂"在别处的构件都会被误判成悬空。
  const hasFoot = (inst) => (inst.asset.sockets || []).some((s) => s.type === 'ground-foot');
  const worldDir = (inst, sock) => snapVec(rotXYZ(DIR_VEC[sock.direction] || [0, 0, 0], inst.tf.rotation));
  const isUp = (v) => Math.abs(v[1] - 1) < 1e-6;
  const isDown = (v) => Math.abs(v[1] + 1) < 1e-6;

  const grounded = new Set();
  for (const inst of insts) {
    if (!hasAsset(inst)) continue;
    const feet = (inst.asset.sockets || []).filter((s) => s.type === 'ground-foot' && s.direction === '-y');
    if (feet.some((s) => !inst.mated.has(s.name))) grounded.add(inst.id);
  }

  for (let pass = 0; pass < insts.length + 1; pass++) {
    let grew = false;
    for (const p of pairs) {
      const { a, aSock, b, bSock } = p;
      if (a.id === b.id) continue;
      const wa = worldDir(a, aSock);
      const wb = worldDir(b, bSock);
      const link = (from, to) => {
        if (!grounded.has(from.id) || grounded.has(to.id)) return false;
        grounded.add(to.id);
        return true;
      };
      // 规则 1
      if (isUp(wa) && isDown(wb) && link(a, b)) grew = true;
      if (isUp(wb) && isDown(wa) && link(b, a)) grew = true;
      // 规则 2
      if (!hasFoot(b) && link(a, b)) grew = true;
      if (!hasFoot(a) && link(b, a)) grew = true;
    }
    if (!grew) break;
  }

  for (const inst of insts) {
    if (!hasAsset(inst)) continue;
    if (!grounded.has(inst.id)) {
      errors.push({
        path: `$.instances[${inst.i}]`,
        message: `承重链未闭合：${inst.id}（${inst.assetId}）无法追溯至任何 ground-foot 承接面——它悬在空中`,
      });
    }
  }

  // ── ⑧ 场景预算 ───────────────────────────────────────────────────────────
  const budget = manifest.scene_budget && manifest.scene_budget.lod0;
  if (typeof budget === 'number' && stats.polys > budget) {
    warnings.push({
      path: '$.scene_budget.lod0',
      message: `装配总面数 ${stats.polys} 超出场景预算 ${budget}（LOD0）`,
    });
  } else if (budget === undefined) {
    warnings.push({ path: '$.scene_budget', message: '未声明 scene_budget，跳过面数预算判据（§19.5 ⑧）' });
  }

  // ── 附加：一份清单里应记录解析到的确切版本（可追溯）────────────────────────
  stats.resolved = insts.filter(hasAsset).map((i) => ({ instance: i.id, id: i.assetId, version: i.resolvedVersion }));

  if (opts.strict) {
    for (const w of warnings) errors.push({ ...w, message: `[strict] ${w.message}` });
    warnings.length = 0;
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    flags: [...new Set(flags)],
    stats,
    libProblems: lib.problems || [],
  };
}

module.exports = {
  checkAssembly,
  loadLibrary,
  resolveAsset,
  parseVer,
  cmpVer,
  satisfies,
  rotXYZ,
  DIR_VEC,
  EPS_COINCIDE,
  EPS_OVERLAP,
};
