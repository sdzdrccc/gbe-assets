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
