# CONVENTIONS.md 审查报告

> 审查对象：`gbe-assets/docs/CONVENTIONS.md`（2026-09-15 初稿，自称 Phase 0 权威）
> 交叉核对：`gbe-assets/docs/PLAN.md` · `gbe-studio/docs/PLAN.md` · `tbg-assets` 存量实体与 v1 schema
> 结论：**方向正确、颗粒度也够，但存在 7 处跨文档硬冲突、10 处契约缺口、7 处不可执行点。当前状态不能作为 Phase 0 定稿下发**——照它实施会让两个仓库各照各的做。
>
> **【2026-09-15 已处置】** 全部 31 项已修订并三份同批对齐：`docs/CONVENTIONS.md` → **v1.1**、`docs/PLAN.md`（本库）、`gbe-studio/docs/PLAN.md`。逐条处置见文末《处置记录》。本文件保留为审查存档，不再作为待办清单。

---

## 0. 先说立得住的部分

不推翻整篇。以下几条是对的、且重要，建议原样保留：

- **§11 Draco 开关按消费方分流**：Web 开 Draco、引擎下载默认关——Godot / UE 对 Draco glTF 无原生支持，这条挡住了"下载回来打不开"的坑。
- **§0.3 实体权威、派生可重建**：库永不腐坏的前提，正确。
- **§7 recipe_hash**：多平台 + 人工精修混用场景下，唯一能支撑"批量回归重做"的机制。
- **§15.5 / §3.2 预算单源**：禁止脚本内置预算值，直击原型痛点。
- **§1 禁止在精修层迁就引擎改朝向**：正确，且与 Studio PLAN 一致。

---

## 1. 硬冲突（P0：必须裁决，否则双库分叉）

### P0-1 校验器：单源 vs 双实现（三方口径相反）

| 出处 | 表述 |
|---|---|
| CONVENTIONS §0.2 / §15.8（L300） | 语法校验器**只保留一份**，**禁止双实现** |
| gbe-assets/PLAN.md §9 ①（L293） | "与 studio 侧同一契约，**双份实现互不信任**" |
| gbe-studio/PLAN.md §9 尾注（L357） | "**同样的判据，两份实现，互不信任**" |

**这是全文最要命的一处。** 两份 PLAN 把"双实现"当成设计优点写进了方案，CONVENTIONS 把它列为硬性禁令。照 PLAN 实施 = 第一件产出物就违反 CONVENTIONS。

**建议裁决**：语法校验（JSON Schema 结构）**单源**，由 assets 侧导出；业务门禁（面数/模数/材质）**双跑**。这个折中其实 CONVENTIONS §0.2 已经写出来了，只是 §15.8 的措辞比 §0.2 严，而两份 PLAN 整段没跟上。**三处必须改到同一句话。**

### P0-2 交接目录名不一致

- CONVENTIONS §2.3（L67）/ §8（L194）：`inbox/<asset-id>@<version>/`
- gbe-assets/PLAN §9（L291）、§16（L449）；gbe-studio/PLAN §15（L485）：`inbox/<asset-id>/`

Studio 按哪个建目录、Assets 按哪个扫目录，必须一致。带上 `@version` 是对的（§2.3 同 id 重投=新版本的规则依赖它），**建议改 PLAN 两处**。

### P0-3 intake"清空交接目录" vs 禁令"禁止 rm -rf 投递目录"

- gbe-assets/PLAN §9 ⑥（L298）："inbox → kits/…，**清空交接目录**"
- CONVENTIONS §15.2（L294）："禁止 `rm -rf` 投递目录"

**建议**：明确写为"`move` 归档（或 `archive/` 保留），**不是 delete**"；§15.2 的 `rm -rf` 禁令只覆盖"直接删"，不覆盖合法归档。否则实施者两边都不敢动。

### P0-4 `needs-material-review` 到底是 status 还是标记

- §6（L146）：“可并行标记，**不替代 status**”
- §14 表格（L284）："终态 = `intake → published`（**或 needs-material-review**）"——把它当终态了

同一文件内两处相反。另外 §14 漏了 `published` 之外的合法终态（`draft` / `needs-review` 路径没在表里出现）。

### P0-5 成本账本字段名漂移

- §12（L265）：`provider_used / job_id / asset_id / tier / cost / unit / usd_est / balance_after`
- gbe-studio/PLAN §4.5（L170）：`provider / … / balance_after / **balance_source**`

`provider_used` 比 `provider` 更准确（要记"实际用的平台"而非"请求的平台"），但 `balance_source`（余额来源：主账号/子账号/CLI）被 CONVENTIONS 丢了。**定稿字段集必须以一处为准，另一处删除。**

### P0-6 UE 手性写错了（事实性错误）

§1 表格（L30）："Unreal | 集成层转换 | **右手**、+X 前、cm"

**Unreal 是左手系**（+X forward / +Y right / +Z up），与 Unity 同族。写成"右手"会让集成层算错——右手→左手需要处理镜像，而这一点恰好决定"旋转 180° 够不够"。

另外这一行只给了 `scale: 100`，没说**谁做 +Y→+Z 的 up 轴转换**（导入器自动做，还是我们写进 `asset.engines.unreal`）。glTF 导入 UE 时 Interchange 自己会转，若我们也转一次就变成双重转换。**需要写清责任方。**

### P0-7 示例 id 与目录名违反自己定的不变式（存量现实是第三个数）

§2.2（L58）不变式：`dirname` 的 name 段必须映射回 `asset.id` 的第三段。

| 出处 | 写法 |
|---|---|
| CONVENTIONS §2.1 / assets PLAN §4.1（L89） | 目录 `components/roof/**roof-**xieshan-double-a/` ← **带 `roof-` 前缀** |
| assets PLAN §4.2 / studio PLAN §4.4 | id = `cn-ancient.roof.xieshan-double-a`（第三段无前缀） |
| **存量实体实测** | `kits/cn-ancient/components/roof/**xuanshan-single-a**/`（**无前缀**） |

示例与不变式冲突，且都不等于存量现实。**建议**：① 目录名与 id 第三段严格相等，去掉 `roof-` 前缀；② 全链路示例统一换成一个真实存在的 id（如 `cn-ancient.roof.xuanshan-single-a`），避免用不存在的资产做 DoD 示例。

---

## 2. 契约缺口（P1：新字段没回写 schema，v2 schema 一落笔就要返工）

v1 schema 带 `additionalProperties: false`，意味着 v2 必须**一次列全**，否则任何遗漏字段都会直接炸校验。

| # | 缺口 | 依据 |
|---|---|---|
| P1-1 | `asset.status` / `deprecated_by` / `deprecated_reason` —— §6 强制要求，但 assets PLAN §4.2 的 asset.json v2 示例里**一个都没有** | §6 L153 vs PLAN L110-152 |
| P1-2 | `meta.suggested_*` —— §14 要求写入，PLAN 无此字段 | §14 L287 |
| P1-3 | `refine.manual` —— §7.2 允许（`manual=true` + 签字），PLAN 无此字段；且与 studio PLAN「**必须回填配方**」口径不同 | §7.2 L184 vs studio PLAN L151 |
| P1-4 | `variants` 权威形态未定：v1 是 asset 内联数组，assets PLAN 一处写 `variants.json`（独立文件）、一处写 `asset.variants`（内联）；**§16 迁移表完全没提 variants** | PLAN L103 / L141 |
| P1-5 | **契约版本无从判定**：§4 说"新增分类→升契约版本"，但 asset.json 里没有 `schema_version` / `$schema` 字段（v1 也没有），intake 无法判断来包是 v1 还是 v2。§2.3 定义的 `0.0.0-draft` 是**资产版本**，不是契约版本 | §4 L114 |
| P1-6 | `dimensions_m` 轴序未定义：v1 schema 描述"宽×高×深"，§1 定了 up=+Y / forward=-Z，但 CONVENTIONS 没把轴序写成 `[X宽, Y高, Z深]`。多引擎包装的缩放与包围盒全依赖这一条 | §8 / v1 schema L28-31 |
| P1-7 | `license` / `tags` 无约定：v1 `license` 是 `const: "CC0-1.0"`，§16 迁移表没提 license，全文无枚举/默认值；`tags` 无词表规则（中英混排？受控？）——而检索重度依赖 tags | §5-§6 |
| P1-8 | provider id 命名漂移：v1 实际值 `"hunyuan-3d"`，studio 侧 provider id 是 `hunyuan3d`；§16 只说 `source.generator → provenance.provider`，**没有规范化取值** | 实测 source.json L2 |
| P1-9 | **`raw_file` 是悬空引用**：assets PLAN §4.3 示例写 `"raw_file": "raw/hunyuan_out.glb"`，而 §11 明确"raw 生成件**不入** Assets Git"、§8 资产包清单里也没有 `raw/` | PLAN L170 vs §11 L246 |
| P1-10 | 引擎包装 / sockets 未绑 `version` / `recipe_hash`：§2.3 允许同路径覆盖换 version，但 `EngineImportPlan.asset` 只有 `{id, lod}`，engines 包装也无版本标识 → **已导入工程的资产无法判断来源版本** | studio PLAN L160 |

---

## 3. 不可执行（P2：现场做不了决定）

| # | 问题 | 证据 / 说明 |
|---|---|---|
| P2-1 | §17.2 DoD「同一 RefineRecipe 重复执行，**关键统计一致**」——**没有容差**。面数严格相等？尺寸 ±1mm？Blender 跨主版本 decimate/triangulate 结果本来就会漂 | §17 L331 |
| P2-2 | §7.1 recipe_hash 只哈希 `steps + recipe_id + blender_major`，**漏了 `qa` 数组**——而 studio PLAN 的 RefineRecipe 里 `qa` 是独立字段。qa 判据变更后 hash 不变 → 同一 hash 对应不同门禁 | §7.1 L168-176 vs studio PLAN L147 |
| P2-3 | §16 `source.refinement → refine.recipe_id + recipe_hash`「能补则补」——实测存量 16 件里 `refinement` 是**中文散文**（"Blender 无头精修（render-preview.py）：缩放归一…"），**一件都补不出**。按 §7.2 全部要打 `refine-unreproducible`，随即撞上 §17.4「警告需清零或登记」 | 实测 source.json L10 |
| P2-4 | §16 `materials: [...] → materials.slots[{slot, ref}]`——**slot 名从哪来？** v1 只有材质路径数组，无槽位信息。且实测存量 `materials: []`（空数组），按 §5 会被全部打 `needs-material-review` | 实测 asset.json L24 |
| P2-5 | §16 `geometry.vertices` 标"（无）→ 新增"，但没写**从哪取**（必须回读 glb 解析），迁移脚本无法实现 | §16 L313 |
| P2-6 | §16 迁移表**遗漏 v1 已有字段**：`generated_at`（→`created_at`）、`raw_file`、`variants`、`license`、`author`、`tags`、`name`、`kit`、`tier` | 实测 v1 实体与 schema |
| P2-7 | §8 必填 `preview.png` **512**，存量是 **300×300**（source.json 自述 + assets PLAN §2 自述）→ 迁移要重渲染全部存量，而 §16 迁移表**完全没提 preview** | PLAN L40 / 实测 L10 |
| P2-8 | §2.3「历史版本 `_versions/<version>/` 可选归档」放在**资产目录内**——会污染 folder-per-asset 扫描与 §2.2 不变式（多出一个非资产子目录），且 §11 权威/派生表没给 `_versions/` 的 Git 归属 | §2.3 L66 |

---

## 4. 单源原则自我违背（P2：结构性）

| # | 问题 |
|---|---|
| P2-9 | §0.1 立"单一真源"，但**本文档自己就是第三份**：§4 抄了 category 全集、§3.2 抄了面数表、§3.3 抄了模数表。schema enum / kit.json / 本文档三方靠人工同步，必然漂移——这恰恰是 §15.1 要禁止的事。**建议**：文档表格标注"由 schema 自动生成"并加 CI 一致性校验，或文档只写指针不抄值 |
| P2-10 | §3.2 写了字段名 `kit.json.budgets`，§3.3 **没写字段名**（只说"结构同构"）。实测 kit.json 是 `grid.snap_m / wall_module_m / story_heights_m / pillar_spacing_m / ground_tile_m`。留口子 = 留漂移 |
| P2-11 | §1 的 `axis` / `pivot` **未定义能否被 kit.json 覆盖**——而 kit.json 里确实有这两个字段。budgets/grid 定义了优先级，axis/pivot 没有 → 优先级规则不完整 |
| P2-12 | §18 端口表放在 `gbe-studio/bridges/registry.json`，但表中 8788/8789 是 **assets 自己的**端口 → assets 反向依赖 studio 仓库文件；公网/独立部署时该依赖不成立。**建议**端口表自持或抽为共享源 |
| P2-13 | §18 校验器"gbe-assets 导出，Studio 依赖"——**分发机制未定义**（npm 私有包？git submodule？vendored 拷贝？）。若走 vendored 拷贝，又回到违反 P0-1 |
| P2-14 | §11 权威/派生表**漏登派生产物**：Draco 变体、贴图 1K/2K 变体、`variants` 展开件。§11 压缩策略明明要求 Web 用 Draco、下载不用 → 同一资产两份 glb，但表里只认 `model.glb` |
| P2-15 | §0.1「双保险 ≠ 双实现」的兜底表述含糊："业务门禁…**但判据表来自同一配置**"——判据实际散落三处（面数在 `kit.json.budgets`、分类在 `asset.schema.json`、材质在 `kit.json.materials`），并不是"同一配置"。需要一张显式的门禁配置表或写明"门禁 = 聚合读取上述三源" |

---

## 5. 建议的最小修订动作（按依赖顺序）

1. **先裁决 P0-1 / P0-5**：校验器单源范围 + 账本字段名。这两条决定目录结构与接口，必须最先行。
2. **改两份 PLAN**去对齐 CONVENTIONS：`inbox/<id>@<version>/`（P0-2）、归档而非删除（P0-3）、校验器口径（P0-1）、账本字段（P0-5）。
3. **修 §1 UE 手性 + 明确 up 轴转换责任方**（P0-6）；统一 id/目录名并换用真实示例（P0-7）。
4. **补 §2 契约缺口到 schema**：`status` 家族、`schema_version`、`license`、`tags` 规则、`dimensions_m` 轴序、`variants` 权威形态（P1-1…P1-8）。
5. **改写 §16 迁移表**：补齐遗漏字段、明确 slot 来源与 vertices 来源、给出"存量 16 件必然全带 `refine-unreproducible` + `needs-material-review`"的预期，并为 §17.4 的"登记"提供豁免清单机制（P2-3…P2-7）。
6. **最后处理 P2-9…P2-15 的结构性项**：把文档里的枚举/数值改成"由 schema 生成 + CI 校验"，端口表与校验器分发去耦合。

---

## 6. 一句话总结

**CONVENTIONS 的意图（把散落的约定收成一份、单源、可校验）是对的，但它现在是"第三份真源"而不是"唯一真源"，且与两份 PLAN 有 7 处直接冲突——下发前必须先做一次三方对齐，否则 Phase 0 会以分歧而不是以契约结束。**

---

## 7. 处置记录（2026-09-15）

三方同批修订：`CONVENTIONS.md` → v1.1 · `gbe-assets/docs/PLAN.md` · `gbe-studio/docs/PLAN.md`。

### P0 硬冲突

| # | 处置 | 落点 |
|---|---|---|
| P0-1 | 统一为「**语法单源 / 门禁双跑**」：两侧共用 `@gbe/schema`；门禁判据聚合自四组真源 | CONV §0.2 · §15.8 · §18；assets PLAN §2/§9；studio PLAN §1/§9 |
| P0-2 | 交接目录统一 `inbox/<id>@<version>/` | CONV §2.3/§8；assets PLAN §3/§9/§16；studio PLAN §15 |
| P0-3 | intake 完成后 **move 归档** 至 `_archive/inbox/…`，禁止 rm/delete | CONV §2.3/§15.2；assets PLAN §9/§11 |
| P0-4 | `needs-material-review` / `refine-unreproducible` 定量为 **并行标记 `flags[]`**，不占 status | CONV §6/§14；assets PLAN §4.2 |
| P0-5 | 账本字段定为 `provider_requested` + `provider_used` + `balance_source` 等 | CONV §12；studio PLAN §4.5/§5.2 |
| P0-6 | **UE 修正为左手系**；新增"轴转换责任划分"（up 轴由引擎导入器转，集成层不重复转） | CONV §1；studio PLAN §4.4/§6/§7.1/§14 |
| P0-7 | 目录名**严格等于** id 第三段（去类别前缀）；示例与全链路统一换成真实 id `cn-ancient.roof.xuanshan-single-a` | CONV §2.1/§2.2/§8；assets PLAN §4.1；studio PLAN §4.4/§6/§9 |

### P1 契约缺口

| # | 处置 | 落点 |
|---|---|---|
| P1-1 | asset.json v2 补 `status` / `flags` / `deprecated_by` / `deprecated_reason` | CONV §6；assets PLAN §4.2 |
| P1-2 | 补 `meta.suggested_*`（仅兜底路径写入） | assets PLAN §4.2/§9 |
| P1-3 | 补 `refine.manual` + `refine.note`，与 studio「必须回填」表述调和 | CONV §7.2；assets PLAN §4.3；studio PLAN §4.3 |
| P1-4 | `variants` 权威形态定为 **`asset.variants` 内联数组**，废弃 `variants.json`；展开件列派生表 | CONV §8/§11；assets PLAN §4.1/§4.2/§5.2 |
| P1-5 | 新增 `asset.schema_version`（契约版本），与 `asset.version`（资产版本）分离 | CONV §2.3/§8；assets PLAN §4.2；studio PLAN §4.4/§9 |
| P1-6 | 尺寸轴序写死 `dimensions_m = [x 宽, y 高, z 深]` | CONV §1/§16；studio PLAN §6/§9 |
| P1-7 | 补许可（SPDX 必填）与标签规则 | CONV §5.2/§5.3；assets PLAN §4.2/§10；studio PLAN §9 |
| P1-8 | provider id 规范化（`hunyuan-3d` → `hunyuan3d`） | CONV §16；studio PLAN §5.1；assets PLAN §4.3 |
| P1-9 | `raw_file` → `provenance.raw_ref`，明确"Studio 侧引用，不保证库内存在" | CONV §8/§16；assets PLAN §4.3 |
| P1-10 | 引擎包装附 `_gbe.json`（id / version / recipe_hash / source_hash）；`EngineImportPlan.asset` 补 `version` + `recipe_hash` | CONV §11；assets PLAN §8.1/§5.2；studio PLAN §4.4 |

### P2 不可执行与结构性

| # | 处置 | 落点 |
|---|---|---|
| P2-1 | DoD 增容差（面数/顶点严格相等，尺寸 ±1e-3 m，轴心 ±1e-4 m） | CONV §17.2 |
| P2-2 | `recipe_hash` **纳入 `qa`** | CONV §7.1；studio PLAN §4.3 |
| P2-3 | 明确迁移预期：存量必然全带 `refine-unreproducible`，并提供 `migration-exempt.json` 豁免登记 | CONV §16 预期；assets PLAN §7/§9/§14/§15；studio PLAN §9 |
| P2-4 | 明确 slot 名来源（按类别默认槽名表补 + 打标记待确认） | CONV §16；assets PLAN §9 |
| P2-5 | `geometry.vertices` 明确"必须回读 glb 解析" | CONV §16 |
| P2-6 | 迁移表补齐遗漏字段（`generated_at` / `raw_file` / `variants` / `license` / `author` / `tags` 等） | CONV §16 |
| P2-7 | preview 512 要求 vs 存量 300×300 → 明确迁移后统一重渲染，旧图可留 `preview-legacy.png` | CONV §16 预期；assets PLAN §5.2/§14 |
| P2-8 | 废弃 `_versions/`（会污染目录不变式），历史版本改库根 `_archive/` | CONV §2.3/§16；assets PLAN §4.1/§11 |
| P2-9 | 镜像表标注「人类可读镜像」，新增原则 5（三份文档同提交同步 + CI 校验） | CONV §0.1/§0.5/§3.2/§4 |
| P2-10 | `kit.json.grid` 字段名写死（`snap_m` / `wall_module_m` / `story_heights_m` / `pillar_spacing_m` / `ground_tile_m`） | CONV §3.3 |
| P2-11 | 明确 `kit.json.axis` / `pivot` **不可覆盖**全局标准，CI 校验 | CONV §1 |
| P2-12 | 端口真源迁至 `gbe-assets/catalog/ports.json`；studio `registry.json` 降为只读视图 | CONV §18；assets PLAN §3/§11/§13；studio PLAN §7.3/§10 |
| P2-13 | 校验器分发机制定为 `@gbe/schema`（开发 `file:` / CI submodule），禁止拷贝 | CONV §18；studio PLAN §1/§10 |
| P2-14 | 派生表补登 Draco / 贴图规格 / variants 展开 / `_archive` | CONV §11；assets PLAN §5.1/§5.2 |
| P2-15 | 门禁判据明确为"聚合读取四组真源"，不再宣称"同一配置" | CONV §0.2；studio PLAN §9 |

### 未处置 / 待议

| 项 | 说明 |
|---|---|
| 存量 16 件的是否重做 | 已按"豁免登记 + 排计划"处理，**实际重做排期未定** |
| Rodin Business 订阅成本（≈$120/mo） | 契约无关，属选型决策，仍待大人拍板 |
| `_archive/` 是否入 Git LFS | 已给"可选"口径，未定死 |
