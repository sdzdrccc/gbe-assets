# GBE 决策记录（ADR）

> **地位**：GBE 双库的**决策台账**。每条决策一旦落入 ADR，即为已裁决状态；实现与文档不得与之相悖。
> **变更流程**：新增决策 = 追加条目，**不修改历史条目**；若需推翻，追加一条 `supersedes` 指向旧条目。
> **与 CONVENTIONS 的关系**：ADR 记录「为什么这么定」；`docs/CONVENTIONS.md` 记录「因此必须怎么做」。ADR 通过后必须**在同一提交内**把结论回写进 CONVENTIONS 与两份 PLAN（原则 5）。
>
> 当前状态：**ADR-0001 ~ ADR-0006 已生效（2026-09-15）**

---

## ADR-0001 — 存量原型资产不迁移，原型仓库冻结为只读归档

**状态**：已生效　**裁决人**：用户（大人）　**日期**：2026-09-15

### 背景

`tbg-assets/kits/cn-ancient/` 下有 16 件 v1 契约资产，是原型阶段的产出。审查（`CONVENTIONS-REVIEW.md`）已确认：

1. 存量 `source.refinement` 是**中文散文**（如「Blender 无头精修（render-preview.py）：…」），无法机械还原为可执行的 `RefineRecipe` → 迁移后**必然全部**带 `refine-unreproducible`。
2. 存量 `materials` 均为**空数组**，且 v1 没有槽位名 → `materials → slots[{slot, ref}]` 的 `slot` 名**无来源** → 迁移后**必然全部**带 `needs-material-review`。
3. 存量预览为 **300×300**，新约定要求 512 → 需全量重渲染。
4. 迁移表（CONVENTIONS §16）遗漏 `generated_at` / `raw_file` / `variants` / `license` / `author` 等 v1 既有字段，逐件核对需人工介入。

结论：**迁移的产出是一批"带两个标记、需要重做"的资产**——即迁移不产生可用资产，只产生待办清单。

### 决策

**不做存量迁移。** 具体：

1. `tbg-assets` / `tbg-3d` **冻结为只读原型归档**，不作为 GBE 的资产来源，不写入任何 GBE 索引。
2. `gbe-assets` 从**空库**起步，只服务新契约（`schema_version = "2"`）资产。
3. **删除**以下迁移相关设计（原 CONVENTIONS §16 与两份 PLAN 对应内容）：
   - `catalog/migration-exempt.json`（迁移豁免登记）
   - `services/migrate/`（v1→v2 迁移服务）
   - Web「迁移台账」页
   - `preview-legacy.png`（迁移前旧预览留档）
4. 原 §16 的 v1→v2 字段对照表**降级为历史参考**（保留知识，明确标注"不执行"），移入附录。
5. **但保留一条硬约束**：intake 遇到 `schema_version` 缺失或为 `"1"` 的包，**直接拒绝并报错**（不静默兼容），错误信息注明「v1 契约已废弃，原型资产不迁移，请用 v2 重新出包」。

### 影响

- 正面：Phase 0/1 少一整条迁移链路（脚本 + 服务 + 台账页 + 全量重渲染），交付面显著收窄。
- 负面：原型的 16 件资产**放弃复用**；如后续确实需要，走「v2 重新出包」路径（重新生成 + 精修 + 入库），而不是迁移。
- 副作用：Phase 1 的资产数**从 0 开始**，`cn-ancient` kit 的覆盖度矩阵初期全空——这反而让「按覆盖度缺口驱动生产」成为自然工作方式。

### 落地要求

- CONVENTIONS：`§16` 重写为「存量原型处置」，删除豁免登记相关条款；`§11` 删 `preview-legacy.png` 行；`§18` 删迁移豁免登记行。
- 两份 PLAN：删除迁移章节与服务；`gbe-assets/docs/PLAN.md` 路线图删除迁移步骤。

---

## ADR-0002 — 不接入 Hyper3D Rodin

**状态**：已生效　**裁决人**：用户（大人）　**日期**：2026-09-15

### 背景

Rodin 的核心优势是 **quad-dominant 拓扑最干净、4K PBR、保真最高**，适合 hero 英雄件。但其接入前提是 **Hyper3D Business 订阅（约 $120/mo）**，单件成本约 $0.5–1.5，是 Tripo 的 5–10 倍。若仅为绕过订阅而走 fal.ai 转调，则 Rodin 的「原生 quad 导出 + 高保真参数」能力会被聚合层削平，性价比进一步下降。

本项目当前需求以**传统建筑的构件与量产件**为主（屋顶 / 柱 / 墙 / 台基…），hero 件占比低——用季度订阅换低占比能力不划算。

### 决策

**不启用 Rodin。** 具体：

1. Provider 集合收敛为 **`tripo` / `meshy` / `hunyuan3d` / `fal`** 四家。
2. 从 CONVENTIONS §12 账本字段的取值示例、§5.2 平台条款清单、两份 PLAN 的接入矩阵中**移除 rodin**。
3. **但保留两件事**，避免未来重接时返工：
   - `core/policy/fallback.json` 保留 `rodin` 条目，状态标 `"enabled": false`（想启用时改一个布尔值，而不用改代码）。
   - `providers/_template/` 适配器模板保持与 rodin 同类平台同构，说明"新增平台 = 一个目录 + capabilities.json"这条抽象仍然成立。
4. 降级链相应更新为：**`meshy → fal → hunyuan3d`**（原链首的 `rodin` 移除）。

### 影响

- 负面影响：**quad 拓扑能力出现空档**。Tripo H3.1 提供有限 quad，但质量不如 Rodin。应对：
  - 需要干净 quad 的构件，改走 **Blender 重拓扑**（`refine` 层新增 `retopo` 步骤，用 Quadriflow / Instant Meshes）——把"买拓扑"换成"做拓扑"。
  - hero 件数量控制在个位数，重拓扑的人工成本可接受。
- 正面：省下订阅；少一个适配器与一条降级分支；provider 面从 5 家降到 4 家。

### 落地要求

- CONVENTIONS：§12 账本 provider 取值示例去掉 `rodin`。
- `gbe-studio/docs/PLAN.md`：§5.1 接入矩阵删除 Rodin 行；§5.2 降级链更新；§13 路线图 Phase 4「补 Meshy / Rodin / fal」改为「补 Meshy / fal」。
- `core/policy/fallback.json`：保留 `rodin` 条目但 `enabled: false`。

---

## ADR-0003 — 混元3D 采用三通道适配，按可用性自动降级

**状态**：已生效　**裁决人**：用户（大人）　**日期**：2026-09-15

### 背景

用户明确「**混元3D 官网上可以**」。经核实（2026-09），腾讯混元 3D 的官方接入存在**三条并行的技术通道**，能力与门槛各不相同：

| 通道 | 端点 / 形态 | 鉴权 | 能力 | 门槛 |
|---|---|---|---|---|
| `tokenhub` | `https://tokenhub.tencentmaas.com/v1/api/3d/submit` + `/v1/api/3d/query`，`model: hy-3d-3.1` | **Bearer API Key** | 文生 / 图生 3D；返回 obj/glb 直链 | 低（最简，**推荐默认**） |
| `tencentcloud` | `ai3d.tencentcloudapi.com`（`SubmitHunyuanTo3DProJob` / `RapidJob` + `Query*`）；或 `mps.tencentcloudapi.com`（`SubmitHunyuan3DTask`，**支持多视角图生**） | **TC3 签名**（SecretId / SecretKey） | 最全：Rapid 快 / Pro 精 / geometry-only 白模 / 多视角 | 中（需腾讯云账号与开通） |
| `web` | 官网网页版 `3d.hunyuan.tencent.com` | 登录态（浏览器） | 同上，人工交互 | 最低（无需任何 API 开通） |

**原文「官网」有歧义**：可能指官网网页版可用（无 API 权限），也可能泛指官方渠道可用。**不为此阻塞设计**——三通道统一封装，谁可用走谁。

### 决策

**混元3D 适配器实现为「一平台三通道」，通道可配置、可自动探测降级。**

1. `providers/hunyuan3d/capabilities.json` 声明 `channels: ["tokenhub", "tencentcloud", "web"]` 与各自能力差异。
2. `gbe.config.json` 中 `providers.hunyuan3d.channel` 显式指定；未指定时按 `tokenhub → tencentcloud → web` **探测可用性**，探测结果写入 `gbe-set` 体检报告。
3. `web` 通道是**半自动兜底**：生成需人工/浏览器自动化完成，产出文件由用户落到 `inbox` 或指定 raw 目录；适配器负责**登记 provenance**（平台、时间、提示词）而非提交任务。此通道下 `source.json.provenance.task_id` 允许为 `null`，但 `mode` / `prompt` 必填。
4. **`web` 通道的产出按"无 API 溯源"处理**：`provenance.channel = "web"`，并在 `flags` 不额外标记（这不是缺陷，是通道差异）；但 `gbe-cost` 账本要求**手工补记成本**（该通道不返回计费信息）。
5. 三通道的产出统一收敛为同一个 `GenerationArtifact`——**上层（精修 / 集成）不感知通道差异**。

### 影响

- 正面：无论用户最终拥有哪种权限，混元3D 都能接入；国内直连，是 fal / Meshy 的可靠性兜底。
- 正面：`geometry-only` 白模能力（`tencentcloud` 通道）对**构件拆分**特别有价值——拆件阶段只需要几何，不需要纹理（见 ADR-0006 与 `BUILDING-DECOMPOSITION.md`）。
- 负面：适配器复杂度高于其他平台（三通道）。缓解：通道差异被限制在 `providers/hunyuan3d/` 内，对外只暴露统一接口。

### 落地要求

- `gbe-studio/docs/PLAN.md` §5.1 混元3D 行需写明三通道；新增 §5.4「多通道平台的处理」。
- `provider id` 仍统一为 `hunyuan3d`（不带通道后缀）；通道记录在 `source.json.provenance.channel`。

---

## ADR-0004 — Unity 适配延后，引擎面先做 Godot + UE5

**状态**：已生效　**裁决人**：用户（大人）　**日期**：2026-09-15

### 背景

原方案把 Godot / Unity / UE5 三引擎并列，理由是「资产要能被三个引擎消费」。但实际生产链路当前只需要 **Godot**（主引擎）与 **UE5**（新增目标），Unity 没有在用的工程。而 Unity 适配的成本并不低：

- MCP 侧需在「CoplayDev / 官方 AI Assistant / Bluepuff71」三套实现间选型；
- 落地语义上 Unity 需要 `rotation: [0,180,0]` 的水平朝向修正 + glTFast 导入链验证；
- 引擎包装（prefab 模板 + mat-map）需单独一套派生模板。

### 决策

**Phase 1/2 只做 Godot + UE5。Unity 延后（未排期），但契约与抽象**不排除**它。**

1. **引擎注册表**（`core/registry/engines.json`）中 Unity 条目 `status: "deferred"`，保留字段定义但不出包装、不写适配器。
2. `asset.json.engines.*` 字段**保留 `unity` 键的定义**（schema 中为可选）——契约要能容纳未来引擎，不能因为今天不做就把字段删掉（删了将来是破坏性变更）。
3. `gbe-assets` 的 `derive --engine` 在 Unity 未启用时**明确报错**（"引擎未启用：unity"），而不是静默跳过或降级为原格式。
4. CONVENTIONS §1 的 Unity 行**保留**（知识正确），但加「启用状态：延后」标注——它是契约的一部分，不是实现的一部分。

### 影响

- 正面：Phase 2 工作量减约 1/3；MCP 选型的纠结（三套 Unity 实现）一并推迟；端口表少一个 8080 的占用争议。
- 负面：如果哪天要接 Unity，仍需补：适配器 + 包装模板 + MCP 选型 + 朝向修正验证。抽象层已预留，成本可控。
- 注意：**不要**因为 Unity 不做就把 §1 里的左右手系统一掉——UE 也是左手系，手性表的价值与 Unity 是否启用无关。

### 落地要求

- CONVENTIONS §1 Unity 行加启用状态注。
- 两份 PLAN 的引擎矩阵与目录结构中 Unity 标注为 `deferred`；路线图把 Unity 从 Phase 2 移出，列为「未排期」。
- `core/registry/engines.json` 中 Unity `status: "deferred"`。

---

## ADR-0005 — MCP 实现不固定，做「引擎 × 实现」可切换注册表

**状态**：已生效　**裁决人**：用户（大人）　**日期**：2026-09-15

### 背景

原方案给每个引擎**指定了一个首选 MCP + 若干备选**（如 UE5 首选 `sam-david/unreal-mcp`，备选 `ChiR24/Unreal_mcp`）。问题在于：

1. 这些都是**社区项目**，生命周期不稳定（改协议、停维护、换作者是常态）；
2. 「首选」是我基于 2026-09 快照做的判断，用户可能已经在用另一套、或更信任另一套；
3. 写死实现会把「引擎适配层」和「某个第三方 MCP」耦死，违背「新增引擎不改上层」的既有原则。

用户明确要求：**MCP 不固定一个，可选择。**

### 决策

**MCP 层做「引擎 × 实现」的注册表 + 运行时切换，不预设唯一实现。**

1. 新增 `gbe-studio/core/registry/mcp.json`，结构：

```jsonc
{
  "godot": {
    "active": null,                        // null = 尚未选择，gbe-set 会引导
    "implementations": [
      {
        "id": "yanhuifair-godot-mcp",
        "repo": "@yanhuifair/godot-mcp",
        "transport": "tcp",
        "port": 9876,
        "tool_count": 386,
        "requirements": ["编辑器插件", "项目已打开"],
        "verified_at": "2026-09"
      }
    ]
  },
  "unreal": { "active": null, "implementations": [ /* sam-david / ChiR24 / aadeshrao123 */ ] },
  "blender": { "active": null, "implementations": [ /* blender-mcp */ ] }
}
```

2. **`active` 决定当前生效实现**，通过 `gbe-engine mcp use <engine> <impl-id>` 切换；切换动作只改注册表 + 重写助手 MCP 配置，**不改任何上层代码**。
3. **适配器只依赖"语义动作"**（`probe` / `importAsset` / `instantiate` / `applyCollision` / …，共 8 个），由各实现自己声明映射表 `semantic_map.json`（语义动作 → 该 MCP 的具体工具名）。**新实现 = 新增一个 `implementations[]` 条目 + 一份映射表**，不需要改引擎适配器。
4. **能力差异显式声明**：每个实现声明 `supports: []`（如 `viewport_capture`、`undo`）。某实现缺某语义动作时，适配器**明确告知能力缺失**并给出替代路径，不静默失败。
5. Bridge Router（Phase 4）同样只依赖语义动作——**它聚合的是语义面，不是实现面**，因此换实现不影响 Router。

### 影响

- 正面：用户可自由选择/替换 MCP；社区项目失效时替换成本 = 一条注册表记录 + 一份映射表。
- 正面：语义动作层（8 个）成为真正的稳定接口，与实现解耦。
- 负面：需要为每个实现维护一份 `semantic_map.json`（首次接入的工作量略增）。
- 负面：不同实现的能力差异会让"同一段流程换实现后行为不同"——故 requirements 与 supports 必须如实声明，`gbe-set` 输出体检报告。

### 落地要求

- `gbe-studio/docs/PLAN.md` §7.2 引擎接入矩阵改为「实现注册表」形态 + 切换命令；§8 增「实现可切换」说明。
- 新增目录 `gbe-studio/core/registry/`（`mcp.json` / `engines.json` / `providers.json`）。
- 每个 `engines/<engine>/` 下新增 `semantic_map.json`。

---

## ADR-0006 — 场景建筑拆分：显式三级分层 + 模数网格 + 插槽拼装

**状态**：已生效　**裁决人**：用户（大人）　**日期**：2026-09-15

### 背景

用户提出新需求：**为「场景建筑」的拆分与细化做方案**。

现状问题：AI 生成平台（Tripo / Meshy / 混元3D）擅长产出**整栋建筑**的漂亮模型，但整栋模型**不可复用**——万安城要几十上百栋建筑，逐栋生成等于逐栋付费、逐栋精修、逐栋占内存，且风格必然发散。传统建筑恰恰是**高度模块化**的（材分制 / 斗口制是千年工程实践），不利用这一点是浪费。

### 决策

**把"生成建筑"改为"生成构件 → 拼装建筑"，并以显式三级分层 + 模数网格 + 插槽拼装作为落地机制。**

1. **三级分层**（与既有 `tier` 正交，是**几何粒度**而非**质量档位**）：

| 层级 | 语义 | 例子 | 是否可独立入库 |
|---|---|---|---|
| `L0` | 整栋建筑（装配结果） | 五开间歇山重檐大殿 | ✅（`buildings/*`，但通常只存 recipe，不存烘焙网格） |
| `L1` | 部位（大件） | 台基 / 柱网 / 屋身 / 屋顶 / 门窗 | ✅（`components/*`） |
| `L2` | 构件（可复用最小单元） | 檐柱 / 额枋 / 斗拱朵 / 脊筒 / 瓦面 / 墙段 | ✅（`components/*`，**主力产出**） |
| `L3` | 装饰细部 | 脊兽 / 悬鱼 / 雀替 / 门钉 | ✅（`components/*` 或 `props/ritual`） |

2. **模数网格**：一切构件按 `kit.json.grid`（`snap_m: 0.5` / `wall_module_m: 2` / `story_heights_m: 3|4` / `pillar_spacing_m: 2|4`）取整；**插槽位置必须落在网格上**——这是"AI 生成的构件能互相插得上"的唯一保证。
3. **插槽拼装**：构件通过 `sockets[]`（CONVENTIONS §9）对接，`mate_types` 声明可对接类型；装配由**声明式装配清单**（`assemblies/*.json`）描述，不是手工摆 Blender。
4. **两条产出路线**（详见 `BUILDING-DECOMPOSITION.md`）：
   - **路线 A｜构件直生**：直接用提示词生成**裸构件**（不带墙体/地面/场景），走声明式精修。适合标准化 L2（屋顶 / 柱 / 墙段 / 门）。
   - **路线 B｜整栋拆分**：生成整栋 → 语义切分 → 得到构件 → 逐个精修。适合 hero 建筑（L0/L1），且拆分产物必须**回填**为可复用构件，否则不予入库。
5. **零成本优先**：能用程序化生成的构件（柱、础、栏杆、直墙段、阶条石）**不进 AI 生成队列**，走 `tier: primitive` 的程序化生成——这是预算利用率最大的杠杆。
6. **装配结果不烘焙成新资产**：L0 建筑以**装配清单**（引用构件 id + version + 变换）形式存在，不入库烘焙网格。这样"改一根柱子样式"只需改一处。若某场景确实需要单网格（性能），走 `derive --bake` 生成**派生物**（可重建，不入库实体）。

### 影响

- 正面：**复用率**——一栋大殿拆出 ~40 个 L2 构件，另一栋不同开间的殿可复用其中 ~30 个；边际成本从「一栋一次生成」降到「几个新构件」。
- 正面：**风格收敛**——构件级统一模数与材质槽，"整城风格一致"从美术要求变成结构保证。
- 正面：**LOD 与碰撞更好做**——构件级 LOD 组合优于整栋 LOD。
- 正面：直接接上 `qiuyuan-dalu` 的万安城规划——城市 = 建筑 = 构件装配，可程序化铺排。
- 负面：**前期投入增加**——要建构件库、写装配清单、验证插槽对齐，前 10 栋建筑会比"直接生成整栋"慢。
- 负面：**AI 生成构件的成功率**需要实测（裸屋顶这类构件，现有提示词体系已在验证中）。
- 负面：装配清单是新的契约面，需进 schema 与 CI 校验。

### 落地要求

- 新增 `gbe-studio/docs/BUILDING-DECOMPOSITION.md`（主方案：分级、模数、拆分工序、装配、万安城落地）。
- CONVENTIONS 新增章节「构件分级与拼装契约」（分级表、插槽类型表、装配清单规则、LOD 继承规则、QA 判据）。
- schema 新增 `assembly.schema.json`（装配清单）；`asset.json` 增 `granularity`（`L0|L1|L2|L3`）字段。
- 分类枚举新增 `assemblies/`（装配清单）与 `components/` 的细化子类。

---

## 附录 A — 被 ADR-0001 废止的迁移对照表（历史参考，**不执行**）

> 以下内容原为 CONVENTIONS §16。因 ADR-0001 裁决「存量不迁移」，此表**降级为纯历史参考**，供未来需要时查阅 v1 字段语义。**任何脚本不得据此实现迁移逻辑。**

| v1（tbg-assets） | v2（GBE） | 原迁移动作（已废止） |
|---|---|---|
| `id` / `name` / `kit` / `category` / `tier` / `tags` | 同名 | 直通 |
| `dimensions_m` | `geometry.dimensions_m` | 确认轴序 = `[x 宽, y 高, z 深]` |
| `polycount` | `geometry.polycount` | 语义补注为**三角面** |
| `pivot` | `geometry.pivot` | 值必须 = `bottom-center` |
| （无） | `geometry.axis` | 固定 `{ "up": "+Y", "forward": "-Z" }` |
| （无） | `geometry.vertices` | 必须回读 glb 解析 |
| `lods.lod0/lod1/lod2` | `files.model.lod0/lod1/lod2` | 直通 |
| （无） | `files.preview` | 存量 300×300 需重渲染为 512 |
| `collision` 字符串 | `collision` + `files.collision` | 直通 |
| `materials: ["group/name"]` | `materials.slots: [{slot, ref}]` | slot 名 v1 无来源 |
| `sockets[]` | 同字段 + `mate_types` | 直通 |
| `variants: [...]` | `asset.variants`（内联） | 直通 |
| `license` / `author` | 同字段 | `license` 须为 SPDX |
| （无） | `version: "1.0.0"` / `schema_version: "2"` | 迁移默认 |
| （无） | `status` / `flags[]` | 按 §6 补 |
| `source.generator` | `provenance.provider` | `hunyuan-3d` → `hunyuan3d` |
| `source.credits` | `provenance.cost.value` + `unit` | unit 填 `unknown` |
| `source.generated_at` | `provenance.created_at` | 转 ISO 8601 带时区 |
| `source.refinement`（中文散文） | `refine` | **无法机械转换** |
| `source.raw_file` | `provenance.raw_ref` | 重命名 |

---
