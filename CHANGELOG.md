# 更新日志 —— GBE-Assets

> **版本真源** = [`VERSION`](VERSION)（单行纯文本，`MAJOR.MINOR.PATCH`）。
> 本文件是**变更内容的真源**；`package.json` 等处的版本号是它的镜像。
> **每次 `git push` 前必须升版本并在此追加条目** —— 见 [`AGENTS.md`](AGENTS.md) §2.6。
> 推送前自动校验：`node scripts/version.js check`（pre-push 钩子已接上）。

本仓遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)。0.x 预发布阶段的取值约定：

| 段位 | 何时 +1 |
|---|---|
| **MAJOR** | 契约破坏性变更：`catalog/schema/` 不兼容、装配清单（assembly.v2）格式重建、目录不变式改口径 |
| **MINOR** | 向后兼容的新能力：新增契约字段 / 目录 / 服务 / 校验项 / 决策条目 |
| **PATCH** | 修错、文档、注释、配置微调、镜像同步 |

> `catalog.config.json` 里的 `config_version` 是**配置格式版本**，与本文件无关：它只在配置结构变了才动。

---

## [未发布]

## [0.4.0] - 2026-09-15

### 新增

- **装配级校验器**（`packages/schema/assembly.js`）：实现 CONVENTIONS §19.5 全部八条判据 —— 引用存在且 `published`（含极简 semver 版本范围解析：`^` / `~` / `>=` / `<` / `=` / `*`）、插槽两端存在与 `mate_types` 互认、`direction` 互为反向、对接面重合（±1e-3）、插槽网格对齐、几何穿插、承重链落地闭合、场景面数预算。附库解析器（扫 `kits/` 建 id → 版本索引）与 `--strict` 逃生舱
- **装配校验冒烟测试**（`packages/schema/test/assembly.js`，27 项）：正向好清单一遍全绿 + 八条判据**逐条**配最小反例，另测语法闸门与 strict 模式。刻意用 `os.tmpdir()` 下的临时夹具库，不依赖真实资产状态 —— 否则以后每入库一件构件都可能无辜变红
- **入库工具**（`tools/intake.js`）：`inbox/<id>@<version>/` → `kits/<kit>/<category>/<name>/`。先跑 `checkPackage` 再搬（门禁双跑的第二次）、**只 move 不删**（同盘 `renameSync`，跨设备才退化 copy）、目标已存在则先把旧目录 move 进 `_archive/`、非 `published` 一律拒收；附带刷新 `kit.json.coverage.done` 派生快照（`--reindex` 可单跑）
- **18 件程序化构件入库**（`kits/cn-ancient/components/`）：首次有资产实体落库。base 4 · wall 2 · pillar 1 · beam 3 · roof 6 · railing 1 · ornament 1，共 1188 三角 / 59 插槽 / **0 credit**；`coverage.done` 由 0 刷新至 18
- **首份 L0 装配清单**（`assemblies/cn-ancient/assemblies/building/wanan-wall-corner-a.json`）：兑现 BUILDING-DECOMPOSITION §10.4 端到端 DoD —— 6 实例 / 4 种构件 / 5 处对接 / 324 面，§19.5 八条判据全绿，含 1 处「收容式嵌入」

### 变更

- `packages/schema/index.js` 新增 `checkAssemblyFull()`（契约版本闸门 → assembly.v2 语法 → §19.5 语义三步）与 CLI `assembly-check <file> [--strict]`；导出 `assembly` 命名空间
- **CONVENTIONS v1.3**（§19.4 / §19.5）：
  - §19.5 新增「实施说明」——把五处契约沉默处一次性定死：`transform.rotation` 单位 = **弧度**（并在疑似角度制时报警，不在沉默处靠猜）· `mate_types` 缺省 = 通配 · `attach` **单向例外**（消解它与「互认」的直接冲突）· **两类嵌入豁免**（已对接对 / 收容式）· 承重链的种子与两条传播规则
  - §19.5 新增「节点件接法」——面接 vs 枢接的可判定前提；推论 L 形转角件**翼厚须 ≥ 1.0 m**（翼厚 0.5 m 不可自洽）；推论 `wall-line` 的 `wall_module_m` 整数倍只约束**同轴续接**
  - §19.4 补齐 `transform` 单位与清单文件命名 `assemblies/<kit>/<category>/<name>.json`（与 `PLAN.md` §5 对齐，此前 §19.4 只写"按 id 索引"）
- README：结构树补 `packages/schema/assembly.js`、`test/assembly.js`、`tools/intake.js`、`assemblies/` 实际形态与 18 件资产；快速开始补四条命令；CONVENTIONS 版本引用 v1.2 → v1.3

### 文档

- `docs/PLAN.md` 的 CONVENTIONS 版本引用同步至 v1.3

## [0.3.1] - 2026-09-15

### 变更
- README 版本徽章改为从 git tag 动态读取（shields github/v/tag），消除硬编码版本号 —— 徽章自此无需随版本手工维护

## [0.3.0] - 2026-09-15

### 变更
- 新增 tag 子命令：在当前 HEAD 打附注 tag vX.Y.Z，说明自动取自 CHANGELOG 该版本正文；工作区不干净时直接报错，防止 tag 打错位置
- check 新增 tag 锚点检查：该版本的 tag 是否已打、是否指向正确的提交（提示项，不阻断）
- 补齐历史 tag：v0.1.0（初始骨架）、v0.2.0（版本机制），并推送远端
- README 与 AGENTS.md 写入发版固定四步：bump → commit → tag → push --follow-tags

## [0.2.0] - 2026-09-15

### 新增
- **版本号与更新日志机制**：`VERSION`（真源）+ `CHANGELOG.md`（变更真源）+ `scripts/version.js`（`show` / `log` / `bump` / `check` / `sync`）
- `scripts/hooks/pre-push` + `scripts/install-hooks.js`：推送前强制校验版本号已更新（`git config core.hooksPath scripts/hooks` 启用）
- `README.md` 写入**完整项目结构树**（逐目录逐文件注释）

### 说明
- 校验项含「自上个版本以来是否有未记录的变更」—— 靠 git 基线机械判定，不靠自觉

## [0.1.0] - 2026-09-15

### 新增
- 仓库初始化：四层结构（存储层 / 目录层 / 服务层 / 界面与客户端）
- `catalog/schema/`：契约真源 v2 —— `asset.v2` / `source.v2` / `assembly.v2` / `kit` / `collection`
- `catalog/ports.json`：全项目端口唯一真源；`catalog.config.json`：预算与模数兜底
- `packages/schema/`：`@gbe/schema` 零依赖 JSON Schema 子集校验器（语法单源，冒烟 37 项）
- `kits/cn-ancient/kit.json`：模数（`snap_m` 0.5 / 开间 2 / 层高 3,4 / 柱距 2,4 / 地面 2）、预算、材质、覆盖度初值
- `docs/DECISIONS.md`：决策台账 ADR-0001 ~ 0006
- `docs/CONVENTIONS.md` **v1.2**：双库共享约定（单位/轴心/朝向 · 尺寸轴序 · id·version · status+flags · 模数 · 插槽 · 装配 · 注册表 · 禁令 12 条）
- `docs/PLAN.md`：仓储端完整方案；`docs/CONVENTIONS-REVIEW.md`：对齐前审查存档
- 空目录占位：`assemblies/` `materials/` `blobs/` `inbox/` `_archive/` `services/` `apps/` `clients/` `tools/`
