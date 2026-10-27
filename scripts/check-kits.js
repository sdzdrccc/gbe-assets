#!/usr/bin/env node
'use strict';

/**
 * check-kits.js —— **已入库资产**（`kits/**`）逐件校验（2026-10-27 · X-0064 N-2）。
 *
 * 为什么要有它：`npm test` 只校验 schema 自身、`intake` 只校验**投递包**；
 * 入库后的 40 件资产**不在任何门禁扫描范围** —— 入库之后改坏（手改资产 / 误删文件 / 版本漂移）
 * 没有任何东西会红。本脚本把「已入库」也纳入同一套 `checkPackage` 判据（`inKits` 模式）。
 *
 * 判据：每件资产目录跑 `checkPackage(dir, {inKits:true})`
 *   —— 语法 / schema_version / 预算 / 网格 / 插槽 / preview 512 / files 存在性 / **目录名 = id 第三段**。
 * ★ 与 `intake` 的区别只有一个：目录名按 kits 规则（不带 `@version`），其余判据完全同一份实现。
 * ★ 另加 **coverage 矩阵判定**（2026-10-27 · X-0064 存量）：键必须 = `kit.categories`、`done` 必须 = 磁盘实况、
 *   `components/*` 必须有 `planned`、资产不得落在未声明类目（详见 CONVENTIONS §3.4）。
 * ★ 软警走 **存量豁免表** `WAIVED`：仅接受「按设计如此」的个例（须写理由与日期）；
 *   警消失后豁免条目自动变错误 —— 豁免不许烂在表里。
 *
 * 用法：
 *   node scripts/check-kits.js             # 常规（warnings 只报不失败）
 *   node scripts/check-kits.js --strict    # warnings 也失败
 *   node scripts/check-kits.js --quiet
 *   node scripts/check-kits.js --self-test
 *
 * 退出码：0 通过 / 1 失败
 */

const fs = require('fs');
const path = require('path');
const gbe = require('../packages/schema');
const { countKitCoverage } = require('../tools/intake');

const ROOT = path.resolve(__dirname, '..');
const KITS = path.join(ROOT, 'kits');
const STRICT = process.argv.includes('--strict');
const QUIET = process.argv.includes('--quiet');

/**
 * 存量豁免（软警）—— 只接受「按设计如此」的个例，不接受「以后再说」。
 * 每条必须写理由与日期；警消失后条目会变成错误（豁免不许烂在表里）。
 */
const WAIVED = [
  {
    match: 'kits/cn-ancient/components/roof/gable-board-a  .geometry.dimensions_m[2]',
    reason: '博风板厚 0.1m：薄板按实物厚度建模，归整到造型网格 0.125m 会与 GLB 不符；软约束本就允许细部构件',
    since: '2026-10-27',
  },
];

/** 纯函数：递归收集 `kits` 下所有 `asset.json` 所在目录（跳过隐藏目录与 `_` 开头）。 */
function listAssetDirs(root = KITS) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ent.name.startsWith('.')) continue;
      if (ent.isDirectory() && ent.name.startsWith('_')) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name === 'asset.json') out.push(dir);
    }
  })(root);
  return out;
}

/** 纯函数：汇总结果（便于自测）。 */
function summarize(results) {
  const errors = [];
  const warnings = [];
  for (const r of results) {
    for (const e of r.res.errors || []) errors.push(`${r.rel}  ${e.path}  ${e.message}`);
    for (const w of r.res.warnings || []) warnings.push(`${r.rel}  ${w.path}  ${w.message}`);
  }
  return { errors, warnings, assets: results.length };
}

/** 纯函数：coverage 派生快照的形状与算术（键 = kit.categories、done = 磁盘实况）。
 *  治的是「声明了类目却没被统计」——6 个 buildings/* 曾长期没有 coverage 键。 */
function checkCoverageShape(kit, counts) {
  const errors = [];
  const infos = [];
  const declared = Array.isArray(kit.categories) ? kit.categories : [];
  const coverage = kit.coverage && typeof kit.coverage === 'object' ? kit.coverage : {};
  const declaredSet = new Set(declared);

  for (const cat of counts.keys()) {
    if (!declaredSet.has(cat)) errors.push(`资产落在未声明的类目 "${cat}"（先加进 kit.categories，再入库）`);
  }
  for (const cat of Object.keys(coverage)) {
    if (cat.startsWith('$')) continue;
    if (!declaredSet.has(cat)) errors.push(`coverage 键 "${cat}" 不在 kit.categories 里（删掉它，或先声明类目）`);
  }
  for (const cat of declared) {
    const entry = coverage[cat];
    if (!entry || typeof entry !== 'object') {
      errors.push(`coverage 缺 "${cat}"（键必须与 kit.categories 一一对应；跑 node tools/intake.js --reindex 重建）`);
      continue;
    }
    const done = counts.get(cat) || 0;
    if (entry.done !== done) {
      errors.push(
        `coverage["${cat}"].done = ${entry.done}，磁盘实为 ${done}（能算的数别手抄；跑 node tools/intake.js --reindex）`
      );
    }
    if (cat.startsWith('components/') && typeof entry.planned !== 'number') {
      errors.push(`coverage["${cat}"] 是构件类目，必须有 planned 数字（§9.2 生产计划）`);
    }
    if (done === 0 && !entry.planned) infos.push(`"${cat}" 已声明、尚无资产、无计划（词汇保留，不参与生产排期）`);
  }
  return { errors, infos };
}

/** 纯函数：软警按豁免表分流；警消失的豁免条目变成错误（不许烂在表里）。 */
function applyWaivers(warnings, waivers = WAIVED) {
  const active = [];
  const waived = [];
  const hit = new Set();
  for (const w of warnings) {
    const item = waivers.find((x) => w.startsWith(x.match));
    if (item) {
      waived.push(w);
      hit.add(item.match);
    } else active.push(w);
  }
  const stale = waivers
    .filter((x) => !hit.has(x.match))
    .map((x) => `豁免已失效：${x.match}（${x.reason}）—— 该警告已不出现，删掉这条豁免`);
  return { active, waived, stale };
}

function listKitIds() {
  if (!fs.existsSync(KITS)) return [];
  return fs
    .readdirSync(KITS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(KITS, e.name, 'kit.json')))
    .map((e) => e.name)
    .sort();
}

function selfTest() {
  const cases = [];
  const eq = (name, got, want) => cases.push([name, JSON.stringify(got) === JSON.stringify(want), `得 ${JSON.stringify(got)} / 期 ${JSON.stringify(want)}`]);
  const fake = [
    { rel: 'a', res: { errors: [], warnings: [] } },
    { rel: 'b', res: { errors: [{ path: '$', message: 'x' }], warnings: [{ path: '$', message: 'w' }] } },
  ];
  const s = summarize(fake);
  eq('汇总 · 资产数', s.assets, 2);
  eq('汇总 · 错误 1 条', s.errors.length, 1);
  eq('汇总 · 警告 1 条', s.warnings.length, 1);
  eq('扫描 · 真库至少 1 件资产（防范围写错）', listAssetDirs().length > 0, true);

  // coverage 形状与算术
  const clean = { categories: ['components/roof', 'buildings/palace'], coverage: { 'components/roof': { done: 1, planned: 3 }, 'buildings/palace': { done: 0, planned: 0 } } };
  const noErr = (r) => r.errors.length === 0;
  eq('coverage · 键齐 done 对 → 无错', noErr(checkCoverageShape(clean, new Map([['components/roof', 1]]))), true);
  eq('coverage · 空类目给提示', checkCoverageShape(clean, new Map()).infos.length, 1);
  const miss = { categories: ['components/roof', 'buildings/palace'], coverage: { 'components/roof': { done: 1, planned: 3 } } };
  eq('coverage · 缺键 → 报错', checkCoverageShape(miss, new Map([['components/roof', 1]])).errors.length, 1);
  eq('coverage · done 与磁盘不符 → 报错', checkCoverageShape(clean, new Map([['components/roof', 2]])).errors.length, 1);
  const extra = { categories: ['components/roof'], coverage: { 'components/roof': { done: 1, planned: 3 }, 'props/x': { done: 0, planned: 0 } } };
  eq('coverage · 键不在 categories → 报错', checkCoverageShape(extra, new Map([['components/roof', 1]])).errors.length, 1);
  eq('coverage · 资产落在未声明类目 → 报错', checkCoverageShape(clean, new Map([['components/roof', 1], ['props/x', 1]])).errors.length, 1);
  const noPlan = { categories: ['components/roof'], coverage: { 'components/roof': { done: 0 } } };
  eq('coverage · 构件类目缺 planned → 报错', checkCoverageShape(noPlan, new Map()).errors.length, 1);

  // 豁免表：命中 / 不命中 / 失效
  const w = ['a  b  warn-x', 'c  d  warn-y'];
  const wa = [{ match: 'a  b', reason: 'r', since: 'd' }];
  const applied = applyWaivers(w, wa);
  eq('豁免 · 命中 1 条', applied.waived.length, 1);
  eq('豁免 · 剩余活跃 1 条', applied.active.length, 1);
  eq('豁免 · 无失效条目', applied.stale.length, 0);
  eq('豁免 · 警消失 → 失效报错', applyWaivers(['c  d  warn-y'], wa).stale.length, 1);

  let bad = 0;
  console.log('[check-kits] 反向测试（--self-test）');
  for (const [name, ok, detail] of cases) {
    console.log(`  ${ok ? '✔' : '✘'} ${name.padEnd(34)} ${detail}`);
    if (!ok) bad++;
  }
  console.log(`  结果：${bad ? '不通过（' + bad + '）' : '通过（' + cases.length + ' / ' + cases.length + '）'}`);
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--self-test')) selfTest();

const dirs = listAssetDirs();
if (dirs.length === 0) {
  console.error('[check-kits] kits/ 下没有任何 asset.json —— 扫描范围写错了（禁止空集真空通过）');
  process.exit(1);
}

const results = dirs.map((dir) => ({
  dir,
  rel: path.relative(ROOT, dir).replace(/\\/g, '/'),
  res: gbe.checkPackage(dir, { inKits: true }),
}));
const summary = summarize(results);
const { assets } = summary;
const covErrors = [];
const covInfos = [];
for (const kitId of listKitIds()) {
  const kit = JSON.parse(fs.readFileSync(path.join(KITS, kitId, 'kit.json'), 'utf8'));
  const r = checkCoverageShape(kit, countKitCoverage(kitId));
  r.errors.forEach((e) => covErrors.push(`kits/${kitId}/kit.json  ${e}`));
  r.infos.forEach((i) => covInfos.push(`kits/${kitId}/kit.json  ${i}`));
}
const { active: warnings, waived, stale } = applyWaivers(summary.warnings);
const errors = summary.errors.concat(covErrors, stale);

if (!QUIET) {
  console.log(`[check-kits] 已入库资产逐件校验（${assets} 件）`);
  console.log('─'.repeat(64));
  for (const r of results) {
    const ne = (r.res.errors || []).length;
    const nw = (r.res.warnings || []).length;
    const mark = ne ? '✗' : nw ? '!' : '✓';
    console.log(`  ${mark} ${r.rel}${ne || nw ? `   错 ${ne} / 警 ${nw}` : ''}`);
  }
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  warnings.forEach((w) => console.log(`  ! ${w}`));
  waived.forEach((w) => console.log(`  ~ ${w}   [存量豁免]`));
  covInfos.forEach((i) => console.log(`  · ${i}`));
  console.log('─'.repeat(64));
}
if (!errors.length && (!STRICT || !warnings.length)) {
  const tail = waived.length ? ` · 豁免 ${waived.length}` : '';
  console.log(
    `  结果：通过（${assets} 件资产 · 错误 0 / 警告 ${warnings.length}${tail}${STRICT ? ' · strict' : ''}）`
  );
  process.exit(0);
}
console.log(`  结果：不通过（${assets} 件资产 · 错误 ${errors.length} / 警告 ${warnings.length}${STRICT ? ' · strict' : ''}）`);
process.exit(1);
