#!/usr/bin/env node
'use strict';

/**
 * check-doc-enums.js —— `CONVENTIONS.md §4` 的分类镜像 ↔ schema 真源（`X-0053` A-2）
 *
 * 为什么需要它：§4 自己写着「下面这份全集是人类可读镜像，CI 校验与 schema enum 一致」——
 *   ★ 而**当时既没有 CI，也没有任何脚本读它**（`grep categories` 在三个脚本 0 命中）。
 *   实测：镜像 28 类（含 `assemblies/*`）· `asset.v2` enum 26 类（不含）· `kit.json` 用 28 类里的值。
 *   ⇒ 描述宣称的约束没有执法 = 假绿。
 *
 * 判据：把 §4 代码块里 `dir/{a,b,c}` 展开，与 **asset.v2 ∪ assembly.v2** 的并集逐项比对。
 *   ★ 之所以是并集：§4 同时列了资产分类与装配分类；两者真源不同（`asset.v2` / `assembly.v2`）。
 *
 * 用法：node scripts/check-doc-enums.js
 * 退出码：0 = 一致 / 1 = 不一致
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONV = path.join(ROOT, 'docs', 'CONVENTIONS.md');

/** 纯函数：展开 `components/{roof,wall}` → ['components/roof','components/wall'] */
function expandCategories(block) {
  const out = [];
  for (const raw of String(block).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !line.includes('/')) continue;
    const m = line.match(/^([a-z-]+)\/\{([^}]+)\}$/);
    if (m) {
      for (const leaf of m[2].split(',')) {
        const v = leaf.trim();
        if (v) out.push(`${m[1]}/${v}`);
      }
    } else if (/^[a-z-]+\/[a-z-]+$/.test(line)) {
      out.push(line);
    }
  }
  return out;
}

/** 纯函数：取 CONVENTIONS §4 下的第一个 ``` 代码块 */
function extractSection4Block(text) {
  const lines = String(text).split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s*4\.\s*分类枚举/.test(l));
  if (start < 0) return null;
  let inFence = false;
  const buf = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^##\s/.test(l) && !inFence) break;      // 下一个一级节 → 结束
    if (/^\s*```/.test(l)) {
      if (!inFence) { inFence = true; continue; }
      break;                                     // 代码块结束
    }
    if (inFence) buf.push(l);
  }
  return buf.length ? buf.join('\n') : null;
}

function main() {
  if (!fs.existsSync(CONV)) {
    console.error('✗ 读不到 docs/CONVENTIONS.md');
    return 1;
  }
  const block = extractSection4Block(fs.readFileSync(CONV, 'utf8'));
  if (!block) {
    console.error('✗ §4 分类枚举下找不到代码块 —— 判据失效（禁止空集通过）');
    return 1;
  }
  const docCats = new Set(expandCategories(block));
  if (docCats.size === 0) {
    console.error('✗ 代码块里展不出任何分类 —— 判据失效');
    return 1;
  }

  const schema = require(path.join(ROOT, 'packages', 'schema'));
  const asset = new Set(schema.loadSchema('asset').properties.category.enum || []);
  const asm = new Set(schema.loadSchema('assembly').properties.category.enum || []);
  const truth = new Set([...asset, ...asm]);

  const onlyDoc = [...docCats].filter((c) => !truth.has(c)).sort();
  const onlySchema = [...truth].filter((c) => !docCats.has(c)).sort();

  console.log('[check-doc-enums] CONVENTIONS §4 镜像 ↔ schema 真源');
  console.log(`  镜像 ${docCats.size} 类 · 真源 ${truth.size} 类（asset ${asset.size} ∪ assembly ${asm.size}）`);
  for (const c of onlyDoc) console.error(`  ✗ 镜像有、真源无：${c} —— 删它，或先在 schema 里新增分类`);
  for (const c of onlySchema) console.error(`  ✗ 真源有、镜像无：${c} —— 补进 §4（镜像必须逐字一致）`);
  if (!onlyDoc.length && !onlySchema.length) {
    console.log('  ✓ 逐字一致（镜像不是第二真源，但必须与真源同步）');
    return 0;
  }
  console.error('\n  结果：不一致 —— 改 schema 或改镜像，二者必须同批');
  return 1;
}

module.exports = { expandCategories, extractSection4Block };

if (require.main === module) process.exit(main());
