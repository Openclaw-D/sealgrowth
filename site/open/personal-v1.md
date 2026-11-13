# Personal template / 个人模板 · V0.5 (2026-11-13)

**License / 许可** CC BY-SA 4.0 · **Method / 方法** same rules as METHOD-V3.md, different dimensions · **Anchors** anchors-personal-v1.json · **Prompt** prompt-v2.md

## English

One question: am I worth more in this era, measured in US dollars? Same rules as the startup template: tiers are quality judgments against people of similar age and field; unknown means not yet proven, not bad; na means it does not apply yet; self-reported content supports at most normal; a person decides the overall, and the reference value is only the mean of rated dimensions (fewer than three rated gives "insufficient").

One gate, health: if the health gate is block, or the health dimension is weak, the overall is hold. Deal with health first.

Outlook check: after each tier is chosen from today's evidence, each dimension also gets an `outlook` of holds, at_risk, unknown or na against SEAL Growth's dated forecast for 11 November 2027; it never changes a tier or the reference value.

| Dimension | Key | Asks | weak | normal | strong |
|---|---|---|---|---|---|
| Health | `health` | How many more years of high-intensity work do you have? | An untreated chronic problem, or long-term poor sleep and no exercise | Can sustain a full work week; basic check-ups done | Recorded sleep and exercise; ten-plus years of high-intensity capacity left |
| Wealth | `wealth` | How many years could you go without making a decision for money? | Less than 6 months of runway, or decisions driven by debt | 6 months to 3 years of spending, counted in US dollars | 5 years or more, or assets that already produce income |
| Creation | `creation` | Have you made something others cannot, and can AI multiply it? | Nothing others can see | Shipped work with users or readers | Hard for others to copy, and already multiplied with AI |
| Relationships | `relationships` | Who would act for you in a crisis? | Nobody would act for you in a crisis | A few people who have really helped you; a stable close relationship, or clarity about it | Your network brings opportunities; a stable close relationship |
| Reputation | `reputation` | Can a stranger verify that your judgment has been right? | Nothing verifiable can be found online | A public record of work | Public, dated, verifiable judgments or work, cited by strangers |
| Position | `position` | Who pays you, and could you switch? | One payer, one market, skills that do not transfer | Skills that work across markets | More than one payer or market; can work remotely or move |

Evidence levels: Self-reported · Recorded · Verifiable by others. The output uses the same review-output-v2 structure, with `"template": "personal"` and no `fit` field.

Not investment advice. Not career advice. Not medical advice.

## 中文

只问一个问题：我在这个时代是否更值钱（按美元计）？规则与初创模板相同：四档是质量判断，与年龄和领域相近的人比较；未知是还没证明，不是差；不适用是暂时不适用；仅凭自述最多到正常；综合由人定，参考值只是已评维度的均值（少于三个为"资料不足"）。

只有一个关卡：健康。健康关卡为阻断，或健康维度为弱点，综合为暂缓。先处理健康。

前瞻检查：每个维度先按今天的证据定档，再对照海豹增长对 2027 年 11 月 11 日的预判给出 `outlook`（holds、at_risk、unknown 或 na），不改变档位，也不进参考值。

| 维度 | 代码 | 问的是什么 | 弱点 | 正常 | 优秀 |
|---|---|---|---|---|---|
| 健康 | `health` | 还能高强度工作多少年？ | 未治疗的慢性问题，或长期睡眠不足、不运动 | 能稳定撑满工作周，有基本体检 | 有记录的睡眠与运动，十年以上高强度余量 |
| 财富 | `wealth` | 多少年不用为钱做决定？ | 跑道不足 6 个月，或被债务驱动决策 | 按美元计 6 个月到 3 年的支出 | 5 年以上，或资产已产生收入 |
| 创造 | `creation` | 做出过别人做不出的东西吗，AI 能把它放大吗？ | 没有别人看得到的作品 | 有上线作品、有用户或读者 | 别人难以复制，且已用 AI 放大产出 |
| 关系 | `relationships` | 出事时谁会替你出手？ | 危机时没人会出手 | 有几位真正帮过你的人，亲密关系稳定或自知 | 关系网会带来机会，亲密关系稳定 |
| 声誉 | `reputation` | 陌生人查得到你判断对过吗？ | 网上查不到任何可验证的东西 | 有公开的作品记录 | 公开、带日期、可验证的判断或作品，有陌生人引用 |
| 位置 | `position` | 谁付你钱，你换得了吗？ | 单一付款方、单一市场、技能不可迁移 | 技能可跨市场 | 不止一个付款方或市场，可远程或迁移 |

证据等级：自述 · 有记录 · 他人可核验。输出沿用 review-output-v2 结构，`"template": "personal"`，没有 `fit` 字段。

不构成投资建议，不构成职业建议，不构成医疗建议。
