#!/usr/bin/env node
'use strict';

/**
 * check-release-compat.js —— 双仓 `version.js` 的**兼容检查**（ADR-0009）。
 *
 * ★ 本条**不比对文件哈希**。旧纪律要求两份逐字节相同，实际已破却无人发现（假绿）；
 *   2026-10-27 大人裁「不一样功能的参考为什么要同版本」⇒ 改为：
 *   **两仓版本各自独立；脚本各自维护；只保共享子命令的语义一致**。
 *
 * 判据：
 *   ① 六个共享子命令两仓都有：show / log / bump / check / sync / tag
 *   ② `bump` 的级别集合一致（major / minor / patch）
 *
 * 兄弟仓不在场（另一台机器 / CI 只 checkout 本仓）⇒ 显式「跳过（NOT a pass）」，不冒充通过。
 *
 * 用法：
 *   node scripts/check-release-compat.js
 *   node scripts/check-release-compat.js --self-test
 *
 * 退出码：0 = 通过或显式跳过 / 1 = 不兼容
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SELF = path.join(ROOT, 'scripts', 'version.js');
const OTHER = path.join(ROOT, '..', 'gbe-studio', 'scripts', 'version.js');
const REQUIRED = ['show', 'log', 'bump', 'check', 'sync', 'tag'];

/** 纯函数：抽 `case 'x':` 的子命令名（只认小写-kebab） */
function commandsOf(text) {
    const out = new Set();
    for (const m of String(text).matchAll(/case\s+'([a-z][a-z-]*)'\s*:/g)) out.add(m[1]);
    return out;
}

/** 纯函数：抽 `const LEVELS = [...]` 的级别集合 */
function levelsOf(text) {
    const m = String(text).match(/const\s+LEVELS\s*=\s*\[([^\]]*)\]/);
    if (!m) return null;
    return m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean).sort();
}

/** 纯函数：缺失的共享命令 */
function missingCommands(text) {
    const have = commandsOf(text);
    return REQUIRED.filter((c) => !have.has(c));
}

/** 纯函数：两份来源的级别集合是否一致；任一缺失 → 视为不一致 */
function levelsDiffer(a, b) {
    const la = levelsOf(a);
    const lb = levelsOf(b);
    if (!la || !lb) return true;
    return la.join(',') !== lb.join(',');
}

function selfTest() {
    const cases = [];
    const eq = (name, got, want) => cases.push([name, JSON.stringify(got) === JSON.stringify(want), `得 ${JSON.stringify(got)} / 期 ${JSON.stringify(want)}`]);
    const full = "switch(cmd){case 'show':case 'log':case 'bump':case 'check':case 'sync':case 'tag':} const LEVELS=['major','minor','patch'];";
    const missing = "switch(cmd){case 'show':case 'log':case 'bump':} const LEVELS=['major','minor','patch'];";

    eq('正常 · 六个命令齐全', missingCommands(full), []);
    eq('缺失 · 少 check/sync/tag', missingCommands(missing), ['check', 'sync', 'tag']);
    eq('级别 · 一致', levelsDiffer(full, full), false);
    eq('级别 · 不一致', levelsDiffer(full, "const LEVELS=['major','patch'];"), true);
    eq('级别 · 读不出 → 视为不一致（不许假绿）', levelsDiffer('no levels here', full), true);
    eq('命令抽取只认 case 字面量', commandsOf("case 'show': case 'bump':").size, 2);

    let bad = 0;
    console.log('[check-release-compat] 反向测试（--self-test）');
    console.log('─'.repeat(60));
    for (const [name, ok, detail] of cases) {
        console.log(`  ${ok ? '✔' : '✘'} ${name.padEnd(28)} ${detail}`);
        if (!ok) bad++;
    }
    console.log('─'.repeat(60));
    console.log(bad ? `  结果：不通过（${bad} 项不成立）` : '  结果：通过');
    process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--self-test')) selfTest();

if (!fs.existsSync(SELF)) {
    console.error('[check-release-compat] 本仓 scripts/version.js 不存在 —— 无法检查');
    process.exit(1);
}
if (!fs.existsSync(OTHER)) {
    console.log('[check-release-compat] 兄弟仓 gbe-studio 不在场 → 跳过（NOT a pass）');
    console.log('  ★ 这是「没跑到」，不是「通过」；双仓同机时请重跑。');
    process.exit(0);
}

const selfText = fs.readFileSync(SELF, 'utf8');
const otherText = fs.readFileSync(OTHER, 'utf8');
const errors = [];

for (const [label, text] of [['gbe-assets', selfText], ['gbe-studio', otherText]]) {
    const miss = missingCommands(text);
    if (miss.length) errors.push(`${label} 的 version.js 缺共享子命令：${miss.join(' / ')}`);
}
if (levelsDiffer(selfText, otherText)) {
    errors.push(`bump 级别集合不一致：assets=${JSON.stringify(levelsOf(selfText))} · studio=${JSON.stringify(levelsOf(otherText))}`);
}

console.log('[check-release-compat] 双仓 version.js 兼容检查（ADR-0009：不比对哈希）');
console.log('─'.repeat(60));
if (errors.length) {
    errors.forEach((e) => console.log(`  ✗ ${e}`));
    console.log('─'.repeat(60));
    console.log(`  结果：不兼容（${errors.length} 项）`);
    process.exit(1);
}
console.log(`  ✓ 共享子命令齐全（${REQUIRED.join(' / ')}）`);
console.log(`  ✓ bump 级别一致（${(levelsOf(selfText) || []).join(' / ')}）`);
console.log('─'.repeat(60));
console.log('  结果：兼容');
