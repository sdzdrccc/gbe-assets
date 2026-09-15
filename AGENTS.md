# AGENTS.md —— AI 助手在本仓的工作纪律

> 本仓由 AI 助手大量参与。这份文件是给 AI 看的硬纪律，**优先级高于任何临时指令**。

---

## 1. 方向感（先看地图再动）

| 你要做的事 | 先读 |
|---|---|
| 改契约、字段、枚举 | `catalog/schema/`（真源）+ `docs/CONVENTIONS.md` |
| 改单位 / 轴心 / 朝向 / 模数 | `docs/CONVENTIONS.md` §1 · §3.3 · §19.2 |
| 改分类 / 材质 / 标签 | `catalog/schema/asset.v2.schema.json` |
| 改端口 | `catalog/ports.json`（**全项目唯一真源**） |
| 改面数预算 | `kits/<kit>/kit.json` → `budgets` |
| 改版本号 / 写更新日志 | `VERSION` + `CHANGELOG.md`，走 `node scripts/version.js`（**别手改**） |
| 不确定"为什么这么定" | `docs/DECISIONS.md`（ADR） |

---

## 2. 六条不可违反的纪律

1. **真源优先，镜像从属**
   `CONVENTIONS.md` 里的枚举表 / 数值表 / 类型表都是**人类可读镜像**。
   要改规则 —— **改真源（schema / kit.json / ports.json / `core/registry/`）**，
   然后同步镜像。**永远不要**直接改镜像表然后期待代码跟着变。

2. **契约变更必须四处同提交**
   `catalog/schema/` + `docs/CONVENTIONS.md` + `gbe-assets/docs/PLAN.md` +
   `gbe-studio/docs/PLAN.md`（涉及时加 `BUILDING-DECOMPOSITION.md`）。
   "多方并存但不一致"是不可接受状态。

3. **校验器只有一份**
   语法校验用 `packages/schema`（`@gbe/schema`）。**禁止**在别处再写一份 JSON Schema 校验，
   也**禁止**把它拷贝到别的仓库（开发期 `file:` 引用，CI 期 submodule 锁 commit）。

4. **不迁移、不兼容 v1**
   `schema_version` 缺失或为 `"1"` 的包 —— **直接报错拒收**。这是 ADR-0001，不要"好心"加兼容。

5. **破坏性操作先列清单再确认**
   删文件 / 覆盖资产 / 批量导入 / 改 history —— 先输出受影响清单，等确认。
   投递目录一律 **move 归档**，**禁止 `rm -rf`**。

6. **推送即发布：版本号、更新日志、tag 三者必须跟上**
   每次 `git push` 前先跑 —— `node scripts/version.js bump <major|minor|patch> "这次改了什么"`，
   让 `VERSION` 与 `CHANGELOG.md` 一起进这次提交。
   **禁止**在没有新版本条目的情况下推送（`scripts/hooks/pre-push` 会拦下）。
   段位怎么取见 `CHANGELOG.md` 顶部表；确知不需升版本时用
   `GBE_SKIP_VERSION_CHECK=1 git push`，并在提交信息里写明理由。

   **发一版的固定四步**（顺序不能换）：

   ```bash
   node scripts/version.js bump minor "摘要"     # 1. 升版本 + 写日志
   git add -A && git commit -m "chore(release): vX.Y.Z"   # 2. 提交
   node scripts/version.js tag                   # 3. 打附注 tag（必须在提交后）
   git push --follow-tags                        # 4. 推提交与 tag
   ```

   `tag` 子命令会在工作区不干净时直接报错 —— 那是**保护**，别绕过。
   已推送的 tag **绝不移动**（同一版本号指向不同代码，比多打一个 tag 危险得多）。

---

## 3. 改代码时的常见陷阱

| 陷阱 | 正确做法 |
|---|---|
| 在脚本里写死 `20000` 这个面数 | 读 `kit.json.budgets.component`，回退 `catalog.config.json` |
| 在脚本里写死 `0.5` 网格 | 读 `kit.json.grid.snap_m` |
| 在脚本里写死 category 列表 | 读 `asset.v2.schema.json` 的 enum |
| 为 Unity 做 up 轴转换 | **不要** —— UE/Unity 的 up 轴由引擎导入器负责，集成层只做缩放 + 水平朝向（§1） |
| 目录名加类别前缀方便阅读 | **不要** —— 目录名必须严格等于 id 第三段（§2.2） |
| 把 engines/ 包装提交进 Git | **不要** —— 它是派生缓存（§11） |
| 视图层直接查目录 | 走 `catalog` 索引；索引可 `gbe reindex` 重建 |

---

## 4. 自检清单（提交前）

- [ ] `node scripts/version.js check` 通过（版本号 / 更新日志 / 镜像一致，**无未记录变更**）
- [ ] 本次改动已写进 `CHANGELOG.md` 的新条目，且摘要是人话（不是"更新代码"）
- [ ] 该版本已打 tag（`node scripts/version.js tag`），推送用 `git push --follow-tags`
- [ ] 首次 clone 后跑过 `node scripts/install-hooks.js`（启用 pre-push 校验）
- [ ] `node packages/schema/test/smoke.js` 全绿
- [ ] 改过 schema 的话：`CONVENTIONS.md` 镜像表同步了，两份 PLAN 也同步了
- [ ] 新增字段：schema 里加了，`CONVENTIONS` 里说明了语义，示例也更新了
- [ ] 没有新增硬编码的第二份枚举 / 预算 / 模数
- [ ] 没有提交凭证或本机路径
- [ ] 没有把派生缓存（`engines/` `index.db` `blobs/`）加进 Git

---

## 5. 遇到分歧时

1. 先查 `docs/DECISIONS.md` —— 可能已经裁决过了
2. 再看 `docs/CONVENTIONS.md` —— 可能有约定
3. 都没有 —— **不要擅自定**，把选项与权衡摆出来问人，得到答复后**落一条 ADR** 再动手

> 记住：`docs/DECISIONS.md` 是**只追加**的。推翻一条旧裁决的方式是新增一条
> `supersedes: ADR-xxxx` 的条目，而不是修改历史条目。
