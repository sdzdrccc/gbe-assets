# GBE 共享约定（CONVENTIONS）

> **地位**：GBE 双库（gbe-assets / gbe-studio）的**唯一共享约定**，Phase 0 权威文档。
> Schema 权威仍在 `catalog/schema/`；本文规定「两边都必须遵守、但不宜塞进单条 schema」的规则。
> **本文档中的枚举表与数值表是"人类可读镜像"**——机器可读真源见 §0.1，镜像与真源由 CI 校验一致。
> **变更流程**：只从本文件发起 → 同步 `catalog/schema/` 与 Studio 契约 → 双库适配；禁止任一侧私自发明第二套定义。
>
> 对应方案：`gbe-assets/docs/PLAN.md` · `gbe-studio/docs/PLAN.md` · `gbe-studio/docs/BUILDING-DECOMPOSITION.md`
> 决策依据：`docs/DECISIONS.md`（ADR-0001 ~ ADR-0006）
> **当前版本：v1.2（2026-09-15）** — 依 ADR-0001~0006 更新：存量不迁移、去 Rodin、混元3D 三通道、Unity 延后、MCP 可切换、新增构件分级与注册表

---

## 0. 原则

0. **决策先于文档**：任何影响双库的裁决先落 `docs/DECISIONS.md`（ADR），**在同一提交内**回写进本文件与两份 PLAN。禁止"先改文档、后补理由"——理由丢失会导致后人反复推翻。
1. **单一真源（机器可读）**：分类枚举 → `catalog/schema/asset.schema.json`；面数预算 / 网格模数 / 材质组 → `kits/<kit>/kit.json`；单位轴心朝向 / id 规则 → 本文件；**平台 / 引擎 / MCP 实现清单 → `core/registry/`（§20）**。**本文件里的表格是镜像，不是第二真源**；镜像必须与真源逐字一致，由 CI 校验（不一致即红）。脚本一律从真源读取，禁止硬编码第二份。
2. **语法单源，门禁双跑**：JSON Schema **语法校验器只保留一份**（`catalog/schema/` 导出，双库共用同一份依赖，见 §18）。**业务门禁**（面数 / 模数 / 材质 / 命名）在出包前与入库时**两处各跑一次**，但判据不是各写一套，而是**聚合读取同一组真源**：面数 ← `kit.json.budgets`、模数 ← `kit.json.grid`、分类 ← `asset.schema.json`、材质 ← `kit.json.materials`。要改门禁判据，改真源，不改脚本。
3. **实体权威，派生可重建**：`kits/` 资产实体是权威；索引、引擎包装、转盘、blobs 皆可重建缓存。
4. **精修只产引擎无关标准件**：坐标轴、单位、材质引用的引擎差异只在集成层 / `engines.*` 字段处理。
5. **四份文档必须同提交同步**：本文件、`catalog/schema/`、两份 PLAN（+ `BUILDING-DECOMPOSITION.md`）构成一组。任一处变更须在同一提交内同步其余；**"多方并存但不一致"是不可接受状态**，由 CI 检出（见 §18）。
6. **实现可替换，语义不变**：平台 / 引擎 / MCP 实现都是**可切换的注册表条目**（§20）。上层只依赖语义接口（providers 的 `submit/poll/fetch`、engines 的 8 个语义动作），**禁止把某个第三方实现的具名工具写进上层逻辑**。

---

## 1. 单位 · 轴心 · 朝向

| 项 | 标准 | 说明 |
|---|---|---|
| 单位 | **1 unit = 1 m** | 导出前 Apply Transform |
| 轴心 | **bottom-center** | 盒底面几何中心；分类细则见 Studio `pipeline/origin-rules.md`（须与本表一致，由 CI 校验） |
| Up | **+Y** | glTF / Godot / Unity 一致 |
| Forward | **-Z** | **glTF 基准**；精修层**禁止**为迁就引擎改朝向 |
| 尺寸轴序 | `geometry.dimensions_m = [x 宽, y 高, z 深]` | **顺序写死**，禁止按"宽高深"字面自由解释——引擎包装的包围盒与缩放全依赖此项 |
| Godot | 原样 | 右手系、+Y up、-Z forward、米。**启用** |
| Unreal | 集成层转换 | **左手系**、+Z up、+X 前、**cm**；常用 `scale: 100`，写入 `asset.engines.unreal`。**启用** |
| Unity | 集成层转换 | **左手系**、+Y up、+Z 前；常用 `rotation: [0, 180, 0]`，写入 `asset.engines.unity`。**启用状态：延后（deferred，ADR-0004）**——契约保留、实现未做 |

> **启用状态不改变契约**：Unity 虽延后，其行仍留在本表（手性知识正确且 UE 同为左手系，二者需一起理解）。`asset.json.engines.unity` 字段定义为**可选保留字段**，因今天不做而删除字段会造成未来的破坏性变更。

**禁止**：在 RefineRecipe 或 Blender 精修里写「面向 -Y / 面向场景主入口」等非 glTF 基准的朝向。历史文档（`tbg-assets/docs/RESTRUCTURE-PLAN.md` 中「面向 -Y」）作废，以本表为准。

**谁做轴转换（责任划分，防止双重转换）**：

- `+Y up / -Z forward` 是**交付基准**，资产包里永远是它。
- **up 轴的 Y→Z 转换由目标引擎的导入器负责**（UE Interchange、Unity glTFast、Godot 原生 glTF）——本库与集成层**不重复转换**，重复转换会得到"躺着的模型"。
- 集成层只负责三件事：① 单位缩放（UE `scale: 100`）；② **水平**朝向修正（Unity `rotation: [0,180,0]`，仅绕 Y）；③ 材质重映射。

**轴心与轴允不允许被 kit 覆盖**：**不允许**。`kit.json.axis` / `kit.json.pivot` 只是冗余声明，CI 校验其值必须等于本表；不一致以本表为准并报错。

**薄壳默认处理**：开放壳（屋瓦、顶棚等）在减面前必须 `solidify` 封底（默认厚度见 recipe，构件常见 0.05–0.06 m），保证 manifold；未封底不得出包。

---

## 2. 资产 id · 路径 · 版本

### 2.1 id 格式

```
<kit>.<category-leaf>.<name>
```

- 全小写，段内 `kebab-case`（不以数字开头、无连续连字符），段分隔 `.`。
- 示例：`cn-ancient.roof.xuanshan-single-a`
- **`category-leaf` = category 路径的最后一段**。完整分类仍写在 `asset.category`（如 `components/roof`），id 中段只用 `roof`。
- 全库唯一；重命名 = 新 id + 旧 id 进 `deprecated`（见 §6）。

### 2.2 目录路径

```
kits/<kit>/<category>/<name>/
```

- `category` 为完整相对路径（可多级），与 `asset.category` 一致。
- **校验不变式**：`<name>` 目录名**严格等于** `asset.id` 的第三段，**不带类别前缀**。
  - 对：`kits/cn-ancient/components/roof/xuanshan-single-a/` ⇄ `cn-ancient.roof.xuanshan-single-a`
  - 错：`kits/cn-ancient/components/roof/roof-xuanshan-single-a/`（多出 `roof-` 前缀，违反不变式）
- kit / category / name 三段必须能完整还原 `asset.id`。

### 2.3 版本与投递

| 场景 | 约定 |
|---|---|
| `asset.schema_version` | **契约版本**，字符串（当前 `"2"`），必填。intake 据此选择校验器；缺失按 v1 处理并**报错**，不静默兼容 |
| `asset.version` | **资产版本**，语义化 `MAJOR.MINOR.PATCH`，首次入库 `1.0.0` |
| 库内权威路径 | **不带版本目录**；同一路径下是当前 published 版本 |
| 历史版本 | **不进资产目录**。可选归档到库根 `_archive/<asset-id>/<version>/`（不参与扫描、不违 §2.2 不变式）；默认只在 index 记历史 + 标 `deprecated` |
| inbox 投递目录 | `inbox/<asset-id>@<version>/`；无 version 的包按 `0.0.0-draft` 处理 |
| intake 完成后的 inbox | **move 归档**（`inbox/<id>@<version>/` → `_archive/inbox/<id>@<version>/`），**禁止 `rm -rf`**（见 §15.2） |
| 同 id 重投 | 视为**新 version**；覆盖当前版需显式 `--force` 且写 intake diff |
| 同 id 异内容且未改 version | **拒绝入库** |

> 契约版本（`schema_version`）与资产版本（`version`）是两件事，不可混用。前者决定"用什么校验器"，后者决定"这是第几版资产"。

---

## 3. tier · 预算 · 模数

### 3.1 tier（质量档位）

| tier | 含义 | 默认来源 | 成本量级（参考） |
|---|---|---|---|
| `primitive` | 程序化基本体，近零生成成本 | 脚本生成 | 0 |
| `component` | 构件（屋顶/柱/墙…），常**无内嵌贴图** | AI 生成 + 声明式精修 | 约 30 credit |
| `mass` | 量产件（带贴图或更高面数） | AI 生成 | 约 40 credit |
| `hero` | 英雄件，允许人工精修 | 高保真平台 + 交互精修 | 50–60 credit |

> 成本量级与 §12 账本对应：tier 同时表达"质量档位"与"预算档位"。
> **tier 与 `granularity` 是两个正交维度**：tier 说"做多好"，granularity 说"拆多细"（§19）。一个 `primitive` 的檐柱与一个 `hero` 的檐柱，granularity 都是 `L2`。

### 3.2 面数预算（默认，可被 kit.json 覆盖）

| tier | max faces（三角面） |
|---|---|
| primitive | 5_000 |
| component | 20_000 |
| mass | 50_000 |
| hero | 100_000 |

- **真源**：`kits/<kit>/kit.json` → `budgets`；缺失时回退 `catalog.config.json` 默认表。
- 本表为**人类可读镜像**（§0.1），CI 校验其与 `catalog.config.json` 及 kit 声明一致。
- `geometry.polycount` 约定记为**三角面数**（tris），非多边形数。
- 脚本**禁止**内置另一套数字。

### 3.3 网格模数（cn-ancient 默认）

| 含义 | 字段（`kit.json.grid`） | 值 |
|---|---|---|
| 吸附网格 | `snap_m` | 0.5 m |
| 墙宽模数 | `wall_module_m` | 2 m |
| 层高 | `story_heights_m` | 3 / 4 m |
| 柱距 | `pillar_spacing_m` | 2 / 4 m |
| 地砖 | `ground_tile_m` | 2 m |

**字段名写死如上**。其它 kit 在各自 `kit.json.grid` 按同结构声明；**不得另起字段名**。
**模数是拼装的前提**（§19）：一切构件尺寸与插槽位置必须落在网格上，否则 AI 生成的构件互相插不上。

---

## 4. 分类枚举

- **真源**：`catalog/schema/asset.schema.json` 中 `category` enum；kit 可在 `kit.json.categories` 声明本 kit 启用子集。
- 生产端、仓储端、网页筛选、CLI 过滤**一律从 schema 读取**。
- 新增分类：改 schema → 升契约版本 → 双库 CI 跟红再修；禁止在 `pack.js` / `classify.js` 私自扩表。
- 下面这份全集是**人类可读镜像**（§0.1），CI 校验与 schema enum 一致；**不要把它当第二真源**。

```
components/{roof,wall,pillar,beam,bracket,base,door-window,railing,ornament}
buildings/{residential,commercial,palace,garden,religious,infrastructure}
props/{lighting,street,ritual,furniture,cultivation}
nature/{tree,rock,plant}
terrain/{ground-tile,cliff,water}
assemblies/{building,district}
```

> `components/ornament` 承载 L3 装饰细部（脊兽 / 悬鱼 / 雀替 / 门钉）；**`components/beam` 承载梁架枋檩**（额枋 / 平板枋 / 架梁 / 角梁 / 瓜柱——古建结构主体，缺此分类则无法表达"柱上层"）；`assemblies/` 存**装配清单**（JSON，非网格资产），见 §19。4。

---

## 5. 材质 · 许可 · 标签

### 5.1 材质

| 项 | 约定 |
|---|---|
| 共享材质 id | `<group>/<name>`，如 `roof-tile/qingwa`；小写 kebab |
| 材质组清单 | 真源 `kit.json.materials`（`group → [names]`）；`materials/index.json` 为派生索引 |
| 槽位 | `materials.slots[]`：`{ "slot": "<材质槽名>", "ref": "<group>/<name>" }` |
| **槽名标准词表** | `roof` / `wall` / `pillar` / `beam` / `bracket` / `base` / `door` / `window` / `railing` / `ornament` / `ground` / `trim`——**新增槽名须回写本表并同步 schema** |
| 无贴图构件 | **必须**声明共享材质槽；否则 intake 打 `needs-material-review` |
| 命名一致性 | `kit.json.materials`、`material-map.json`、实际 `.tres`/`.mat`/Web JSON **同名**；禁止 `jiu-mu` / `jiumu` 式漂移 |
| 引擎文件 | 权威参数 + Web 预览 JSON；`.tres`/`.mat` 为派生 |
| Web 预览 | 每种材质必须有可被 three.js 读取的 JSON（baseColor / roughness / metalness / map），供详情页切换材质 |

### 5.2 许可

| 项 | 约定 |
|---|---|
| 资产许可 | `asset.license` 必填，**SPDX 标识符**（本项目资产统一 `CC0-1.0`）；脚本许可 `MIT` |
| 平台条款 | AI 平台生成的资产须在 `source.json` 记明平台（取值见 §20.1）；再分发前确认各平台条款 |
| 缺省 | 无法确定时填 `NOASSERTION` 并打 `needs-review`——**不允许留空** |

### 5.3 标签

| 项 | 约定 |
|---|---|
| 语言 | 中文为主（与 `asset.name` 一致），可用英文补充专有名词 |
| 粒度 | 每个标签 2–6 字；词表内取值优先（屋顶五样式：悬山顶 / 歇山顶 / 庑殿顶 / 攒尖顶 / 盝顶） |
| 用途 | 进入 FTS 全文索引，是"按语义找回资产"的主通道；同一含义禁止多种拼写 |

---

## 6. 生命周期 `status`

```
draft ──▶ needs-review ──▶ published ──▶ deprecated
```

| status | 含义 | 谁可写 |
|---|---|---|
| `draft` | 打包中 / inbox 未确认 | Studio、intake 默认 |
| `needs-review` | 裸模型或元数据不全，待人工 | 上传兜底、QA |
| `published` | 可检索、可下载、可被引用 | intake 通过后人工或自动确认 |
| `deprecated` | 仍保留墓碑，不推荐新引用 | 显式下线 |

**并行标记（`asset.flags[]`，不是 status，不占 status 取值）**：

| 标记 | 含义 | 谁可写 |
|---|---|---|
| `needs-material-review` | 无贴图件未声明共享材质槽，或槽位待人工确认 | QA / intake |
| `refine-unreproducible` | 无 `recipe_hash`，精修过程不可回归（§7.2） | QA |
| `socket-unverified` | 插槽未通过网格对齐校验（§19.5） | QA |

**规则**：

- `status` 枚举**只有上表四个值**；`flags` 与 `status` **正交并存**——一个资产可以同时是 `published` 且带多个标记。
- 列表页默认只显示 `published`；`deprecated` 可搜到但带警告。
- 裸模型上传**禁止**自动分类进 `published`；只能 `needs-review` + 尽力统计。
- `deprecated` 必须写 `deprecated_by`（新 id）或 `deprecated_reason`；CLI pull 旧 id 时提示迁移。

---

## 7. recipe_hash（精修可回归）

### 7.1 定义

```
recipe_hash = sha256(
  canonical_json({
    "recipe_id": "<id>",
    "blender_major": "<如 4.5>",
    "steps": <steps 数组，键排序、去空白规范化>,
    "qa":    <qa 判据数组，同样规范化>
  })
).slice(0, 16)
```

- 对 **steps + qa + recipe_id + Blender 主版本** 哈希；注释、文件路径美化不影响 hash。
- **`qa` 必须纳入**：质检判据变了，产出的"合格"含义就变了，同一 hash 不能对应两套门禁。
- 写入 `source.json` → `refine.recipe_hash`（16 位 hex）。
- 配方文件变更且 steps 或 qa 变化 → hash 必变 → 可批量找出「旧配方资产」做回归重做。

### 7.2 交互精修回填

- hero / 人工路径允许临时 `refine.py` 交互，但**出包前必须回填**可执行的 `RefineRecipe`。
- **确无法回填时**，必须显式写 `refine.manual = true` + `refine.note`（操作摘要），并在 QA 打 `refine-unreproducible`；此类资产**不得**宣称 recipe 可回归。
- 回填后按 §7.1 重算 hash。
- `refine.note` 只记人可读摘要，**不进 hash**。

---

## 8. 资产包契约（交接物）

Studio → Assets 的唯一交接物：

```
<asset-id>@<version>/
├── model.glb            # LOD0，精修后，引擎无关
├── model-lod1.glb       # 可选
├── model-lod2.glb       # 可选
├── preview.png          # 必填：512×512，白底 3/4 视角
├── asset.json           # v2 元数据（含 schema_version / version / status）
├── source.json          # v2 溯源
└── collisions/          # 可选：convex 等
```

- 权威 schema：`catalog/schema/`（asset.v2 / source.v2）。
- Studio `pack` 与 Assets `intake` **共用同一份校验库**（§0.2 / §18），语法校验不双实现。
- 文件清单以 `asset.files` 为准；`engines/` 包装**不在投递包内**，由 Assets derive 生成。
- **`asset.variants` 为内联数组（权威形态）**，不拆分为独立 `variants.json`。
- `source.json.provenance.raw_ref` 是 **Studio 侧引用**（如 `raw/hunyuan3d_out.glb`），**不保证在库内存在**，Assets 不得据此定位文件。
- 「3/4 视角」约定：相机沿资产局部 `-Z` 方位水平偏 45°、俯角 30°，透视 50mm 等效，白底无阴影——多件资产缩略图一致性依赖此约定。
- **v1 包一律拒收**（ADR-0001）：`schema_version` 缺失或为 `"1"` 时 intake **直接报错**，提示「v1 契约已废弃，原型资产不迁移，请用 v2 重新出包」。

---

## 9. sockets（拼接口）

```jsonc
{
  "name": "ridge-west",
  "type": "ridge-point",          // 见 §9.1 类型表
  "position_m": [0, 2.4, 0],      // 局部空间，相对 bottom-center 轴心
  "direction": "+x",              // 对接件的接入方向，取值 +x|-x|+y|-y|+z|-z
  "mate_types": ["ridge-point"],  // 可选：允许对接的 type
  "grid_locked": true             // 可选：position 是否已吸附到 kit 网格（§19.5）
}
```

- 位置单位米；相对**本资产**轴心局部坐标（坐标系同 §1：+X 右 / +Y up / +Z 后）。
- **`direction` 语义 = 对接件从该方向接入**（即接口的外法线方向），**不是**"资产正面朝向"。`±y` 仅用于上下堆叠场景。
- component 类建议必填；buildings 可汇总对外接口。
- sockets 定义在 **LOD0**；LOD1/2 不重复定义，派生物直接继承。

### 9.1 socket `type` 类型表

| type | 用途 | 典型载体 | 对接规则 |
|---|---|---|---|
| `ground-foot` | 落地/承重面 | 台基、柱础、墙段底 | 与 `terrain/ground-tile` 或上一级承托面对接；`direction` 为 `-y` |
| `stack-up` | 竖向堆叠 | 柱顶、额枋上沿、斗拱上沿 | 与同轴向 `stack-down` 对接，`position` 的 Y 必须落在 `story_heights_m` 上 |
| `wall-line` | 墙线延伸 | 墙段两端、转角 | 同轴延续；相邻件 `position` 差必须为 `wall_module_m` 的整数倍 |
| `pillar-point` | 柱位 | 柱网节点、柱础 | 相邻件间距必须为 `pillar_spacing_m` 的整数倍 |
| `roof-seat` | 屋顶坐落 | 屋身顶面（承接屋顶） | 与 `roof-seat` 反向对接；承载件顶面必须水平 |
| `ridge-point` | 屋脊延续 | 正脊两端、垂脊下端 | 用于屋顶接续与重檐分层，`position` 按脊线连续 |
| `attach` | 通用附着 | 装饰件（`ornament`） | 单向挂接，不参与结构对齐；允许非网格落点 |
| `continue` | 重复阵列 | 栏杆、连廊、街墙 | 声明"沿 direction 按 `step_m` 重复"；`step_m` 必填 |
| `custom` | 其它 | — | 必须附 `note` 说明；**跨 kit 复用不允许出现 `custom`** |

> 类型表是**人类可读镜像**（§0.1），真源为 `catalog/schema/asset.schema.json` 中 `sockets[].type` enum。新增类型须同步三处。

### 9.2 socket 与装配的关系

- socket 是**几何对接点**；装配清单（§19.4）是**谁插谁**的声明。二者分离——构件不必知道自己在哪栋建筑里。
- 装配校验（§19.5）会检查：`mate_types` 互认、`direction` 反向、`position` 网格对齐、对接后**无穿插**、承重链**落地闭合**。

---

## 10. collision

| `asset.collision` | 含义 | `files.collision` |
|---|---|---|
| `box` | AABB，由引擎适配器生成 | `null` |
| `convex` | 凸包网格 | 路径，如 `collisions/convex.glb` |
| `none` | 无碰撞（装饰） | `null` |

引擎包装可再生成简单碰撞，但 **convex 显式网格以资产文件为准**。

---

## 11. 派生 · 压缩 · Git 边界

| 产物 | 权威？ | Git / LFS | 重建 |
|---|---|---|---|
| `model.glb` / lods / `preview.png` / collisions | ✅ | LFS | — |
| `asset.json` / `source.json` / kit.json / schema / assemblies | ✅ | 普通 Git | — |
| `engines/`（含 `source_hash` / `asset_version` 记录） | ❌ | **默认不入库** | `gbe derive --engine <n>` |
| `variants/`（`asset.variants` 的展开件） | ❌ | 默认不入库 | `gbe derive --variants` |
| `draco/`（Web 用 Draco 变体） | ❌ | 默认不入库 | `gbe derive --draco` |
| `textures/1k` · `textures/2k`（贴图规格变体） | ❌ | 默认不入库 | `gbe derive --textures` |
| `turntable/` · `preview.webp` | ❌ | 默认不入库 | `gbe derive --previews` |
| `index.db` · `blobs/` · `materials/index.json` | ❌ | 默认不入库 | `gbe reindex` / `gbe dedupe` |
| `baked/`（装配清单烘焙成的单网格，§19.6） | ❌ | 默认不入库 | `gbe derive --bake <assembly>` |
| `_archive/`（历史版本、已处理 inbox） | ✅ 只读留档 | 可 LFS，可选 | — |
| Studio 侧 raw 生成件 | 中间态 | 不入 Assets Git | — |

> **同资产的"Draco 版"与"原版"是两份产物**：Web 详情页用 Draco 版，引擎下载默认给原版（避免插件依赖）。二者都登记于本表，不视为新资产。

### 压缩策略

| 用途 | Draco | 贴图 |
|---|---|---|
| Web 浏览 / 详情页 | 开（`<model-viewer>` / three.js 自带 decoder） | ≤1024 缩略，主贴图按需 |
| Godot / UE 下载默认 | **关**（避免插件依赖） | 下载参数可选 1K/2K |
| CLI/API | `draco=on\|off` 显式参数 | 同上 |

---

## 12. 成本账本

| 项 | 权威 |
|---|---|
| CostLedger | **Studio**（生产侧唯一账本） |
| `source.json` 中 cost | 投递时的快照，Assets 只读用于展示与对账 |
| 闸门 | 单件预算、批次预算、平台余额兜底；余额不足**停止**，不静默重试 |

**记账字段（唯一字段集，双库共用，禁止改名）**：

```
provider_requested   -- 请求时指定的平台（可能是 auto）
provider_used        -- 实际出件的平台（降级后可能不同）
provider_channel     -- 实际使用的通道（多通道平台，如 hunyuan3d 的 tokenhub|tencentcloud|web）
job_id / asset_id / tier
cost / unit / usd_est
balance_after / balance_source   -- balance_source：余额来源（主账号 / 子账号 / CLI OAuth）
```

**平台取值**（`provider_requested` / `provider_used`）：`tripo` | `meshy` | `hunyuan3d` | `fal`（启用的四家，见 §20.1）。
`web` 通道产出的成本需**手工补记**（该通道不返回计费信息）。

禁止两边各记一本可写的账。

---

## 13. 凭证与安全

- 平台密钥只在 `~/.gbe/credentials.json`（或 CLI OAuth）；**永不进 Git、对话、日志、截图、source.json**。
- `source.json` / 日志只记 `task_id`，不记账号、token、Cookie。**但 `source.json` 允许记 `provenance.provider` 平台名**（非凭证）。
- 日志统一脱敏：`sk-***`、`Bearer ***`。
- 本机路径配置（`gbe.config.json` / 历史 `config.json`）一律 gitignore，且 **禁止 `git add -A` 误提交**。

---

## 14. 上传兜底 vs 生产端主通道

| 通道 | 元数据 | 分类 | 终态 |
|---|---|---|---|
| Studio 投递（主） | 生成时语义已知，schema 校验通过 | 权威 | intake → `published`（可并带 `needs-material-review` / `refine-unreproducible` / `socket-unverified` 标记） |
| 网页裸模型（兜底） | 不全 | **只打 `needs-review`，自动分类仅作建议** | 人工确认后转 `published` |

- 注意：`flags` 是**标记**而非 `status`（§6）；上表"终态"一律指 `status` 取值。
- Assets 侧**不得**维护权威 classify；建议分类可来自生产端共享规则，结果只写入 `meta.suggested_*`，确认前不覆盖权威字段。

---

## 15. 硬性禁令（原型血泪，写入 CI / AGENTS）

1. 禁止硬编码第二份 category 枚举、面数预算、网格模数、材质表、**平台/引擎/MCP 实现清单**。
2. 禁止 `rm -rf` 投递目录或资产目录；同 id 异内容未升 version **直接报错**。（intake 完成后对 inbox 一律 **move 归档**，不删除）
3. 禁止配置文件、凭证、本机绝对路径进 Git。
4. 禁止开放壳未 solidify 封底就减面出包。
5. 禁止预算以脚本内置值覆盖 kit.json。
6. 禁止未通过 `validate` 的资产进入 `published`。
7. 禁止精修层修改 forward/up 以适配 Unity/UE；也**禁止在集成层重复做 up 轴转换**（§1）。
8. 禁止 JSON Schema 语法校验器双实现（业务门禁可双跑，语法校验必须单源）。
9. 禁止把本文档的镜像表当真源去改代码——改真源（schema / kit.json / 本文件 / `core/registry/`）。
10. 禁止把某个 MCP 实现的**具名工具**写进引擎适配器或上层流程；只能依赖 8 个语义动作（§20.3）。
11. 禁止静默兼容 v1 契约包（ADR-0001）——一律报错拒收。
12. **禁止装配清单引用未注册的 socket 类型，或引用非网格对齐的插槽**（§19.5）。

---

## 16. 存量原型处置（不迁移）

> 依 **ADR-0001**。本节取代 v1.1 的「v1 → v2 字段迁移对照」。

### 16.1 决策

**不做存量迁移。** `tbg-assets` / `tbg-3d` 冻结为**只读原型归档**，不作为 GBE 的资产来源，不写入任何 GBE 索引。`gbe-assets` 从**空库**起步。

理由（摘要，详见 ADR-0001）：存量 16 件按 v1→v2 映射后**必然全部**带 `refine-unreproducible`（`source.refinement` 是中文散文，无法还原为 recipe），`materials` 空者**必然**带 `needs-material-review`——迁移只产出待办清单，不产出可用资产。

### 16.2 因此删除的设计

| 已删除 | 原因 |
|---|---|
| `catalog/migration-exempt.json` | 无迁移即无豁免需求 |
| `services/migrate/` | 同上 |
| Web「迁移台账」页 | 同上 |
| `preview-legacy.png` | 无迁移前旧图需要留档 |
| CONVENTIONS 原 §16 迁移对照表 | 降级为 `DECISIONS.md` 附录 A（历史参考，**不执行**） |

### 16.3 保留的硬约束

- **v1 包一律拒收**：intake 遇到 `schema_version` 缺失或为 `"1"`，**直接报错**，不静默兼容（§15.11）。
- 若将来确需原型的某些资产，走 **v2 重新出包**（重新生成 → 精修 → 入库），而不是迁移。
- `tbg-*` 仓库**不删除**：作为经验与提示词的来源保留，但**不参与任何自动化**。

### 16.4 v1→v2 字段对照表

见 `docs/DECISIONS.md` **附录 A**（标注为历史参考，任何脚本不得据此实现迁移逻辑）。

---

## 17. Phase 1 端到端验收 DoD（双库联调）

同时满足才算 Studio Phase 1 + Assets 浏览 MVP 可关：

1. ≥2 个 provider 各产出 1 件 `component` 或以上资产（**provider 面已收敛为 4 家**，§20.1）；
2. 同一 `RefineRecipe` 重复执行，关键统计一致。**容差**：面数与顶点数**严格相等**；`dimensions_m` 各轴 ±1e-3 m；轴心位置 ±1e-4 m。Blender 主版本升位导致超差时，视为"配方需重新基线"，更新 `recipe_hash` 并记入变更日志；
3. QA Gate 出包通过，且 `recipe_hash` 非空（**含 qa**，§7.1）；
4. 投递 `inbox/<id>@<version>/`，Assets intake **无 error 且无 warning**（无豁免通道，ADR-0001）；
5. 索引可 `reindex` 重建，网页列表 / 详情可预览；
6. 按引擎下载 **Godot 或 Unreal** 包装成功（至少 1 个引擎；**Unity 延后，不计入**，ADR-0004）；
7. CostLedger 有账，`provider_used` 正确（发生降级时 `provider_used ≠ provider_requested`；多通道平台另记 `provider_channel`，§12）；
8. `validate` CI 在双库均绿；
9. **文档多方一致**：CONVENTIONS / `catalog/schema/` / 两份 PLAN / `BUILDING-DECOMPOSITION.md` 无冲突（CI 校验镜像表与真源一致）。
10. **（新增）** 至少 1 件构件具备完整 `sockets[]` 且通过网格对齐校验（§19.5），并可被一条装配清单引用成功装配。

---

## 18. 文档与代码归属

| 内容 | 位置 |
|---|---|
| 本约定 | `gbe-assets/docs/CONVENTIONS.md`（权威） |
| 决策台账（ADR） | `gbe-assets/docs/DECISIONS.md`（权威，只追加） |
| 资产包 schema（机器可读真源） | `gbe-assets/catalog/schema/` |
| 校验器实现 | `gbe-assets/packages/schema/`，导出 npm 包形态 `@gbe/schema`（含 JSON Schema + `validate.js`） |
| Studio 引用方式 | 开发期 `file:../gbe-assets/packages/schema`；CI 期用 **git submodule 锁 commit**。**禁止拷贝副本**（拷贝即违反 §0.2） |
| 生成 / 精修 / 引擎契约 | `gbe-studio/core/contracts/` |
| **平台 / 引擎 / MCP 实现注册表** | `gbe-studio/core/registry/`（`providers.json` / `engines.json` / `mcp.json`），见 §20 |
| 端口表（**全项目唯一真源**） | `gbe-assets/catalog/ports.json`（含 studio 桥端口与 assets 服务端口） |
| Studio 端口视图 | `gbe-studio/bridges/registry.json` — **由真源生成 / 校验的只读视图**，启动前仍做冲突探测；不得作为第二真源 |
| 轴心分类细则 | Studio `pipeline/origin-rules.md`（须与 §1 一致，由 CI 校验） |
| 场景建筑拆分方案 | `gbe-studio/docs/BUILDING-DECOMPOSITION.md`（流程权威；契约部分见本文件 §19） |

---

## 19. 构件分级与建筑拼装契约

> 依 **ADR-0006**。流程与工序见 `gbe-studio/docs/BUILDING-DECOMPOSITION.md`；本节只规定**契约**（分级取值、插槽规则、装配清单格式、校验判据）。

### 19.1 granularity（几何粒度，与 tier 正交）

| 取值 | 语义 | 典型 `category` | 是否入库 | 面数参考 |
|---|---|---|---|---|
| `L0` | 整栋建筑（装配结果） | `assemblies/building` | 只存**装配清单**，不存烘焙网格 | — |
| `L1` | 部位（大件） | `components/*`（台基 / 柱网 / 屋身 / 屋顶） | ✅ | ≤ `mass` 预算 |
| `L2` | 构件（可复用最小单元） | `components/*`（檐柱 / 额枋 / 斗拱朵 / 脊筒 / 瓦面 / 墙段） | ✅（**主力产出**） | ≤ `component` 预算 |
| `L3` | 装饰细部 | `components/ornament` · `props/ritual` | ✅ | ≤ `component` 预算 |

- `asset.granularity` **必填**（v2 新增字段）；missing → schema 拒绝。
- 真源：`catalog/schema/asset.schema.json` 的 `granularity` enum。本表为镜像。

### 19.2 模数约束（拼装可插上的前提）

一切 `L1`–`L3` 构件的以下量必须落在 `kit.json.grid` 网格上：

| 量 | 约束 |
|---|---|
| `geometry.dimensions_m` 的水平轴（x / z） | `wall_module_m`（2 m）的整数倍；细部件（斗拱 / 门窗 / 脊件）可放宽为 `snap_m / 2`（**0.25 m**）的整数倍 |
| 竖向堆叠高度 | 落在 `story_heights_m`（3 / 4 m）上 |
| 柱位间距 | `pillar_spacing_m`（2 / 4 m）的整数倍 |
| `sockets[].position_m` | 各轴**必须**为 `snap_m`（0.5 m）的整数倍（`attach` 类型除外） |

**两级模数**：`snap_m`（0.5 m）是**定位网格**，用于一切插槽位置与结构对齐；`snap_m / 2`（0.25 m）是**造型网格**，只用于细部构件的外部尺寸（斗拱层高 0.75 / 1.0 m、脊件 0.25 m 级）。**插槽位置不得使用造型网格**——定位一松，跨构件拼装就散了。

**例外**：`L3` 装饰件与 `attach` 类插槽允许非网格落点，但必须在 `asset.json` 标 `grid_exempt: true` 并附理由。

### 19.3 插槽（socket）

类型表与语义见 **§9.1 / §9.2**。本节约定的额外要求：

- `L2` 及以上构件**必须**声明 `sockets[]`（至少 1 个）；无插槽的构件只能作为装饰件（`attach` 单挂）。
- 插槽命名 `kebab-case`，建议 `<位置>-<轴向>`（如 `base-south` / `top-center`）；**同名插槽在一个资产内唯一**。
- 插槽的 `position_m` 相对 bottom-center 轴心、取 LOD0 几何。

### 19.4 装配清单（`assemblies/*.json`）

L0 建筑以**声明式装配清单**存在，引用构件 id + version + 变换：

```jsonc
{
  "schema_version": "2",
  "id": "cn-ancient.assembly.wanan-hall-main",
  "name": "万安城主殿·装配清单",
  "kit": "cn-ancient",
  "granularity": "L0",
  "grid_snap_m": 0.5,
  "instances": [
    {
      "instance_id": "base-01",
      "asset": { "id": "cn-ancient.base.podium-three-step-a", "version": "^1.0.0" },
      "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": 1 },
      "sockets": { "top-center": "colonnade-01::foot" }   // 本件插槽 → 对端件::插槽
    },
    {
      "instance_id": "roof-01",
      "asset": { "id": "cn-ancient.roof.xieshan-double-a", "version": "^1.0.0" },
      "transform": { "position": [0, 6, 0], "rotation": [0, 0, 0], "scale": 1 },
      "sockets": { "roof-foot": "colonnade-01::roof-seat" }
    }
  ],
  "params": { "bays": 5, "bay_width_m": 4, "story_count": 2 },   // 可选：参数化变体
  "derived_from": null                                            // 若由参数化模板生成，记模板 id
}
```

**规则**：

- 装配清单是**权威**（可重建装配结果）；烘焙网格是派生物（§11 `baked/`）。
- 引用必须写**版本范围**；解析时取满足范围的最高 `published` 版本。
- `sockets` 映射是**单向声明**（A 的插槽 → B 的插槽），校验器验证 B 侧存在反向匹配。
- **禁止在装配清单里放几何数据**（坐标只能是实例变换）；几何一律在构件资产里。
- 装配清单**不参与** `kits/` 的 folder-per-asset 扫描——它位于 `assemblies/`，按 id 索引。
- 修改构件 → 所有引用它的装配清单**不受影响**（引用不变），但装配结果会变；影响面由 `gbe assembly impact <asset-id>` 列出。

### 19.5 装配校验（QA 判据）

`gbe assembly validate <id>` 必须全绿：

| 判据 | 失败处理 |
|---|---|
| 所有引用的 `asset.id` + `version` 在库中存在且 `published` | 报错 |
| 插槽映射的两端都存在，且 `mate_types` 互认 | 报错 |
| 对接的 `direction` 互为反向（`+x` ↔ `-x`） | 报错 |
| 对接后 `position` 重合（容差 1e-3 m） | 警告 |
| 所有插槽 `position_m` 网格对齐（§19.2） | 打 `socket-unverified`（若 `grid_exempt` 则不检查） |
| 装配后**无几何穿插**（抽检 AABB 相交 + 采样） | 警告 |
| **承重链落地闭合**：每个实例都可追溯至至少一个 `ground-foot` 承接面 | 报错 |
| 装配总面数在场景预算内（由目标场景声明） | 警告 |

### 19.6 烘焙（可选派生）

需要单网格（性能 / 导出）时：`gbe derive --bake <assembly-id>` → 输出 `baked/<assembly-id>.glb`。

- 烘焙结果**不入库实体**，是派生物（§11）；清单一变即失效。
- 烘焙必须保留材质槽映射（不合并材质），否则无法回写。
- 烘焙件**不参与** `published` 状态——它没有独立 id。

---

## 20. 注册表（Provider / Engine / MCP）

> 依 **ADR-0002 / 0003 / 0004 / 0005**。三张注册表是「平台 / 引擎 / MCP 实现」的**机器可读真源**，位于 `gbe-studio/core/registry/`。本节表格是**镜像**。
> **共同原则**：一切"启用什么"由注册表的 `enabled` / `active` 字段决定，**不写死在代码里**（§15.1、§15.10）。

### 20.1 Provider 注册表（`core/registry/providers.json`）

| id | 状态 | 接入方式 | 通道 | 角色 |
|---|---|---|---|---|
| `tripo` | ✅ enabled | `tripo` CLI（OAuth 本地凭证） | 单一 | 默认主力（快 / 便宜 / 低模友好） |
| `meshy` | ✅ enabled | REST API | 单一 | 角色 / 动画 / 贴图重做 |
| `hunyuan3d` | ✅ enabled | 见下 | **多通道**：`tokenhub` / `tencentcloud` / `web` | 国内直连兜底 + 白模构件 |
| `fal` | ✅ enabled | REST（单 key 聚合多家模型） | 单一 | 聚合兜底 + 长尾模型 |
| `rodin` | ❌ disabled | — | — | 不接入（ADR-0002）；条目保留以便未来改一个布尔值启用 |
| （本地开源） | ⏸ 未排期 | 自托管 | — | 批量草稿 / 隐私敏感，按需 |

- **平台取值**（用于 `asset.json` / 账本 / `source.json.provenance.provider`）：`tripo` | `meshy` | `hunyuan3d` | `fal`。
- 降级链（`core/policy/fallback.json`）：**`meshy → fal → hunyuan3d`**。
- 每个 provider 一份 `capabilities.json`（模式 / 拓扑 / 格式 / 并发 / 计费单位 / 区域）。

**hunyuan3d 三通道能力差异**：

| 通道 | 鉴权 | 能力 | 门槛 |
|---|---|---|---|
| `tokenhub` | Bearer API Key | 文生 / 图生 3D，返回 obj/glb 直链 | 低（**推荐默认**） |
| `tencentcloud` | TC3 签名 | 最全：Rapid / Pro / **geometry-only 白模** / 多视角 | 中 |
| `web` | 浏览器登录态 | 同官网网页版，人工交互 | 最低（半自动兜底） |

- `web` 通道为**半自动**：适配器不提交任务，只登记 provenance；`task_id` 允许 `null`，`mode` / `prompt` 必填；成本需手工补记（§12）。

### 20.2 Engine 注册表（`core/registry/engines.json`）

| id | 状态 | 端口 / 传输 | 备注 |
|---|---|---|---|
| `godot` | ✅ enabled | TCP 9876（MCP 写死） | 主引擎 |
| `unreal` | ✅ enabled | UDP 6776 + HTTP 30010 | 零编译路线优先 |
| `blender` | ✅ enabled | TCP 9877 | 精修主通道（非落地引擎） |
| `unity` | ⏸ **deferred** | （预留 HTTP 8080） | ADR-0004：延后，契约保留、实现未做 |

- `derive --engine <id>` 遇到 `deferred` 引擎**明确报错**（"引擎未启用"），不静默跳过、不降级为原格式。
- 每个引擎适配器必须实现同一组 **8 个语义动作**：`probe` / `importAsset` / `instantiate` / `applyCollision` / `remapMaterials` / `registerScene` / `verify` / `undo`。

### 20.3 MCP 实现注册表（`core/registry/mcp.json`）

**「引擎 × 实现」多对多，不预设唯一实现。**

```jsonc
{
  "godot": {
    "active": null,
    "implementations": [
      { "id": "yanhuifair-godot-mcp", "repo": "@yanhuifair/godot-mcp",
        "transport": "tcp", "port": 9876, "tool_count": 386,
        "requirements": ["编辑器插件", "项目已打开"],
        "supports": ["probe","importAsset","instantiate","applyCollision","remapMaterials","registerScene","verify","undo"],
        "verified_at": "2026-09" }
    ]
  },
  "unreal": { "active": null, "implementations": [ /* sam-david / ChiR24 / aadeshrao123 */ ] },
  "blender": { "active": null, "implementations": [ /* blender-mcp */ ] }
}
```

**规则**：

- `active` = 当前生效实现；`null` 表示未选择，`gbe-set` 引导用户选择。
- 切换：`gbe-engine mcp use <engine> <impl-id>` —— 只改注册表 + 重写助手 MCP 配置，**不改上层代码**。
- 适配器通过 `engines/<engine>/semantic_map.json`（语义动作 → 该实现的具体工具名）调用；**新实现 = 一条注册表记录 + 一份映射表**。
- `supports` 未覆盖某语义动作时，适配器**明确报告能力缺失**并给替代路径，不静默失败。
- Bridge Router（Phase 4）聚合的是**语义面**而非实现面，因此换实现不影响 Router。

---

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-09-15 | 初稿：合并双库方案评审结论，固定单位/轴心/朝向、id·version、预算单源、status、recipe_hash、材质、派生边界、账本归属、硬性禁令、迁移对照与 Phase 1 DoD |
| 2026-09-15 | **v1.1 三方对齐**（依 `docs/CONVENTIONS-REVIEW.md`）：① 明确"本文档表格 = 镜像、真源在 schema / kit.json"，新增原则 5（三份文档同提交同步）；② 校验器统一为"语法单源 / 门禁双跑"；③ inbox 统一 `inbox/<id>@<version>/`，intake 完成后 **move 归档**而非删除；④ §1 **修正 UE 为左手系**，新增尺寸轴序、轴转换责任划分、kit 不可覆盖 axis/pivot；⑤ §2.2 目录名**严格等于** id 第三段（去 `roof-` 前缀）；⑥ §2.3 区分契约版本 `schema_version` 与资产版本 `version`；⑦ §6 明确 flags 为**并行标记**；⑧ §7.1 `recipe_hash` **纳入 `qa`**；⑨ §8 补 `variants` 权威形态、`raw_ref` 语义、3/4 视角约定；⑩ §9 定义 `direction` 语义与 LOD 继承；⑪ §11 补登 Draco / 贴图变体 / variants 展开 / `_archive`；⑫ §12 账本定为 `provider_requested` + `provider_used` + `balance_source`；⑬ §5 增补许可（SPDX）与标签规则；⑭ §16 迁移表补全遗漏字段；⑮ §17 DoD 增容差与三方一致性检查；⑯ §18 端口表迁至 assets 自持 |
| 2026-09-15 | **v1.2 决策回写**（依 `docs/DECISIONS.md` ADR-0001~0006）：① §16 整节重写为「存量原型处置（不迁移）」，删除 migration-exempt / migrate 服务 / 迁移台账 / preview-legacy，v1→v2 对照表降级为 DECISIONS 附录 A（ADR-0001）；② §15 新增禁令 11（禁静默兼容 v1 包）；③ §20.1 Provider 去 `rodin`（`disabled` 保留条目）、降级链改 `meshy → fal → hunyuan3d`（ADR-0002）；④ §20.1 增 `hunyuan3d` 三通道（`tokenhub`/`tencentcloud`/`web`），§12 账本增 `provider_channel`（ADR-0003）；⑤ §1 / §20.2 标注 Unity 为 `deferred`，`engines.unity` 字段保留（ADR-0004）；⑥ §0 新增原则 6（实现可替换、语义不变），新增 **§20 注册表**（Provider / Engine / MCP），§15 新增禁令 10（禁写死具名 MCP 工具）（ADR-0005）；⑦ 新增 **§19 构件分级与建筑拼装契约**：`granularity` L0–L3、模数约束、插槽类型表（§9.1 新增）、装配清单格式、装配校验判据、烘焙派生（ADR-0006）；⑧ §4 分类枚举增 `components/ornament` 与 `assemblies/`；⑨ §5.1 新增槽名标准词表；⑩ §11 增 `baked/` 派生行；⑪ §17 DoD 第 4/6/7/9 项调整并新增第 10 项（插槽+装配验收）；⑫ §0 新增原则 0（决策先于文档） |
