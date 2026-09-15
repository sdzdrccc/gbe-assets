# GBE-Assets

**GBE = Generative Blender-to-Engine**

[![version](https://img.shields.io/github/v/tag/sdzdrccc/gbe-assets?label=version&color=blue)](CHANGELOG.md) ![license](https://img.shields.io/badge/code-MIT-green) ![assets](https://img.shields.io/badge/assets-CC0--1.0-lightgrey)

> 仓储 / 服务 / 分发端：精修后的模型资产在这里被校验、索引、浏览、下载，并被引擎直接消费；**建筑由构件装配而成**。

---

## 这是什么

一个**资产库**，但不是"一堆模型文件"——而是**四层服务**：

```
④ 界面与客户端   Web 浏览下载 · 装配视图 · CLI · 引擎插件（Godot / Unreal）
③ 服务层         intake 入库 · derive 派生 · catalog 索引 · assembly 装配校验 · publish 分发
② 目录层         index.db（结构化 + FTS5 全文）· ports.json（全项目端口真源）
① 存储层         kits/ 资产实体（权威）· assemblies/ 装配清单（权威）· blobs/ 去重
```

**核心原则**：`kits/` 与 `assemblies/` 里的东西永远是权威；索引与派生（引擎包装、LOD、预览、Draco）都是**可重建的缓存**。服务层挂了，库照样能用。

---

## 完整项目结构

```
gbe-assets/
│
├── README.md                    本文件
├── CHANGELOG.md             ★   更新日志 —— 变更内容真源
├── VERSION                  ★   版本号真源（单行 MAJOR.MINOR.PATCH）
├── AGENTS.md                    AI 助手在本仓的工作纪律（硬约束）
├── CONTRIBUTING.md              人工协作者的上手说明
├── LICENSE                      代码许可：MIT
├── LICENSE-ASSETS               资产许可：CC0-1.0
├── .gitattributes               统一 LF、二进制与派生文件标记
├── .gitignore                   排除凭证 / 本机配置 / 派生缓存
├── catalog.config.json          全库配置：预算与模数的【默认兜底值】
│
├── catalog/                 ② 目录层
│   ├── ports.json           ★   全项目端口唯一真源（含 studio 侧桥端口）
│   ├── schema/              ★   契约真源（机器可读，一切校验的依据）
│   │   ├── asset.v2.schema.json      资产身份 / 几何 / 材质 / 插槽 / 引擎
│   │   ├── source.v2.schema.json     来源与复现（provider / recipe_hash / 许可）
│   │   ├── assembly.v2.schema.json   L0 建筑装配清单（构件引用 + 变换 + 插槽绑定）
│   │   ├── kit.schema.json           kit 元数据：模数网格 / 预算 / 材质分组
│   │   └── collection.schema.json    合集（一次分发的一组资产）
│   └── index.db                运行时生成的结构化 + 全文索引（git 忽略，可重建）
│
├── packages/
│   └── schema/              ★   @gbe/schema —— 双库共用的契约校验包
│       ├── package.json            包元数据（零依赖）
│       ├── index.js                对外 API：validate* / checkPackage / checkAssemblyFull / 门禁函数
│       ├── validate.js             零依赖 JSON Schema 子集校验器（含 $ref 解析）
│       ├── assembly.js         ★   装配级校验（CONVENTIONS §19.5 八条判据 + 库解析 + 极简 semver 范围）
│       └── test/
│           ├── smoke.js            构件级冒烟测试（37 项）
│           └── assembly.js         装配级冒烟测试（27 项：正向 + 八条判据逐条反例）
│
├── kits/                    ① 存储层 · 资产实体（权威）
│   └── cn-ancient/                 中国古建风格 kit（当前 18 件程序化构件）
│       ├── kit.json            ★  模数网格 / 面数预算 / 材质分组 / 覆盖度（kit 内的真源）
│       └── <category>/<name>/      每件资产一个目录（目录名 = asset.id 第三段，无类别前缀）
│           ├── asset.json          资产契约实例（asset.v2）
│           ├── source.json         来源与复现信息（source.v2）
│           ├── lod0.glb            引擎无关标准模型（1u = 1m，bottom-center，+Y up / -Z forward）
│           ├── preview.png         512×512 白底 3/4 视角预览
│           └── lods/               可选：分级细节
│
├── assemblies/              ① 存储层 · L0 建筑装配清单（权威 JSON，非网格）
│   └── <kit>/<category>/<name>.json  与 kits/ 同构；按 id 索引，不参与 folder-per-asset 扫描
│       · cn-ancient/assemblies/building/wanan-wall-corner-a.json   首件装配清单（§10.4 DoD 示范）
│
├── materials/              ① 存储层 · 跨 kit 共享材质
│   └── .gitkeep                    占位
│
├── blobs/                      内容寻址的去重二进制存储（git 忽略，可重建）
│   └── .gitkeep
│
├── inbox/                      与 GBE-Studio 的交接目录（`<asset-id>@<version>/`）
│   └── .gitkeep                    intake 完成后 move 到 _archive/，禁止 rm
│
├── _archive/                   历史版本 + 已处理 inbox（只读留档）
│   └── .gitkeep
│
├── services/               ③ 服务层（intake / derive / catalog / assembly / publish）
│   └── .gitkeep                    占位
├── apps/                   ④ Web 界面（浏览 / 下载 / 装配视图）
│   └── .gitkeep                    占位
├── clients/                ④ 引擎客户端与 CLI
│   └── .gitkeep                    占位
├── tools/                      独立工具脚本
│   └── intake.js           ★   inbox → kits 入库（先校验后搬、只 move 不删、旧版本进 _archive、刷新 coverage）
│
├── docs/
│   ├── DECISIONS.md         ★   决策台账（ADR-0001 ~ 0007）—— 为什么这么定
│   ├── CONVENTIONS.md       ★   双库共享约定 v1.4 —— 因此必须怎么做
│   ├── PLAN.md                  仓储端完整方案（架构 / 契约 / 检索 / 下载 / 入库 / 路线图）
│   └── CONVENTIONS-REVIEW.md    对齐前的审查存档 + 31 项处置记录（历史，非待办）
│
└── scripts/                ★   仓库自身工具
    ├── version.js               版本工具：show / log / bump / check
    ├── install-hooks.js         启用 Git 钩子（core.hooksPath）
    └── hooks/
        └── pre-push             推送前强制校验版本号与更新日志
```

> **图例**：★ = 真源或关键文件；`（权威）` = 不可由脚本重新生成；其余为可重建缓存或占位。

---

## 版本与更新日志

**每次推送都必须带版本号与新日志条目。** 这条纪律由工具链保障，不靠自觉。

| 角色 | 文件 |
|---|---|
| 版本号**真源** | [`VERSION`](VERSION)（单行 `MAJOR.MINOR.PATCH`） |
| 变更内容**真源** | [`CHANGELOG.md`](CHANGELOG.md) |
| 版本**镜像** | 各 `package.json` 的 `version`（若有，由脚本同步） |
| 版本**git 锚点** | 附注 tag `vX.Y.Z`（说明取自 CHANGELOG 该版本正文） |

```bash
node scripts/version.js show                  # 当前版本
node scripts/version.js log 5                 # 最近 5 个版本条目
node scripts/version.js bump patch "修了 X" "调了 Y"   # 升版本 + 写日志
node scripts/version.js bump minor --dry-run "只预览不落盘"
node scripts/version.js check                 # ★ 一致性校验（推送前必过）
node scripts/version.js sync                  # 只对齐镜像，不动版本、不写日志
node scripts/version.js tag                   # 提交后打附注 tag vX.Y.Z
```

**发一版的固定节奏**（四步，别调换）：

```bash
node scripts/version.js bump minor "这次加了什么"   # 1. 升版本 + 写日志
git add -A && git commit -m "chore(release): v0.3.0"  # 2. 提交
node scripts/version.js tag                          # 3. 打 tag（必须在提交后）
git push --follow-tags                               # 4. 推提交 + tag
```

> 第 3 步**必须在提交之后** —— 工作区不干净时 `tag` 会直接报错拦下，避免 tag 打在旧提交上。
> `git push` 单独用不会带 tag，要用 `--follow-tags`。

**先启用钩子**（一次即可）：

```bash
node scripts/install-hooks.js     # → git config core.hooksPath scripts/hooks
```

之后每次 `git push` 都会自动先跑 `check`，**没升版本就推不上去**：

- `VERSION` 是否合法语义化版本
- `CHANGELOG.md` 最新条目是否 == `VERSION`
- `package.json` 版本镜像是否一致
- **自上个版本以来是否存在「没被记录的变更」** —— 用 git 基线机械判定，改了多少文件就管多少个
- 该版本的 tag `vX.Y.Z` 是否已打、是否指向正确的提交（提示项，不阻断）

确知不需升版本时（应写明理由）：`GBE_SKIP_VERSION_CHECK=1 git push`

版本号怎么取 —— 见 [`CHANGELOG.md`](CHANGELOG.md) 顶部的段位表。

---

## 快速开始

```bash
# 校验一个投递包（零依赖，Node 内置模块）
node packages/schema/index.js package inbox/<asset-id>@<version>/

# 入库：inbox → kits（先校验后搬、只 move 不删、旧版本进 _archive、顺手刷新 coverage）
node tools/intake.js                 # 加 --dry-run 只报告不动盘；--reindex 只刷 coverage.done

# 装配清单：语法 + §19.5 八条语义判据（--strict 把所有警告升级为错误，供 CI 用）
node packages/schema/index.js assembly       assemblies/cn-ancient/assemblies/building/wanan-wall-corner-a.json
node packages/schema/index.js assembly-check assemblies/cn-ancient/assemblies/building/wanan-wall-corner-a.json

# 跑契约校验器的冒烟测试（构件级 37 项 + 装配级 27 项）
node packages/schema/test/smoke.js
node packages/schema/test/assembly.js
```

```js
const gbe = require('@gbe/schema');
const r = gbe.checkPackage('inbox/cn-ancient.roof.xuanshan-single-a@1.0.0');
if (!r.ok) console.error(r.errors);

const a = gbe.checkAssemblyFull('assemblies/cn-ancient/assemblies/building/wanan-wall-corner-a.json');
console.log(a.ok, a.stats);   // 引用版本 / 对接数 / 面数 / 收容式嵌入数
```

---

## 文档（读之前先读这个顺序）

| 文档 | 作用 |
|---|---|
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | **决策台账（ADR）** —— 为什么这么定。ADR-0001 ~ 0007 已生效 |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | **共享约定 v1.4** —— 因此必须怎么做（单位/轴心/朝向 · id · 模数 · 插槽 · 装配 · 注册表） |
| [`docs/PLAN.md`](docs/PLAN.md) | 仓储端完整方案（架构 · 契约 · 检索 · 下载 · 入库 · 路线图） |
| [`CHANGELOG.md`](CHANGELOG.md) | 更新日志（版本号的真源伴随物） |
| [`docs/CONVENTIONS-REVIEW.md`](docs/CONVENTIONS-REVIEW.md) | 对齐前的审查存档（历史，非待办） |
| `gbe-studio/docs/BUILDING-DECOMPOSITION.md` | 场景建筑拆分细化方案（拆分层） |

> **单一真源纪律**：`CONVENTIONS.md` 里的枚举表与数值表是**人类可读镜像**，真源在 `catalog/schema/` 与 `kit.json`。发现两者不一致 —— 改真源，并**在同一提交内**同步镜像。

---

## 六条已生效的裁决（摘要）

| ADR | 内容 |
|---|---|
| 0001 | **存量原型不迁移**，`tbg-*` 只读归档；v1 包一律拒收 |
| 0002 | **不接入 Hyper3D Rodin**（订阅成本不划算）；quad 需求改走 Blender 重拓扑 |
| 0003 | **混元3D 三通道**（`tokenhub` / `tencentcloud` / `web`），按可用性降级 |
| 0004 | **Unity 延后**；契约保留字段与端口，实现未做 |
| 0005 | **MCP 实现可切换**，不固定单一实现；适配器只依赖 8 个语义动作 |
| 0006 | **场景建筑构件化**：L0–L3 分级 + 模数网格 + 插槽拼装 |

---

## 许可

- **代码**（`services/` `apps/` `clients/` `packages/` `tools/` `scripts/`）：MIT —— 见 `LICENSE`
- **资产**（`kits/` `materials/` `assemblies/`）：CC0-1.0 —— 见 `LICENSE-ASSETS`

每件资产在 `asset.json` 中以 SPDX 标识符显式声明许可，**不允许留空**。

> AI 生成的资产由对应平台产出（Tripo / Meshy / 混元3D / fal），再分发前请确认各平台条款。
