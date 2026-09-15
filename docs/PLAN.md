# GBE-Assets 设计方案

> **GBE = Generative Blender-to-Engine**
> GBE-Assets 是**仓储 / 服务 / 分发端**：精修后的模型资产在这里被校验、索引、浏览、下载，并被引擎直接消费。
> 本文是**重构方案**，不复用 tbg-assets 的既有结构；tbg-assets 仅作为已验证的原型与经验来源（**只读归档，不迁移**，ADR-0001）。
> **共享约定（单位/轴心/朝向、尺寸轴序、id·version、预算单源、status、recipe_hash、材质、许可、派生边界、硬性禁令、构件分级 §19、注册表 §20）见 [`docs/CONVENTIONS.md`](./CONVENTIONS.md)（v1.2）**——实现前先读。
> **决策依据见 [`docs/DECISIONS.md`](./DECISIONS.md)（ADR-0001 ~ ADR-0006）**：存量不迁移 · 不接 Rodin · 混元3D 三通道 · Unity 延后 · MCP 实现可切换 · 构件分级拼装。
> 四份文档（`catalog/schema/` · `CONVENTIONS.md` · 本 PLAN · `gbe-studio/docs/BUILDING-DECOMPOSITION.md`）**必须口径一致**。若发现冲突——以 schema 为机器可读真源、以 CONVENTIONS 为语义裁决，并**在同一提交内修掉本 PLAN**。

---

## 0. 一句话目标

**资产不再是躺在 Git 目录里的文件，而是一个可检索、可预览、可按引擎取用的服务体系。**

```
别处：git clone 一个仓库，翻目录找模型，手动转格式，手动改材质路径
这里：网页搜索"歇山顶" → 3D 预览 + 切材质 + 看面数 → 点"下载 Unreal 版" → 拿到 fbx + import.py + 材质映射
     再点开"万安城主殿"的装配视图 → 看到它由 42 个构件插接而成 → 一键打包整栋
```

---

## 1. 定位与边界

| | GBE-Assets（本方案） | GBE-Studio |
|---|---|---|
| 角色 | **仓储 + 服务 + 分发** | 生产端 |
| 交互面 | Web 站、REST API、CLI、引擎插件 | AI 助手对话 |
| 职责 | 校验 → 入库 → 派生 → 索引 → 浏览 → 分发 | 路由 → 生成 → 拆分 → 精修 → 质检 → 打包 |
| 独占资产 | **数据契约（schema 权威）**、资产实体、索引、导出模板 | 平台凭证、精修配方、提示词库、MCP 桥 |

**唯一契约 = GBE 资产包**（多格式模型 + `asset.json` + `source.json`）。契约由本库定义，studio 遵循。

---

## 2. 为什么要重构（相对 tbg-assets）

| 维度 | tbg-assets（原型） | GBE-Assets（重构） | 动机 |
|---|---|---|---|
| 形态 | Git 仓库 + 目录约定 + 一个入库网页 | **四层服务**：存储 / 目录 / 服务 / 界面与客户端 | 目录约定无法支撑检索、分发与多引擎消费 |
| 索引 | 靠 glob 扫目录 | **Catalog 索引库**（结构化过滤 + 全文检索） | 资产上千后目录遍历不可用 |
| 浏览 | 单张 300×300 静态渲染图 | **交互式 3D Viewer** + 512 统一预览 + **装配视图** | 选资产必须能看清；建筑要能看到构件构成 |
| 下载 | 只有 `model.glb` | **按引擎导出**（Godot / Unreal 的包装与格式；Unity 延后，ADR-0004） | 引擎消费要求不同格式与落地元数据 |
| 格式 | 单一 glb | **派生多格式**（glb/fbx/obj/usdz）+ 多 LOD + 多贴图规格 + Draco 变体 | 引擎与 DCC 各异 |
| 契约 | v1（单模型单 LOD，无 version/status/engines） | **v2**（多文件/多引擎/依赖/版本/生命周期/溯源/契约版本/**几何粒度**） | 支撑多引擎、构件化与版本演进 |
| 校验 | 单份校验脚本 | **语法单源 + 门禁双跑**（同一份 `@gbe/schema`，出包前与入库各跑一次） | 既要一致，又不能出现两套判据 |
| 检索 | 无 | 标签/分类/tier/**granularity**/面数/尺寸/许可证/引擎兼容 **+ status/flags** 多维过滤 | 复用资产的前提是找得到 |
| 组装 | 无 | **装配清单**（L0 建筑 = 构件 + 插槽绑定，声明式） | 建筑由构件拼出，改一根柱子只改一处 |
| 分发 | git submodule | **多形态部署**（本地/团队 LFS/公网对象存储+CDN） | 从个人工作区走向可分享 |
| 消费入口 | 手工拷贝 | **REST API + CLI + 引擎插件** | 让引擎里就能搜资产并导入 |

> 结论：**重构的核心是把"资产库"从文件组织方式，升级为一个有契约、有索引、有派生、有分发通道的服务**；并在此基础上新增**构件化与装配**能力，把"资产"从单件扩展到"可拼装的建筑"。

---

## 3. 总体架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ④ 界面与客户端                                                           │
│   Web App（浏览/详情/装配视图/上传/合集）   CLI（gbe pull/push/search）      │
│   引擎插件：Godot Addon / Unreal Plugin（站内搜索→直接导入）                 │
│   （Unity Plugin 延后，ADR-0004）                                          │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ REST / 本地文件
┌──────────────────────────────────┴───────────────────────────────────────┐
│  ③ 服务层                                                                 │
│   intake（入库校验）  derive（派生）  catalog（索引检索）                    │
│   assembly（装配校验与影响面）  publish（分发打包）                          │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴───────────────────────────────────────┐
│  ② 目录层（Catalog）                                                       │
│   index.db（结构化字段 + FTS5 全文）  kits.json  collections.json          │
│   ports.json（全项目端口真源）  assemblies/（装配清单，★ 权威 JSON 实体）    │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴───────────────────────────────────────┐
│  ① 存储层                                                                 │
│   kits/<kit>/<category>/<name>/   ← 资产实体（folder-per-asset，权威）      │
│   assemblies/<kit>/<cat>/<name>.json ← L0 装配清单实体（权威，非网格）      │
│   blobs/<sha256 前缀>/<sha256>    ← 可选内容寻址去重层                      │
│   materials/                      ← 跨 kit 共享材质                        │
│   inbox/                          ← 与 studio 的交接目录（<id>@<version>）  │
│   _archive/                       ← 历史版本 + 已处理 inbox（只读留档）      │
└──────────────────────────────────────────────────────────────────────────┘
```

**分层原则**：资产实体永远是权威（可脱离服务层存在，纯文件也自洽）；索引与派生都是**可重建的缓存**——`gbe reindex` 能从文件全量重建。

---

## 4. 数据契约 v2

### 4.1 单件资产目录

```
kits/cn-ancient/components/roof/xuanshan-single-a/     # 目录名 = id 第三段，无类别前缀
├── asset.json          # 元数据（v2，权威；含 schema_version / version / status / flags / granularity）
├── source.json         # 溯源（provider / channel / model / prompt / seed / 成本）
├── model.glb           # LOD0（精修后，引擎无关标准）
├── model-lod1.glb      # 可选
├── model-lod2.glb      # 可选
├── preview.png         # 主预览（512×512，白底 3/4 视角）
├── preview.webp        # 派生（体积优化）
├── turntable/          # 派生：转盘序列帧（可选）
├── collisions/         # 可选：凸包等显式碰撞网格
└── engines/            # ★ 各引擎包装（派生产物，可重建；附 source_hash / asset_version）
    ├── godot/          *.tscn（预挂碰撞 + LOD + 材质引用）
    ├── unreal/         import.py（导入脚本）+ 材质映射
    └── unity/          （延后，ADR-0004；目录预留，未生成）
```

> **目录不变式**（CONVENTIONS §2.2）：`<name>` 段**严格等于** `asset.id` 第三段。`roof/xuanshan-single-a/` 对；`roof/roof-xuanshan-single-a/` **错**（带类别前缀）。
> `variants` 权威形态是 `asset.variants` **内联数组**，不再另建 `variants.json`；展开件属派生物（见 §5.2）。
> 历史版本**不进**资产目录，走库根 `_archive/`（否则会污染 folder-per-asset 扫描）。

### 4.2 asset.json v2（相对 v1 的扩展）

```jsonc
{
  "schema_version": "2",                   // ★ 契约版本：intake 据此选校验器（缺失即报错，不静默兼容）
  "id": "cn-ancient.roof.xuanshan-single-a",
  "name": "悬山顶·单檐 A",
  "version": "1.0.0",                      // ★ 资产版本：语义化，首次入库 1.0.0
  "status": "published",                   // ★ 生命周期：draft | needs-review | published | deprecated
  "flags": [],                             // ★ 并行标记：needs-material-review | refine-unreproducible | socket-unverified
  "kit": "cn-ancient",
  "category": "components/roof",
  "tier": "component",                     // ★ 质量档位：primitive | component | mass | hero
  "granularity": "L2",                     // ★ 几何粒度：L0 整栋 | L1 部位 | L2 构件 | L3 装饰
                                           //   与 tier 正交（tier 说"做多好"，granularity 说"拆多细"，CONVENTIONS §19）
  "tags": ["悬山顶", "单檐", "屋顶"],

  "geometry": {                            // ★ 重组：从扁平字段改为分组
    "dimensions_m": [6.02, 4.22, 2.34],    // [x 宽, y 高, z 深] —— 顺序写死（CONVENTIONS §1）
    "pivot": "bottom-center",
    "axis": { "up": "+Y", "forward": "-Z" },
    "polycount": 15000,                    // ★ 语义 = 三角面数（tris）
    "vertices": 7800
  },

  "files": {                               // ★ 多文件清单
    "model": { "lod0": "model.glb", "lod1": "model-lod1.glb" },
    "preview": ["preview.png", "preview.webp"],
    "collision": null
  },

  "shell": { "has_uv": true, "manifold": true, "solidified": true },   // ★ 几何健康

  "materials": {
    "slots": [{ "slot": "roof", "ref": "roof-tile/qingwa" }],          // ★ 槽位级映射（槽名词表见 CONVENTIONS §5.1）
    "embedded_textures": 0
  },

  "collision": "box",
  "sockets": [ /* 拼接口：位置 + 接入方向 + 对接类型 + grid_locked（语义见 CONVENTIONS §9 / §19.3） */ ],
  "variants": [ { "type": "material-swap", "detail": "roof-tile: qingwa→liuli-huang" } ],  // ★ 内联即权威

  "engines": {                              // ★ 各引擎落地元数据；未启用引擎的键可缺省
    "godot":  { "scene": "engines/godot/xuanshan-single-a.tscn", "import_scale": 1.0 },
    "unreal": { "scale": 100,   "rotation": [0, 0, 0],   "up_axis": "z" },    // 左手系；UE 用 cm；up 轴由导入器转
    "unity":  { "scale": 1.0,   "rotation": [0, 180, 0], "up_axis": "y" }    // 左手系；仅绕 Y 修正水平朝向
  },                                                                          // ★ Unity 延后（ADR-0004）：键为可选保留，不因未启用而删字段

  "deps": [ { "id": "cn-ancient.material.qingwa", "version": "^1.0.0" } ],  // ★ 依赖
  "license": "CC0-1.0",                    // SPDX 标识符，不允许留空
  "author": "sdzdrccc",

  "meta": { "suggested_category": null }   // ★ 仅上传兜底路径写入；人工确认前不覆盖权威字段
}
```

**下线字段**：`status = "deprecated"` 时，`deprecated_by`（新 id）或 `deprecated_reason` **必填其一**（CONVENTIONS §6）。

> **轴转换责任**（CONVENTIONS §1）：`+Y up / -Z forward` 是交付基准，引擎包里永远是它；**up 轴的 Y→Z 转换由引擎导入器负责**，本库与集成层**不重复转换**——否则会得到"躺着的模型"。

### 4.3 source.json v2

```jsonc
{
  "provenance": {
    "provider": "hunyuan3d",          // ★ 取值：tripo | meshy | hunyuan3d | fal（ADR-0002：已去 rodin）
    "channel": "tokenhub",            // ★ 多通道平台的实际通道：tokenhub | tencentcloud | web（ADR-0003）
    "model": "hy-3d-3.1",
    "mode": "text",
    "prompt": "...",
    "negative_prompt": "...",
    "seed": null,
    "task_id": null,                  // ★ web 通道允许 null
    "cost": { "value": 30, "unit": "credit", "usd_est": 0.33 },
    "raw_ref": "raw/hunyuan3d_out.glb" // ★ Studio 侧引用，不保证库内存在，不得据此定位
  },
  "refine": {
    "recipe_id": "cn-ancient/roof-component",
    "recipe_hash": "a1b2c3d4e5f60718", // 16 位 hex，含 steps + qa（CONVENTIONS §7.1）
    "blender": "4.5"
  },
  "created_at": "2026-09-15T20:00:00+08:00"   // ISO 8601，带时区
}
```

**无法回填配方时**（如人工交互精修且未回填）：写 `refine.manual = true` + `refine.note`（操作摘要），QA 同时打 `refine-unreproducible` 标记——此类资产不宣称可回归。

> `recipe_hash` 是关键字段：**配方一变（steps 或 qa），hash 就变**，可以批量找出"用了旧配方精修"的资产做回归重做。

---

## 5. 存储与派生

### 5.1 权威与缓存

| 层 | 是否权威 | 可重建 |
|---|---|---|
| `kits/` 资产实体 | ✅ 权威 | — |
| `assemblies/` 装配清单 | ✅ 权威 | — |
| `_archive/`（历史版本 / 已处理 inbox） | ✅ 只读留档 | — |
| `blobs/` 内容寻址 | ❌ 去重层 | `gbe dedupe` |
| `index.db` 索引 | ❌ 缓存 | `gbe reindex` |
| `engines/` 引擎包装 | ❌ 缓存 | `gbe derive --engine <id>` |
| `baked/` 装配烘焙网格 | ❌ 缓存 | `gbe derive --bake <assembly>` |
| `draco/` · `textures/{1k,2k}` · `variants/` | ❌ 缓存 | `gbe derive --draco / --textures / --variants` |
| `preview.webp` / `turntable/` | ❌ 缓存 | `gbe derive --previews` |

> 这条原则让库**永不腐坏**：索引坏了重建，派生旧了重跑，实体始终干净。

### 5.2 派生流水线（derive）

| 派生 | 工具 | 说明 |
|---|---|---|
| glb → fbx / usdz / obj | Blender 无头批处理 | 保 UV 与材质槽 |
| 反向 fbx → glb | FBX2glTF + 单位修正 | 修 100 倍单位缩水的坑 |
| 几何优化 | gltf-transform（simplify / prune / draco） | 生成 LOD1/LOD2 |
| **Draco 变体** | gltf-transform draco | 仅供 Web 详情页；引擎下载仍给原版 |
| **贴图规格变体** | gltf-transform resize | 1024 / 2048 两档 |
| **变体展开** | 按 `asset.variants` 生成 | material-swap / tint / mirror / scale |
| 预览渲染 | Blender 无头（512，白底 3/4 视角） | + webp 转换 |
| 转盘序列 | Blender 无头多角度 | 可选，详情页动效 |
| 引擎包装 | 各引擎模板生成器 | .tscn（Godot）/ import.py（Unreal），**附 source_hash 与 asset_version**；Unity 延后（ADR-0004） |
| **装配烘焙** | 装配清单 → 单网格 | `gbe derive --bake <assembly-id>`；派生物不入库实体（CONVENTIONS §19.6） |

派生是**按需 + 缓存**：首次下载某引擎包装时生成，之后命中缓存直接给。缓存键 = `asset_id + version + source_hash`——实体一变即失效重跑。

---

## 6. 目录与检索（Catalog）

### 6.1 索引结构

SQLite（单文件、零运维）+ FTS5 全文索引。小库（<200 件）可退化纯 JSON。

```
assets(id PK, schema_version, version, status, flags, name, kit, category, tier,
       granularity, license, author, polycount, dim_xyz, updated_at, preview_path,
       has_lod, has_collision, has_uv, manifold,
       health_flags, deprecated_by, deprecated_reason)
asset_engines(asset_id, engine, derived, source_hash)   -- ★ 一行一引擎，不写死列（Unity 启用时不改表结构）
tags(asset_id, tag)                       -- 多值
materials(asset_id, slot, material_ref)   -- 多值
sockets(asset_id, name, type, pos, dir, grid_locked)    -- 多值（CONVENTIONS §9.1）
deps(asset_id, dep_id, range)
assemblies(id PK, name, kit, granularity, params_json, source_hash)
assembly_instances(assembly_id, instance_id, asset_id, version_range, transform_json, socket_map_json)
history(asset_id, version, created_at, archived_path)   -- _archive 挂钩
assets_fts(id, name, tags, prompt)        -- FTS5，含 prompt 以便"按提示词找回"
```

> `asset_engines` 独立成表而不是列，是刻意的：**引擎是可扩展维度**（ADR-0004 Unity 延后、未来可能加别的），列式设计每加一个引擎就要改表结构。

### 6.2 检索维度

- **分类**：kit / category / tier
- **几何粒度**：`granularity`（L0 整栋 / L1 部位 / L2 构件 / L3 装饰，CONVENTIONS §19）
- **状态**：`status`（默认只出 `published`）、`flags`（可反向排除带标记的资产）
- **数值区间**：面数、尺寸（宽/高/深）
- **布尔**：有无 LOD、有无碰撞、有无 UV、是否 manifold、有无贴图
- **集合**：tags、materials、sockets 类型
- **引擎兼容**：godot / unreal（含"已派生"与"可按需派生"两态）；**Unity 延后**（ADR-0004，不参与筛选默认值）
- **其他**：许可证、作者、更新时间、版本区间
- **全文**：id / 中文名 / 标签 / 生成提示词

> 特别设计：`prompt` 入全文索引。这样"上次那个'青瓦飞檐的重檐屋顶'叫什么来着"可以直接搜到——生成侧的信息在仓储侧产生检索价值。

---

## 7. 浏览体验（Web App）

| 页面 | 能力 |
|---|---|
| **列表页** | 缩略图网格 / 表格双视图；多维筛选侧栏；排序；全文搜索；结果计数与筛选条件回显；默认隐藏 `deprecated` 与非 `published` |
| **详情页** | 交互式 3D 预览（拖拽旋转、缩放、线框、自动归一化取景）；LOD 切换；材质预设切换（青瓦↔琉璃）；变体切换；统计面板（面数/顶点/尺寸/贴图数/健康标记）；sockets 可视化；溯源面板；生命周期与标记（`status` / `flags` / 版本 / recipe_hash） |
| **装配视图** | 装配清单可视化：按插槽树展开实例、点击定位到构件资产、显示引用版本与影响面；一键打包整栋（含全部依赖构件）；装配校验结果直显 |
| **对比视图** | 多件并排（选型时横向看规格与外观） |
| **合辑（Collection）** | 人工策展的场景级组合（如"街景 MVP 30 件"），可一键打包下载 |
| **上传 / 入库台** | 拖拽上传；自动识别分类与统计；预览确认；一键入库；inbox 待办队列 |
| **Kit 概览** | 一个套件的资产覆盖度矩阵（哪些类别满了、哪些是空缺），**直接驱动生产排期** |

**Viewer 技术选型**：`<model-viewer>`（web component，开箱即用，含 AR）优先；需要材质槽切换 / socket 可视化 / 多变体对比 / 装配树时用 three.js 自建（原型已有 three.js + GLTFLoader 基础可升级）。

**性能**：缩略图懒加载 + webp；查看器按需加载 GLB（draco）；列表页首屏只传元数据。

---

## 8. 下载与分发

### 8.1 单件下载

| 选项 | 取值 |
|---|---|
| 格式 | glb / fbx / obj / usdz |
| LOD | 0（默认）/ 1 / 2 |
| 引擎 | 原样 / Godot 包装（.tscn）/ Unreal 包装（fbx + import.py）——**Unity 延后**（ADR-0004，请求则明确报错"引擎未启用"） |
| 附带 | 是否带 preview、是否带 source.json（溯源）、贴图规格 1K/2K |
| Draco | Web 默认开；**引擎下载默认关**（避免插件依赖） |

**包装身份**：所有引擎包装内附一份 `_gbe.json`，记录 `asset_id` / `asset_version` / `recipe_hash` / `source_hash`——已导入工程的资产要能自证来源版本。

### 8.2 批量下载

- 选中多件 → zip（自动附带一份 `MANIFEST.json` 与材质引用清单）
- 整 kit → zip / Godot addon 结构（`res://` 就绪）
- **整栋装配** → zip（构件 × 实例数 + 装配清单 + 全部依赖材质；可选是否附烘焙单网格）
- 按合辑 → zip
- **依赖自动带出**：下载用到共享材质的资产时，材质定义一并打包（避免"模型到手材质缺失"）

### 8.3 消费入口

| 入口 | 说明 |
|---|---|
| Web | 手动下载，最直观 |
| **CLI** | `gbe search "歇山"` / `gbe pull cn-ancient.roof.xuanshan-single-a --engine unreal --lod 1` / `gbe assembly validate <id>` / `gbe push <包>` |
| **REST API** | 给流水线与 CI 用 |
| **引擎插件** | Godot / Unreal 编辑器内搜索资产 → 直接导入到当前工程（免去"下载→解压→拖入"） |

> 引擎插件是重构的**高价值入口**：它把"资产库"变成引擎里的一等公民。

---

## 9. 入库流水线（intake）

```
inbox/<asset-id>@<version>/     ← studio 投递，或网页上传兜底（裸模型，无 asset.json）
   │
   ├─ ⓪ 契约版本闸门  schema_version 必须为 "2"；缺失或为 "1" → 直接报错拒收（ADR-0001）
   ├─ ① 契约复检      语法校验：调 @gbe/schema（与 studio 侧同一份库，单源，不双实现）
   ├─ ② 质量门禁      单位/轴心/朝向/尺寸轴序/面数预算/UV/材质映射/命名/模数/插槽网格对齐
   │                  —— 判据聚合自真源：kit.json.budgets · kit.json.grid · schema enum · kit.json.materials
   ├─ ③ 安全检查      无凭证泄漏、无超大文件、无非法路径
   ├─ ④ 派生          预览图(512) + webp + LOD + 多格式 + Draco + 引擎包装（可异步）
   ├─ ⑤ 索引          写入 index.db + FTS，登记 flags
   ├─ ⑥ 归档          inbox/<id>@<version>/ ──move──▶ _archive/inbox/<id>@<version>/
   │                  （**move，不是删除**；违反 CONVENTIONS §15.2 的 rm -rf 禁令）
   └─ ⑦ 溯源登记      source.json 落库，进入成本账本（供 studio 侧对账）
```

**上传兜底路径**（裸模型无元数据）：文件名关键词降级分类 + 自动统计 + 标 `needs-review` → 人工在入库台补全后转正；建议分类只写 `meta.suggested_*`。分类规则与 studio 侧**共用同一定义**（避免两套规则漂移）。

**v1 包一律拒收**（ADR-0001）：`schema_version` 缺失或为 `"1"` 时**直接报错**，提示「v1 契约已废弃，原型资产不迁移，请用 v2 重新出包」——**不静默兼容、不提供迁移通道**。

**冲突处理**：同 id 但内容不同 → 生成新 `version`，保留历史；同 id 意在覆盖 → 需显式 `--force` 且记 diff；同 id 异内容且未升 version → **直接报错**。

---

## 10. 权限 / 许可证 / 溯源

| 项 | 方案 |
|---|---|
| 许可证 | 资产 `CC0-1.0` / 脚本 `MIT`，双许可声明；每件资产在 `asset.json` 以 **SPDX 标识符**显式声明，不允许留空 |
| 平台条款 | README 注明资产由 AI 生成并标明平台（Tripo / Meshy / 混元3D / fal，ADR-0002 已去 Rodin），发布前确认各平台再分发条款 |
| 溯源 | `source.json` 记 provider / **channel** / model / prompt / seed / task_id / 成本，**只记 task_id，不记账号信息** |
| 凭证 | 禁止提交任何平台密钥；日志与 API 响应统一脱敏 |
| 访问控制 | 本地模式全开放；团队/公网模式支持 token（读公开，写需鉴权） |
| 大文件 | Git LFS 管 `*.glb *.fbx *.blend *.png *.webp`；`blobs/` 与派生缓存按需是否入库 |

---

## 11. 目录结构

```text
gbe-assets/
├── README.md / LICENSE / CONTRIBUTING.md / AGENTS.md
├── catalog.config.json          # 全库配置：单位、网格模数、面数预算、默认 kit、启用引擎
│
├── catalog/                     # ★ 目录层
│   ├── schema/                  # asset.v2 / source.v2 / assembly.v2 / kit / collection 的 JSON Schema（★ 契约真源）
│   ├── index.db                 # 索引（可重建）
│   ├── ports.json               # ★ 全项目端口唯一真源（含 studio 桥端口）
│   └── collections/             # 人工策展的合辑定义
│
├── packages/
│   └── schema/                  # ★ 导出 npm 包 @gbe/schema（schema + validate.js），双库共用
│
├── kits/                        # ★ 资产实体（folder-per-asset，权威）
│   └── <kit>/
│       ├── kit.json             # 套件元数据、grid、budgets、材质组、类别覆盖
│       ├── components/ · buildings/ · props/ · nature/ · terrain/
│       └── previews/
│
├── assemblies/                  # ★ 装配清单实体（L0 建筑，权威 JSON，非网格；CONVENTIONS §19.4）
│   └── <kit>/<building|district>/<name>.json
│
├── materials/                   # ★ 共享材质库（跨 kit 复用）
│   ├── index.json
│   └── <group>/<name>.tres|.mat|.json
│
├── blobs/                       # 可选：内容寻址去重层
├── inbox/                       # ★ 与 studio 的交接目录（inbox/<id>@<version>/）
├── _archive/                    # ★ 历史版本 + 已处理 inbox（只读留档，不入扫描）
│
├── services/                    # ★ 服务层（Node.js）
│   ├── api/                     # REST 服务
│   ├── intake/                  # 入库校验与登记（v1 包拒收）
│   ├── derive/                  # 派生：预览/LOD/多格式/Draco/贴图/引擎包装/装配烘焙
│   ├── catalog/                 # 索引构建与检索
│   ├── assembly/                # 装配校验、影响面分析（CONVENTIONS §19）
│   └── publish/                 # 分发：静态导出 / 打包 / CDN 同步
│
├── apps/
│   ├── web/                     # ★ 浏览下载站（列表 / 详情 / viewer / 装配视图 / 上传台 / 合辑）
│   └── cli/                     # gbe 命令行
│
├── clients/                     # ★ 引擎客户端
│   ├── godot-addon/             # 编辑器内搜索与导入
│   ├── unreal-plugin/
│   └── unity-plugin/            # （延后，ADR-0004；目录预留）
│
├── tools/                       # 工具脚本（渲染、批量转换、体检）
└── docs/                        # PLAN.md / CONVENTIONS.md / CONVENTIONS-REVIEW.md / DECISIONS.md
```

---

## 12. API 设计（草案）

| 方法 | 端点 | 说明 |
|---|---|---|
| GET | `/api/assets` | 列表：`?q=&kit=&category=&tier=&granularity=&status=&flags=&tags=&poly_max=&dim_min=&engine=&has_lod=&license=&sort=&page=` |
| GET | `/api/assets/{id}` | 详情（完整 asset.json + source.json + 派生状态 + 路径校验结果） |
| GET | `/api/assets/{id}/files` | 文件清单与可派生选项 |
| GET | `/api/assets/{id}/download` | `?engine=unreal&fmt=fbx&lod=1&draco=off&tex=2k&with_source=1` |
| GET | `/api/assets/{id}/used-by` | 反向查询：哪些装配清单引用了本资产（改动的爆炸半径） |
| POST | `/api/assets/{id}/derive` | 触发派生（同步或入队） |
| POST | `/api/ingest` | 入库（上传包或 inbox 指定 id） |
| GET | `/api/inbox` | 待入库队列 |
| POST | `/api/packs` | 批量打包：`{ ids \| kit \| assembly \| collection, engine, opts }` |
| GET | `/api/kits` · `/api/kits/{id}/coverage` | 套件与覆盖度矩阵 |
| GET | `/api/assemblies` · `/api/assemblies/{id}` | 装配清单列表 / 详情（插槽树 + 引用版本 + 依赖展开） |
| POST | `/api/assemblies/{id}/validate` | 装配校验（CONVENTIONS §19.5 判据） |
| GET | `/api/collections` | 合辑列表 |
| GET | `/api/stats` | 全库统计（件数/面数分布/引擎派生覆盖/status 与 flags 分布/成本汇总） |
| GET | `/api/ports` | 端口真源（供 studio 读取与冲突探测） |
| GET | `/api/health` | 服务与索引健康 |

---

## 13. 部署形态

| 形态 | 组成 | 适用 |
|---|---|---|
| **本地开发** | 本地 server（8789 Web / 8788 API）+ 文件系统 | 个人 + studio 联调（默认，零依赖） |
| **团队** | Git LFS 仓库 + 内网服务 + 只读 Web | 小团队共享，可控 |
| **公网** | 资产实体进对象存储（S3/OSS/COS） + CDN + 静态站 + 无服务器 API + 索引可只读快照 | 对外分发、开源发布 |

> **端口真源在本库**：`catalog/ports.json` 持有全项目端口（含 studio 桥端口）。9876 / 9877（Godot / Blender）、6776 与 30010（Unreal）由 studio 占用，本库服务固定 **8788 / 8789**；**8080 预留给 Unity（延后，ADR-0004），当前不占用**。studio 侧 `bridges/registry.json` 是从真源生成/校验的**只读视图**，不再各持一份。

---

## 14. 路线图

**Phase 0 — 契约先行**
1. 定稿 asset.v2 / source.v2 / **assembly.v2** / kit / collection schema（含 `schema_version` / `status` / `flags` / 尺寸轴序 / **`granularity`**）
2. 建 `packages/schema` 导出 `@gbe/schema`；建 `catalog/ports.json`；CI 校验"文档镜像表 ⇄ 真源"一致
3. 建 `assemblies/` 目录形态与装配校验器骨架（CONVENTIONS §19.5）

> **不含迁移步骤**（ADR-0001）：库从空开始，v1 包一律拒收。

**Phase 1 — 索引与派生骨架**
4. `services/catalog`：扫描目录建索引（结构化 + FTS + status/flags/version/**granularity**）
5. `services/derive`：预览渲染 512 + webp + LOD + Draco + 贴图规格（gltf-transform / Blender 无头）
6. `gbe reindex` / `gbe derive` CLI（**无存量重渲染步骤**——库从空开始，ADR-0001）

**Phase 2 — 浏览与下载 MVP**
7. Web 列表页（筛选 + 搜索 + 缩略图，默认只出 `published`）
8. 详情页 + 交互式 3D viewer（旋转/线框/LOD/材质切换/生命周期面板）
9. 单件下载（格式 + LOD + 引擎包装 + `_gbe.json` 身份）+ 依赖自动带出
10. 批量打包（选中 / 整 kit / **整栋装配及其依赖构件**）

**Phase 3 — 入库与装配闭环**
11. `services/intake`：完整流水线 + inbox 队列 + 上传兜底 + move 归档（**v1 包拒收**）
12. `services/assembly`：装配校验 + 影响面分析 + 装配视图页
13. 与 GBE-Studio 的端到端联调（生成 → 投递 → 入库 → 浏览 → 下载 → **装配**）

**Phase 4 — 分发与消费入口**
14. REST API 完整化 + token 鉴权
15. CLI（search / pull / push / `assembly validate`）
16. Godot 插件（编辑器内搜索导入）→ Unreal 插件（**Unity 延后**，ADR-0004）

**Phase 5 — 规模化**
17. blobs 内容寻址去重 + 增量发布
18. 公网部署形态（对象存储 + CDN）
19. 合辑、对比视图、kit 覆盖度驱动生产计划（**冷启动的覆盖度缺口即生产排期**）

---

## 15. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 服务层成为不可绕过的单点 | 服务挂了库就用不了 | 资产实体始终权威、目录约定自洽；索引/派生皆可重建；CLI 可直连文件系统 |
| 派生缓存与实体不一致 | 下载到旧版本 | 缓存键 = `asset_id + version + source_hash`，实体变更即失效重跑 |
| 资产量增长后索引/预览渲染变慢 | 体验退化 | 索引增量化；预览渲染入队异步；缩略图预生成 |
| 多引擎包装需要各引擎环境 | 无法生成包装 | 包装为"可按需派生"态；无环境时降级为原格式下载 + 落地说明文档 |
| **冷启动无存量资产** | 覆盖度矩阵全空，前期"没东西可看" | ADR-0001 已接受此代价；用 kit 覆盖度矩阵**直接驱动生产排期**（§7），首批只铺「万安城主殿」所需构件 |
| 装配引用悬空（构件 `deprecated` 或版本不满足） | 建筑拼不起来 | 装配校验硬失败（CONVENTIONS §19.5）；`asset deprecate` 前先跑 `used-by` 影响面检查 |
| 引擎插件维护成本高 | 长尾负担 | 插件只做"搜索 + 下载 + 导入"三件事，逻辑集中在 API 侧；**Unity 插件延后**，当前只维护 2 套（ADR-0004） |
| 文档多方漂移 | 双库各照各的做 | 原则 5：文档同提交同步；CI 校验镜像表与真源一致 |

---

## 16. 与 GBE-Studio 的交接

```
GBE-Studio  ──投递──▶  <gbe-assets>/inbox/<asset-id>@<version>/
                          │  intake 流水线（复检 → 派生 → 索引 → move 归档）
                          ▼
                       kits/<kit>/<category>/<name>/     （构件资产）
                          │
                          ├──引用──▶ assemblies/<kit>/building/<name>.json  （L0 建筑装配清单）
                          │
        ┌─────────────────┼─────────────────┬──────────────────┐
        ▼                 ▼                 ▼                  ▼
     Web 浏览/下载     REST API          CLI              引擎插件
   （含装配视图）                                        （Godot / Unreal）
```

分工一句话：**Studio 负责"把东西做出来"，Assets 负责"让它被找到、被看清、被取走、被拼起来"**。

拆分工序与批次计划见 `gbe-studio/docs/BUILDING-DECOMPOSITION.md`；契约细节以 `docs/CONVENTIONS.md`（v1.2）为准。
