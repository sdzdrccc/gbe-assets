#!/usr/bin/env node
'use strict';

/**
 * check-assemblies.js —— **已入库装配清单**逐份校验（2026-10-27 · X-0064 B-6）。
 *
 * 为什么要有它：CI 原来的装配步是「有清单才校验；一份都没有 → 打印跳过、exit 0」——
 * **跳过长得像通过**。本脚本把「零份清单」直接判失败，并且用同一份 `checkAssemblyFull` 校验。
 *
 * 用法：
 *   node scripts/check-assemblies.js            # 常规
 *   node scripts/check-assemblies.js --strict   # warnings 也失败
 *   node scripts/check-assemblies.js --quiet
 *   node scripts/check-assemblies.js --self-test
 *
 * 退出码：0 通过 / 1 失败
 */

const fs = require('fs');
const path = require('path');
const gbe = require('../packages/schema');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assemblies');
const STRICT = process.argv.includes('--strict');
const QUIET = process.argv.includes('--quiet');

/** 纯函数：递归收集 assemblies 下的 `.json`。 */
function listAssemblyFiles(root = DIR) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ent.name.startsWith('.')) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith('.json')) out.push(full);
    }
  })(root);
  return out;
}

/** 纯函数：零份清单即失败（不再 exit 0 跳过）。 */
function verdict(count, errors, warnings, strict) {
  if (count === 0) return { ok: false, reason: 'assemblies/ 下没有任何清单 —— 门禁空转（NOT a pass）' };
  if (errors.length) return { ok: false, reason: `装配校验报错 ${errors.length} 条` };
  if (strict && warnings.length) return { ok: false, reason: `strict：警告 ${warnings.length} 条` };
  return { ok: true, reason: `通过（${count} 份 · 警告 ${warnings.length}）` };
}

function selfTest() {
  const cases = [];
  const eq = (name, got, want) => cases.push([name, got === want, `得 ${JSON.stringify(got)} / 期 ${JSON.stringify(want)}`]);
  eq('零份 → 失败', verdict(0, [], [], false).ok, false);
  eq('有错 → 失败', verdict(3, ['x'], [], false).ok, false);
  eq('普通模式 warnings 不失败', verdict(3, [], ['w'], false).ok, true);
  eq('strict warnings 失败', verdict(3, [], ['w'], true).ok, false);
  eq('正常 → 通过', verdict(3, [], [], false).ok, true);
  eq('真库至少 1 份（防范围写错）', listAssemblyFiles().length > 0, true);
  let bad = 0;
  console.log('[check-assemblies] 反向测试（--self-test）');
  for (const [name, ok, detail] of cases) {
    console.log(`  ${ok ? '✔' : '✘'} ${name.padEnd(32)} ${detail}`);
    if (!ok) bad++;
  }
  console.log(`  结果：${bad ? '不通过（' + bad + '）' : '通过（' + cases.length + ' / ' + cases.length + '）'}`);
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--self-test')) selfTest();

const files = listAssemblyFiles();
const errors = [];
const warnings = [];
const rows = [];
for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const r = gbe.checkAssemblyFull(f);
  (r.errors || []).forEach((e) => errors.push(`${rel}  ${e.path}  ${e.message}`));
  (r.warnings || []).forEach((w) => warnings.push(`${rel}  ${w.path}  ${w.message}`));
  rows.push({ rel, ok: r.ok, ne: (r.errors || []).length, nw: (r.warnings || []).length });
}

if (!QUIET) {
  console.log(`[check-assemblies] 已入库装配清单逐份校验（${files.length} 份）`);
  console.log('─'.repeat(64));
  rows.forEach((r) => console.log(`  ${r.ne ? '✗' : r.nw ? '!' : '✓'} ${r.rel}${r.ne || r.nw ? `   错 ${r.ne} / 警 ${r.nw}` : ''}`));
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  warnings.forEach((w) => console.log(`  ! ${w}`));
  console.log('─'.repeat(64));
}

const v = verdict(files.length, errors, warnings, STRICT);
console.log(`  结果：${v.reason}`);
process.exit(v.ok ? 0 : 1);
