#!/usr/bin/env node
'use strict';

/**
 * kit-categories.js —— `kit.categories` 分类并集校验的反向测试（`X-0053` A-2）
 *
 * 病：`kit.schema.json` 的 categories 描述写着「必须属于 asset.v2 的 category enum」，
 *    但**实现没有 enum** ⇒ 真源 kit 带越界值照样过 smoke（49 通过 / 0 失败）= **假绿**。
 * 药：`checkKitCategories()` 现读 asset.v2（26 类）∪ assembly.v2（2 类）求并集，逐项校验。
 *
 * 用法：node test/kit-categories.js
 * 退出码：0 = 全过 / 1 = 有失败
 */

const path = require('path');
const fs = require('fs');
const { checkKitCategories } = require(path.resolve(__dirname, '..'));

const cases = [];
const t = (name, got, want) => cases.push({ name, ok: got === want, got, want });

// ① 真源 kit 必绿（现状：23 个资产分类 ＋ assemblies/building）
const kit = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'kits', 'cn-ancient', 'kit.json'), 'utf8'));
t('真源 kit.json → 必绿', checkKitCategories(kit).valid, true);

// ② 资产分类与装配分类**都合法**（并集，不是只认 asset）
t('资产分类 components/roof → 合法', checkKitCategories({ categories: ['components/roof'] }).valid, true);
t('装配分类 assemblies/building → 合法', checkKitCategories({ categories: ['assemblies/building'] }).valid, true);
t('装配分类 assemblies/district → 合法', checkKitCategories({ categories: ['assemblies/district'] }).valid, true);

// ③ 越界值必红（旧实现放过的那种）
t('★ 未知分类 assemblies/castle → 必红', checkKitCategories({ categories: ['assemblies/castle'] }).valid, false);
t('★ 拼错 components/rooves → 必红', checkKitCategories({ categories: ['components/rooves'] }).valid, false);
t('★ 空串 → 必红', checkKitCategories({ categories: [''] }).valid, false);

// ④ 结构异常
t('categories 非数组 → 必红', checkKitCategories({ categories: 'components/roof' }).valid, false);
t('缺 categories → 放行（可选字段）', checkKitCategories({}).valid, true);

// ⑤ 报错要点到具体项（不然读者不知道改哪一行）
const r = checkKitCategories({ categories: ['components/roof', 'assemblies/castle'] });
t('★ 报错定位到 $.categories[1]', r.errors.some((e) => e.path === '$.categories[1]'), true);

const failed = cases.filter((c) => !c.ok);
console.log('[kit-categories] kit.categories = asset.v2 ∪ assembly.v2');
for (const c of cases) {
  console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.ok ? '' : `  → 实际 ${JSON.stringify(c.got)}`}`);
}
console.log(failed.length ? `\n  结果：不通过（${failed.length} / ${cases.length}）` : `\n  结果：通过（${cases.length} / ${cases.length}）`);
process.exit(failed.length ? 1 : 0);
