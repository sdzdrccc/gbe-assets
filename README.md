# GBE-Assets

**GBE = Generative Blender-to-Engine**

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

## 快速开始

```bash
# 校验一个投递包（零依赖，Node 内置模块）
node packages/schema/index.js package inbox/<asset-id>@<version>/

# 跑契约校验器的冒烟测试
node packages/schema/test/smoke.js
```

```js
const gbe = require('@gbe/schema');
const r = gbe.checkPackage('inbox/cn-ancient.roof.xuanshan-single-a@1.0.0');
if (!r.ok) console.error(r.errors);
```

---

## 仓库结构

| 路径 | 说明 |
|---|---|
| `catalog/schema/` | ★ **契约真源**（asset.v2 / source.v2 / assembly.v2 / kit / collection） |
| `catalog/ports.json` | ★ **全项目端口唯一真源**（含 studio 侧桥端口） |
| `catalog.config.json` | 默认预算 / 模数 / 预览规格的兜底值 |
| `packages/schema/` | ★ `@gbe/schema` —— 双库共用的校验器（语法单源） |
| `kits/<kit>/` | 资产实体（folder-per-asset）+ `kit.json`（模数与预算真源） |
| `assemblies/` | L0 建筑的装配清单（权威 JSON，非网格） |
| `materials/` | 跨 kit 共享材质 |
| `inbox/` | 与 GBE-Studio 的交接目录（`<asset-id>@<version>/`） |
| `_archive/` | 历史版本 + 已处理 inbox（只读留档） |
| `services/` · `apps/` · `clients/` · `tools/` | 服务层 / Web 与 CLI / 引擎客户端 / 工具脚本 |

---

## 文档（读之前先读这个顺序）

| 文档 | 作用 |
|---|---|
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | **决策台账（ADR）** —— 为什么这么定。ADR-0001 ~ 0006 已生效 |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | **共享约定 v1.2** —— 因此必须怎么做（单位/轴心/朝向 · id · 模数 · 插槽 · 装配 · 注册表） |
| [`docs/PLAN.md`](docs/PLAN.md) | 仓储端完整方案（架构 · 契约 · 检索 · 下载 · 入库 · 路线图） |
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

- **代码**（`services/` `apps/` `clients/` `packages/` `tools/`）：MIT —— 见 `LICENSE`
- **资产**（`kits/` `materials/` `assemblies/`）：CC0-1.0 —— 见 `LICENSE-ASSETS`

每件资产在 `asset.json` 中以 SPDX 标识符显式声明许可，**不允许留空**。

> AI 生成的资产由对应平台产出（Tripo / Meshy / 混元3D / fal），再分发前请确认各平台条款。
