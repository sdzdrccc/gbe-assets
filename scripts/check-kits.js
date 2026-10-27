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

const ROOT = path.resolve(__dirname, '..');
const KITS = path.join(ROOT, 'kits');
const STRICT = process.argv.includes('--strict');
const QUIET = process.argv.includes('--quiet');

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
const { errors, warnings, assets } = summarize(results);

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
  console.log('─'.repeat(64));
}
if (!errors.length && (!STRICT || !warnings.length)) {
  console.log(`  结果：通过（${assets} 件资产 · 错误 0 / 警告 ${warnings.length}${STRICT ? ' · strict' : ''}）`);
  process.exit(0);
}
console.log(`  结果：不通过（${assets} 件资产 · 错误 ${errors.length} / 警告 ${warnings.length}${STRICT ? ' · strict' : ''}）`);
process.exit(1);
