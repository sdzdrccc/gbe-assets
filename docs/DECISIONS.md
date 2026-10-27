# GBE 决策记录（ADR）

> **地位**：GBE 双库的**决策台账**。每条决策一旦落入 ADR，即为已裁决状态；实现与文档不得与之相悖。
> **变更流程**：新增决策 = 追加条目，**不修改历史条目**；若需推翻，追加一条 `supersedes` 指向旧条目。
> **与 CONVENTIONS 的关系**：ADR 记录「为什么这么定」；`docs/CONVENTIONS.md` 记录「因此必须怎么做」。ADR 通过后必须**在同一提交内**把结论回写进 CONVENTIONS 与两份 PLAN（原则 5）。
>
> 当前状态：**ADR-0001 ~ ADR-0009 已生效**（0001~0007 · 2026-09-15；0008 · 2026-10-12；0009 · 2026-10-27）

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

## ADR-0007 — 官方 MCP 进注册表，引入「来源 / 版本区间 / 成熟度」三维度，但不预设首选

**状态**：已生效　**裁决人**：用户（大人）　**日期**：2026-09-15

### 背景

ADR-0005 裁决「MCP 不固定唯一实现」时（同日），`unreal` 段收录的是 3 个**社区**实现（`sam-david` / `ChiR24` / `aadeshrao123`）——当时视野中不存在官方实现。

核查 2026-09 生态后发现两件事实，注册表的前提随之失效：

1. **UE 5.8（2026-06-17 发布）首次内置官方 MCP 插件**（Experimental）：把 MCP server 嵌进编辑器进程，本地回环绑定 `http://127.0.0.1:8000/mcp`；配套 `AllToolsets` 插件；通过 `Toolset Registry` 机制（继承 `UToolsetDefinition` 即自动暴露为 JSON-RPC tool）可扩展；`ModelContextProtocol.GenerateClientConfig` 一条命令生成客户端配置。
2. **5.8 是 UE5 计划内最后一个版本**；UE6 目标 2027 底 Early Access，且 Epic 明示 **UE6 将把 MCP 做成一等公民**（State of Unreal 2026 三大方向之一，含 Claude / Gemini 集成）。

结论：**注册表缺一条**。更根本的是，注册表原先只有「社区项目之间怎么选」这一个维度，而官方实现与社区实现**不是同类选项**——可靠性来源、引擎版本覆盖、扩展方式都不同，扁平列表表达不了。

且官方实现带来一个 ADR-0005 未覆盖的能力差异：社区实现是「**把语义动作映射到它已有的工具名**」；官方插件暴露的是引擎操作工具（actor / 蓝图 / 材质 / Niagara / Sequencer），**不含 GBE 的 8 个语义动作**，要自己写 Toolset 才有可映射的工具名。即：**前者是"填映射表"，后者是"写实现"**——工作量与可控性不在同一量级。

### 决策

**官方实现进注册表，但不设为默认；条目新增三个维度以表达「官方 vs 社区」的取舍。**

1. `core/registry/mcp.json` 的 `unreal` 段新增 `unreal-official-mcp` 条目（`source: "first-party"`）。**不改 `selection_policy.preselect = false`**——ADR-0005 的「不预设唯一实现」继续有效。

2. **条目新增三个字段**，并回填全部既有实现：

| 字段 | 取值 | 用途 |
|---|---|---|
| `source` | `"first-party"` \| `"community"` | 可靠性来源：跟引擎发布周期 vs 依赖维护者 |
| `engine_version_range` | SemVer 区间串 \| `null` | 先按此过滤，避免选到与当前引擎不兼容的实现。**`null` = 未核实，不等于「无限制」** |
| `maturity` | `"experimental"` \| `"beta"` \| `"stable"` \| `"unknown"` | 官方的 Experimental 标注必须如实反映，**不得因「官方」就当稳定**；未核实者填 `unknown`，**不允许替它猜一个看起来体面的值** |

> 为什么给 `maturity` 留 `unknown`：本项目的既有纪律是「**如实报告比漂亮的零警告诚实**」（见 `gable-board-a` 厚度警告的保留决策）。若不留 `unknown`，回填时只能二选一——要么标 `stable`（撒谎），要么标 `experimental`（同样是撒谎）。**枚举缺一个"不知道"，就会逼出假数据。**

3. **`selection_policy` 增 `preference_rules`（偏好提示，非自动选定）**：

   - ① 先按 `engine_version_range` 过滤掉与当前引擎版本不兼容的实现；
   - ② 要长期稳定、或要让 8 个语义动作由自己掌控 → 倾向 `first-party`（代价：需自行实现 Toolset）；
   - ③ 要零编译，或引擎版本 < 5.8 → 倾向 `community`；
   - ④ 以上均为**提示**，最终仍由用户在 `gbe-set` 中选择。

4. **官方实现的 `semantic_map` 显式置 `null` 并记录阻塞原因**，不写空壳映射表：

```jsonc
"semantic_map": null,
"semantic_map_blocked_by": "官方插件暴露的是引擎操作工具，不含 GBE 语义动作；需先实现 GBE Toolset（继承 UToolsetDefinition，C++ 或 Python）才有可映射的工具名"
```

   理由：ADR-0005 的既有纪律是「禁止猜测工具名」（见 `engines/unreal/semantic_map.json` 的 `status: "unmapped"`）。本次的阻塞**不是「还没查」，而是「工具还不存在」**——写一份全 `null` 的映射表会掩盖这个区别。

5. **官方实现的 `supports` 标为「设计上齐全」，但必须注明前提**：Toolset 由我们自己实现，不受第三方工具面限制，理论上 8 个动作都能有；但在 Toolset 落地前**实际可用为 0**。适配器据此明确报告能力缺失（ADR-0005 第 4 条）。

6. **端口 8000 进 `catalog/ports.json`**，`status: "reserved"`。8000 是通用端口，启用前**必须探测占用**。

7. **Mesh Terrain 另案评估，不在本 ADR 裁决范围内**：UE 5.8 的实验性真 3D 网格体地形（可做悬崖 / **浮岛** / 隧道）与修仙场景的浮岛、洞天相关，但它是**引擎内建模能力**，与注册表无关，留待单独立项。

### 影响

- 正面：**ADR-0005 的抽象被这次生态变化验证了**。官方实现的出现没有推翻任何东西——只需**加一条数据 + 三个字段**，引擎适配器、语义动作层、Bridge Router 均无需改动。这正是「实现可替换」的设计意图。
- 正面：注册表从此能表达「官方 / 社区」这个真实取舍，而不是靠 `notes` 里的散文。
- 负面：三个新字段需为既有实现回填，且 `engine_version_range` 取值需核实（本次为文档核对，**非上机实测**）。
- 负面：官方实现要真正可用，**必须先实现 GBE Toolset**——这是 ADR-0005 未预见的工作量。在此之前它只能算「候选在册、能力为零」。
- 风险：官方 MCP 标注为 Experimental，Epic 自己说明 API 与格式可能变化、不建议用于生产；**不得因「官方」而当作稳定依赖**。

### 落地要求

- `gbe-assets/docs/DECISIONS.md`：追加本条（ADR-0001 ~ 0006 条目不动）。
- `gbe-studio/core/registry/mcp.json`：新增 `unreal-official-mcp`；为 3 个社区实现回填 `source` / `engine_version_range` / `maturity`；`selection_policy` 增 `filter_by_engine_version` 与 `preference_rules`。
- `gbe-studio/core/registry/engines.json`：`unreal.ports` 增 `unreal-mcp-official`。
- `gbe-assets/catalog/ports.json`：登记端口 8000（`status: "reserved"`）；重跑 `bridges/sync-ports.js` 刷新只读视图。
- CONVENTIONS §20.2 / §20.3 镜像同步。

---

## ADR-0008 — `$` 前缀的键是文档性注释，不受 `additionalProperties: false` 约束

**状态**：已生效　**裁决人**：用户（大人，2026-10-12 指令「直接开工按推荐方案改」）　**日期**：2026-10-12

### 背景：契约与自己的数据形状长期不符，而冒烟测试看不见它

`X-0032` 的四仓审阅发现一条事实：**作为模数与预算真源的 `kits/cn-ancient/kit.json`，过不了本仓自己的 `kit.schema.json`**。

```
$ node -e "const g=require('./packages/schema/index.js'),fs=require('fs');
           console.log(g.validateKit(JSON.parse(fs.readFileSync('kits/cn-ancient/kit.json','utf8'))))"
valid = false
  ✗ $.grid.$comment      不允许的额外字段
  ✗ $.budgets.$comment   不允许的额外字段
  ✗ $.materials.$comment 类型应为 array，实际为 string
```

而这件事**长期不可见**，原因不是"没人查"，是**查的地方看不见它**：`packages/schema/test/smoke.js` 的 kit 正例是一份**手工合成、刻意不含 `$comment`** 的夹具 —— 夹具与真源分叉，测试就永远绿。（`X-0032` 的 A-1；本次已把真源接进冒烟测试。）

### 关键事实：这个惯例比契约更早，而且工具链依赖它

`$` 前缀注释不是某处笔误，而是**双库既有写法**，实测在场范围：

| 位置 | 处数 |
|---|---|
| `kits/cn-ancient/kit.json`（`grid` / `budgets` / `materials` / `coverage` / `axis`） | 5 |
| `catalog/ports.json` · `catalog.config.json` | 各 1 |
| `gbe-studio/core/registry/{providers,engines,mcp}.json` · `core/policy/{fallback,budget}.json` · `bridges/registry.json` 等 | 8 份文件 |

★ 决定性的一条：**`tools/intake.js` 主动重写 `coverage.$comment`** —— 本仓的入库工具在**生产一份 schema 会拒绝的数据**。这说明惯例与契约的分叉已经深到"日常工具链在违反契约"，不是清理一处笔误能了结的。

### 裁决：承认惯例，把规则写进 **schema**（而不是写进校验器）

| 方向 | 代价 | 判 |
|---|---|---|
| **A. schema 放行 `$` 前缀**（受约束节点加 `"patternProperties": { "^\\$": {} }`） | schema 里多 27 处机械插桩；"文档性键"成为契约的一部分 | ✅ **采** |
| B. 把注释移出受约束节点 | 注释与它所解释的字段**分离**，读数据时看不到"为什么这么定"；还要改 `intake.js` 落点与 8 份注册表；历史文件改不动 | ✗ 否 |

★ **为什么不走最省事那条路**（校验器私自跳过 `$` 键）：那样 schema 就是假的 —— 本仓自称遵循 JSON Schema 2020-12，若第三方拿 `ajv` 复核会得到**与本仓校验器不同的结论**，正是 §0 原则 1「单一真源」要防的事。**放宽必须落在 schema 里**，谁复核都同一个答案。

### 边界（防止"放行一个前缀"退化成"放开整个闸门"）

- ✅ 只放行键名以 `$` 开头的键，**不校验其值类型**。
- ✗ 未知**非** `$` 键仍必须拦 —— 把 `grid.snap_m` 拼成 `grid.snap_x` 必须报「不允许的额外字段」。
- ✗ map 型节点（`materials` = 组名 → 数组）放行 `$` 前缀后，**其余值仍严格按数组校验**。
- ✗ 不放开 `$` 之外的任何前缀（`_` / `x-` 等一律照旧拦）。
- 上面三条各有一条用例钉在 `packages/schema/test/smoke.js`（1 正 2 负），改坏了当场红。

### 执行结果（2026-10-12）

| 项 | 结果 |
|---|---|
| `catalog/schema/*.schema.json` | 5 个文件 **27 处**封闭 / map 节点插桩（`asset.v2` 12 · `assembly.v2` 5 · `source.v2` 4 · `kit` 3 ＋ map 型 1 · `collection` 2）。★ 按**行插入**保留原排版 —— `JSON.stringify` 会把 323 行的文件摊成 580 行，真源的 diff 会被格式噪声淹没 |
| `CONVENTIONS.md` | **v1.4 → v1.5**：§0 新增**原则 7** ＋ 变更记录回写一行（依原则 5「四份文档同提交同步」） |
| `packages/schema/test/smoke.js` | 真源 `kit.json` 入校验 ⇒ **37 → 41 用例 / 0 失败**；A-1 由"故意亮红"转为常规回归，另加 3 条边界护栏 |
| 实测 | 真源 `validateKit` → **`valid = true`**；未知非 `$` 键与 map 值类型违规 → **仍被拦**；`test/assembly.js` 27 通过 / 0 失败 |
| 两份 PLAN | `gbe-assets/docs/PLAN.md`（校验器段）＋ `gbe-studio/docs/PLAN.md`（契约依赖段）各补一行 —— 同一提交内 |

### 不做的事

- ✗ **不删既有 `$comment`** —— 它们承载"这条为什么这么定"，删掉等于丢决策上下文，且与 `intake.js` 的现有行为直接冲突。
- ✗ **不在校验器里开后门**（理由见「裁决」表下方那条）。
- ✗ **不借本 ADR 放宽任何别的东西** —— 本条只管 `$` 前缀；`additionalProperties: false` 对其余键的效力一字未动。

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

---

## ADR-0009 — 两仓 `version.js` 独立维护：不要求同版本、不要求逐字节相同，只保共享命令的语义

**状态**：已生效　**裁决人**：用户（大人）　**日期**：2026-10-27　**supersedes**：无（**废止**旧纪律「`scripts/version.js` 与另一仓逐字节相同、改动必须双仓同步提交」）

### 背景

`gbe-studio/scripts/version.js` 与 `gbe-assets/scripts/version.js` 长期被要求**逐字节相同**，三处活文档都在这么写（studio `AGENTS.md` §2、`README.md`、`docs/REPO-LAYOUT.md`）。

2026-10-27 复审实测：

- 两份**已经不同**：2026-10-19 只改了 studio 那份（README 硬编码检查 ＋ 嵌套 `package.json` 处理，63 行），assets 那份自 v0.3.0 未动；哈希 `1617240d…` ≠ `a10ca03…`。
- **三道门禁都不比对两份文件**（提交前检查 / push 钩子 / CI），所以全绿 —— **规则已破而无任何东西会红**。
- 直接同步也不成立：assets 的 `package.json` 在 `packages/schema/`，studio 的在根目录；studio 那份的路径写死了。

大人裁决（原话）：「**不一样功能的参考为什么要同版本，b**」。

### 决策

1. **两仓的 `VERSION` 各自独立** —— 不要求同版本、不要求同时发版。
2. **两份 `version.js` 独立维护** —— 实现可以不同（路径、额外检查、扫描范围），**不要求逐字节相同**，不要求双仓同提交。
3. **只要求「共享命令的语义一致」**：以下六个子命令在两仓都必须存在，且行为一致 ——

   | 子命令 | 必须一致的行为 |
   |---|---|
   | `show` | 打印当前版本 |
   | `log` | 打印更新日志 |
   | `bump <major\|minor\|patch>` | 升版本 ＋ 追加更新日志（级别集合一致） |
   | `check` | 版本 / 日志 / 镜像一致；不一致 **exit 1** |
   | `sync` | 同步版本镜像（`package.json` 等） |
   | `tag` | 在当前 HEAD 打附注 tag；**工作区不干净必须报错** |

   发布节奏也一致：`bump → commit → tag → git push --follow-tags`。
4. **判据**：`gbe-assets/scripts/check-release-compat.js` —— 兄弟仓在场时比对**命令面**与 `bump` 级别集合；不在场时显式写「跳过（NOT a pass）」。★ 它**不比对文件哈希**（那正是本条要废止的东西）。

### 理由

- 「逐字节相同」是把**同名工具**当成**同一份工具**；两仓产物与发版节奏不同，脚本本来就会各自长。
- 实际已经破了很久，却没有任何判据会红 —— **比没有约定更坏**（同 §18.1 的病）。
- 保留「共享命令语义一致」即可保证肌肉记忆与发布流程不乱；实现细节各仓自决。

### 影响

- studio：`AGENTS.md` §2、`README.md`、`docs/REPO-LAYOUT.md`、`scripts/version.js` 头注释去掉「逐字节 / 同提交」；
- assets：`scripts/version.js` 头注释同理；新增 `scripts/check-release-compat.js`；`AGENTS.md` 自检清单加一条；
- 两仓各自 patch 升版（studio → v0.9.3 / assets → v0.9.2），**不要求同号**。

### 未覆盖

- 不保证两份实现的逐行一致，也不做自动同步；
- CI 不跨仓（compat 检查在本地/双仓同机时跑；CI 侧显式跳过）；
- 不合并两份脚本 —— 合并会重新引入「路径写死」那类跨仓耦合。
