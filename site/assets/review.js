/* SEAL Growth 海豹增长 · review tool V0.5 (2026-11-13). Apache-2.0.
   One file holds all logic: quick sheet (or pasted text) → prompt → your own chat model (zero-API, default)
   or your own API key → parse and show. Two templates (startup / personal), two languages (en / zh).
   There is no server. A key stays in browser memory unless you tick "remember"; input goes only to the
   provider you pick, or to whatever chat product you paste the prompt into. */
(function () {
  'use strict';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function L(o) { return o ? (o[LANG] !== undefined ? o[LANG] : o.en) : ''; }

  /* ---------- tiers and states (shared by both templates) ---------- */
  var AXIS_TIERS = ['unknown', 'weak', 'normal', 'strong', 'na'];
  var TIER_COLOR = { unknown: '#6B3FA0', weak: '#D93025', normal: '#F2C200', strong: '#2E8B3E', na: '#9AA0A6', hold: '#1F1F1F' };
  var TIER_WORD = {
    en: { unknown: 'Unknown', weak: 'Weak', normal: 'Normal', strong: 'Strong', na: 'N/A', hold: 'Hold', insufficient: 'Insufficient data' },
    zh: { unknown: '未知', weak: '弱点', normal: '正常', strong: '优秀', na: '不适用', hold: '暂缓', insufficient: '资料不足' }
  };
  var GATE_STATES = ['unchecked', 'pass', 'block'];
  var GATE_WORD = { en: { unchecked: 'Unchecked', pass: 'Pass', block: 'Block' }, zh: { unchecked: '未核查', pass: '通过', block: '阻断' } };
  var PREMISE_STATES = ['verified', 'partial', 'unverified', 'false'];
  var PREMISE_WORD = { en: { verified: 'Verified', partial: 'Partly verified', unverified: 'Unverified', 'false': 'Does not hold' }, zh: { verified: '已核实', partial: '部分核实', unverified: '未核实', 'false': '不成立' } };
  var PREMISE_MARK = { verified: '●', partial: '◐', unverified: '○', 'false': '×' };
  var FIT = ['focus', 'recommended', 'other'];
  var FIT_WORD = {
    en: { focus: 'In person: AI wearables and pocket devices', recommended: 'First: light hardware + software', other: 'Other sectors' },
    zh: { focus: '亲自看：AI 随身设备', recommended: '先看：轻量软硬结合', other: '其他赛道' }
  };
  function tw(t) { return TIER_WORD[LANG][t] || t; }
  /* Outlook check: after each tier is set from today's evidence, an unscored look at a dated forecast.
     It never changes a tier or the reference value. Every date shown in the tool or the prompts comes from here. */
  var OUTLOOK_DATE = '2027-11-11';
  var OUTLOOKS = ['holds', 'at_risk', 'unknown', 'na'];
  var OUTLOOK_WORD = { en: { holds: 'Holds', at_risk: 'At risk', unknown: 'Unknown' }, zh: { holds: '仍成立', at_risk: '有风险', unknown: '未知' } };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function outlookDate(lang) { var p = OUTLOOK_DATE.split('-'); return lang === 'zh' ? p[0] + ' 年 ' + (+p[1]) + ' 月 ' + (+p[2]) + ' 日' : (+p[2]) + ' ' + MONTHS[p[1] - 1] + ' ' + p[0]; }
  function hasOutlook(a) { return !!(a && a.outlook && a.outlook !== 'na'); }
  function outlookText(a, sep) { return OUTLOOK_WORD[LANG][a.outlook] + (a.outlook_reason ? sep + a.outlook_reason : ''); }

  /* ---------- templates ---------- */
  function opts(list) { return list.map(function (x) { return { v: x[0], en: x[1], zh: x[2] }; }); }
  var TEMPLATES = {
    startup: {
      axes: [
        { key: 'market', en: 'Demand', zh: '市场需求', ask: { en: 'Who pays, and why now', zh: '谁付钱、为什么现在' },
          anchors: {
            en: { weak: 'The pain is only inferred and there is counter-evidence; or interviews or data show customers will not pay', normal: 'Budget holder, use case and acceptance criteria verified; letters of intent or a pilot', strong: 'Payments from unrelated parties, with repeat purchase or continued use; at scale, customers come unprompted. Demand created by subsidies is flagged separately' },
            zh: { weak: '痛点只是推断且有反证；或访谈、数据显示客户不愿付费', normal: '已核实预算人、使用场景和验收条件；有意向客户或试点', strong: '有非关联方回款，并有复购或持续使用；规模化，客户主动找来。补贴带来的需求另行标注' } } },
        { key: 'model', en: 'Business model', zh: '商业模式', ask: { en: 'How it charges; unit economics after delivery and collection', zh: '怎么收费；算进交付与回款后单位经济是否为正' },
          anchors: {
            en: { weak: 'No pricing yet; or the pricing logic conflicts with the customer budget', normal: 'A pricing logic, with a quote or a first order', strong: 'After acquisition, delivery, support, rework and payment cycle, unit economics are positive and repeatable; or margins hold under competition, with pricing power' },
            zh: { weak: '收费方式未定；或定价逻辑与客户预算冲突', normal: '有定价逻辑，有报价或首单', strong: '计入获客、交付、售后、返工和回款周期后，单位经济为正且能复制；或经竞争检验后毛利稳定、有议价权' } } },
        { key: 'capital', en: 'Capital efficiency', zh: '资本效率', ask: { en: 'Where the money goes and what it buys', zh: '钱花在哪、换来什么' },
          anchors: {
            en: { weak: 'Unclear use of funds; or heavy spending without milestones', normal: 'A budget and milestones; key risks are being removed with small money', strong: 'More validated than peers at the same stage and route, with ample runway; or self-funding' },
            zh: { weak: '用途不清；或重投入却没有里程碑', normal: '有预算和里程碑，关键风险正在用小钱消除', strong: '与同阶段、同路线公司相比验证成果更多，现金跑道充足；或能自我造血' } } },
        { key: 'moat', en: 'Moat', zh: '竞争壁垒', ask: { en: 'Is the difference tested and hard to route around', zh: '差异是否被验证、是否难以绕开' },
          anchors: {
            en: { weak: 'No difference; or a close alternative exists and there is no answer to it', normal: 'A claimed difference, tested head-to-head under equal conditions (patent applications alone do not count)', strong: 'A difference customers recognise and that is hard to route around; or several lasting moats (data, channels, scale). Granted patents alone do not make it Strong' },
            zh: { weak: '没有差异；或已有近邻方案而无应对', normal: '有差异主张，并在同等条件下对照验证过（只有专利申请不算）', strong: '客户认可的差异，绕开难度高；或数据、渠道、规模多重壁垒且能持续。授权专利本身不自动给优秀' } } },
        { key: 'execution', en: 'Execution', zh: '执行能力', ask: { en: 'Complete team, delivery record', zh: '团队是否完整、是否交付过' },
          anchors: {
            en: { weak: 'Team incomplete and no delivery record', normal: 'Core people in place with relevant experience; a prototype delivered (prototype, production and customer acceptance counted separately)', strong: 'Repeated on-time delivery with customer acceptance; yield and reliability checked; complete team' },
            zh: { weak: '团队不完整，且没有交付记录', normal: '核心人员到位、有相关经历，已交付原型（原型、量产、客户验收分开计）', strong: '多次按期交付，有客户验收，良率和可靠性经过核查；团队完备' } } },
        { key: 'return', en: 'Return', zh: '投资回报', ask: { en: 'Do valuation and terms match the evidence', zh: '估值与条款是否配得上证据' },
          anchors: {
            en: { weak: 'Valuation clearly above the evidence; or unclear terms', normal: 'Valuation roughly matches the stage', strong: 'Still reasonable after failure, delay, follow-on rounds, dilution and liquidation preference; a discount (name the reference) or a clear exit path' },
            zh: { weak: '估值明显高于证据；或条款不清', normal: '估值与阶段大体匹配', strong: '考虑失败、延期、后续融资、稀释和清算顺序后估值仍合理；有折价（说明参照对象）或退出路径清楚' } } }
      ],
      gates: [
        { key: 'fraud', en: 'Fraud', zh: '造假' },
        { key: 'tech', en: 'Key technology cannot work', zh: '关键技术不可行' },
        { key: 'cash', en: 'Cash about to run out', zh: '现金即将断流' },
        { key: 'integrity', en: 'Integrity and related-party dealings', zh: '诚信与关联交易' }
      ],
      sources: opts([['self', 'Self-reported', '公司自述'], ['doc', 'Documented', '文件佐证'], ['verified', 'Independently verified', '独立核验']]),
      ctx: [
        { name: 'name', type: 'text', half: 1, label: { en: 'Code name', zh: '公司代号' }, ph: { en: 'e.g. Company A', zh: '如：公司甲' } },
        { name: 'track', type: 'text', half: 1, label: { en: 'One line: what, for whom', zh: '赛道一句话' }, ph: { en: 'What it makes, who buys it', zh: '做什么、卖给谁' } },
        { name: 'stage', type: 'seg', label: { en: 'Stage', zh: '阶段' }, options: opts([['concept', 'Concept', '概念'], ['poc', 'Proof of concept', '原理验证'], ['prototype', 'Prototype', '样机'], ['pilot', 'Pilot', '试点'], ['paying', 'Paying', '付费'], ['production', 'Production', '量产']]) },
        { name: 'industry', type: 'seg', label: { en: 'Sector', zh: '行业' }, options: opts([['wearables', 'Consumer hardware / wearables', '消费硬件/随身设备'], ['robotics', 'Robotics', '机器人'], ['manufacturing', 'Manufacturing', '制造/工业'], ['bio', 'Life sciences', '医药/生物'], ['research', 'Research tools', '科研工具'], ['enterprise', 'Enterprise software', '企业软件'], ['consumer', 'Consumer software', '消费软件/内容'], ['finance', 'Finance', '金融'], ['other', 'Other', '其他']]) },
        { name: 'founder', type: 'seg', half: 1, label: { en: 'Founder background', zh: '创始人背景' }, options: opts([['tech', 'Technical', '技术'], ['industry', 'Industry veteran', '行业资深'], ['serial', 'Serial founder', '连续创业'], ['academic', 'Academic', '学术'], ['other', 'Other', '其他']]) },
        { name: 'bizmodel', type: 'seg', half: 1, label: { en: 'Business model', zh: '商业模式' }, options: opts([['subscription', 'Subscription', '订阅'], ['project', 'Projects', '项目制'], ['hwsw', 'Hardware + software', '硬件+软件'], ['license', 'Licensing', '技术授权'], ['platform', 'Platform fee', '平台抽成'], ['other', 'Other', '其他']]) },
        { name: 'compliance', type: 'seg', label: { en: 'Compliance', zh: '合规敏感点' }, options: opts([['none', 'Nothing special', '无特殊'], ['data', 'Data / privacy', '数据/隐私'], ['medical', 'Medical approval', '医疗/药监'], ['finlicense', 'Financial licence', '金融牌照'], ['export', 'Export control', '出口管制'], ['other', 'Other', '其他']]) },
        { name: 'team', type: 'text', half: 1, label: { en: 'Team', zh: '团队' }, ph: { en: 'Full-time headcount, key gaps', zh: '全职几人，关键缺口' } },
        { name: 'round', type: 'text', half: 1, label: { en: 'This round', zh: '本轮' }, ph: { en: 'Amount · valuation · stake · use of funds', zh: '金额 · 估值 · 出让 · 用途占比' } }
      ],
      deck: { label: { en: 'Deck or memo text (optional)', zh: 'BP 或备忘录文字（可选）' }, ph: { en: 'Paste the text of your deck. Use a code name instead of the company name; remove contact details, contracts and customer lists.', zh: '把 BP 的文字贴进来。用代号代替公司名；删掉联系方式、合同和客户名单原文。' } },
      extra: [
        { name: 'notes', type: 'textarea', max: 600, label: { en: 'Notes', zh: '笔记' }, ph: { en: 'Hunches, worries, what you heard; under 100 words', zh: '直觉、担心、听到的、没写进上面的；300 字内' } },
        { name: 'materials', type: 'textarea', max: 400, label: { en: 'Material at hand', zh: '手头材料' }, ph: { en: 'File names or types only, not contents', zh: '只写文件名或类型，不贴内容' } },
        { name: 'q_round', type: 'text', group: 'quant', label: { en: 'Round', zh: '本轮' }, ph: { en: 'Amount / pre-money / stake', zh: '本轮金额 / 投前估值 / 出让' } },
        { name: 'q_ops', type: 'text', group: 'quant', label: { en: 'Operations', zh: '经营' }, ph: { en: 'Last-12-month revenue / gross margin / paying customers', zh: '近 12 月营收 / 毛利率 / 付费客户数' } },
        { name: 'q_cash', type: 'text', group: 'quant', label: { en: 'Cash', zh: '资金' }, ph: { en: 'Cash / monthly burn', zh: '现金余额 / 月支出' } },
        { name: 'q_next', type: 'text', group: 'quant', label: { en: 'Next milestone', zh: '下个里程碑' }, ph: { en: 'When, and what', zh: '几个月后、是什么' } }
      ]
    },
    personal: {
      axes: [
        { key: 'health', en: 'Health', zh: '健康', ask: { en: 'How many more years of high-intensity work do you have?', zh: '还能高强度工作多少年？' },
          anchors: {
            en: { weak: 'An untreated chronic problem, or long-term poor sleep and no exercise', normal: 'Can sustain a full work week; basic check-ups done', strong: 'Recorded sleep and exercise; ten-plus years of high-intensity capacity left' },
            zh: { weak: '未治疗的慢性问题，或长期睡眠不足、不运动', normal: '能稳定撑满工作周，有基本体检', strong: '有记录的睡眠与运动，十年以上高强度余量' } } },
        { key: 'wealth', en: 'Wealth', zh: '财富', ask: { en: 'How many years could you go without making a decision for money?', zh: '多少年不用为钱做决定？' },
          anchors: {
            en: { weak: 'Less than 6 months of runway, or decisions driven by debt', normal: '6 months to 3 years of spending, counted in US dollars', strong: '5 years or more, or assets that already produce income' },
            zh: { weak: '跑道不足 6 个月，或被债务驱动决策', normal: '按美元计 6 个月到 3 年的支出', strong: '5 年以上，或资产已产生收入' } } },
        { key: 'creation', en: 'Creation', zh: '创造', ask: { en: 'Have you made something others cannot, and can AI multiply it?', zh: '做出过别人做不出的东西吗，AI 能把它放大吗？' },
          anchors: {
            en: { weak: 'Nothing others can see', normal: 'Shipped work with users or readers', strong: 'Hard for others to copy, and already multiplied with AI' },
            zh: { weak: '没有别人看得到的作品', normal: '有上线作品、有用户或读者', strong: '别人难以复制，且已用 AI 放大产出' } } },
        { key: 'relationships', en: 'Relationships', zh: '关系', ask: { en: 'Who would act for you in a crisis?', zh: '出事时谁会替你出手？' },
          anchors: {
            en: { weak: 'Nobody would act for you in a crisis', normal: 'A few people who have really helped you; a stable close relationship, or clarity about it', strong: 'Your network brings opportunities; a stable close relationship' },
            zh: { weak: '危机时没人会出手', normal: '有几位真正帮过你的人，亲密关系稳定或自知', strong: '关系网会带来机会，亲密关系稳定' } } },
        { key: 'reputation', en: 'Reputation', zh: '声誉', ask: { en: 'Can a stranger verify that your judgment has been right?', zh: '陌生人查得到你判断对过吗？' },
          anchors: {
            en: { weak: 'Nothing verifiable can be found online', normal: 'A public record of work', strong: 'Public, dated, verifiable judgments or work, cited by strangers' },
            zh: { weak: '网上查不到任何可验证的东西', normal: '有公开的作品记录', strong: '公开、带日期、可验证的判断或作品，有陌生人引用' } } },
        { key: 'position', en: 'Position', zh: '位置', ask: { en: 'Who pays you, and could you switch?', zh: '谁付你钱，你换得了吗？' },
          anchors: {
            en: { weak: 'One payer, one market, skills that do not transfer', normal: 'Skills that work across markets', strong: 'More than one payer or market; can work remotely or move' },
            zh: { weak: '单一付款方、单一市场、技能不可迁移', normal: '技能可跨市场', strong: '不止一个付款方或市场，可远程或迁移' } } }
      ],
      gates: [{ key: 'health', en: 'Health needs attention first', zh: '健康需要先处理' }],
      sources: opts([['self', 'Self-reported', '自述'], ['doc', 'Recorded', '有记录'], ['verified', 'Verifiable by others', '他人可核验']]),
      ctx: [
        { name: 'name', type: 'text', half: 1, label: { en: 'Code name', zh: '代号' }, ph: { en: 'e.g. R.', zh: '如：R.' } },
        { name: 'job', type: 'text', half: 1, label: { en: 'What you do', zh: '职业' }, ph: { en: 'Role, field, years', zh: '角色、领域、年限' } },
        { name: 'age', type: 'seg', half: 1, label: { en: 'Age', zh: '年龄段' }, options: opts([['u25', 'Under 25', '25 岁以下'], ['25-34', '25–34', '25–34'], ['35-44', '35–44', '35–44'], ['45+', '45+', '45 岁以上']]) },
        { name: 'currency', type: 'seg', half: 1, label: { en: 'Paid in', zh: '收入币种' }, options: opts([['usd', 'USD', '美元'], ['eur', 'EUR', '欧元'], ['cny', 'CNY', '人民币'], ['other', 'Other', '其他']]) },
        { name: 'place', type: 'text', half: 1, label: { en: 'City, country', zh: '所在城市、国家' }, ph: { en: 'e.g. Shenzhen, China', zh: '如：中国深圳' } },
        { name: 'hours', type: 'text', half: 1, label: { en: 'Hours per week', zh: '每周工作小时' }, ph: { en: 'e.g. 50', zh: '如：50' } },
        { name: 'runway', type: 'text', half: 1, label: { en: 'Savings last how many months', zh: '储蓄可支撑几个月' }, ph: { en: 'e.g. 8', zh: '如：8' } }
      ],
      deck: { label: { en: 'About you (optional)', zh: '关于你（可选）' }, ph: { en: 'Paste a CV or a few paragraphs about yourself. Remove contact details and anything about other people.', zh: '贴一份简历或几段自述。删掉联系方式和任何关于他人的信息。' } },
      extra: [
        { name: 'notes', type: 'textarea', max: 600, label: { en: 'Notes', zh: '笔记' }, ph: { en: 'What worries you; where you want to be in three years', zh: '担心什么；三年后想在哪里' } }
      ]
    }
  };

  /* ---------- synthetic samples (fictional) ---------- */
  var SAMPLES = {
    startup: {
      en: {
        f: { name: 'Sample Co. (synthetic)', track: 'AI visual inspection module for small electronics factories, sold to line integrators', stage: 'prototype', industry: 'manufacturing', founder: 'tech', bizmodel: 'hwsw', compliance: 'none', team: '6 full-time; no head of sales', round: 'US$1.1m · pre-money US$8.5m · about 12% · R&D 60%, market 25%, team 15%', notes: 'Founder knows line takt time well; vague on pricing. One of the two rivals named could not be found.', materials: 'Deck (12 pages), comparison test record (PDF), two letters of intent', q_round: 'US$1.1m / US$8.5m / 12%', q_ops: 'Revenue 0 / — / 0 paying', q_cash: 'Cash 3m / burn 0.45m a month', q_next: 'In 6 months: both prototypes pass acceptance', deck: '' },
        axes: [
          { tier: 'normal', evidence: 'Two integrators sent letters of intent; pilot schedule under discussion', source: 'doc' },
          { tier: 'unknown', evidence: 'Not decided: sell per module or subscribe per line', source: 'self' },
          { tier: 'na', evidence: 'First round, nothing raised yet', source: 'self' },
          { tier: 'strong', evidence: 'Under equal lighting, miss rate below two rivals in a recorded comparison', source: 'doc' },
          { tier: 'normal', evidence: 'Two prototypes delivered; customer acceptance not done', source: 'doc' },
          { tier: 'weak', evidence: 'Valuation back-solved from next year\'s revenue plan; no term sheet', source: 'self' }
        ],
        gates: { fraud: { state: 'unchecked', why: 'Not checked in the meeting' }, tech: { state: 'pass', why: 'Comparison record matches the live demo' }, cash: { state: 'unchecked', why: 'About 6 months of cash; bank statements not checked' }, integrity: { state: 'unchecked', why: '' } },
        premises: [
          { text: 'Integrators will pay more for a lower miss rate', status: 'unverified', critical: true },
          { text: 'Both prototypes pass customer acceptance within three months', status: 'unverified', critical: true },
          { text: 'The core model moves to a new product category within a week', status: 'partial', critical: false }
        ]
      },
      zh: {
        f: { name: '示例公司（合成）', track: '面向中小电子厂的 AI 视觉外观检测模块，卖给产线集成商', stage: 'prototype', industry: 'manufacturing', founder: 'tech', bizmodel: 'hwsw', compliance: 'none', team: '全职 6 人，缺销售负责人', round: '110 万美元 · 投前 850 万美元 · 出让约 12% · 研发 60% 市场 25% 团队 15%', notes: '创始人对产线节拍很熟，对定价回答含糊；提到的两家对手一家没查到。', materials: 'BP（12 页）、对照测试记录（PDF）、两份意向书扫描件', q_round: '110 万美元 / 850 万美元 / 12%', q_ops: '近 12 月营收 0 / — / 付费 0', q_cash: '现金 300 万 / 月支出 45 万', q_next: '6 个月后：两台样机通过验收', deck: '' },
        axes: [
          { tier: 'normal', evidence: '两家集成商出具意向，试点排期在谈', source: 'doc' },
          { tier: 'unknown', evidence: '按模块卖还是按产线订阅没定', source: 'self' },
          { tier: 'na', evidence: '尚未融资，首轮', source: 'self' },
          { tier: 'strong', evidence: '同等光照条件下对照测试漏检率低于两家对手，有测试记录', source: 'doc' },
          { tier: 'normal', evidence: '样机交付两台，客户验收未完成', source: 'doc' },
          { tier: 'weak', evidence: '估值按明年收入规划倒推，条款未出', source: 'self' }
        ],
        gates: { fraud: { state: 'unchecked', why: '会上未核查' }, tech: { state: 'pass', why: '对照测试记录与现场演示一致' }, cash: { state: 'unchecked', why: '现金约可撑 6 个月，未核对银行流水' }, integrity: { state: 'unchecked', why: '' } },
        premises: [
          { text: '集成商愿意为漏检率下降付溢价', status: 'unverified', critical: true },
          { text: '现有两台样机三个月内通过客户验收', status: 'unverified', critical: true },
          { text: '核心算法在新品类上一周内可迁移', status: 'partial', critical: false }
        ]
      }
    },
    personal: {
      en: {
        f: { name: 'R. (fictional)', job: 'Backend engineer, 6 years', age: '25-34', currency: 'cny', place: 'Shenzhen, China', hours: '55', runway: '4', notes: 'Wants to go independent within two years; worried about runway.', deck: '' },
        axes: [
          { tier: 'normal', evidence: 'Annual check-up normal; sleeps about 6.5 hours; runs twice a week', source: 'self' },
          { tier: 'weak', evidence: 'Savings cover about 4 months of spending', source: 'self' },
          { tier: 'normal', evidence: 'Maintains an open-source library with about 300 users', source: 'doc' },
          { tier: '', evidence: '', source: '' },
          { tier: 'weak', evidence: 'Nothing public beyond the library; no written judgments', source: 'self' },
          { tier: 'normal', evidence: 'Skills transfer across markets; paid in CNY by one employer', source: 'self' }
        ],
        gates: { health: { state: 'unchecked', why: '' } },
        premises: [
          { text: 'A side project can earn in USD within 12 months', status: 'unverified', critical: true },
          { text: 'Savings can stretch to 9 months if needed', status: 'partial', critical: false }
        ]
      },
      zh: {
        f: { name: 'R.（虚构）', job: '后端工程师，6 年', age: '25-34', currency: 'cny', place: '中国深圳', hours: '55', runway: '4', notes: '想两年内独立出来；担心现金跑道。', deck: '' },
        axes: [
          { tier: 'normal', evidence: '年度体检正常；每晚约睡 6.5 小时；每周跑步两次', source: 'self' },
          { tier: 'weak', evidence: '储蓄约够 4 个月支出', source: 'self' },
          { tier: 'normal', evidence: '维护一个约 300 人使用的开源库', source: 'doc' },
          { tier: '', evidence: '', source: '' },
          { tier: 'weak', evidence: '除开源库外没有公开记录，没写过公开判断', source: 'self' },
          { tier: 'normal', evidence: '技能可跨市场；只有一个雇主，收入是人民币', source: 'self' }
        ],
        gates: { health: { state: 'unchecked', why: '' } },
        premises: [
          { text: '副业 12 个月内能有美元收入', status: 'unverified', critical: true },
          { text: '需要时储蓄能撑到 9 个月', status: 'partial', critical: false }
        ]
      }
    }
  };

  /* ---------- model providers (tested ones: from a browser on a Shanghai computer, 2026-11-05) ---------- */
  var TESTED = { en: 'Tested 2026-11-05: a browser can call it directly', zh: '2026-11-05 实测可从浏览器直连' };
  var PROVIDERS = {
    anthropic: { name: { en: 'Claude (Anthropic)', zh: 'Claude（Anthropic）' }, base: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', kind: 'anthropic', tested: true, note: { en: 'api.anthropic.com; the provider must serve your region', zh: 'api.anthropic.com；需服务商支持你所在地区' } },
    openai: { name: { en: 'OpenAI', zh: 'OpenAI' }, base: 'https://api.openai.com/v1', model: '', kind: 'openai', json: true, tested: false, note: { en: 'api.openai.com · not tested from our machine. Fill in a model name from your account, or load the list.', zh: 'api.openai.com · 我们未实测。模型名请填你账号里的，或读取模型列表。' } },
    deepseek: { name: { en: 'DeepSeek', zh: 'DeepSeek' }, base: 'https://api.deepseek.com', model: 'deepseek-chat', kind: 'openai', json: true, tested: true, note: { en: 'api.deepseek.com', zh: 'api.deepseek.com' } },
    qwen: { name: { en: 'Qwen (Alibaba Cloud Model Studio)', zh: '通义千问（阿里云百炼）' }, base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', kind: 'openai', json: true, tested: true, note: { en: 'dashscope.aliyuncs.com, compatible mode', zh: 'dashscope.aliyuncs.com 兼容模式' } },
    moonshot: { name: { en: 'Kimi (Moonshot)', zh: 'Kimi（Moonshot）' }, base: 'https://api.moonshot.cn/v1', model: 'kimi-k2-0905-preview', kind: 'openai', json: true, tested: true, note: { en: 'api.moonshot.cn; check model names in your account', zh: 'api.moonshot.cn；模型名以你账号的列表为准' } },
    siliconflow: { name: { en: 'SiliconFlow', zh: '硅基流动 SiliconFlow' }, base: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3.1', kind: 'openai', json: false, tested: true, note: { en: 'api.siliconflow.cn', zh: 'api.siliconflow.cn' } },
    minimax: { name: { en: 'MiniMax', zh: 'MiniMax' }, base: 'https://api.minimaxi.com/v1', model: 'MiniMax-M2', kind: 'openai', json: false, path: '/text/chatcompletion_v2', tested: true, note: { en: 'api.minimaxi.com', zh: 'api.minimaxi.com' } },
    custom: { name: { en: 'Custom (OpenAI-compatible)', zh: '自定义（OpenAI 兼容）' }, base: '', model: '', kind: 'openai', json: false, tested: false, note: { en: 'Any OpenAI-compatible endpoint; it must allow browser calls (CORS)', zh: '任何 OpenAI 兼容接口；需要服务商允许浏览器跨域（CORS）' } }
  };

  /* ---------- interface text ---------- */
  var I18N = {
    en: {
      'title': 'Review tool · SEAL Growth',
      'nav.home': 'Home', 'nav.method': 'Method', 'nav.cases': 'Cases', 'nav.tool': 'Tool', 'nav.contact': 'Contact', 'nav.lang': '中文', 'nav.lang.aria': 'Switch to Chinese',
      'head.h1': 'Run the same method with your own model',
      'head.lede': 'Paste your text or fill in a short sheet, copy the prompt into your own chat model, then paste its answer back. You get six tiers, key premises, gates and what to prove next, by the open method.',
      'head.key': 'Key', 'head.key.d': 'Not needed by default. If you use one, it stays in browser memory and is forgotten on reload, unless you tick "remember". Drafts are saved only in this browser; "Clear" deletes them. This site has no server and receives nothing.',
      'head.input': 'Input', 'head.input.d': 'Goes only to the chat product you paste into, or the provider you pick.',
      'head.code': 'Code', 'head.code.d': 'All logic is in <code>assets/review.js</code>, open source.',
      'tpl.label': 'Template', 'tpl.startup': 'Startup', 'tpl.personal': 'Personal',
      'banner.startup': 'AI-assisted self-review. Not independently verified, not endorsed by SEAL Growth, not investment advice, no promise of funding or returns. Use a code name; leave out contact details, contracts and customer lists.',
      'banner.personal': 'AI-assisted self-review. Not independently verified; not medical, career or investment advice. Use a code name; leave out contact details and anything about other people.',
      'h.ctx': '1. Context', 'hint.ctx.startup': 'Sets what to check and where the bar is; it does not change the method.', 'hint.ctx.personal': 'A few facts about where you stand now.',
      'h.deck': '2. Paste your text', 'hint.deck.startup': 'Optional. The model treats it as the founder\'s own claims.', 'hint.deck.personal': 'Optional. The model treats it as your own claims.',
      'h.axes': '3. Six dimensions', 'hint.axes': 'Pick a tier per row, or leave it for the model to suggest. One line of evidence and its source.',
      'h.gates.startup': '4. Gates', 'hint.gates.startup': 'Not scored. Only verified evidence can block; if you have not checked, say so.',
      'h.gates.personal': '4. Gate', 'hint.gates.personal': 'One gate. If health needs attention first, everything else waits.',
      'h.premises': '5. Key premises', 'hint.premises.startup': '2 to 3 things that must be true for this to work; mark at least one as key.', 'hint.premises.personal': '2 to 3 things that must be true for your plan to work; mark at least one as key.',
      'h.extra': '6. Notes',
      'f.tier': 'Your tier (optional)', 'f.evidence': 'Evidence, one line', 'f.source': 'Source', 'f.why': 'Why (one line)', 'f.premise': 'Premise', 'f.premise.ph': 'What must hold (under 15 words)', 'f.critical': 'Key premise', 'f.quant': 'Numbers (optional, write your units)',
      'btn.sample': 'Fill a synthetic sample', 'btn.clear': 'Clear', 'btn.copysheet': 'Copy sheet (Markdown)',
      'run.h': 'Run', 'run.hint': 'Same output either way; conclusions vary by model. Nothing passes through this site.',
      'consent': 'I have the right to submit this, and I know it goes to the chat product or provider I choose. I will not include other people\'s contact details, contracts or customer lists.',
      'zero.h': 'No API key (default)', 'zero.hint': 'Step 1: copy the prompt into any chat model (web or app). Step 2: paste its JSON reply below and show it.',
      'btn.copyprompt': '① Copy prompt', 'btn.showprompt': 'View prompt', 'zero.paste': '② Paste the model\'s reply', 'btn.parse': '③ Parse and show',
      'adv.h': 'Advanced: use your own API key', 'adv.provider': 'Provider', 'adv.base': 'Endpoint (OpenAI-compatible, up to /v1)', 'adv.key': 'Your API key', 'adv.key.ph': 'Kept in memory only', 'adv.remember': 'Remember in this browser (localStorage, plain text; not on shared computers)', 'adv.model': 'Model name', 'adv.model.sub': 'Use your provider\'s current list; with a key filled in you can <a href="#" id="btn-models"><u>load the model list</u></a>.', 'btn.run': 'Start review',
      'adv.tested': 'Direct-call test (2026-11-05)', 'adv.tested.d': 'From a browser on a computer in Shanghai: DeepSeek, Qwen (Model Studio), Kimi, SiliconFlow, MiniMax and Anthropic allowed direct calls. Zhipu, Volcano Ark and OpenAI could not be reached from that network; use the no-key mode. Your network may differ.',
      'offline': 'Offline version: one HTML file you can open from your own disk.', 'offline.link': 'Download review-offline.html',
      'res.title': 'Result', 'res.overall': 'Overall (reference)', 'res.weakest': 'Weakest key premise', 'res.gates': 'Gates', 'res.fit': 'Where it fits',
      'res.axes': 'Six dimensions', 'res.premises': 'Key premises', 'res.next': 'What to prove next', 'res.requests.startup': 'Material to add', 'res.requests.personal': 'Evidence to collect', 'res.questions.startup': 'Three questions for the meeting', 'res.questions.personal': 'Three questions to ask yourself', 'res.caveats': 'Where the model is unsure',
      'res.outlook': 'Outlook: SEAL Growth\'s forecast for {d}, not a fact. It never changes a tier.',
      'res.invite': 'Want a human view? Send this review to the contact on the SEAL Growth home page. Entirely optional: nothing leaves this page unless you send it.',
      'res.banner.startup': 'AI-assisted self-review · not independently verified · not endorsed by SEAL Growth · not investment advice · no promise of funding or returns. You decide the final tiers; the model only suggests and lists gaps.',
      'res.banner.personal': 'AI-assisted self-review · not independently verified · not medical, career or investment advice. You decide the final tiers; the model only suggests and lists gaps.',
      'btn.copymd': 'Copy Markdown', 'btn.dlmd': 'Download .md', 'btn.dljson': 'Download JSON', 'btn.raw': 'View raw output',
      'foot': 'SEAL Growth invests no cash and charges no fees; it promises no returns and does not publicly solicit investors. This tool is provided as is; its output is an AI-assisted self-review, not independently verified, and not investment advice. Your key and input never touch this site. Docs CC BY-SA 4.0 · Code Apache-2.0 ·',
      'foot.home': 'Home', 'foot.top': 'Back to top',
      'unnamed': 'Untitled', 'none': 'None', 'unset': '(blank)', 'notchosen': 'not chosen',
      'next': 'Next', 'missing': 'Missing', 'agree': 'Model agrees', 'disagree': 'Model disagrees, suggests', 'suggested': 'Model suggestion', 'key': 'key',
      'verify': 'Verify', 'by': 'By', 'pass': 'Pass line', 'good': 'Good answer', 'red': 'Red flag',
      'ref.hold': 'A gate failed, so the reference is Hold, not an average', 'ref.insufficient': 'Fewer than three rated dimensions; no average', 'ref.mean': 'Reference = mean of rated dimensions', 'ref.you': 'you decide the overall tier',
      'no.premise': 'No key premise given', 'no.caveat': 'The model gave none',
      's.consent': 'Please tick the confirmation above first.', 's.copied.prompt': 'Prompt copied. Paste it into any chat model, then paste its JSON reply below.', 's.copy.fail.prompt': 'Copy failed. Click "View prompt" and copy by hand.',
      's.paste.first': 'Paste the model\'s reply first.', 's.done': 'Done.', 's.copied.sheet': 'Sheet copied.', 's.copy.fail': 'Copy failed; select it by hand.', 's.copied.md': 'Markdown copied.',
      's.key.first': 'Fill in the key first.', 's.base.bad': 'The endpoint must be a full https:// provider address, and not this site.', 's.models.loading': 'Loading model list…', 's.models.n': 'Found {n} models; pick one in the model name box.', 's.models.none': 'The provider returned no model list.', 's.models.fail': 'Could not load: ',
      's.need.key': 'Please enter your API key.', 's.need.model': 'Please enter a model name.', 's.sent': 'Sent to {p}; usually 20 to 90 seconds…',
      'e.timeout': 'Timed out (240 seconds). Try a faster model.', 'e.cors': 'The browser cannot reach this provider directly (CORS refused or network blocked). Use the no-key mode, or another provider.', 'e.notjson': 'The provider did not return JSON: ', 'e.provider': 'Provider error: ', 'e.nochoice': 'No choices[0].message in the reply',
      'e.nojson': 'No JSON object found. The model may not have followed the format; use "View raw output".', 'e.parse': 'JSON parse failed: ', 'e.version': 'version should be review-output-v2 (or v1), got ', 'e.v1': 'A review-output-v1 reply only fits the Startup template.', 'e.tpl': 'This reply is for the {t} template. Switch template first.', 'e.axes': 'axes must hold six dimensions, one each. Missing: ', 'e.axes.n': 'axes should have 6 items, got ', 'e.short': 'The reply does not match the format: ',
      'e.premises': 'premises needs at least 2', 'e.next': 'next_steps needs at least 3', 'e.questions': 'questions should be exactly 3', 'e.caveats': 'caveats needs at least 1', 'e.requests': 'requests array missing', 'e.dup': '(duplicates or extras)', 'e.see.raw': ' Use "View raw output".',
      'src.zero': 'No-key mode · pasted by hand'
    },
    zh: {
      'title': '评审工具 · 海豹增长 SEAL Growth',
      'nav.home': '首页', 'nav.method': '方法', 'nav.cases': '案例', 'nav.tool': '工具', 'nav.contact': '联系', 'nav.lang': 'EN', 'nav.lang.aria': '切换到英文',
      'head.h1': '用你自己的模型，跑同一套方法',
      'head.lede': '贴一段文字或填一张速查表，把提示词复制到你自己的对话模型里，再把回答贴回来。你会拿到六维归档建议、关键前提、关卡状态和"下一步要证明什么"，按开源方法。',
      'head.key': '密钥', 'head.key.d': '默认不需要。如果用，只存在浏览器内存里，刷新即忘；勾选"记住"才存进本浏览器。草稿只存在本浏览器里，点"清空"即删。本站没有服务器，收不到任何内容。',
      'head.input': '输入', 'head.input.d': '只去你粘贴到的对话产品，或你选择的服务商。',
      'head.code': '代码', 'head.code.d': '全部逻辑在 <code>assets/review.js</code>，开源。',
      'tpl.label': '模板', 'tpl.startup': '初创', 'tpl.personal': '个人',
      'banner.startup': 'AI 辅助自评，未经独立核验，不代表海豹增长背书，不构成投资建议，不承诺融资或收益。请用代号代替公司名，不要填联系方式、合同或客户名单原文。',
      'banner.personal': 'AI 辅助自评，未经独立核验，不构成医疗、职业或投资建议。请用代号，不要填联系方式和任何关于他人的信息。',
      'h.ctx': '一、情境', 'hint.ctx.startup': '决定查什么、合格线在哪，不改方法。', 'hint.ctx.personal': '几条关于你现在处境的事实。',
      'h.deck': '二、贴文字', 'hint.deck.startup': '可选。模型会把它当作创始人自述。', 'hint.deck.personal': '可选。模型会把它当作你的自述。',
      'h.axes': '三、六维', 'hint.axes': '每行选一档，或不选、让模型建议。证据写一句并注明来源。',
      'h.gates.startup': '四、关卡', 'hint.gates.startup': '不计分。只有核实的证据才算阻断；没核查就写未核查。',
      'h.gates.personal': '四、关卡', 'hint.gates.personal': '只有一个关卡：健康需要先处理时，其余全部暂缓。',
      'h.premises': '五、关键前提', 'hint.premises.startup': '这个项目成立必须为真的 2 到 3 件事，至少一条标为关键。', 'hint.premises.personal': '你的计划成立必须为真的 2 到 3 件事，至少一条标为关键。',
      'h.extra': '六、笔记',
      'f.tier': '你的档位（可不选）', 'f.evidence': '证据一句', 'f.source': '来源', 'f.why': '理由（一句）', 'f.premise': '前提', 'f.premise.ph': '什么必须成立（40 字内）', 'f.critical': '关键前提', 'f.quant': '量化（可选，单位自写）',
      'btn.sample': '填入合成样例', 'btn.clear': '清空', 'btn.copysheet': '复制速查表 (Markdown)',
      'run.h': '运行', 'run.hint': '两种方式输出结构相同，结论随模型不同而不同。都不经过本站。',
      'consent': '我确认有权提交以上信息，并知悉它们会发送给我选择的对话产品或服务商；我不会填入他人的联系方式、合同或客户名单原文。',
      'zero.h': '零接口（默认）', 'zero.hint': '第一步：复制提示词，粘贴到任意对话模型（网页或 App 都行）。第二步：把它回复的 JSON 原样贴到下面，解析。',
      'btn.copyprompt': '① 复制提示词', 'btn.showprompt': '查看提示词', 'zero.paste': '② 粘贴模型回复', 'btn.parse': '③ 解析并展示',
      'adv.h': '进阶：用自己的 API 密钥', 'adv.provider': '模型服务商', 'adv.base': '接口地址（OpenAI 兼容，到 /v1 为止）', 'adv.key': '你的 API 密钥', 'adv.key.ph': '只存内存，刷新即忘', 'adv.remember': '记在这个浏览器里（localStorage，明文，公用电脑请勿勾选）', 'adv.model': '模型名', 'adv.model.sub': '以服务商当前的模型列表为准；填好密钥后可<a href="#" id="btn-models"><u>读取模型列表</u></a>。', 'btn.run': '开始评审',
      'adv.tested': '直连实测说明（2026-11-05）', 'adv.tested.d': '在一台位于上海的电脑上从浏览器直接请求各家接口：DeepSeek、通义千问（百炼）、Kimi、SiliconFlow、MiniMax、Anthropic 允许浏览器跨域直连；智谱、火山方舟（豆包）、OpenAI 在该网络下无法直连，请用零接口方式。你的网络可能不同。',
      'offline': '离线版：一个 HTML 文件，可以从你自己的硬盘打开。', 'offline.link': '下载 review-offline.html',
      'res.title': '评审结果', 'res.overall': '综合参考', 'res.weakest': '最弱关键前提', 'res.gates': '关卡', 'res.fit': '落在哪一圈',
      'res.axes': '六维', 'res.premises': '关键前提', 'res.next': '下一步要证明什么', 'res.requests.startup': '要补的材料', 'res.requests.personal': '要收集的证据', 'res.questions.startup': '会上要问的三个问题', 'res.questions.personal': '问自己的三个问题', 'res.caveats': '模型自述的不确定处',
      'res.outlook': '前瞻：海豹增长对 {d}的预判，不是事实，不改变档位。',
      'res.invite': '想听听人的看法，可以把这份评审发到海豹增长首页的联系方式。完全自愿：你不发，什么都不会离开这个页面。',
      'res.banner.startup': 'AI 辅助自评 · 未经独立核验 · 不代表海豹增长背书 · 不构成投资建议 · 不承诺融资或收益。档位由你最终决定；模型只给建议与缺口。',
      'res.banner.personal': 'AI 辅助自评 · 未经独立核验 · 不构成医疗、职业或投资建议。档位由你最终决定；模型只给建议与缺口。',
      'btn.copymd': '复制 Markdown', 'btn.dlmd': '下载 .md', 'btn.dljson': '下载 JSON', 'btn.raw': '查看原始输出',
      'foot': '海豹增长不投现金，不收费；不向任何人承诺回报，不公开招揽投资人。本页工具按原样提供，输出为 AI 辅助自评，未经独立核验，不构成投资建议。密钥与输入不经过本站。文档 CC BY-SA 4.0 · 代码 Apache-2.0 ·',
      'foot.home': '首页', 'foot.top': '回到顶部',
      'unnamed': '未命名', 'none': '无', 'unset': '（未填）', 'notchosen': '未选',
      'next': '下一步', 'missing': '缺', 'agree': '模型同意', 'disagree': '模型不同意，建议', 'suggested': '模型建议', 'key': '关键',
      'verify': '验证', 'by': '期限', 'pass': '通过线', 'good': '好答案', 'red': '红旗',
      'ref.hold': '有关卡未过，参考值为暂缓，不按均值', 'ref.insufficient': '已评维度少于三个，不计算均值', 'ref.mean': '参考值按已评维度均值计算', 'ref.you': '综合档位由你定',
      'no.premise': '未给出关键前提', 'no.caveat': '模型未说明',
      's.consent': '请先勾选上面的确认。', 's.copied.prompt': '提示词已复制。去任意对话模型粘贴，把它回复的 JSON 贴到下面。', 's.copy.fail.prompt': '复制失败，请点"查看提示词"手动复制。',
      's.paste.first': '先粘贴模型的回复。', 's.done': '完成。', 's.copied.sheet': '速查表已复制。', 's.copy.fail': '复制失败，请手动选择。', 's.copied.md': 'Markdown 已复制。',
      's.key.first': '先填密钥。', 's.base.bad': '接口地址必须是 https:// 开头的服务商完整地址，且不能是本站。', 's.models.loading': '正在读取模型列表…', 's.models.n': '读到 {n} 个模型，在模型名框里下拉选择。', 's.models.none': '服务商没有返回模型列表。', 's.models.fail': '读取失败：',
      's.need.key': '请填入你的 API 密钥。', 's.need.model': '请填模型名。', 's.sent': '已发送给 {p}，通常 20 到 90 秒…',
      'e.timeout': '超时（240 秒）。可以换个更快的模型再试。', 'e.cors': '浏览器无法直连该服务商（跨域被拒或网络不通）。请改用零接口方式，或换一家服务商。', 'e.notjson': '服务商返回的不是 JSON：', 'e.provider': '服务商错误：', 'e.nochoice': '返回里没有 choices[0].message',
      'e.nojson': '没有找到 JSON 对象。模型可能没有按要求输出，可以点"查看原始输出"。', 'e.parse': 'JSON 解析失败：', 'e.version': 'version 应为 review-output-v2（或 v1），实际 ', 'e.v1': 'review-output-v1 的回复只适用于初创模板。', 'e.tpl': '这份回复属于"{t}"模板，请先切换模板。', 'e.axes': 'axes 必须是六个维度各一项，缺：', 'e.axes.n': 'axes 应有 6 项，实际 ', 'e.short': '输出不符合格式：',
      'e.premises': 'premises 至少 2 条', 'e.next': 'next_steps 至少 3 条', 'e.questions': 'questions 应为 3 条', 'e.caveats': 'caveats 至少 1 条', 'e.requests': '缺 requests 数组', 'e.dup': '（有重复或多余）', 'e.see.raw': '可点"查看原始输出"。',
      'src.zero': '零接口 · 手动粘贴'
    }
  };
  var LANG = 'en', TPL = 'startup';
  function t(k, vars) {
    var d = I18N[LANG], s = d[k + '.' + TPL] !== undefined ? d[k + '.' + TPL] : (d[k] !== undefined ? d[k] : (I18N.en[k + '.' + TPL] || I18N.en[k] || k));
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); });
    return s;
  }
  function tpl() { return TEMPLATES[TPL]; }

  /* ---------- prompt (single source of truth; open/prompt-v2.md is exported from here) ---------- */
  function axisLine(a, lang) { var A = a.anchors[lang]; return lang === 'zh' ? '- ' + a.zh + '（' + a.key + '）：弱点＝' + A.weak + '。正常＝' + A.normal + '。优秀＝' + A.strong + '。' : '- ' + a.en + ' (' + a.key + '): weak = ' + A.weak + '. normal = ' + A.normal + '. strong = ' + A.strong + '.'; }
  function buildPrompt(tk, lang) {
    var T = TEMPLATES[tk], keys = T.axes.map(function (a) { return a.key; });
    var keyList = T.axes.map(function (a) { return lang === 'zh' ? a.key + '（' + a.zh + '）' : a.key + ' (' + a.en + ')'; }).join(lang === 'zh' ? '、' : ', ');
    var anchors = T.axes.map(function (a) { return axisLine(a, lang); }).join('\n');
    var gatesJson = T.gates.map(function (g) { return '"' + g.key + '": "unchecked|pass|block"'; }).join(', ');
    if (lang === 'zh') {
      var Z = tk === 'startup' ? [
        '你是一位早期初创项目的评审助手，按"海豹增长评审方法"（V0.5）工作。你的任务不是打分，而是按下面的规则，对一份速查表（以及附带的文字）给出六个维度的归档建议、证据缺口、关键前提、关卡状态、项目落在哪一圈，以及"下一步要证明什么"。',
        '',
        '规则（必须遵守）',
        '1. 六个维度顺序固定，用 key 标识：' + keyList + '。每个维度只在 unknown（未知）、weak（弱点）、normal（正常）、strong（优秀）、na（不适用）里选一个。',
        '2. 四档是质量判断，按同阶段比较（概念、原理验证、样机、试点、付费、量产）。"正常"以该阶段在全球有竞争力的那一批公司的典型水平为准，也就是这个项目在市场上真正会遇到的对手，不以本地平均水平为准。无法判断项目相对这批公司的位置时，选未知。金额按美元读；材料用其他币种时，粗略折算并说明。',
        '3. 未知 = 还没证明，不是差。没看到证据，或证据不足以归入弱点、正常、优秀，就给 unknown，并写清缺什么。不适用 = 公司还没走到这一步，写明原因。',
        '4. 只能依据速查表和附带文字判断。不得发明数字、客户、合同、来源或背景；没写的就当不知道。附带文字是创始人自述。仅凭自述的内容最多支持到 normal，不能单凭自述给 strong。',
        '5. 如果填表人已经选了档位，你不要改它：在 agree 里写你是否同意（true/false），在 reason 里写理由。填表人没选的，agree 写 null，你在 suggested 里给建议。无论哪种情况 suggested 都要填。',
        '6. 关卡（fraud 造假、tech 关键技术不可行、cash 现金即将断流、integrity 诚信与关联交易）不计分。只有速查表里有已核实的证据才能写 block；pass 也需要有依据；否则写 unchecked。未核查不等于通过。',
        '7. 下一步要证明什么：3 到 5 件事，按"先便宜后贵"排序，每件带验证方式、期限和通过线。要具体到这家公司，不要套话。',
        '8. 只用在哪里都成立的经济逻辑：壁垒、资本效率、单位经济、标准条款。创始人个人回购、对赌、返投之类的条款只算风险，写进 caveats 或 gates.note，不能让任何档位因此变高。',
        '9. 落在哪一圈（fit）：focus = AI 随身设备（戴在身上或随身携带、比手机轻、面向消费者、AI 是核心功能）；recommended = 其他轻量软硬结合；other = 其余（纯软件、重型具身等）。写一句理由。',
        '10. 前瞻检查，基准日 ' + outlookDate('zh') + '。这是海豹增长注明日期的预判，不是事实：（a）软件贬值：今天要一个团队做的功能，到时通用模型直接给；（b）硬件成本下降：同样的设备更便宜，也更容易被仿制；（c）仍然难以复制的，可能是软硬件做在一起的部分（只有设备才采得到的数据、校准、制造经验），但要材料里有证据才算。每个维度先按今天的证据定档，再给出 outlook：holds（仍成立）、at_risk（有风险）、unknown（未知），或 na（预判与该维度无关），并写一句理由。outlook 不改变档位；"软硬结合"本身不算加分。',
        '11. 语气平实，不夸奖，不贬损，不下投资结论，不提及任何真实公司作比较。全部用简体中文，遵守字数限制。',
        '12. 只输出一个 JSON 对象，不要输出任何其他文字、解释或 Markdown 代码块标记。'
      ] : [
        '你是一位个人价值评审助手：帮一个人看清自己在这个时代是否更值钱（按美元计）。按"海豹增长评审方法"（V0.5）的个人模板工作。你的任务不是打分，而是按下面的规则，对一份速查表（以及附带的文字）给出六个维度的归档建议、证据缺口、关键前提、关卡状态和"下一步要证明什么"。',
        '',
        '规则（必须遵守）',
        '1. 六个维度顺序固定，用 key 标识：' + keyList + '。每个维度只在 unknown（未知）、weak（弱点）、normal（正常）、strong（优秀）、na（不适用）里选一个。',
        '2. 四档是质量判断，与年龄和领域相近的人比较。"正常"以典型情况为准。',
        '3. 未知 = 还没证明，不是差。证据不足就给 unknown，并写清缺什么。不适用 = 对这个人暂时不适用，写明原因。',
        '4. 只能依据速查表和附带文字判断。不得发明数字、经历、关系或来源；没写的就当不知道。附带文字是本人自述。仅凭自述的内容最多支持到 normal，不能单凭自述给 strong。',
        '5. 如果填表人已经选了档位，你不要改它：在 agree 里写你是否同意（true/false），在 reason 里写理由。填表人没选的，agree 写 null，你在 suggested 里给建议。无论哪种情况 suggested 都要填。',
        '6. 只有一个关卡 health：健康维度为 weak，或速查表显示有需要马上处理的健康问题，写 block；pass 需要依据；否则写 unchecked。未核查不等于通过。',
        '7. 下一步要证明什么：3 到 5 件事，按"先便宜后贵"排序，每件带验证方式、期限和通过线。要具体到这个人，不要套话。',
        '8. 放到全球市场里想：这件事是否让这个人对任何地方付得起钱的人更有价值？不评判生活选择，只看杠杆、证据和风险。金额按美元计。',
        '9. 前瞻检查，基准日 ' + outlookDate('zh') + '。这是海豹增长注明日期的预判，不是事实：（a）软件贬值：常规的知识工作，到时通用模型直接给；（b）硬件成本下降；（c）仍然难以复制的，可能是把软件和硬件、软件和现实世界接在一起的工作。每个维度先按今天的证据定档，再给出 outlook：到那一天，别人还会为这一项付钱吗？取 holds（仍成立）、at_risk（有风险）、unknown（未知），或 na（预判与该维度无关，通常是健康和关系），并写一句理由。outlook 不改变档位。',
        '10. 语气平实，不夸奖，不贬损，不下医疗、法律、职业或投资结论，不拿真实人物作比较。全部用简体中文，遵守字数限制。',
        '11. 只输出一个 JSON 对象，不要输出任何其他文字、解释或 Markdown 代码块标记。'
      ];
      Z = Z.concat(['', '评分锚点（弱点 / 正常 / 优秀）', anchors]);
      if (tk === 'startup') Z.push('硬件类证据示例：出货量、毛利、退货率、公开评价（含差评）、应用留存、大厂推出同类功能的风险。');
      Z = Z.concat([
        '',
        '输出 JSON 的结构（字段名与取值必须完全一致；字数为上限）',
        '{',
        '  "version": "review-output-v2",',
        '  "template": "' + tk + '",',
        '  "summary": "一句话定位与阶段，60 字内",'
      ]);
      if (tk === 'startup') Z.push('  "fit": "focus|recommended|other",', '  "fit_reason": "一句理由，24 字内",');
      Z = Z.concat([
        '  "axes": [  // 固定 6 项，顺序同上',
        '    {"key": "' + keys.join('|') + '", "suggested": "unknown|weak|normal|strong|na", "agree": true|false|null,',
        '     "reason": "依据，100 字内", "public_reason": "给' + (tk === 'startup' ? '创始人' : '本人') + '看的一句理由，24 字内",',
        '     "next": "下一步要证明什么，60 字内；弱点与未知必填，其余可为空字符串", "missing": "缺什么证据，40 字内，可为空字符串",',
        '     "outlook": "holds|at_risk|unknown|na", "outlook_reason": "一句理由，40 字内，可为空字符串"}',
        '  ],',
        '  "premises": [ {"text": "什么必须成立，40 字内", "status": "verified|partial|unverified|false", "critical": true|false, "why": "判断依据，60 字内"} ],  // 2 到 5 条，至少 1 条 critical',
        '  "gates": {' + gatesJson + ', "note": "200 字内，可为空字符串"},',
        '  "next_steps": [ {"text": "60 字内", "verify": "验证方式，22 字内", "by": "期限，6 字内", "pass": "通过线，12 字内"} ],  // 3 到 5 条，先便宜后贵',
        '  "requests": ["' + (tk === 'startup' ? '要补的材料' : '要收集的证据') + '，30 字内"],  // 最多 8 条',
        '  "questions": [ {"q": "' + (tk === 'startup' ? '会上要问的问题' : '问自己的问题') + '，60 字内", "good": "好答案的信号，40 字内", "red": "红旗信号，40 字内"} ],  // 3 条',
        '  "caveats": ["你没把握、可能判断错的地方，60 字内"]  // 1 到 5 条',
        '}'
      ]);
      return Z.join('\n');
    }
    var E = tk === 'startup' ? [
      'You are a review assistant for early-stage startups, working to the "SEAL Growth review method" (V0.5). Your job is not to score. Follow the rules below and, for one quick sheet (and any pasted text), give a tier suggestion for each of six dimensions, the evidence gaps, the key premises, the gate states, where the project fits, and what to prove next.',
      '',
      'Rules (must follow)',
      '1. Six dimensions in fixed order, identified by key: ' + keyList + '. For each, choose exactly one of unknown, weak, normal, strong, na.',
      '2. Tiers are quality judgments against companies at the same stage (concept, proof of concept, prototype, pilot, paying, production). "normal" means typical among the companies at that stage that compete globally, the ones this project would meet in the market, not the local average. If you cannot place the project against that group, choose unknown. Read amounts in US dollars; if the sheet uses another currency, convert roughly and say so.',
      '3. unknown means not yet proven, not bad. With no evidence, or evidence that does not settle weak, normal or strong, choose unknown and say what is missing. na means the company has not reached this step; say why.',
      '4. Judge only from the sheet and the pasted text. Do not invent numbers, customers, contracts, sources or background; anything not written is unknown. Pasted text is the founder\'s own claim. Self-reported content supports at most normal, never strong on its own.',
      '5. If the filler already chose a tier, do not change it: set agree to true or false and explain in reason. If not, set agree to null and suggest a tier. Always fill suggested.',
      '6. Gates (fraud; tech = key technology cannot work; cash = cash about to run out; integrity = integrity and related-party dealings) are not scored. Write block only with verified evidence in the sheet; pass also needs grounds; otherwise unchecked. Unchecked is not a pass.',
      '7. What to prove next: 3 to 5 items, cheapest first, each with how to verify, a deadline and a pass line. Specific to this company, no boilerplate.',
      '8. Use only economics that hold anywhere: moat, capital efficiency, unit economics, standard terms. Personal buy-back obligations on founders, valuation ratchets (bet-on agreements), local reinvestment quotas and similar clauses are risks: put them in caveats or gates.note, and never let them raise a tier.',
      '9. Fit: focus = AI wearables and pocket devices (worn or carried, lighter than a phone, for consumers, AI is core); recommended = other light hardware plus software; other = everything else (pure software, heavy robotics and so on). Give one short reason.',
      '10. Outlook check, as of ' + outlookDate('en') + '. This is SEAL Growth\'s dated forecast, not a fact: (a) software is worth less, because features that need a team today come with a general model; (b) hardware costs less, so the same device is cheaper to build and to copy; (c) what can stay hard to copy is hardware and software built together (data only the device collects, calibration, manufacturing know-how), but only where the sheet shows it. After choosing each tier from today\'s evidence, add outlook for that dimension: holds, at_risk, unknown, or na if the forecast has no bearing, with one reason. The outlook never changes a tier, and being a hardware-plus-software project is not merit by itself.',
      '11. Plain tone: no praise, no put-downs, no investment conclusion, no comparison with any real company. Write all text in English and keep to the length limits.',
      '12. Output one JSON object only, with no other text, explanation or Markdown code fences.'
    ] : [
      'You are a review assistant for one person who wants to be worth more in this era, measured in US dollars. You work to the personal template of the "SEAL Growth review method" (V0.5). Your job is not to score. Follow the rules below and, for one quick sheet (and any pasted text), give a tier suggestion for each of six dimensions, the evidence gaps, the key premises, the gate state, and what to prove next.',
      '',
      'Rules (must follow)',
      '1. Six dimensions in fixed order, identified by key: ' + keyList + '. For each, choose exactly one of unknown, weak, normal, strong, na.',
      '2. Tiers are quality judgments against people of similar age and field. "normal" means typical.',
      '3. unknown means not yet proven, not bad. With too little evidence, choose unknown and say what is missing. na means it does not apply to this person yet; say why.',
      '4. Judge only from the sheet and the pasted text. Do not invent numbers, history, relationships or sources; anything not written is unknown. Pasted text is the person\'s own claim. Self-reported content supports at most normal, never strong on its own.',
      '5. If the filler already chose a tier, do not change it: set agree to true or false and explain in reason. If not, set agree to null and suggest a tier. Always fill suggested.',
      '6. One gate, health: write block if the health dimension is weak or the sheet shows a health problem that needs treatment now; pass needs grounds; otherwise unchecked. Unchecked is not a pass.',
      '7. What to prove next: 3 to 5 items, cheapest first, each with how to verify, a deadline and a pass line. Specific to this person, no boilerplate.',
      '8. Think in global markets: does this make the person worth more to people who can pay, anywhere? Do not judge life choices; judge leverage, evidence and risk. Count money in US dollars.',
      '9. Outlook check, as of ' + outlookDate('en') + '. This is SEAL Growth\'s dated forecast, not a fact: (a) software is worth less, because routine knowledge work comes with a general model; (b) hardware costs less; (c) what can stay hard to copy is work that joins hardware and software, or software and the physical world. After choosing each tier from today\'s evidence, add outlook for that dimension: will people still pay for this on that date? Choose holds, at_risk, unknown, or na if the forecast has no bearing (usually health and relationships), with one reason. The outlook never changes a tier.',
      '10. Plain tone: no praise, no put-downs, no medical, legal, career or investment conclusion, no comparison with real people. Write all text in English and keep to the length limits.',
      '11. Output one JSON object only, with no other text, explanation or Markdown code fences.'
    ];
    E = E.concat(['', 'Anchors (weak / normal / strong)', anchors]);
    if (tk === 'startup') E.push('Hardware evidence examples: units shipped, gross margin, return rate, public reviews (bad ones included), app retention, the risk of a large platform shipping the same feature.');
    E = E.concat([
      '',
      'Output JSON (field names and values exactly as below; limits are maximums)',
      '{',
      '  "version": "review-output-v2",',
      '  "template": "' + tk + '",',
      '  "summary": "one-line positioning and stage, up to 25 words",'
    ]);
    if (tk === 'startup') E.push('  "fit": "focus|recommended|other",', '  "fit_reason": "one reason, up to 12 words",');
    E = E.concat([
      '  "axes": [  // exactly 6, order as above',
      '    {"key": "' + keys.join('|') + '", "suggested": "unknown|weak|normal|strong|na", "agree": true|false|null,',
      '     "reason": "grounds, up to 40 words", "public_reason": "one line for the ' + (tk === 'startup' ? 'founder' : 'person') + ', up to 10 words",',
      '     "next": "what to prove next, up to 25 words; required for weak and unknown, otherwise an empty string", "missing": "missing evidence, up to 15 words, may be an empty string",',
      '     "outlook": "holds|at_risk|unknown|na", "outlook_reason": "one reason, up to 20 words, may be an empty string"}',
      '  ],',
      '  "premises": [ {"text": "what must hold, up to 15 words", "status": "verified|partial|unverified|false", "critical": true|false, "why": "grounds, up to 25 words"} ],  // 2 to 5, at least 1 critical',
      '  "gates": {' + gatesJson + ', "note": "up to 80 words, may be an empty string"},',
      '  "next_steps": [ {"text": "up to 25 words", "verify": "how to verify, up to 8 words", "by": "deadline, up to 3 words", "pass": "pass line, up to 6 words"} ],  // 3 to 5, cheapest first',
      '  "requests": ["' + (tk === 'startup' ? 'material to add' : 'evidence to collect') + ', up to 12 words"],  // up to 8',
      '  "questions": [ {"q": "' + (tk === 'startup' ? 'question for the meeting' : 'question to ask yourself') + ', up to 25 words", "good": "good-answer signal, up to 15 words", "red": "red flag, up to 15 words"} ],  // exactly 3',
      '  "caveats": ["where you are unsure or may be wrong, up to 25 words"]  // 1 to 5',
      '}'
    ]);
    return E.join('\n');
  }

  /* ---------- form ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function seg(name, options, tierAttr) {
    var wrap = document.createElement('div'); wrap.className = 'seg'; wrap.setAttribute('data-name', name);
    options.forEach(function (o) {
      var lab = document.createElement('label'); if (tierAttr) lab.setAttribute('data-tier', o.v);
      var inp = document.createElement('input'); inp.type = 'radio'; inp.name = name; inp.value = o.v;
      lab.appendChild(inp); lab.appendChild(document.createTextNode(L(o))); wrap.appendChild(lab);
    });
    return wrap;
  }
  function refreshSeg(wrap) { $$('label', wrap).forEach(function (l) { var i = $('input', l); l.classList.toggle('on', !!(i && i.checked)); }); }
  function fieldEl(f) {
    var d = document.createElement('div'); d.className = 'field';
    if (f.type === 'seg') { d.innerHTML = '<span class="lab">' + esc(L(f.label)) + '</span>'; d.appendChild(seg(f.name, f.options)); return d; }
    var id = 'f-' + f.name;
    d.innerHTML = '<label for="' + id + '">' + esc(L(f.label)) + '</label>' + (f.type === 'textarea'
      ? '<textarea id="' + id + '" name="' + f.name + '" maxlength="' + (f.max || 600) + '" placeholder="' + esc(L(f.ph)) + '"></textarea>'
      : '<input type="text" id="' + id + '" name="' + f.name + '" placeholder="' + esc(L(f.ph)) + '" autocomplete="off">');
    return d;
  }
  function layFields(container, fields) {
    container.innerHTML = '';
    var pending = null;
    fields.forEach(function (f) {
      var el = fieldEl(f);
      if (f.half) { if (!pending) { pending = document.createElement('div'); pending.className = 'two'; container.appendChild(pending); } pending.appendChild(el); if (pending.children.length === 2) pending = null; }
      else { pending = null; container.appendChild(el); }
    });
  }
  function buildForm() {
    var T = tpl();
    layFields($('#ctx'), T.ctx);
    $('#deck-label').textContent = L(T.deck.label); $('#f-deck').placeholder = L(T.deck.ph);
    var axesEl = $('#axes'); axesEl.innerHTML = '';
    var tierOpts = AXIS_TIERS.map(function (k) { return { v: k, en: TIER_WORD.en[k], zh: TIER_WORD.zh[k] }; });
    T.axes.forEach(function (a, i) {
      var A = a.anchors[LANG];
      var row = document.createElement('div'); row.className = 'axis-row';
      row.innerHTML = '<h4>' + esc(L(a)) + ' <small>' + esc(L(a.ask)) + '</small></h4>' +
        '<p class="anchor"><b>' + tw('weak') + '</b> ' + esc(A.weak) + '　<b>' + tw('normal') + '</b> ' + esc(A.normal) + '　<b>' + tw('strong') + '</b> ' + esc(A.strong) + '</p>' +
        '<div class="field"><span class="lab">' + esc(t('f.tier')) + '</span></div>' +
        '<div class="two"><div class="field"><input type="text" name="axis' + i + '_evidence" placeholder="' + esc(t('f.evidence')) + '" autocomplete="off"></div>' +
        '<div class="field"><span class="lab">' + esc(t('f.source')) + '</span></div></div>';
      $$('.field', row)[0].appendChild(seg('axis' + i + '_tier', tierOpts, true));
      $$('.field', row)[2].appendChild(seg('axis' + i + '_source', T.sources));
      axesEl.appendChild(row);
    });
    var gatesEl = $('#gates'); gatesEl.innerHTML = '';
    var gateOpts = GATE_STATES.map(function (k) { return { v: k, en: GATE_WORD.en[k], zh: GATE_WORD.zh[k] }; });
    T.gates.forEach(function (g) {
      var row = document.createElement('div'); row.className = 'axis-row';
      row.innerHTML = '<h4>' + esc(L(g)) + '</h4><div class="two"><div class="field"></div><div class="field"><input type="text" name="gate_' + g.key + '_why" placeholder="' + esc(t('f.why')) + '" autocomplete="off"></div></div>';
      $('.field', row).appendChild(seg('gate_' + g.key, gateOpts, true));
      gatesEl.appendChild(row);
    });
    var prEl = $('#premises'); prEl.innerHTML = '';
    var premOpts = PREMISE_STATES.map(function (k) { return { v: k, en: PREMISE_WORD.en[k], zh: PREMISE_WORD.zh[k] }; });
    [1, 2, 3].forEach(function (n) {
      var row = document.createElement('div'); row.className = 'axis-row';
      row.innerHTML = '<h4>' + esc(t('f.premise')) + ' ' + n + '</h4><div class="field"><input type="text" name="premise' + n + '_text" placeholder="' + esc(t('f.premise.ph')) + '" maxlength="120" autocomplete="off"></div>' +
        '<div class="two"><div class="field"></div><div class="field"><div class="seg"><label><input type="checkbox" name="premise' + n + '_critical"> ' + esc(t('f.critical')) + '</label></div></div></div>';
      $('.field + .two .field', row).appendChild(seg('premise' + n + '_status', premOpts));
      prEl.appendChild(row);
    });
    var ex = $('#extra'); ex.innerHTML = '';
    var plain = T.extra.filter(function (f) { return !f.group; }), quant = T.extra.filter(function (f) { return f.group === 'quant'; });
    layFields(ex, plain);
    if (quant.length) {
      var q = document.createElement('div'); q.className = 'field'; q.innerHTML = '<span class="lab">' + esc(t('f.quant')) + '</span>';
      var two = document.createElement('div'); two.className = 'two';
      quant.forEach(function (f) { var i = document.createElement('input'); i.type = 'text'; i.name = f.name; i.placeholder = L(f.ph); i.setAttribute('autocomplete', 'off'); i.setAttribute('aria-label', L(f.label)); two.appendChild(i); });
      q.appendChild(two); ex.appendChild(q);
    }
    $$('#sheet .seg').forEach(refreshSeg);
  }

  /* ---------- read and write the sheet ---------- */
  function allFields() { var T = tpl(); return T.ctx.concat(T.extra).concat([{ name: 'deck', type: 'textarea' }]); }
  function val(name) {
    var el = $('#sheet [name="' + name + '"]'); if (!el) return '';
    if (el.type === 'radio') { var c = $('#sheet input[name="' + name + '"]:checked'); return c ? c.value : ''; }
    if (el.type === 'checkbox') return el.checked;
    return (el.value || '').trim();
  }
  function setVal(name, v) {
    var el = $('#sheet [name="' + name + '"]'); if (!el) return;
    if (el.type === 'radio') { $$('#sheet input[name="' + name + '"]').forEach(function (i) { i.checked = (i.value === v); }); refreshSeg(el.closest('.seg')); return; }
    if (el.type === 'checkbox') { el.checked = !!v; el.parentNode.classList.toggle('on', !!v); return; }
    el.value = v || '';
  }
  function readSheet() {
    var T = tpl(), s = { template: TPL, f: {}, axes: [], gates: {}, premises: [] };
    allFields().forEach(function (f) { s.f[f.name] = val(f.name); });
    T.axes.forEach(function (a, i) { s.axes.push({ key: a.key, tier: val('axis' + i + '_tier'), evidence: val('axis' + i + '_evidence'), source: val('axis' + i + '_source') }); });
    T.gates.forEach(function (g) { s.gates[g.key] = { state: val('gate_' + g.key) || 'unchecked', why: val('gate_' + g.key + '_why') }; });
    [1, 2, 3].forEach(function (n) { var x = val('premise' + n + '_text'); if (x) s.premises.push({ text: x, status: val('premise' + n + '_status') || 'unverified', critical: !!val('premise' + n + '_critical') }); });
    return s;
  }
  function writeSheet(s) {
    var T = tpl(); s = s || {}; var f = s.f || {};
    allFields().forEach(function (x) { setVal(x.name, f[x.name] || ''); });
    T.axes.forEach(function (a, i) { var x = (s.axes || [])[i] || {}; setVal('axis' + i + '_tier', x.tier || ''); setVal('axis' + i + '_evidence', x.evidence || ''); setVal('axis' + i + '_source', x.source || ''); });
    T.gates.forEach(function (g) { var x = (s.gates || {})[g.key] || {}; setVal('gate_' + g.key, x.state || ''); setVal('gate_' + g.key + '_why', x.why || ''); });
    [1, 2, 3].forEach(function (n) { var p = (s.premises || [])[n - 1] || {}; setVal('premise' + n + '_text', p.text || ''); setVal('premise' + n + '_status', p.status || ''); setVal('premise' + n + '_critical', !!p.critical); });
  }
  function optLabel(field, v) { var o = (field.options || []).filter(function (x) { return x.v === v; })[0]; return o ? L(o) : v; }
  function sheetMarkdown(s, lang, tk) {
    var keepL = LANG, keepT = TPL; if (lang) LANG = lang; if (tk) TPL = tk;
    try {
      var T = tpl(); s = s || {}; var f = s.f || {}; var blank = t('unset');
      var zh = LANG === 'zh', or = function (v) { return v ? v : blank; };
      var Lines = [];
      Lines.push('# ' + (zh ? '速查表（' + (TPL === 'startup' ? '初创' : '个人') + '）：' : 'Quick sheet (' + (TPL === 'startup' ? 'Startup' : 'Personal') + '): ') + or(f.name));
      T.ctx.forEach(function (x) { if (x.name === 'name') return; Lines.push('- ' + L(x.label) + (zh ? '：' : ': ') + or(x.type === 'seg' ? (f[x.name] ? optLabel(x, f[x.name]) : '') : f[x.name])); });
      Lines.push('', zh ? '## 六维（填表人判断；"未选"表示请你建议）' : '## Six dimensions (filler\'s view; "not chosen" means please suggest)');
      Lines.push(zh ? '| 维度 | 填表人档位 | 证据 | 来源 |' : '| Dimension | Filler\'s tier | Evidence | Source |', '|---|---|---|---|');
      T.axes.forEach(function (a, i) { var x = (s.axes || [])[i] || {}; Lines.push('| ' + L(a) + ' (' + a.key + ') | ' + (x.tier ? tw(x.tier) + ' (' + x.tier + ')' : t('notchosen')) + ' | ' + or(x.evidence) + ' | ' + (x.source ? optLabel({ options: T.sources }, x.source) : blank) + ' |'); });
      Lines.push('', zh ? '## 关卡' : '## Gates', zh ? '| 关卡 | 状态 | 理由 |' : '| Gate | State | Why |', '|---|---|---|');
      T.gates.forEach(function (g) { var x = (s.gates || {})[g.key] || {}; Lines.push('| ' + L(g) + ' (' + g.key + ') | ' + GATE_WORD[LANG][x.state || 'unchecked'] + ' | ' + or(x.why) + ' |'); });
      Lines.push('', zh ? '## 关键前提' : '## Key premises');
      var pr = s.premises || [];
      if (!pr.length) Lines.push(zh ? '（未填，请你根据表中信息提出 2 到 3 条）' : '(Blank; please propose 2 to 3 from the information given)');
      pr.forEach(function (p, i) { Lines.push((i + 1) + '. ' + p.text + (zh ? '　状态：' : ' · status: ') + PREMISE_WORD[LANG][p.status || 'unverified'] + (p.critical ? (zh ? '　【关键】' : ' · [key]') : '')); });
      var plain = T.extra.filter(function (x) { return !x.group; }), quant = T.extra.filter(function (x) { return x.group === 'quant'; });
      plain.forEach(function (x) { Lines.push('', '## ' + L(x.label), or(f[x.name])); });
      if (quant.length) { Lines.push('', zh ? '## 量化（填表人提供，单位如写）' : '## Numbers (as given by the filler, units as written)'); quant.forEach(function (x) { Lines.push('- ' + L(x.label) + (zh ? '：' : ': ') + or(f[x.name])); }); }
      Lines.push('', zh ? '## 附带文字（' + (TPL === 'startup' ? '创始人自述' : '本人自述') + '）' : '## Pasted text (' + (TPL === 'startup' ? 'the founder\'s own claims' : 'the person\'s own claims') + ')');
      Lines.push(f.deck ? '<<<\n' + f.deck + '\n>>>' : blank);
      return Lines.join('\n');
    } finally { LANG = keepL; TPL = keepT; }
  }
  function userMessage(s, lang) { return sheetMarkdown(s, lang) + '\n\n' + ((lang || LANG) === 'zh' ? '请按规则只输出 JSON。' : 'Following the rules, output JSON only.'); }
  function fullPrompt(s, lang, tk) { lang = lang || LANG; tk = tk || TPL; var keep = TPL; TPL = tk; try { return buildPrompt(tk, lang) + '\n\n---\n\n' + userMessage(s, lang); } finally { TPL = keep; } }

  /* ---------- local storage (this browser only) ---------- */
  var KEY_KEY = 'seal-review-key-v1', LANG_KEY = 'seal-lang-v1', TPL_KEY = 'seal-template-v1';
  function draftKey() { return 'seal-review-draft-v2-' + TPL; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  var saveTimer = null;
  function saveDraft() { clearTimeout(saveTimer); var k = draftKey(); saveTimer = setTimeout(function () { lsSet(k, JSON.stringify(readSheet())); }, 300); }
  function flushDraft() { clearTimeout(saveTimer); lsSet(draftKey(), JSON.stringify(readSheet())); }
  function loadDraft() { var s = lsGet(draftKey()); if (s) { try { writeSheet(JSON.parse(s)); } catch (e) { } } }

  /* ---------- clipboard and download ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(new Error('copy failed')); } catch (e) { rej(e); }
      document.body.removeChild(ta);
    });
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 1000);
  }
  function status(id, msg, err) { var el = $('#' + id); el.textContent = msg || ''; el.classList.toggle('err', !!err); }

  /* ---------- call a provider ---------- */
  function currentProvider() {
    var k = $('#provider').value; var p = Object.assign({}, PROVIDERS[k]); p.key = k;
    if (k === 'custom') p.base = ($('#base').value || '').trim().replace(/\/+$/, '');
    return p;
  }
  function maskErr(text, key) { return key ? text.split(key).join('[key hidden]') : text; }
  function callModel(p, key, model, sys, user) {
    var ctrl = new AbortController(); var timer = setTimeout(function () { ctrl.abort(); }, 240000);
    var url, headers, body;
    if (p.kind === 'anthropic') {
      url = p.base + '/v1/messages';
      headers = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
      body = { model: model, max_tokens: 4096, temperature: 0.2, system: sys, messages: [{ role: 'user', content: user }] };
    } else {
      url = p.base + (p.path || '/chat/completions');
      headers = { 'content-type': 'application/json', 'authorization': 'Bearer ' + key };
      body = { model: model, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: 0.2, max_tokens: 4096 };
      if (p.json) body.response_format = { type: 'json_object' };
    }
    return fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl.signal, referrerPolicy: 'no-referrer' })
      .then(function (r) {
        return r.text().then(function (x) {
          clearTimeout(timer);
          if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + maskErr(x.slice(0, 400), key));
          var data; try { data = JSON.parse(x); } catch (e) { throw new Error(t('e.notjson') + x.slice(0, 200)); }
          if (data.base_resp && data.base_resp.status_code && data.base_resp.status_code !== 0) throw new Error(t('e.provider') + data.base_resp.status_code + ' ' + (data.base_resp.status_msg || ''));
          if (data.error) throw new Error(t('e.provider') + (data.error.message || JSON.stringify(data.error)).slice(0, 300));
          if (p.kind === 'anthropic') return (data.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
          var ch = (data.choices || [])[0];
          if (!ch || !ch.message) throw new Error(t('e.nochoice'));
          return typeof ch.message.content === 'string' ? ch.message.content : JSON.stringify(ch.message.content);
        });
      })
      .catch(function (e) {
        clearTimeout(timer);
        if (e.name === 'AbortError') throw new Error(t('e.timeout'));
        if (/Failed to fetch|NetworkError|Load failed/.test(String(e))) throw new Error(t('e.cors'));
        throw e;
      });
  }
  /* The endpoint must be a full https provider address and never this site (so a key and input cannot be sent here or to a relative path). */
  function validBase(b) { var m = /^https:\/\/([^\/?#]+)/i.exec(b || ''); return !!m && m[1].toLowerCase() !== String(location.host).toLowerCase(); }
  function listModels(p, key) {
    var url = p.kind === 'anthropic' ? p.base + '/v1/models' : p.base + '/models';
    var headers = p.kind === 'anthropic' ? { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } : { 'authorization': 'Bearer ' + key };
    return fetch(url, { headers: headers, referrerPolicy: 'no-referrer' }).then(function (r) { return r.json(); }).then(function (d) {
      var a = Array.isArray(d.data) ? d.data : (Array.isArray(d.models) ? d.models : []);
      return a.map(function (m) { return m.id || m.name || ''; }).filter(Boolean).sort();
    });
  }

  /* ---------- parse model output (accepts review-output-v2, and v1 for the startup template) ---------- */
  function str(v, n) { v = (v === null || v === undefined) ? '' : String(v); return n ? v.slice(0, n) : v; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function resolveKey(T, s) {
    s = String(s || '').trim().toLowerCase(); if (!s) return null;
    var hit = T.axes.filter(function (a) { return a.key === s || a.en.toLowerCase() === s || a.zh === s; })[0];
    return hit ? hit.key : null;
  }
  function parseOutput(text, tk) {
    tk = tk || TPL; var T = TEMPLATES[tk];
    var s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s < 0 || e < s) throw new Error(t('e.nojson'));
    var o; try { o = JSON.parse(text.slice(s, e + 1)); } catch (err) { throw new Error(t('e.parse') + err.message); }
    if (o.version === 'review-output-v1') { if (tk !== 'startup') throw new Error(t('e.v1')); }
    else if (o.version === 'review-output-v2') { if (o.template && o.template !== tk && TEMPLATES[o.template]) throw new Error(t('e.tpl', { t: I18N[LANG]['tpl.' + o.template] })); }
    else throw new Error(t('e.version') + JSON.stringify(o.version) + '.' + t('e.see.raw'));
    var axes = arr(o.axes);
    if (axes.length !== 6) throw new Error(t('e.axes.n') + axes.length + '.');
    var byKey = {};
    axes.forEach(function (a) { var k = a && (resolveKey(T, a.key) || resolveKey(T, a.name)); if (k && !byKey[k]) byKey[k] = a; });
    var lack = T.axes.filter(function (a) { return !byKey[a.key]; }).map(function (a) { return L(a); });
    if (lack.length) throw new Error(t('e.axes') + lack.join(LANG === 'zh' ? '、' : ', ') + '.');
    var out = { version: 'review-output-v2', template: tk, summary: str(o.summary, 240) };
    if (tk === 'startup') { out.fit = FIT.indexOf(o.fit) >= 0 ? o.fit : ''; out.fit_reason = str(o.fit_reason, 120); }
    out.axes = T.axes.map(function (ax) { var a = byKey[ax.key]; return { key: ax.key, suggested: AXIS_TIERS.indexOf(a.suggested) >= 0 ? a.suggested : 'unknown', agree: typeof a.agree === 'boolean' ? a.agree : null, reason: str(a.reason, 400), public_reason: str(a.public_reason, 120), next: str(a.next, 240), missing: str(a.missing, 160), outlook: OUTLOOKS.indexOf(a.outlook) >= 0 ? a.outlook : '', outlook_reason: str(a.outlook_reason, 200) }; });
    out.premises = arr(o.premises).slice(0, 5).map(function (p) { p = p || {}; return { text: str(p.text, 160), status: PREMISE_STATES.indexOf(p.status) >= 0 ? p.status : 'unverified', critical: !!p.critical, why: str(p.why, 200) }; }).filter(function (p) { return p.text; });
    var g = o.gates || {}; out.gates = { note: str(g.note, 600) };
    T.gates.forEach(function (x) { out.gates[x.key] = GATE_STATES.indexOf(g[x.key]) >= 0 ? g[x.key] : 'unchecked'; });
    out.next_steps = arr(o.next_steps).slice(0, 6).map(function (n) { return typeof n === 'string' ? { text: str(n, 240) } : { text: str((n || {}).text, 240), verify: str((n || {}).verify, 80), by: str((n || {}).by, 40), pass: str((n || {}).pass, 80) }; }).filter(function (n) { return n.text; });
    out.requests = arr(o.requests).slice(0, 8).map(function (r) { return str(r, 120); }).filter(Boolean);
    out.questions = arr(o.questions).slice(0, 5).map(function (q) { return typeof q === 'string' ? { q: str(q, 240) } : { q: str((q || {}).q, 240), good: str((q || {}).good, 160), red: str((q || {}).red, 160) }; }).filter(function (q) { return q.q; });
    out.caveats = arr(o.caveats).slice(0, 5).map(function (c) { return str(c, 240); }).filter(Boolean);
    var short = [];
    if (out.premises.length < 2) short.push(t('e.premises'));
    if (out.next_steps.length < 3) short.push(t('e.next'));
    if (out.questions.length !== 3) short.push(t('e.questions'));
    if (!out.caveats.length) short.push(t('e.caveats'));
    if (!Array.isArray(o.requests)) short.push(t('e.requests'));
    if (short.length) throw new Error(t('e.short') + short.join(LANG === 'zh' ? '；' : '; ') + '.' + t('e.see.raw'));
    return out;
  }
  /* Final tiers: the filler's choice wins; otherwise the model's suggestion. */
  function finalTiers(sheet, out) { return out.axes.map(function (a, i) { return ((sheet.axes || [])[i] || {}).tier || a.suggested; }); }
  function reference(tiers, gates, tk) {
    var T = TEMPLATES[tk || TPL];
    if (T.gates.some(function (g) { return gates[g.key] === 'block'; })) return 'hold';
    if ((tk || TPL) === 'personal' && tiers[0] === 'weak') return 'hold';
    var rated = tiers.filter(function (x) { return x === 'weak' || x === 'normal' || x === 'strong'; });
    if (rated.length < 3) return 'insufficient';
    var total = rated.reduce(function (s, x) { return s + ['weak', 'normal', 'strong'].indexOf(x) + 1; }, 0);
    return ['weak', 'normal', 'strong'][Math.floor((2 * total + rated.length) / (2 * rated.length)) - 1];
  }
  function weakest(premises) {
    var c = premises.filter(function (p) { return p.critical; }); if (!c.length) return null;
    return c.reduce(function (m, p) { return PREMISE_STATES.indexOf(p.status) > PREMISE_STATES.indexOf(m.status) ? p : m; });
  }

  /* ---------- radar ---------- */
  function hexSVG(tiers) {
    var T = tpl(), cx = 230, cy = 140, R = 100, ang = [-90, -30, 30, 90, 150, 210];
    var pt = function (r, i) { var a = ang[i] * Math.PI / 180; return [(cx + r * Math.cos(a)).toFixed(1), (cy + r * Math.sin(a)).toFixed(1)]; };
    var ring = function (r) { return ang.map(function (_, i) { return pt(r, i).join(','); }).join(' '); };
    var radius = { weak: R / 3, normal: 2 * R / 3, strong: R };
    var pts = [], dots = '';
    tiers.forEach(function (x, i) { var p; if (radius[x]) { p = pt(radius[x], i); pts.push(p.join(',')); dots += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="6" fill="' + TIER_COLOR[x] + '" stroke="#fff" stroke-width="2"/>'; } else { p = pt(R, i); dots += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="5" fill="#fff" stroke="' + (TIER_COLOR[x] || '#9AA0A6') + '" stroke-width="1.5" stroke-dasharray="2 2"/>'; } });
    var dx = R * Math.cos(Math.PI / 6) + 14;
    var lp = [[cx, cy - R - 26, 'middle'], [cx + dx, cy - R / 2 - 8, 'start'], [cx + dx, cy + R / 2 + 4, 'start'], [cx, cy + R + 22, 'middle'], [cx - dx, cy + R / 2 + 4, 'end'], [cx - dx, cy - R / 2 - 8, 'end']];
    var labels = T.axes.map(function (a, i) { var p = lp[i]; var dim = !radius[tiers[i]]; return '<text x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '" text-anchor="' + p[2] + '"><tspan font-weight="600">' + esc(L(a)) + '</tspan><tspan x="' + p[0].toFixed(1) + '" dy="15" fill="' + (dim ? '#8a9096' : '#4a4f54') + '">' + esc(tw(tiers[i])) + '</tspan></text>'; }).join('');
    var poly = pts.length >= 3 ? '<polygon points="' + pts.join(' ') + '" fill="rgba(31,31,31,.12)" stroke="#1f1f1f" stroke-width="2" stroke-linejoin="round"/>' : (pts.length === 2 ? '<line x1="' + pts[0].split(',')[0] + '" y1="' + pts[0].split(',')[1] + '" x2="' + pts[1].split(',')[0] + '" y2="' + pts[1].split(',')[1] + '" stroke="#1f1f1f" stroke-width="2"/>' : '');
    var aria = T.axes.map(function (a, i) { return L(a) + ' ' + tw(tiers[i]); }).join(LANG === 'zh' ? '，' : ', ');
    return '<svg viewBox="0 0 460 290" role="img" aria-label="' + esc(aria) + '"><g fill="none" stroke="#e3e5e7" stroke-width="1"><polygon points="' + ring(R) + '"/><polygon points="' + ring(2 * R / 3) + '"/><polygon points="' + ring(R / 3) + '"/>' +
      ang.map(function (_, i) { var p = pt(R, i); return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '"/>'; }).join('') + '</g>' + poly + dots +
      '<g font-family="Helvetica Neue,PingFang SC,Arial,sans-serif" font-size="12" fill="#1f1f1f">' + labels + '</g></svg>';
  }
  function chip(x) { return '<span class="chip ' + x + '">' + esc(tw(x)) + '</span>'; }

  /* ---------- show the result ---------- */
  var LAST = null;
  function render(sheet, out, raw, source, quiet) {
    var T = tpl(), tiers = finalTiers(sheet, out), ref = reference(tiers, out.gates), wk = weakest(out.premises);
    LAST = { sheet: sheet, out: out, tiers: tiers, ref: ref, raw: raw, source: source, at: (LAST && quiet) ? LAST.at : new Date(), lang: LANG, template: TPL };
    $('#res-title').textContent = ((sheet.f || {}).name || t('unnamed')) + ' · ' + t('res.title');
    $('#res-meta').textContent = source + ' · ' + LAST.at.toLocaleString(LANG === 'zh' ? 'zh-CN' : 'en-GB');
    $('#res-summary').textContent = out.summary || '';
    $('#res-banner').textContent = t('res.banner');
    $('#res-hex').innerHTML = hexSVG(tiers);
    var refNote = ref === 'hold' ? t('ref.hold') : (ref === 'insufficient' ? t('ref.insufficient') : t('ref.mean'));
    $('#res-overall').innerHTML = (ref === 'insufficient' ? '<b>' + esc(tw('insufficient')) + '</b>' : chip(ref)) + ' <small class="muted">' + esc(refNote) + (LANG === 'zh' ? '；' : '; ') + esc(t('ref.you')) + '</small>';
    $('#res-weakest').innerHTML = wk ? esc(wk.text) + ' <small class="muted">' + PREMISE_MARK[wk.status] + ' ' + esc(PREMISE_WORD[LANG][wk.status]) + '</small>' : '<span class="muted">' + esc(t('no.premise')) + '</span>';
    $('#res-gates').innerHTML = T.gates.map(function (g) { var st = out.gates[g.key]; return '<span class="chip ' + (st === 'block' ? 'weak' : st === 'pass' ? 'strong' : 'na') + '" style="margin:0 6px 6px 0">' + esc(L(g)) + ' · ' + esc(GATE_WORD[LANG][st]) + '</span>'; }).join('') + (out.gates.note ? '<div class="muted" style="font-size:13px;margin-top:4px">' + esc(out.gates.note) + '</div>' : '');
    var fitOn = TPL === 'startup' && out.fit;
    $('#res-fit-dt').hidden = !fitOn; $('#res-fit').hidden = !fitOn;
    $('#res-fit').innerHTML = fitOn ? esc(FIT_WORD[LANG][out.fit]) + (out.fit_reason ? ' <small class="muted">' + esc(out.fit_reason) + '</small>' : '') : '';
    $('#res-axes').innerHTML = out.axes.map(function (a, i) {
      var mine = ((sheet.axes || [])[i] || {}).tier; var ag = a.agree === true ? t('agree') : a.agree === false ? t('disagree') + ' ' + tw(a.suggested) : '';
      return '<li><div class="top"><b>' + esc(L(T.axes[i])) + '</b><span>' + (mine ? chip(mine) + '<span class="agree">' + esc(ag) + '</span>' : chip(a.suggested) + '<span class="agree">' + esc(t('suggested')) + '</span>') + '</span></div>' +
        (a.public_reason ? '<p><strong style="color:var(--ink)">' + esc(a.public_reason) + '</strong></p>' : '') + (a.reason ? '<p>' + esc(a.reason) + '</p>' : '') + (a.missing ? '<p>' + esc(t('missing')) + (LANG === 'zh' ? '：' : ': ') + esc(a.missing) + '</p>' : '') + (a.next ? '<p class="next"><span class="muted">' + esc(t('next')) + ' · </span>' + esc(a.next) + '</p>' : '') +
        (hasOutlook(a) ? '<p class="outlook"><span class="muted">' + OUTLOOK_DATE + ' · </span><strong>' + esc(OUTLOOK_WORD[LANG][a.outlook]) + '</strong>' + (a.outlook_reason ? (LANG === 'zh' ? '：' : ': ') + esc(a.outlook_reason) : '') + '</p>' : '') + '</li>';
    }).join('');
    var anyOutlook = out.axes.some(hasOutlook);
    $('#res-outlook').hidden = !anyOutlook; $('#res-outlook').textContent = anyOutlook ? t('res.outlook', { d: outlookDate(LANG) }) : '';
    var none = '<li class="muted">' + esc(t('none')) + '</li>';
    $('#res-premises').innerHTML = out.premises.length ? out.premises.map(function (p) { return '<li>' + PREMISE_MARK[p.status] + ' ' + esc(p.text) + (p.critical ? ' <b>[' + esc(t('key')) + ']</b>' : '') + '<small>' + esc(PREMISE_WORD[LANG][p.status]) + (p.why ? ' · ' + esc(p.why) : '') + '</small></li>'; }).join('') : none;
    $('#res-next').innerHTML = out.next_steps.length ? out.next_steps.map(function (n, i) { return '<li>' + (i + 1) + '. ' + esc(n.text) + '<small>' + [n.verify && t('verify') + ': ' + esc(n.verify), n.by && t('by') + ': ' + esc(n.by), n.pass && t('pass') + ': ' + esc(n.pass)].filter(Boolean).join(' · ') + '</small></li>'; }).join('') : none;
    $('#res-requests').innerHTML = out.requests.length ? out.requests.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') : none;
    $('#res-questions').innerHTML = out.questions.length ? out.questions.map(function (q, i) { return '<li>' + (i + 1) + '. ' + esc(q.q) + '<small>' + [q.good && '<span class="ok">' + esc(t('good')) + ': ' + esc(q.good) + '</span>', q.red && esc(t('red')) + ': ' + esc(q.red)].filter(Boolean).join(' · ') + '</small></li>'; }).join('') : none;
    $('#res-caveats').innerHTML = out.caveats.length ? out.caveats.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') : '<li class="muted">' + esc(t('no.caveat')) + '</li>';
    $('#raw').textContent = raw; if (!quiet) $('#raw').hidden = true;
    $('#res-invite').hidden = false; /* optional invitation: plain text, shown only with a result; sends nothing */
    $('#result').classList.add('show');
    if (!quiet) $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function reportMarkdown() {
    var X = LAST, s = X.sheet, o = X.out, T = tpl(), zh = LANG === 'zh', sep = zh ? '：' : ': ', lines = [];
    lines.push('# ' + ((s.f || {}).name || t('unnamed')) + (zh ? ' · AI 辅助自评（海豹增长 V0.5）' : ' · AI-assisted self-review (SEAL Growth V0.5)'));
    lines.push('', '> ' + t('res.banner'), '> ' + (zh ? '生成' : 'Generated') + sep + X.at.toLocaleString(zh ? 'zh-CN' : 'en-GB') + ' · ' + X.source + ' · ' + (zh ? 'V0.5 · 模板 ' : 'V0.5 · template ') + t('tpl.' + TPL), '');
    lines.push('**' + (zh ? '一句话' : 'In one line') + '**' + sep + (o.summary || t('none')), '');
    lines.push('**' + t('res.overall') + '**' + sep + tw(X.ref) + ' (' + (X.ref === 'hold' ? t('ref.hold') : X.ref === 'insufficient' ? t('ref.insufficient') : t('ref.mean')) + '; ' + t('ref.you') + ')');
    var wk = weakest(o.premises); lines.push('**' + t('res.weakest') + '**' + sep + (wk ? wk.text + ' (' + PREMISE_WORD[LANG][wk.status] + ')' : t('none')));
    if (TPL === 'startup' && o.fit) lines.push('**' + t('res.fit') + '**' + sep + FIT_WORD[LANG][o.fit] + (o.fit_reason ? ' — ' + o.fit_reason : ''));
    lines.push('', '## ' + t('res.axes'), zh ? '| 维度 | 档位 | 来源 | 一句理由 | 依据 | 缺什么 | 下一步 | 前瞻 ' + OUTLOOK_DATE + ' |' : '| Dimension | Tier | From | One line | Grounds | Missing | Next | Outlook ' + OUTLOOK_DATE + ' |', '|---|---|---|---|---|---|---|---|');
    o.axes.forEach(function (a, i) { var mine = ((s.axes || [])[i] || {}).tier; lines.push('| ' + L(T.axes[i]) + ' | ' + tw(X.tiers[i]) + ' | ' + (mine ? (zh ? '填表人' : 'filler') + (a.agree === false ? ' (' + t('disagree') + ' ' + tw(a.suggested) + ')' : '') : t('suggested')) + ' | ' + a.public_reason + ' | ' + a.reason + ' | ' + a.missing + ' | ' + a.next + ' | ' + (hasOutlook(a) ? outlookText(a, sep) : '—') + ' |'); });
    lines.push('', '## ' + t('res.gates'));
    T.gates.forEach(function (g) { lines.push('- ' + L(g) + sep + GATE_WORD[LANG][o.gates[g.key]]); });
    if (o.gates.note) lines.push('- ' + (zh ? '说明' : 'Note') + sep + o.gates.note);
    lines.push('', '## ' + t('res.premises'));
    o.premises.forEach(function (p, i) { lines.push((i + 1) + '. ' + p.text + ' · ' + PREMISE_WORD[LANG][p.status] + (p.critical ? ' · [' + t('key') + ']' : '') + (p.why ? ' · ' + p.why : '')); });
    lines.push('', '## ' + t('res.next'));
    o.next_steps.forEach(function (n, i) { lines.push((i + 1) + '. ' + n.text + [n.verify && t('verify') + sep + n.verify, n.by && t('by') + sep + n.by, n.pass && t('pass') + sep + n.pass].filter(Boolean).map(function (x) { return ' · ' + x; }).join('')); });
    lines.push('', '## ' + t('res.requests')); o.requests.forEach(function (r) { lines.push('- ' + r); });
    lines.push('', '## ' + t('res.questions')); o.questions.forEach(function (q, i) { lines.push((i + 1) + '. ' + q.q + (q.good ? ' · ' + t('good') + sep + q.good : '') + (q.red ? ' · ' + t('red') + sep + q.red : '')); });
    lines.push('', '## ' + t('res.caveats')); o.caveats.forEach(function (c) { lines.push('- ' + c); });
    lines.push('', '---', '', zh ? '## 附：速查表原文' : '## Appendix: the quick sheet', '', sheetMarkdown(s));
    return lines.join('\n');
  }

  /* ---------- static text, language and template ---------- */
  function applyText() {
    document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
    document.title = t('title');
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    $$('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
    $$('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    $$('[data-tpl]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tpl') === TPL)); });
    var base = document.documentElement.getAttribute('data-site-base') || '';
    $$('a[data-home]').forEach(function (a) { var h = a.getAttribute('data-home'); a.href = base + (LANG === 'zh' ? 'zh/index.html' : 'index.html') + (TPL === 'personal' ? '?mode=personal' : '') + h; });
    var sel = $('#provider'), cur = sel.value;
    sel.innerHTML = Object.keys(PROVIDERS).map(function (k) { return '<option value="' + k + '">' + esc(L(PROVIDERS[k].name)) + '</option>'; }).join('');
    if (cur) sel.value = cur;
    syncProviderNote();
    var mb = $('#btn-models'); if (mb) mb.addEventListener('click', onModels);
  }
  function syncProviderNote() { var p = PROVIDERS[$('#provider').value]; if (!p) return; $('#provider-note').textContent = L(p.note) + (p.tested ? ' · ' + L(TESTED) : ''); }
  function relabel() {
    var s = readSheet(); buildForm(); writeSheet(s); applyText();
    if (LAST && LAST.template === TPL) render(LAST.sheet, LAST.out, LAST.raw, LAST.source, true);
  }
  function setLang(l) { if (l === LANG) return; LANG = l; lsSet(LANG_KEY, l); relabel(); }
  function setTemplate(k) {
    if (k === TPL || !TEMPLATES[k]) return;
    flushDraft(); TPL = k; lsSet(TPL_KEY, k);
    buildForm(); loadDraft(); applyText();
    $('#result').classList.remove('show'); $('#res-invite').hidden = true; LAST = null; $('#paste').value = ''; status('status-b', ''); status('status-a', ''); $('#prompt-view').hidden = true;
  }
  function onModels(e) {
    e.preventDefault(); var key = $('#key').value.trim(); if (!key) { status('status-a', t('s.key.first'), true); return; }
    var p = currentProvider(); if (!validBase(p.base)) { status('status-a', t('s.base.bad'), true); return; }
    status('status-a', t('s.models.loading'));
    listModels(p, key).then(function (ids) { $('#model-list').innerHTML = ids.map(function (id) { return '<option value="' + esc(id) + '">'; }).join(''); status('status-a', ids.length ? t('s.models.n', { n: ids.length }) : t('s.models.none')); }, function (err) { status('status-a', t('s.models.fail') + maskErr(String(err.message || err), key), true); });
  }
  function needConsent(id) { if (!$('#consent').checked) { status(id, t('s.consent'), true); return false; } return true; }
  function localDate(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fileStem() { return (((LAST && LAST.sheet.f && LAST.sheet.f.name) || 'review') + '').replace(/[\\/:*?"<>|\s()（）]+/g, '-').replace(/-+$/, '') + '-' + localDate(new Date()); }

  function init() {
    var q = /[?&]lang=(en|zh)\b/.exec(location.search), qt = /[?&]t=(startup|personal)\b/.exec(location.search);
    LANG = q ? q[1] : (lsGet(LANG_KEY) === 'zh' ? 'zh' : 'en');
    TPL = qt ? qt[1] : (lsGet(TPL_KEY) === 'personal' ? 'personal' : 'startup');
    if (q) lsSet(LANG_KEY, LANG); if (qt) lsSet(TPL_KEY, TPL);
    buildForm(); applyText(); loadDraft();

    var sel = $('#provider');
    function baseVal() { return ($('#base').value || '').trim().replace(/\/+$/, ''); }
    function syncProvider() {
      var p = PROVIDERS[sel.value]; syncProviderNote(); $('#base-field').hidden = sel.value !== 'custom';
      $('#model').value = p.model; $('#model-list').innerHTML = '';
      var saved = null; try { saved = JSON.parse(lsGet(KEY_KEY) || 'null'); } catch (e) { }
      if (saved && saved.provider === sel.value && (sel.value !== 'custom' || saved.base === baseVal())) { $('#key').value = saved.key || ''; $('#remember').checked = true; } else { $('#key').value = ''; $('#remember').checked = false; }
    }
    try { var saved0 = JSON.parse(lsGet(KEY_KEY) || 'null'); if (saved0 && PROVIDERS[saved0.provider]) { sel.value = saved0.provider; $('#adv').open = true; } } catch (e) { }
    sel.addEventListener('change', syncProvider); syncProvider();
    $('#remember').addEventListener('change', function () { if (this.checked) lsSet(KEY_KEY, JSON.stringify({ provider: sel.value, base: baseVal(), key: $('#key').value })); else lsDel(KEY_KEY); });
    $('#key').addEventListener('input', function () { if ($('#remember').checked) lsSet(KEY_KEY, JSON.stringify({ provider: sel.value, base: baseVal(), key: this.value })); });
    /* when the custom endpoint changes, clear the key so an old key is never sent to a new address */
    $('#base').addEventListener('input', function () { if (sel.value === 'custom') { $('#key').value = ''; $('#remember').checked = false; lsDel(KEY_KEY); } });

    $('#lang-toggle').addEventListener('click', function () { setLang(LANG === 'zh' ? 'en' : 'zh'); });
    $$('[data-tpl]').forEach(function (b) { b.addEventListener('click', function () { setTemplate(b.getAttribute('data-tpl')); }); });

    var sheet = $('#sheet');
    sheet.addEventListener('input', saveDraft); sheet.addEventListener('change', saveDraft);
    sheet.addEventListener('change', function (e) {
      var x = e.target;
      if (x && x.type === 'radio') $$('#sheet input[name="' + x.name + '"]').forEach(function (i) { refreshSeg(i.closest('.seg')); });
      if (x && x.type === 'checkbox' && /_critical$/.test(x.name)) x.parentNode.classList.toggle('on', x.checked);
    });
    /* clicking a chosen chip clears it */
    sheet.addEventListener('click', function (e) {
      var lab = e.target.closest('.seg label'); if (!lab) return;
      var inp = $('input[type=radio]', lab); if (!inp || e.target === inp) return;
      if (inp.checked) { e.preventDefault(); inp.checked = false; refreshSeg(lab.closest('.seg')); saveDraft(); }
    });

    $('#btn-sample').addEventListener('click', function () { writeSheet(SAMPLES[TPL][LANG]); saveDraft(); });
    $('#btn-clear').addEventListener('click', function () { writeSheet({}); lsDel(draftKey()); });
    $('#btn-copy-sheet').addEventListener('click', function () { copyText(sheetMarkdown(readSheet())).then(function () { status('status-b', t('s.copied.sheet')); }, function () { status('status-b', t('s.copy.fail'), true); }); });

    $('#btn-run').addEventListener('click', function () {
      if (!needConsent('status-a')) return;
      var key = $('#key').value.trim(), model = $('#model').value.trim(), p = currentProvider();
      if (!key) { status('status-a', t('s.need.key'), true); return; }
      if (!model) { status('status-a', t('s.need.model'), true); return; }
      if (!validBase(p.base)) { status('status-a', t('s.base.bad'), true); return; }
      var s = readSheet(), btn = $('#btn-run'), pname = L(p.name); btn.disabled = true; status('status-a', t('s.sent', { p: pname }));
      callModel(p, key, model, buildPrompt(TPL, LANG), userMessage(s)).then(function (text) {
        try { render(s, parseOutput(text), text, pname + ' · ' + model); status('status-a', t('s.done')); }
        catch (e) { status('status-a', e.message, true); $('#raw').textContent = text; $('#raw').hidden = false; $('#result').classList.add('show'); }
      }, function (err) { status('status-a', String(err.message || err), true); }).then(function () { btn.disabled = false; });
    });

    $('#btn-copy-prompt').addEventListener('click', function () { if (!needConsent('status-b')) return; copyText(fullPrompt(readSheet())).then(function () { status('status-b', t('s.copied.prompt')); }, function () { status('status-b', t('s.copy.fail.prompt'), true); }); });
    $('#btn-show-prompt').addEventListener('click', function () { var pv = $('#prompt-view'); pv.textContent = fullPrompt(readSheet()); pv.hidden = !pv.hidden; if (!pv.hidden) pv.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    $('#btn-parse').addEventListener('click', function () {
      if (!needConsent('status-b')) return; var text = $('#paste').value; if (!text.trim()) { status('status-b', t('s.paste.first'), true); return; }
      try { render(readSheet(), parseOutput(text), text, t('src.zero')); status('status-b', t('s.done')); } catch (e) { status('status-b', e.message, true); }
    });

    $('#btn-export-md').addEventListener('click', function () { if (!LAST) return; copyText(reportMarkdown()).then(function () { status('status-r', t('s.copied.md')); }, function () { status('status-r', t('s.copy.fail'), true); }); });
    $('#btn-dl-md').addEventListener('click', function () { if (LAST) download(fileStem() + '.md', reportMarkdown(), 'text/markdown;charset=utf-8'); });
    $('#btn-dl-json').addEventListener('click', function () { if (LAST) download(fileStem() + '.json', JSON.stringify({ tool: 'seal-growth-review', version: 'V0.5', template: LAST.template, lang: LAST.lang, generated_at: LAST.at.toISOString(), source: LAST.source, disclaimer: t('res.banner'), sheet: LAST.sheet, output: LAST.out, final_tiers: LAST.tiers, overall_reference: LAST.ref }, null, 2), 'application/json;charset=utf-8'); });
    $('#btn-raw').addEventListener('click', function () { var r = $('#raw'); r.hidden = !r.hidden; });
  }
  window.SEAL_REVIEW = {
    version: 'V0.5', TEMPLATES: TEMPLATES, PROVIDERS: PROVIDERS, SAMPLES: SAMPLES, TIER_WORD: TIER_WORD,
    OUTLOOK_DATE: OUTLOOK_DATE, OUTLOOKS: OUTLOOKS, outlookDate: outlookDate,
    buildPrompt: buildPrompt, sheetMarkdown: sheetMarkdown, fullPrompt: fullPrompt, parseOutput: parseOutput, reference: reference, readSheet: readSheet,
    state: function () { return { lang: LANG, template: TPL }; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
