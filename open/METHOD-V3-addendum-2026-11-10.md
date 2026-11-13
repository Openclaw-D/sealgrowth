# SEAL Growth review method V3 · Addendum 2026-11-10 / 海豹增长评审方法 V3 · 补充件（2026-11-10）

**License / 许可** CC BY-SA 4.0 · **Applies to / 适用于** METHOD-V3.md (unchanged / 原文不动) · **Prompt / 提示词** prompt-v2.md · **Output / 输出** review-output.schema.json (review-output-v2)

Not investment advice. Not career advice. / 不构成投资建议，不构成职业建议。

## English

### 1. Three circles

We review projects in every sector, with the same six dimensions and the same rules. Each startup review also says where the project falls:

| Circle | `fit` value | What it covers |
|---|---|---|
| In person | `focus` | AI wearables and pocket devices: worn or carried, lighter than a phone, for consumers, AI is core (earbuds, voice recorders, watches, bands and the like) |
| First | `recommended` | Other light hardware plus software |
| Other | `other` | Everything else, such as pure software or heavy robotics |

Why: pure software is easy to copy, because the model is rented and a feature can be cloned in weeks. Heavy robotics needs a very large budget before a product ships. The layer in between can be strong on both moat and capital efficiency. The circle is a description, not a tier: it never raises or lowers any dimension. Outside the in-person circle we expect to mark more dimensions as Unknown, because we see less first-hand evidence there.

### 2. Universal economics only

Judge with economics that hold anywhere: moat, capital efficiency, unit economics, standard terms. Personal buy-back obligations on founders, valuation ratchets (bet-on agreements), local reinvestment quotas and similar clauses are risks. They go into caveats or the gate note, and never raise a tier.

### 3. Hardware evidence examples

For hardware projects, useful evidence includes units shipped, gross margin, return rate, public reviews (bad ones included), app retention, and the risk of a large platform shipping the same feature. In human review we use the product for two weeks, open it up, check the bill of materials and the return rate, and talk to the factory.

### 4. Personal template

The same rules also apply to one person instead of a company: six dimensions (Health, Wealth, Creation, Relationships, Reputation, Position), one gate (health), the same four tiers. See personal-v1.md and anchors-personal-v1.json.

### 5. Output structure

review-output-v2 adds `template` (`startup` or `personal`) and, for startups, the optional `fit` and `fit_reason`. Dimensions are identified by `key`. review-output-v1 is still accepted for startups. From 2026-11-11 each dimension may also carry the optional `outlook` and `outlook_reason` (section 6).

### 6. Outlook check (added 2026-11-11)

Base date: 11 November 2027. SEAL Growth's forecast, not a fact, to be revisited in later versions:

- software is worth less: features that need a team today come with a general model;
- hardware costs less, so devices are cheaper to build and to copy;
- what can stay hard to copy is hardware and software built together.

The first two are pressures. The third is a question to check case by case: being hardware plus software is not merit by itself. Each dimension is first tiered from today's evidence, then marked `holds`, `at_risk`, `unknown` or `na` (no bearing), with one reason. The outlook never changes a tier and is not part of the reference value.

### 7. Reference group, currency and intent (added 2026-11-13)

- **Reference group.** "Normal" means typical among companies at the same stage that compete globally: the rivals a project would meet, not the local average. If it cannot be placed against that group, choose `unknown`.
- **Currency.** Read amounts in US dollars; convert other currencies roughly and say so.
- **Two logics.** Capital: money follows proof, on standard terms. Focus: people, supply chain and time behind one thing. Founder buy-back obligations, valuation ratchets and local reinvestment quotas count only as risks.
- **Intent.** By AGI we mean a world where machines do real work, production nearly runs itself and there is plenty for everyone. This is our view and direction: not a promise to any project, and never a basis for a tier.

## 中文

### 1. 三个圈

我们评所有赛道，六个维度和规则都一样。每份初创评审另外写明项目落在哪一圈：

| 圈 | `fit` 取值 | 范围 |
|---|---|---|
| 亲自看 | `focus` | AI 随身设备：戴在身上或随身携带、比手机轻、面向消费者、AI 是核心功能（耳机、录音卡片、手表、手环之类） |
| 先看 | `recommended` | 其他轻量软硬结合 |
| 其他 | `other` | 其余，例如纯软件、重型具身 |

理由：纯软件容易被抄，模型是租的，功能几周就被复制；重型具身要投入很大才见产品；中间那一层，壁垒和资本效率都能强。圈只是描述，不是档位，不会让任何维度变高或变低。亲自看的圈之外，我们看到的一手证据更少，会更多地标"未知"。

### 2. 只用通用经济逻辑

只用在哪里都成立的经济逻辑：壁垒、资本效率、单位经济、标准条款。创始人个人回购、对赌、返投之类的条款只算风险，写进 caveats 或关卡备注，不能让任何档位因此变高。

### 3. 硬件类证据示例

硬件项目可用的证据：出货量、毛利、退货率、公开评价（含差评）、应用留存、大厂推出同类功能的风险。人工评审时我们会用两周、拆开、查 BOM 和退货率、和工厂聊。

### 4. 个人模板

同一套规则也可以用在一个人身上：六维（健康、财富、创造、关系、声誉、位置），一个关卡（健康），同样的四档。见 personal-v1.md 和 anchors-personal-v1.json。

### 5. 输出结构

review-output-v2 增加 `template`（`startup` 或 `personal`），初创模板另有可选的 `fit` 和 `fit_reason`。维度用 `key` 标识。初创模板仍接受 review-output-v1。2026-11-11 起，每个维度还可带可选的 `outlook` 和 `outlook_reason`（见第 6 节）。

### 6. 前瞻检查（2026-11-11 增补）

基准日：2027 年 11 月 11 日。以下是海豹增长的预判，不是事实，日后版本会回看：

- 软件贬值：今天要一个团队做的功能，到时通用模型直接给；
- 硬件成本下降：同样的设备更便宜，也更容易被仿制；
- 仍然难以复制的，可能是软硬件做在一起的部分。

前两条是压力条件；第三条要逐个验证，"软硬结合"本身不算加分。每个维度先按今天的证据定档，再标 `holds`、`at_risk`、`unknown` 或 `na`（预判与该维度无关），并写一句理由。前瞻不改变档位，也不进参考值。

### 7. 参照系、计价和用意（2026-11-13 增补）

- **参照系**："正常"以同阶段、在全球有竞争力的那一批公司的典型水平为准，即项目真正会遇到的对手，不是本地平均；无法判断就标未知。
- **计价**：金额按美元读，其他币种粗略折算并说明。
- **两种逻辑**：资本的逻辑（钱跟着证据走，条款标准）；集中的逻辑（把人、供应链和时间压在一件事上）。回购、对赌、返投仍只算风险。
- **用意**：我们说的 AGI，是机器能在现实里干活、生产几乎全自动、人人物质富足的那个世界。这是我们的看法和方向，不是对任何项目的承诺，也不是评分依据。
