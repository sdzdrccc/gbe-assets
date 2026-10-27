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

## [0.9.3] - 2026-10-27

### 变更
- ADR-0010：.obsidian 配置保留入库（大人裁定，复审不再报）

## [0.9.2] - 2026-10-27

### 变更
- ADR-0009：双仓 version.js 不再要求逐字节相同；只保共享命令语义 ＋ 新增兼容检查

## [0.9.1] - 2026-10-27

### 变更
- 文档纠错：4 处 schema 死链改 asset.v2 · Unity 预留端口 8080→8090 · _archive 扁平形制 · LFS/submodule 声明按实测更正

## [0.9.0] - 2026-10-22

### 新增
- 入库村落皮肤与道具两批共 16 件（均 1.0.0 · 程序化 · 0 credit）：
  - 第一批：`terrain/ground-tile` 3（土 / 草 / 土路）· `nature/tree` 老槐 1 ·
    `nature/rock` 山石 2 · `nature/plant` 草木 2。
  - 第二批：`props/street` 4（柴堆 / 晒架 / 篱笆 / 石碾）· `props/furniture` 2（药篓 / 农具）·
    `props/ritual` 1（八系测灵盘）· `props/lighting` 1（灯笼杆）。
  `coverage` 八类全部 `done = planned`：地面 3/3 · 树 1/1 · 石 2/2 · 草木 2/2 ·
  街具 4/4 · 家具 2/2 · 法器 1/1 · 照明 1/1。
- `kit.json.materials` 新增 `plant` 组（`cao-lv` / `ye-lu` / `ku-huang`）。

### 变更
- 村落皮肤与道具 16 件（8 类全部补齐）

## [0.8.0] - 2026-10-22

### 新增
- 入库 `cn-ancient.roof.yingshan-single-a@1.0.0`（程序化灰模 · 10 × 2 × 7 m · 16 三角）。
- 入库民居五件灰模（均 1.0.0 · 程序化 · 0 credit）：
  `pillar.yanzhu-round-a`（檐柱）· `roof.ridge-main-a`（正脊）· `wall.shanqiang-a`（硬山山墙）·
  `door-window.door-panel-double-a`（双扇板门）· `door-window.window-fan-lattice-a`（扇形格扇窗）。
  `coverage` 刷新：roof **6 → 8** · wall **2 → 3** · pillar **1 → 2** · door-window **0 → 2**。
  民居形制 18 类至此全部在库。
- 新增装配清单 `assemblies/cn-ancient/assemblies/building/yingshan-roof-test-a.json`
  （5 段直墙 ＋ 1 件硬山屋面 ＋ 1 件正脊；7 实例 / 3 独特构件，`assembly-check` 0 警告）。
- 新增装配清单 `assemblies/cn-ancient/assemblies/building/minju-hard-mountain-a.json`
  （**首栋完整民居**：8 × 7 m 硬山；24 实例 / 8 独特构件 / 1324 面，复用比 3.0，`assembly-check` 0 警告）。
  墙与山墙平接、不用角墩；门窗暂为外贴填充件（本版不做墙洞）。

### 变更
- 民居六件程序化灰模入库 + 首栋硬山民居装配

## [0.7.1] - 2026-10-19

### 修错
- **补 CI**：此前 `AGENTS` / `CONVENTIONS` / `PLAN` / `README` 四处把 CI 当既有门禁，而仓里 **`.github` 不存在** ⇒ 新建 `.github/workflows/ci.yml`（schema 测试 / 真源 kit / 装配清单 / 入库 dry-run / 版本 / 文档镜像）
- **分类假绿**：`kit.schema.json` 描述写「必须属于 asset.v2 的 category enum」，但**实现没有 enum** ⇒ 越界值照样过 smoke（49 通过 / 0 失败）。现由 `checkKitCategories()` 现读 **asset.v2（26 类）∪ assembly.v2（2 类）** 逐项执法
- **§4 真源说法**：原文把 `assemblies/*` 也归给 `asset.v2`（该 enum 里并没有）→ 拆成「资产 26 类 / 装配 2 类」两份真源，`kit.categories` 取并集
- **README ADR 区间**：`0001 ~ 0007` 改指针（实测最新已 0008，手抄必腐）

### 变更
- `CONVENTIONS` **v1.5 → v1.6**：§4 真源拆分 ＋ 新增 **§18.1「CI 覆盖边界」**（逐条标注"已校验 / 待补"，不再把愿望写成现状）
- `CONTRIBUTING.md` **合并进 README**「贡献指南」节（`X-0053` A-3 的唯一一条合并建议），两处引用同步
- `npm test`：只跑 smoke → **smoke ＋ assembly ＋ kit-categories**（装配 30 项此前没有 npm 入口）
- 新增 `scripts/check-doc-enums.js`（§4 镜像 ↔ schema 逐字一致，进 CI）

## [0.7.0] - 2026-10-18

### 变更
- 端口真源补登 qiuyuan-game-ws:8080（账实不符修正 · guild X-0050/ADR-0029③）· unity-mcp 保留位 8080→8090

## [0.6.3] - 2026-10-13

### 变更
- **X-0032 遗留 A 类六修**（guild 审阅卡归口 gbe-assets 的未修项）：
  - **A-3**：`tools/intake.js --reindex` 改为**只刷 coverage.done**（此前无条件先跑完整入库 —— 想「只重建派生快照」却会触发 inbox→kits 搬迁，派生动作不许有副作用）
  - **A-4**：intake 按契约 DoD（`docs/CONVENTIONS.md` §17 第 4 条：无 error **且** 无 warning、无豁免通道）**拒收带 warning 的包** —— 此前只看 `res.ok`
  - **A-5**：`preview.png` 无法解析 PNG 头由 warning 改 **error**（坏包不放行）；补 `files.preview[]` 与 `files.collision` 的存在性检查（此前只查 `files.model`）
  - **A-7**：`wanan-wall-corner-a.json` 的 `params.instance_count` 5→6（与 instances 实际数对齐）；`assembly.js` 新增语义校验「instance_count 存在即须等于 instances.length」
  - **A-8**：新增 `catalog/schema/ports.schema.json`（端口真源入 schema 校验，端口三态/`$` 文档键与既有 schema 同构）；`catalog.config.json` 删除重复登记的 `api_port`/`web_port`（唯一真源是 `catalog/ports.json`）
  - **A-9**：`packages/schema/validate.js` 补 CLI 守卫（无参/`--help` 打印用法 exit 2 · 校验结果 exit 0/1）；README 订正「含 `$ref` 解析」的不实说法（本校验器**不支持** `$ref`，未知关键字静默忽略）
- 测试：smoke 41→**49** · assembly 27→**30**（新增用例均含一正一反）

## [0.6.2] - 2026-10-13

### 变更
- AGENTS.md 追加 §6 文档地图 + §7 移动与作废（全量对推 · 与 guild §8 同源）

## [0.6.1] - 2026-10-13

### 变更
- pre-push 追加跨仓契约对齐校验（跑 guild 的 check-asset-ref.js）—— 补 gbe-assets 侧盲区

## [0.6.0] - 2026-10-12

### 新增（契约）—— **ADR-0008：`$` 前缀的键 = 文档性注释，不受 `additionalProperties: false` 约束**

- **裁决**：承认既有惯例，**把规则写进 schema**，五个契约真源共 **27 处**封闭 / map 节点插桩 `"patternProperties": { "^\\$": {} }`（`asset.v2` 12 · `assembly.v2` 5 · `source.v2` 4 · `kit` 3 ＋ map 型 1 · `collection` 2）。
- ★ **为什么不写在校验器里**（这是最省事的写法，也是本 ADR 明确否决的）：那样 schema 就成了假的 —— 本仓自称遵循 JSON Schema 2020-12，第三方拿 `ajv` 复核会得到**与 `@gbe/schema` 不同的结论**，正是 `CONVENTIONS §0` 原则 1「单一真源」要防的事。**放宽必须落在 schema 里，谁复核都同一个答案。**
- **为什么不是"把注释搬走"**：`$comment` 在两仓 10+ 份文件里都在用（`kit.json` 5 处 · `catalog.config.json` · `ports.json` · studio 四张注册表…），而 **`tools/intake.js` 还会主动重写 `coverage.$comment`** —— 入库工具一直在生产一份 schema 会拒绝的数据，说明分叉已深到"日常工具链违反契约"，不是一处笔误。搬走注释还会把"这条为什么这么定"与它所解释的字段**分离**，读数据时丢掉决策上下文。
- **边界（防"放行一个前缀"退化成"放开整个闸门"）**：只放行 `$` 开头的键、不校验其值；未知非 `$` 键（拼错的 `grid.snap_x`）**仍必须拦**；`materials` 这类 map 节点放行该前缀后**其余值仍按数组校验**；`_` / `x-` 等其它前缀一律照旧拦。

### 撤销 —— v0.5.2 那节「★ 已知红」在本版关闭

- v0.5.2 里**故意点亮**的红灯（真源 `kit.json` 过不了 `kit.schema.json`）随 ADR-0008 落地而**转绿**：`validateKit(kit.json)` → **`valid = true`**，`node packages/schema/test/smoke.js` → **41 通过 / 0 失败**。
- ★ 该用例**不删**，转为常规回归（真源必须过自己的 schema），并新增 **3 条边界护栏**（1 正 2 负）钉住 ADR-0008 的作用域。v0.5.2 那一节作为**已发布历史**保留原样，不追改。
- ★ **本次一并修掉的可见性缺陷**：原来"看不见"不是因为没人查，而是 `smoke.js` 的 kit 正例是**手工合成、刻意不含 `$comment`** 的夹具 —— 夹具与真源分叉，测试就永远绿。真源接入后这类"夹具掩盖真源"的分叉第一次有了回归位。

### 连带同步（依 `CONVENTIONS §0` 原则 5「四份文档同提交」）

- `catalog/schema/`（5 个文件 · 27 处插桩）＋ `docs/CONVENTIONS.md`（**v1.4 → v1.5** · §0 新增原则 7 ＋ 变更记录一行）＋ `docs/PLAN.md` ＋ `gbe-studio/docs/PLAN.md`（版本号指针 v1.5 ＋ ADR 列表补 0008）＋ 两份 `README.md` 的 v1.4 指针 ＋ `docs/DECISIONS.md`（ADR-0008 正文 ＋ 头部状态行）。

### 验证（命令 + 实际输出）

```
$ node packages/schema/test/smoke.js          EXIT=0   结果：41 通过 / 0 失败
$ node packages/schema/test/assembly.js       EXIT=0   通过 27 · 失败 0
$ node -e "…validateKit(真源 kit.json)"        valid = true
# ADR-0008 作用域七条实测（放行 / 拦下 逐条符合预期）：
  ✓ $comment 文档性键 · 放行      ✓ grid.snap_x 未知键 · 拦下      ✓ materials 未知组名值非数组 · 拦下
  ✓ materials.$comment · 放行     ✓ 顶层 nope · 拦下              ✓ 顶层 $comment · 放行
  ✓ $note（$ 前缀一律放行）
# 五个 schema 插桩后仍全部是合法 JSON（脚本写盘前先 JSON.parse 校验，失败即不落盘）
$ node scripts/version.js check               ✓ 通过
```

### 变更
- ADR-0008：$ 前缀=文档性键，五个 schema 的 27 处封闭/map 节点放行（规则写进 schema 不写进校验器）· v0.5.2 点亮的 A-1 真源红灯转绿（smoke 41/0）· CONVENTIONS v1.5 + 两份 PLAN + 两份 README 指针同提交

## [0.5.2] - 2026-10-12

### 修正（`X-0032` 的 A-2 / A-6 ＋ 把 A-1 从暗雷变成红灯）

- **A-2 · `node packages/schema/index.js kit <file>` 此前恒红**：CLI 对**所有** kind 一律套 `gateSchemaVersion`（要求 `schema_version === "2"`），而 `kit.schema.json` 的 `required` 里根本没有这个字段 ⇒ 无论 kit 多合规都 `EXIT=1`。
  修法**不是写一份"哪些类型免闸门"的清单**（那等于造出第二份真源），而是**由 schema 自己决定**：`(schema.required || []).includes('schema_version')` 才套闸门。
  实测对照：`kit` → 不再报「缺少 schema_version」，改报**真实原因**（三条 `$comment`）；`collection`（schema 要求该字段）→ 缺 `schema_version` 仍 `EXIT=1` 报原话 ⇒ 闸门没被拆掉，只是不再乱套。
- **A-6 · `packages/schema/package.json` 的 `files` 补上 `assembly.js`**：`index.js:26` 就 `require('./assembly')`，而打包清单只有 `index.js` / `validate.js` ⇒ `npm pack` 出来的 tarball **发布即坏**（`MODULE_NOT_FOUND`）。
  ⚠️ **这只补了崩溃，没让本包能独立发布**：`REPO_ROOT`（`index.js:28`）指向包外两级的 `catalog/schema/`，`assembly.js` 还要读 `kits/<kit>/kit.json` 与资产目录 ⇒ 本包**离开 gbe-assets 仓库就无法工作**，这是 `AGENTS.md` 纪律 3（校验器只有一份 · 开发期 `file:` 引用 / CI 期 submodule 锁 commit）的**既有设计**，不是漏洞。要真发布，得把 schema 与仓库解耦，那是另一张卡。
- **★ A-1 从暗雷变成红灯（大人裁定：只暴露、不裁）**：`test/smoke.js` 原「正例：kit.json 通过」用的是**手工合成、刻意不含 `$comment`** 的夹具 —— 它与真源分叉，正好把「真源过不了自己的 schema」这件事**掩盖**掉。现把该用例**改名为「正例（合成夹具）：… 不代表真源已过 schema」**，并**新增一条真源用例**：直接把 `kits/cn-ancient/kit.json` 喂给 `validateKit`。

### ★ 已知红（本版**故意**带红发布 · 有归口 · 有销号条件）

```
$ node packages/schema/test/smoke.js
  ✗ 正例：真源 kits/cn-ancient/kit.json 必须过 kit.schema（★ 已知红 · 待 ADR 裁定 A-1）
      真源 kit.json 过不了自己的 schema ⇒ $.grid.$comment 不允许的额外字段
      ｜ $.budgets.$comment 不允许的额外字段 ｜ $.materials.$comment 类型应为 array，实际为 string
      ⇒ 去向：开 ADR 裁定 `$comment` 合法性（见 CHANGELOG「已知红」）
结果：37 通过 / 1 失败        EXIT=1
```
（实际是**一行**输出，上面按 `｜` 折行只为了可读；错误文本由用例自己拼出，含"缺哪几处"与"去向"。）

- **矛盾点**：`kit.json` 在 `grid` / `budgets` / `materials` / `coverage` / `axis` 五处都用 `$comment` 写"这条为什么这么定"（人读的习惯，且 `tools/intake.js` 还会**主动重写** `coverage.$comment`），而 `kit.schema.json` 对 `grid` / `budgets` 设 `additionalProperties: false`、对 `materials` 要求值为数组 —— **两边必有一边是错的**。
- **为什么不顺手改**：放开 schema = **契约破坏性变更**，依 `AGENTS.md` 纪律 2 须 `catalog/schema/` ＋ `CONVENTIONS.md` ＋ 两份 `PLAN.md` 同提交，且要先开 ADR；把注释挪出受约束节点 = 改真源数据形状。**两条都属"裁定"，不属"修 bug"**，大人本次只点了「暴露」。
- **销号条件**：ADR 落地（放开 `$comment` **或** 移出受约束节点）⇒ 本条转绿 ⇒ 撤掉本节。在那之前 `AGENTS.md` §4 的「smoke 全绿」前置**本仓未满足**，记录在案，**不得被后人读成"当时是绿的"**。
- 其余判据不受影响：`node packages/schema/test/assembly.js` → **通过 27 · 失败 0**；`node scripts/version.js check` → 通过。

### 变更
- CLI 的 kit 不再乱套版本闸门（A-2，判据改取自 schema）· package files 补 assembly.js（A-6）· 新增真源 kit 用例把 A-1 暴露成红灯（故意带红发布 · 待 ADR）

## [0.5.1] - 2026-10-12

### 修正

- **`kits/cn-ancient/kit.json` 的 `coverage.components/roof.planned` 由 13 改 18**，`planned` 加总由 **45 改 50**。原因：真源 `gbe-studio/BUILDING-DECOMPOSITION.md` §9.2 补入了 5 件屋顶样式件（硬山 / 悬山 / 攒尖 / 庑殿 / 盝顶），而 `planned` 是**人工维护的分母**（`tools/intake.js` 只刷 `done`、不动 `planned`）—— 它此前与 §9.2 同源双写、且已经漂了。**后果是可见的**：`planned` 停在 45 时，Web 端覆盖度视图会显示屋顶"已规划 13 / 已齐"，把 5 件必生成件当成不存在，§7 的"覆盖度缺口驱动生产排期"随之失真。
- **`kit.json.description` 删除「万安城」**：改为「服务于『虬渊大陆 · 北桢洲』场景（M4 首批 = 槐阴村，远期 = 城邑）」。该场景名在设定库 `虬渊大陆` **0 命中**（大人裁决删除）；`BUILDING-DECOMPOSITION` §9.4 已把 M4 落到槐阴村，城邑具体是哪座（`青麓城` / `太华仙城`）由 guild 定。
  ⚠️ **未改的残留（登记待办，不在本次动）**：已发布资产 id `cn-ancient.assembly.wanan-wall-corner-a` 与文件名 `assemblies/cn-ancient/assemblies/building/wanan-wall-corner-a.json` 仍带 `wanan-` 前缀 —— **id 不可变**，改名属破坏性变更，须另开 ADR + 发版。
- **8 个类别仍是"列了名、没规划"**（本次只如实记录，未填数）：`categories` 里有 `props/{lighting,street,ritual,furniture}`、`nature/{tree,rock,plant}`、`terrain/ground-tile`，但 `coverage` 里**连 `planned` 键都没有** = 从未规划。M4 是**村落**场景，地面 / 树 / 山石 / 道具 / 演出法器（八系测灵盘）全在这些类别里 —— 缺口形状见 `BUILDING-DECOMPOSITION` §9.4，件集须另开卡定。

### 验证

- `node packages/schema/test/smoke.js` → **37 通过 / 0 失败**。
- `node gbe-studio/build/convergence/reconcile.js`（§9.2 ↔ `forms.js` ↔ `kit.json` 三方对账）→ **全绿**：50 类构件 · `planned` 逐类别吻合 · P 18 == 在库 18 · B 5 == 未入库 hero 专属件 · §9.1 数量 == `forms.count` · 合计 28 栋。

### 变更
- kit.json 的 roof planned 13→18（补 §9.2 新增的 5 件屋顶样式件，分母加总 45→50）· 场景描述去「万安城」改指北桢洲与 M4 槐阴村

## [0.5.0] - 2026-09-15

### 新增

- **ADR-0007**：官方 UE 5.8 MCP 出现后，MCP 注册表引入「来源 / 版本区间 / 成熟度」三维度；官方实现进注册表但**不预设首选**。ADR-0001 ~ 0006 条目未改动（台账只追加）。
- **CONVENTIONS v1.4**：
  - §20.3 MCP 注册表条目新增 `source`（`first-party` / `community`）、`engine_version_range`、`maturity`（含 `unknown`），并回填全部既有实现；`selection_policy` 增 `preference_rules`（偏好提示，**不自动选定**）。
  - §20.3 明确 **`semantic_map: null` 的语义 =「工具尚不存在」而非「还没填」** —— 禁止写全 `null` 空壳映射表（会掩盖「要写实现」vs「要填映射」的工作量差异）；新增 `supports_basis: design-complete` 表示「设计齐全但落地前可用为 0」。
  - §20.2 `unreal` 行补全 4 个实现端口（6776 / 30010 / 8091 / 55557）+ **预留 8000**。
  - §18 端口 `status` 定为**三态**：省略 = 已启用 · `reserved` = 已登记未启用 · `deferred` = 引擎延后；只读视图对应 `studio_ports` / `reserved_ports` / `deferred_ports` 三组。
- `catalog/ports.json`：登记 `unreal-mcp-official`（HTTP 8000，`status: "reserved"`）—— 官方 MCP 内置于 UE 5.8 编辑器进程，本地回环 `/mcp`。

### 说明

- `maturity` 特意保留 `unknown` 取值：不留这一项，回填时只能二选一——标 `stable` 或标 `experimental` 都是撒谎。**枚举缺一个「不知道」，就会逼出假数据。**
- 本次为**文档核对**，非上机实测；官方实现的 `verified_at: null` 即为此意。

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
