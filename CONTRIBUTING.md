# 贡献指南

> 本库有两类贡献者：**人** 与 **AI 助手**。AI 助手另见 [`AGENTS.md`](AGENTS.md)。
> 入库的主通道是 **GBE-Studio 投递**（带完整元数据、schema 校验通过）；网页上传只是兜底。

---

## 0. 开工前必读

1. [`docs/DECISIONS.md`](docs/DECISIONS.md) —— 已生效的裁决，不要重复讨论已决的事
2. [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) —— 单位 / 轴心 / 朝向 / id / 模数 / 插槽 / 装配
3. [`catalog/schema/`](catalog/schema/) —— 机器可读真源，条款有歧义时以它为准

---

## 1. 加一件资产（标准流程）

```
1. Studio 侧生成 → 拆分 → 精修 → 打包
       ↓ 投递
2. inbox/<asset-id>@<version>/
       ↓
3. 校验：node packages/schema/index.js package inbox/<asset-id>@<version>/
       ↓ 通过
4. intake：复检 → 派生（预览 512 / LOD / 多格式 / 引擎包装）→ 索引
       ↓
5. move 归档：inbox/... → _archive/inbox/...
       ↓
6. kits/<kit>/<category>/<name>/   ← 入库完成
```

**必须通过**：
- 契约版本 `schema_version = "2"`（v1 包直接拒收，ADR-0001）
- 规格：1u = 1m、bottom-center 轴心、`+Y up / -Z forward`、`dimensions_m = [x 宽, y 高, z 深]`
- 面数在 tier 预算内（真源 `kit.json.budgets`）
- L1–L3 构件至少 1 个插槽，插槽位置落在 `snap_m` 网格上
- 有 `preview.png` 且为 512×512
- `license` 为 SPDX 标识符
- **目录名严格等于 `asset.id` 第三段**（不带类别前缀）

---

## 2. 目录与命名

```
kits/<kit>/<category>/<name>/
     └─ 例：kits/cn-ancient/components/roof/xuanshan-single-a/
                ⇅ id: cn-ancient.roof.xuanshan-single-a
```

| 规则 | 对 | 错 |
|---|---|---|
| 目录名 == id 第三段 | `roof/xuanshan-single-a/` | `roof/roof-xuanshan-single-a/` |
| 全小写 kebab-case | `xieshan-double-a` | `XieShan_Double_A` |

---

## 3. 加一套 kit

1. 建 `kits/<kit-id>/kit.json`（参考 `kits/cn-ancient/kit.json`）
2. **必须**声明 `grid`（模数）与 `budgets`（面数预算）—— 这是真源，不是可选
3. 在 `categories` 里列出本 kit 启用的分类子集（取值须属于 `asset.v2` 的 category enum）
4. 新增分类要先改 `catalog/schema/asset.v2.schema.json`，再同步 `CONVENTIONS.md §4` 的镜像表

---

## 4. 加一条装配清单

装配清单描述「一栋建筑由哪些构件、以什么插槽绑定拼成」。格式见
[`catalog/schema/assembly.v2.schema.json`](catalog/schema/assembly.v2.schema.json) 与
`docs/CONVENTIONS.md §19.4`。

要点：
- **不烘焙几何** —— 清单只存引用 + 变换，几何在构件资产里
- 引用写版本范围（如 `^1.0.0`），解析时取满足范围的最高 `published` 版本
- 通过装配校验（CONVENTIONS §19.5）：插槽互认 · 方向反向 · 网格对齐 · 无穿插 · **承重链落地闭合**

---

## 5. 硬性禁令（违反即拒）

1. 禁止 `rm -rf` 投递目录或资产目录；inbox 处理完一律 **move 归档**
2. 禁止提交凭证、本机绝对路径、`gbe.config.json`
3. 禁止绕过 `validate` 直接改 `index.db`（索引是可重建缓存，改了也会被冲掉）
4. 禁止硬编码第二份分类枚举 / 面数预算 / 模数 / 材质表 —— 改真源
5. 禁止把 `CONVENTIONS.md` 的镜像表当真源去改代码

---

## 6. 提交

```
<type>(<scope>): <subject>

type: feat | fix | docs | schema | data | chore
scope: 如 schema · kit/cn-ancient · docs · intake · web
```

**改契约时**：`catalog/schema/` + `docs/CONVENTIONS.md` + 两份 PLAN + `BUILDING-DECOMPOSITION.md`
必须在**同一提交内**同步（原则 5）。CI 会校验镜像表与真源一致。
