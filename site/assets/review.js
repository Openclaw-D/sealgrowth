/* 海豹增长 SEAL Growth · 自带密钥评审工具 V1（2026-11-05）
   Apache-2.0。本页全部逻辑在此文件：速查表 → 提示词 → 你的模型服务商（或零接口粘贴）→ 解析与展示。
   密钥只存在浏览器内存（除非你勾选"记在这个浏览器里"）；输入只发给你选择的服务商；本站没有服务器。 */
(function () {
  'use strict';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* ---------- 方法常量（与 method.html / open/anchors-v3.json 一致） ---------- */
  var AXES = ['市场需求', '商业模式', '资本效率', '竞争壁垒', '执行能力', '投资回报'];
  var STAGES = ['概念', '原理验证', '样机', '试点', '付费', '量产'];
  var TIER_WORD = { unknown: '未知', weak: '弱点', normal: '正常', strong: '优秀', na: '不适用', hold: '暂缓', insufficient: '资料不足' };
  var TIER_COLOR = { unknown: '#6B3FA0', weak: '#D93025', normal: '#F2C200', strong: '#2E8B3E', na: '#9AA0A6', hold: '#1F1F1F' };
  var AXIS_TIERS = ['unknown', 'weak', 'normal', 'strong', 'na'];
  var ANCHORS = {
    '市场需求': { weak: '痛点只是推断且有反证；或访谈、数据显示客户不愿付费', normal: '已核实预算人、使用场景和验收条件；有意向客户或试点', strong: '有非关联方回款，并有复购或持续使用；规模化，客户主动找来。补贴带来的需求另行标注' },
    '商业模式': { weak: '收费方式未定；或定价逻辑与客户预算冲突', normal: '有定价逻辑，有报价或首单', strong: '计入获客、交付、售后、返工和回款周期后，单位经济为正且能复制；或经竞争检验后毛利稳定、有议价权' },
    '资本效率': { weak: '用途不清；或重投入却没有里程碑', normal: '有预算和里程碑，关键风险正在用小钱消除', strong: '与同阶段、同路线公司相比验证成果更多，现金跑道充足；或能自我造血' },
    '竞争壁垒': { weak: '没有差异；或已有近邻方案而无应对', normal: '有差异主张，并在同等条件下对照验证过（只有专利申请不算）', strong: '客户认可的差异，绕开难度高；或数据、渠道、规模多重壁垒且能持续。授权专利本身不自动给优秀' },
    '执行能力': { weak: '团队不完整，且没有交付记录', normal: '核心人员到位、有相关经历，已交付原型（原型、量产、客户验收分开计）', strong: '多次按期交付，有客户验收，良率和可靠性经过核查；团队完备' },
    '投资回报': { weak: '估值明显高于证据；或条款不清', normal: '估值与阶段大体匹配', strong: '考虑失败、延期、后续融资、稀释和清算顺序后估值仍合理；有折价（说明参照对象）或退出路径清楚' }
  };
  var GATES = [['fraud', '造假'], ['tech', '关键技术不可行'], ['cash', '现金即将断流'], ['integrity', '诚信与关联交易']];
  var GATE_STATES = [['unchecked', '未核查'], ['pass', '通过'], ['block', '阻断']];
  var PREMISE_STATES = [['verified', '已核实'], ['partial', '部分核实'], ['unverified', '未核实'], ['false', '不成立']];
  var PREMISE_MARK = { verified: '●', partial: '◐', unverified: '○', 'false': '×' };
  var EVIDENCE = ['公司自述', '文件佐证', '独立核验'];
  var CHOICES = {
    stage: STAGES,
    industry: ['医药/生物', '制造/工业', '科研工具', '企业软件', '金融', '消费/内容', '机器人/硬件', '其他'],
    founder: ['技术', '行业资深', '连续创业', '学术', '其他'],
    model: ['订阅', '项目制', '硬件+软件', '技术授权', '平台抽成', '其他'],
    compliance: ['无特殊', '数据/隐私', '医疗/药监', '金融牌照', '出口管制', '其他']
  };

  /* ---------- 模型服务商（2026-11-05 在上海的一台电脑上实测浏览器可直连者） ---------- */
  var PROVIDERS = {
    deepseek: { name: 'DeepSeek', base: 'https://api.deepseek.com', model: 'deepseek-chat', kind: 'openai', json: true, note: 'api.deepseek.com · 已实测可从浏览器直连' },
    qwen: { name: '通义千问（阿里云百炼）', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', kind: 'openai', json: true, note: 'dashscope.aliyuncs.com 兼容模式 · 已实测可直连' },
    moonshot: { name: 'Kimi（Moonshot）', base: 'https://api.moonshot.cn/v1', model: 'kimi-k2-0905-preview', kind: 'openai', json: true, note: 'api.moonshot.cn · 已实测可直连；模型名以你账号的列表为准' },
    siliconflow: { name: '硅基流动 SiliconFlow', base: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3.1', kind: 'openai', json: false, note: 'api.siliconflow.cn · 已实测可直连' },
    minimax: { name: 'MiniMax', base: 'https://api.minimaxi.com/v1', model: 'MiniMax-M2', kind: 'openai', json: false, path: '/text/chatcompletion_v2', note: 'api.minimaxi.com · 已实测可直连' },
    anthropic: { name: 'Claude（Anthropic）', base: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', kind: 'anthropic', note: 'api.anthropic.com · 已实测可直连；需服务商支持你所在地区' },
    custom: { name: '自定义（OpenAI 兼容）', base: '', model: '', kind: 'openai', json: false, note: '任何 OpenAI 兼容接口；需要服务商允许浏览器跨域（CORS）' }
  };

  /* ---------- 提示词 V1（与 open/prompt-v1.md 同文） ---------- */
  var PROMPT_SYSTEM = [
    '你是一位早期前沿科技项目的评审助手，按"海豹增长评审方法 V3"工作。你的任务不是打分，而是按下面的规则，对一份速查表给出六个维度的归档建议、证据缺口、关键前提、关卡状态和"下一步要证明什么"。',
    '',
    '规则（必须遵守）',
    '1. 六个维度顺序固定：市场需求、商业模式、资本效率、竞争壁垒、执行能力、投资回报。每个维度只在 unknown（未知）、weak（弱点）、normal（正常）、strong（优秀）、na（不适用）里选一个。',
    '2. 四档是质量判断，按同阶段比较（概念、原理验证、样机、试点、付费、量产）。"正常"以该阶段典型公司为准。',
    '3. 未知 = 还没证明，不是差。没看到证据，或证据不足以归入弱点、正常、优秀，就给 unknown，并写清缺什么。不适用 = 公司还没走到这一步，写明原因。',
    '4. 只能依据速查表里写了的内容判断。不得发明数字、客户、合同、来源或背景；速查表没写的就当不知道。仅凭公司自述的内容最多支持到 normal，不能单凭自述给 strong。',
    '5. 如果填表人已经选了档位，你不要改它：在 agree 里写你是否同意（true/false），在 reason 里写理由。填表人没选的，agree 写 null，你在 suggested 里给建议。无论哪种情况 suggested 都要填。',
    '6. 关卡（造假、关键技术不可行、现金即将断流、诚信与关联交易）不计分。只有速查表里有已核实的证据才能写 block；pass 也需要有依据；否则写 unchecked。未核查不等于通过。',
    '7. 下一步要证明什么：3 到 5 件事，按"先便宜后贵"排序，每件带验证方式、期限和通过线。要具体到这家公司，不要套话。',
    '8. 语气平实，不夸奖，不贬损，不下投资结论，不提及任何真实公司作比较。全部用简体中文，遵守字数限制。',
    '9. 只输出一个 JSON 对象，不要输出任何其他文字、解释或 Markdown 代码块标记。',
    '',
    '评分锚点（弱点 / 正常 / 优秀）',
    AXES.map(function (a) { return '- ' + a + '：弱点＝' + ANCHORS[a].weak + '。正常＝' + ANCHORS[a].normal + '。优秀＝' + ANCHORS[a].strong + '。'; }).join('\n'),
    '',
    '输出 JSON 的结构（字段名与取值必须完全一致；字数为上限）',
    '{',
    '  "version": "review-output-v1",',
    '  "summary": "一句话定位与阶段，60 字内",',
    '  "axes": [  // 固定 6 项，顺序同上',
    '    {"name": "市场需求", "suggested": "unknown|weak|normal|strong|na", "agree": true|false|null,',
    '     "reason": "依据，100 字内", "public_reason": "给创始人看的一句理由，24 字内",',
    '     "next": "下一步要证明什么，60 字内；弱点与未知必填，其余可为空字符串", "missing": "缺什么证据，40 字内，可为空字符串"}',
    '  ],',
    '  "premises": [ {"text": "什么必须成立，40 字内", "status": "verified|partial|unverified|false", "critical": true|false, "why": "判断依据，60 字内"} ],  // 2 到 5 条，至少 1 条 critical',
    '  "gates": {"fraud": "unchecked|pass|block", "tech": "...", "cash": "...", "integrity": "...", "note": "200 字内，可为空字符串"},',
    '  "next_steps": [ {"text": "60 字内", "verify": "验证方式，22 字内", "by": "期限，6 字内", "pass": "通过线，12 字内"} ],  // 3 到 5 条，先便宜后贵',
    '  "requests": ["要补的材料，30 字内"],  // 最多 8 条',
    '  "questions": [ {"q": "会上要问的问题，60 字内", "good": "好答案的信号，40 字内", "red": "红旗信号，40 字内"} ],  // 3 条',
    '  "caveats": ["你没把握、可能判断错的地方，60 字内"]  // 1 到 5 条',
    '}'
  ].join('\n');

  /* ---------- 表单构建 ---------- */
  function seg(name, options, tierKeys) {
    var wrap = $('.seg[data-name="' + name + '"]') || document.createElement('div');
    wrap.className = 'seg'; wrap.setAttribute('data-name', name); wrap.innerHTML = '';
    options.forEach(function (o, i) {
      var val = tierKeys ? tierKeys[i] : o;
      var lab = document.createElement('label');
      if (tierKeys) lab.setAttribute('data-tier', val);
      var inp = document.createElement('input'); inp.type = 'radio'; inp.name = name; inp.value = val;
      lab.appendChild(inp); lab.appendChild(document.createTextNode(o));
      wrap.appendChild(lab);
    });
    return wrap;
  }
  function refreshSeg(wrap) {
    $$('label', wrap).forEach(function (l) { var i = $('input', l); l.classList.toggle('on', !!(i && i.checked)); });
  }
  function buildForm() {
    Object.keys(CHOICES).forEach(function (k) { seg(k, CHOICES[k]); });
    var axesEl = $('#axes');
    AXES.forEach(function (a, i) {
      var row = document.createElement('div'); row.className = 'axis-row';
      row.innerHTML = '<h4>' + a + '</h4>' +
        '<p class="anchor"><b>弱点</b> ' + ANCHORS[a].weak + '　<b>正常</b> ' + ANCHORS[a].normal + '　<b>优秀</b> ' + ANCHORS[a].strong + '</p>' +
        '<div class="field"><span class="lab">你的档位（可不选）</span></div>' +
        '<div class="two"><div class="field"><input type="text" name="axis' + i + '_evidence" placeholder="证据一句" autocomplete="off"></div>' +
        '<div class="field"><span class="lab" style="margin-bottom:4px">来源</span></div></div>';
      row.children[2].appendChild(seg('axis' + i + '_tier', AXIS_TIERS.map(function (t) { return TIER_WORD[t]; }), AXIS_TIERS));
      var evWrap = $$('.field', row)[2];
      evWrap.appendChild(seg('axis' + i + '_source', EVIDENCE));
      axesEl.appendChild(row);
    });
    var gatesEl = $('#gates');
    GATES.forEach(function (g) {
      var row = document.createElement('div'); row.className = 'axis-row';
      row.innerHTML = '<h4>' + g[1] + '</h4><div class="two"><div class="field"></div><div class="field"><input type="text" name="gate_' + g[0] + '_why" placeholder="理由（一句）" autocomplete="off"></div></div>';
      $('.field', row).appendChild(seg('gate_' + g[0], GATE_STATES.map(function (s) { return s[1]; }), GATE_STATES.map(function (s) { return s[0]; })));
      gatesEl.appendChild(row);
    });
    var prEl = $('#premises');
    [1, 2, 3].forEach(function (n) {
      var row = document.createElement('div'); row.className = 'axis-row';
      row.innerHTML = '<h4>前提 ' + n + '</h4><div class="field"><input type="text" name="premise' + n + '_text" placeholder="什么必须成立（40 字内）" maxlength="60" autocomplete="off"></div>' +
        '<div class="two"><div class="field"></div><div class="field"><div class="seg"><label><input type="checkbox" name="premise' + n + '_critical"> 关键前提</label></div></div></div>';
      $('.field + .two .field', row).appendChild(seg('premise' + n + '_status', PREMISE_STATES.map(function (s) { return s[1]; }), PREMISE_STATES.map(function (s) { return s[0]; })));
      prEl.appendChild(row);
    });
    $$('.seg').forEach(refreshSeg);
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.type === 'radio') { $$('input[name="' + t.name + '"]').forEach(function (i) { refreshSeg(i.closest('.seg')); }); }
      if (t && t.type === 'checkbox' && /_critical$/.test(t.name)) { t.parentNode.classList.toggle('on', t.checked); }
    });
    /* 点已选中的档位可取消 */
    document.addEventListener('click', function (e) {
      var lab = e.target.closest('.seg label');
      if (!lab) return;
      var inp = $('input[type=radio]', lab);
      if (e.target === inp) return;
      if (inp && inp.checked) {
        e.preventDefault(); inp.checked = false; refreshSeg(lab.closest('.seg')); saveDraft();
      }
    });
  }

  /* ---------- 读取与写入表单 ---------- */
  function val(name) {
    var el = $('[name="' + name + '"]');
    if (!el) return '';
    if (el.type === 'radio') { var c = $('input[name="' + name + '"]:checked'); return c ? c.value : ''; }
    if (el.type === 'checkbox') return el.checked;
    return (el.value || '').trim();
  }
  function setVal(name, v) {
    var el = $('[name="' + name + '"]');
    if (!el) return;
    if (el.type === 'radio') { $$('input[name="' + name + '"]').forEach(function (i) { i.checked = (i.value === v); }); refreshSeg(el.closest('.seg')); return; }
    if (el.type === 'checkbox') { el.checked = !!v; el.parentNode.classList.toggle('on', !!v); return; }
    el.value = v || '';
  }
  function readSheet() {
    var s = { name: val('name'), track: val('track'), stage: val('stage'), industry: val('industry'), founder: val('founder'), model: val('model'), compliance: val('compliance'), team: val('team'), round: val('round'), axes: [], gates: {}, premises: [], notes: val('notes'), materials: val('materials'), quant: { round: val('q_round'), ops: val('q_ops'), cash: val('q_cash'), next: val('q_next') } };
    AXES.forEach(function (a, i) { s.axes.push({ name: a, tier: val('axis' + i + '_tier'), evidence: val('axis' + i + '_evidence'), source: val('axis' + i + '_source') }); });
    GATES.forEach(function (g) { s.gates[g[0]] = { state: val('gate_' + g[0]) || 'unchecked', why: val('gate_' + g[0] + '_why') }; });
    [1, 2, 3].forEach(function (n) { var t = val('premise' + n + '_text'); if (t) s.premises.push({ text: t, status: val('premise' + n + '_status') || 'unverified', critical: !!val('premise' + n + '_critical') }); });
    return s;
  }
  function writeSheet(s) {
    ['name', 'track', 'stage', 'industry', 'founder', 'model', 'compliance', 'team', 'round', 'notes', 'materials'].forEach(function (k) { setVal(k, s[k] || ''); });
    var q = s.quant || {}; setVal('q_round', q.round); setVal('q_ops', q.ops); setVal('q_cash', q.cash); setVal('q_next', q.next);
    AXES.forEach(function (a, i) { var x = (s.axes || [])[i] || {}; setVal('axis' + i + '_tier', x.tier || ''); setVal('axis' + i + '_evidence', x.evidence || ''); setVal('axis' + i + '_source', x.source || ''); });
    GATES.forEach(function (g) { var x = (s.gates || {})[g[0]] || {}; setVal('gate_' + g[0], x.state || ''); setVal('gate_' + g[0] + '_why', x.why || ''); });
    [1, 2, 3].forEach(function (n) { var p = (s.premises || [])[n - 1] || {}; setVal('premise' + n + '_text', p.text || ''); setVal('premise' + n + '_status', p.status || ''); setVal('premise' + n + '_critical', !!p.critical); });
  }
  function orBlank(v) { return v ? v : '（未填）'; }
  function sheetMarkdown(s) {
    s = s || {}; s.axes = s.axes || []; s.gates = s.gates || {}; s.premises = s.premises || []; s.quant = s.quant || {};
    var L = [];
    L.push('# 速查表（' + orBlank(s.name) + '）');
    L.push('- 赛道：' + orBlank(s.track));
    L.push('- 阶段：' + orBlank(s.stage) + '　行业：' + orBlank(s.industry) + '　创始人背景：' + orBlank(s.founder) + '　商业模式：' + orBlank(s.model) + '　合规敏感点：' + orBlank(s.compliance));
    L.push('- 团队：' + orBlank(s.team));
    L.push('- 本轮：' + orBlank(s.round));
    L.push('', '## 六维（填表人判断；"未选"表示请你建议）', '| 维度 | 填表人档位 | 证据 | 来源 |', '|---|---|---|---|');
    s.axes.forEach(function (a) { L.push('| ' + a.name + ' | ' + (a.tier ? TIER_WORD[a.tier] + '（' + a.tier + '）' : '未选') + ' | ' + orBlank(a.evidence) + ' | ' + orBlank(a.source) + ' |'); });
    L.push('', '## 关卡', '| 关卡 | 状态 | 理由 |', '|---|---|---|');
    GATES.forEach(function (g) { var x = s.gates[g[0]] || {}; var w = GATE_STATES.filter(function (st) { return st[0] === x.state; })[0]; L.push('| ' + g[1] + ' | ' + (w ? w[1] : '未核查') + ' | ' + orBlank(x.why) + ' |'); });
    L.push('', '## 关键前提');
    if (!s.premises.length) L.push('（未填，请你根据表中信息提出 2 到 3 条）');
    s.premises.forEach(function (p, i) { var w = PREMISE_STATES.filter(function (st) { return st[0] === p.status; })[0]; L.push((i + 1) + '. ' + p.text + '　状态：' + (w ? w[1] : '未核实') + (p.critical ? '　【关键】' : '')); });
    L.push('', '## 笔记', orBlank(s.notes), '', '## 手头材料', orBlank(s.materials), '', '## 量化（填表人提供，单位如写）');
    L.push('- 本轮：' + orBlank(s.quant.round)); L.push('- 经营：' + orBlank(s.quant.ops)); L.push('- 资金：' + orBlank(s.quant.cash)); L.push('- 下个里程碑：' + orBlank(s.quant.next));
    return L.join('\n');
  }
  function userMessage(s) { return sheetMarkdown(s) + '\n\n请按规则只输出 JSON。'; }
  function fullPrompt(s) { return PROMPT_SYSTEM + '\n\n---\n\n' + userMessage(s); }

  /* ---------- 合成样例 ---------- */
  var SAMPLE = {
    name: '示例公司（合成）', track: '面向中小电子厂的 AI 视觉外观检测模块，卖给产线集成商', stage: '样机', industry: '制造/工业', founder: '技术', model: '硬件+软件', compliance: '无特殊',
    team: '全职 6 人，缺销售负责人', round: '800 万 · 投前 6000 万 · 出让约 12% · 研发 60% 市场 25% 团队 15%',
    axes: [
      { tier: 'normal', evidence: '两家集成商出具意向，试点排期在谈', source: '文件佐证' },
      { tier: 'unknown', evidence: '按模块卖还是按产线订阅没定', source: '公司自述' },
      { tier: 'na', evidence: '尚未融资，首轮', source: '公司自述' },
      { tier: 'strong', evidence: '同等光照条件下对照测试漏检率低于两家对手，有测试记录', source: '文件佐证' },
      { tier: 'normal', evidence: '样机交付两台，客户验收未完成', source: '文件佐证' },
      { tier: 'weak', evidence: '估值按明年收入规划倒推，条款未出', source: '公司自述' }
    ],
    gates: { fraud: { state: 'unchecked', why: '会上未核查' }, tech: { state: 'pass', why: '对照测试记录与现场演示一致' }, cash: { state: 'unchecked', why: '现金约可撑 6 个月，未核对银行流水' }, integrity: { state: 'unchecked', why: '' } },
    premises: [
      { text: '集成商愿意为漏检率下降付溢价', status: 'unverified', critical: true },
      { text: '现有两台样机三个月内通过客户验收', status: 'unverified', critical: true },
      { text: '核心算法在新品类上一周内可迁移', status: 'partial', critical: false }
    ],
    notes: '创始人对产线节拍很熟，对定价回答含糊；提到的两家对手一家没查到。', materials: 'BP（12 页）、对照测试记录（PDF）、两份意向书扫描件',
    quant: { round: '800 万 / 6000 万 / 12%', ops: '近 12 月营收 0 / — / 付费 0', cash: '现金 300 万 / 月支出 45 万', next: '6 个月后：两台样机通过验收' }
  };

  /* ---------- 本地草稿（仅本浏览器） ---------- */
  var DRAFT_KEY = 'seal-review-draft-v1', KEY_KEY = 'seal-review-key-v1';
  var saveTimer = null;
  function saveDraft() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(readSheet())); } catch (e) { } }, 300); }
  function loadDraft() { try { var s = localStorage.getItem(DRAFT_KEY); if (s) writeSheet(JSON.parse(s)); } catch (e) { } }

  /* ---------- 剪贴板与下载 ---------- */
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

  /* ---------- 调用服务商 ---------- */
  function currentProvider() {
    var k = $('#provider').value; var p = Object.assign({}, PROVIDERS[k]); p.key = k;
    if (k === 'custom') p.base = ($('#base').value || '').trim().replace(/\/+$/, '');
    return p;
  }
  function maskErr(text, key) { return key ? text.split(key).join('[密钥已隐去]') : text; }
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
        return r.text().then(function (t) {
          clearTimeout(timer);
          if (!r.ok) throw new Error('HTTP ' + r.status + '：' + maskErr(t.slice(0, 400), key));
          var data; try { data = JSON.parse(t); } catch (e) { throw new Error('服务商返回的不是 JSON：' + t.slice(0, 200)); }
          if (data.base_resp && data.base_resp.status_code && data.base_resp.status_code !== 0) throw new Error('服务商错误 ' + data.base_resp.status_code + '：' + (data.base_resp.status_msg || ''));
          if (data.error) throw new Error('服务商错误：' + (data.error.message || JSON.stringify(data.error)).slice(0, 300));
          if (p.kind === 'anthropic') return (data.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
          var ch = (data.choices || [])[0];
          if (!ch || !ch.message) throw new Error('返回里没有 choices[0].message');
          return typeof ch.message.content === 'string' ? ch.message.content : JSON.stringify(ch.message.content);
        });
      })
      .catch(function (e) {
        clearTimeout(timer);
        if (e.name === 'AbortError') throw new Error('超时（240 秒）。可以换个更快的模型再试。');
        if (/Failed to fetch|NetworkError|Load failed/.test(String(e))) throw new Error('浏览器无法直连该服务商（跨域被拒或网络不通）。请改用零接口方式，或换一家服务商。');
        throw e;
      });
  }
  function listModels(p, key) {
    var url = p.kind === 'anthropic' ? p.base + '/v1/models' : p.base + '/models';
    var headers = p.kind === 'anthropic' ? { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } : { 'authorization': 'Bearer ' + key };
    return fetch(url, { headers: headers, referrerPolicy: 'no-referrer' }).then(function (r) { return r.json(); }).then(function (d) {
      var arr = Array.isArray(d.data) ? d.data : (Array.isArray(d.models) ? d.models : []);
      return arr.map(function (m) { return m.id || m.name || ''; }).filter(Boolean).sort();
    });
  }

  /* ---------- 解析输出 ---------- */
  function str(v, n) { v = (v === null || v === undefined) ? '' : String(v); return n ? v.slice(0, n) : v; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function parseOutput(text) {
    var s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s < 0 || e < s) throw new Error('没有找到 JSON 对象。模型可能没有按要求输出，可以点"查看原始输出"。');
    var o; try { o = JSON.parse(text.slice(s, e + 1)); } catch (err) { throw new Error('JSON 解析失败：' + err.message); }
    var axes = arr(o.axes);
    if (axes.length !== 6) throw new Error('axes 应有 6 项，实际 ' + axes.length + ' 项。');
    var out = { version: 'review-output-v1', summary: str(o.summary, 120) };
    out.axes = axes.map(function (a, i) { a = a || {}; return { name: AXES[i], suggested: AXIS_TIERS.indexOf(a.suggested) >= 0 ? a.suggested : 'unknown', agree: typeof a.agree === 'boolean' ? a.agree : null, reason: str(a.reason, 200), public_reason: str(a.public_reason, 40), next: str(a.next, 120), missing: str(a.missing, 80) }; });
    out.premises = arr(o.premises).slice(0, 5).map(function (p) { p = p || {}; return { text: str(p.text, 60), status: PREMISE_STATES.some(function (x) { return x[0] === p.status; }) ? p.status : 'unverified', critical: !!p.critical, why: str(p.why, 100) }; }).filter(function (p) { return p.text; });
    var g = o.gates || {}; out.gates = { note: str(g.note, 300) };
    GATES.forEach(function (x) { out.gates[x[0]] = ['unchecked', 'pass', 'block'].indexOf(g[x[0]]) >= 0 ? g[x[0]] : 'unchecked'; });
    out.next_steps = arr(o.next_steps).slice(0, 6).map(function (n) { return typeof n === 'string' ? { text: n } : { text: str((n || {}).text, 120), verify: str((n || {}).verify, 40), by: str((n || {}).by, 20), pass: str((n || {}).pass, 30) }; }).filter(function (n) { return n.text; });
    out.requests = arr(o.requests).slice(0, 8).map(function (r) { return str(r, 60); }).filter(Boolean);
    out.questions = arr(o.questions).slice(0, 5).map(function (q) { return typeof q === 'string' ? { q: q } : { q: str((q || {}).q, 120), good: str((q || {}).good, 80), red: str((q || {}).red, 80) }; }).filter(function (q) { return q.q; });
    out.caveats = arr(o.caveats).slice(0, 6).map(function (c) { return str(c, 120); }).filter(Boolean);
    return out;
  }
  /* 最终档位：填表人选了就用填表人的，否则用模型建议 */
  function finalTiers(sheet, out) { return out.axes.map(function (a, i) { return sheet.axes[i].tier || a.suggested; }); }
  function reference(tiers, gates) {
    if (GATES.some(function (g) { return gates[g[0]] === 'block'; })) return 'hold';
    var rated = tiers.filter(function (t) { return t === 'weak' || t === 'normal' || t === 'strong'; });
    if (rated.length < 3) return 'insufficient';
    var total = rated.reduce(function (s, t) { return s + ['weak', 'normal', 'strong'].indexOf(t) + 1; }, 0);
    return ['weak', 'normal', 'strong'][Math.floor((2 * total + rated.length) / (2 * rated.length)) - 1];
  }
  function weakest(premises) {
    var c = premises.filter(function (p) { return p.critical; }); if (!c.length) return null;
    var order = PREMISE_STATES.map(function (s) { return s[0]; });
    return c.reduce(function (m, p) { return order.indexOf(p.status) > order.indexOf(m.status) ? p : m; });
  }

  /* ---------- 六维图 ---------- */
  function hexSVG(tiers) {
    var cx = 186, cy = 140, R = 100, ang = [-90, -30, 30, 90, 150, 210];
    var pt = function (r, i) { var a = ang[i] * Math.PI / 180; return [(cx + r * Math.cos(a)).toFixed(1), (cy + r * Math.sin(a)).toFixed(1)]; };
    var ring = function (r) { return ang.map(function (_, i) { return pt(r, i).join(','); }).join(' '); };
    var radius = { weak: R / 3, normal: 2 * R / 3, strong: R };
    var pts = [], dots = '';
    tiers.forEach(function (t, i) { if (radius[t]) { var p = pt(radius[t], i); pts.push(p.join(',')); dots += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="6" fill="' + TIER_COLOR[t] + '"/>'; } });
    var labelPos = [[186, 26, 'middle'], [280, 86, 'start'], [280, 200, 'start'], [186, 266, 'middle'], [92, 200, 'end'], [92, 86, 'end']];
    var labels = AXES.map(function (a, i) { var lp = labelPos[i]; var dim = !radius[tiers[i]]; return '<text x="' + lp[0] + '" y="' + lp[1] + '" text-anchor="' + lp[2] + '"' + (dim ? ' fill="#8a9096"' : '') + '>' + a + (dim ? '·' + TIER_WORD[tiers[i]] : '') + '</text>'; }).join('');
    var poly = pts.length >= 3 ? '<polygon points="' + pts.join(' ') + '" fill="rgba(31,31,31,.12)" stroke="#1f1f1f" stroke-width="2" stroke-linejoin="round"/>' : (pts.length === 2 ? '<line x1="' + pts[0].split(',')[0] + '" y1="' + pts[0].split(',')[1] + '" x2="' + pts[1].split(',')[0] + '" y2="' + pts[1].split(',')[1] + '" stroke="#1f1f1f" stroke-width="2"/>' : '');
    return '<svg viewBox="0 0 372 284" role="img" aria-label="六维图"><g fill="none" stroke="#e3e5e7" stroke-width="1"><polygon points="' + ring(R) + '"/><polygon points="' + ring(2 * R / 3) + '"/><polygon points="' + ring(R / 3) + '"/>' +
      ang.map(function (_, i) { var p = pt(R, i); return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '"/>'; }).join('') + '</g>' + poly + '<g stroke="#fff" stroke-width="2">' + dots + '</g>' +
      '<g font-family="PingFang SC,Helvetica Neue,Arial,sans-serif" font-size="11" fill="#1f1f1f">' + labels + '</g></svg>';
  }
  function chip(t) { return '<span class="chip ' + t + '">' + TIER_WORD[t] + '</span>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- 展示 ---------- */
  var LAST = null;
  function render(sheet, out, raw, source) {
    var tiers = finalTiers(sheet, out); var ref = reference(tiers, out.gates); var wk = weakest(out.premises);
    LAST = { sheet: sheet, out: out, tiers: tiers, ref: ref, raw: raw, source: source, at: new Date() };
    $('#res-title').textContent = (sheet.name || '未命名') + ' · 评审结果';
    $('#res-meta').textContent = source + ' · ' + LAST.at.toLocaleString('zh-CN');
    $('#res-summary').textContent = out.summary || '';
    $('#res-hex').innerHTML = hexSVG(tiers);
    $('#res-overall').innerHTML = (ref === 'insufficient' ? '<b>资料不足</b>（已评维度少于三个）' : chip(ref)) + ' <small style="color:var(--muted)">参考值按已评维度均值计算；综合档位由你定</small>';
    $('#res-weakest').innerHTML = wk ? esc(wk.text) + ' <small style="color:var(--muted)">' + PREMISE_MARK[wk.status] + ' ' + PREMISE_STATES.filter(function (s) { return s[0] === wk.status; })[0][1] + '</small>' : '<span style="color:var(--muted)">未给出关键前提</span>';
    $('#res-gates').innerHTML = GATES.map(function (g) { var st = out.gates[g[0]]; var w = GATE_STATES.filter(function (s) { return s[0] === st; })[0][1]; return '<span class="chip ' + (st === 'block' ? 'weak' : st === 'pass' ? 'strong' : 'na') + '" style="margin:0 6px 6px 0">' + g[1] + ' · ' + w + '</span>'; }).join('') + (out.gates.note ? '<div style="font-size:13px;color:var(--muted);margin-top:4px">' + esc(out.gates.note) + '</div>' : '');
    $('#res-axes').innerHTML = out.axes.map(function (a, i) {
      var mine = sheet.axes[i].tier; var agree = a.agree === true ? '模型同意' : a.agree === false ? '模型不同意，建议 ' + TIER_WORD[a.suggested] : '';
      return '<li><div class="top"><b>' + a.name + '</b><span>' + (mine ? chip(mine) + '<span class="agree">' + agree + '</span>' : chip(a.suggested) + '<span class="agree">模型建议</span>') + '</span></div>' +
        (a.public_reason ? '<p><strong style="color:var(--ink)">' + esc(a.public_reason) + '</strong></p>' : '') + (a.reason ? '<p>' + esc(a.reason) + '</p>' : '') + (a.missing ? '<p>缺：' + esc(a.missing) + '</p>' : '') + (a.next ? '<p class="next">' + esc(a.next) + '</p>' : '') + '</li>';
    }).join('');
    $('#res-premises').innerHTML = out.premises.length ? out.premises.map(function (p) { return '<li>' + PREMISE_MARK[p.status] + ' ' + esc(p.text) + (p.critical ? ' <b>【关键】</b>' : '') + '<small>' + PREMISE_STATES.filter(function (s) { return s[0] === p.status; })[0][1] + (p.why ? ' · ' + esc(p.why) : '') + '</small></li>'; }).join('') : '<li style="color:var(--muted)">无</li>';
    $('#res-next').innerHTML = out.next_steps.length ? out.next_steps.map(function (n, i) { return '<li>' + (i + 1) + '. ' + esc(n.text) + '<small>' + [n.verify && '验证：' + esc(n.verify), n.by && '期限：' + esc(n.by), n.pass && '通过线：' + esc(n.pass)].filter(Boolean).join(' · ') + '</small></li>'; }).join('') : '<li style="color:var(--muted)">无</li>';
    $('#res-requests').innerHTML = out.requests.length ? out.requests.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') : '<li style="color:var(--muted)">无</li>';
    $('#res-questions').innerHTML = out.questions.length ? out.questions.map(function (q, i) { return '<li>' + (i + 1) + '. ' + esc(q.q) + '<small>' + [q.good && '<span class="ok">好答案：' + esc(q.good) + '</span>', q.red && '红旗：' + esc(q.red)].filter(Boolean).join(' · ') + '</small></li>'; }).join('') : '<li style="color:var(--muted)">无</li>';
    $('#res-caveats').innerHTML = out.caveats.length ? out.caveats.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') : '<li style="color:var(--muted)">模型未说明</li>';
    $('#raw').textContent = raw; $('#raw').hidden = true;
    $('#result').classList.add('show');
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function reportMarkdown() {
    var L = LAST, s = L.sheet, o = L.out; var lines = [];
    lines.push('# ' + (s.name || '未命名') + ' · AI 辅助自评（海豹增长方法 V3）');
    lines.push('', '> AI 辅助自评 · 未经独立核验 · 不代表海豹增长背书 · 不构成投资建议 · 不承诺融资或收益。', '> 生成：' + L.at.toLocaleString('zh-CN') + ' · ' + L.source + ' · 工具 V1 · 方法 V3', '');
    lines.push('**一句话**：' + (o.summary || '（无）'), '', '**综合参考**：' + (L.ref === 'insufficient' ? '资料不足' : TIER_WORD[L.ref]) + '（已评维度均值；综合档位由人定）');
    var wk = weakest(o.premises); lines.push('**最弱关键前提**：' + (wk ? wk.text + '（' + PREMISE_STATES.filter(function (x) { return x[0] === wk.status; })[0][1] + '）' : '无'), '');
    lines.push('## 六维', '| 维度 | 档位 | 来源 | 一句理由 | 依据 | 缺什么 | 下一步 |', '|---|---|---|---|---|---|---|');
    o.axes.forEach(function (a, i) { var mine = s.axes[i].tier; lines.push('| ' + a.name + ' | ' + TIER_WORD[L.tiers[i]] + ' | ' + (mine ? '填表人' + (a.agree === false ? '（模型建议 ' + TIER_WORD[a.suggested] + '）' : '') : '模型建议') + ' | ' + a.public_reason + ' | ' + a.reason + ' | ' + a.missing + ' | ' + a.next + ' |'); });
    lines.push('', '## 关卡');
    GATES.forEach(function (g) { lines.push('- ' + g[1] + '：' + GATE_STATES.filter(function (x) { return x[0] === o.gates[g[0]]; })[0][1]); });
    if (o.gates.note) lines.push('- 说明：' + o.gates.note);
    lines.push('', '## 关键前提');
    o.premises.forEach(function (p, i) { lines.push((i + 1) + '. ' + p.text + '　' + PREMISE_STATES.filter(function (x) { return x[0] === p.status; })[0][1] + (p.critical ? '　【关键】' : '') + (p.why ? '　' + p.why : '')); });
    lines.push('', '## 下一步要证明什么（先便宜后贵）');
    o.next_steps.forEach(function (n, i) { lines.push((i + 1) + '. ' + n.text + [n.verify && '验证：' + n.verify, n.by && '期限：' + n.by, n.pass && '通过线：' + n.pass].filter(Boolean).map(function (x) { return '　' + x; }).join('')); });
    lines.push('', '## 要补的材料'); o.requests.forEach(function (r) { lines.push('- ' + r); });
    lines.push('', '## 会上要问的问题'); o.questions.forEach(function (q, i) { lines.push((i + 1) + '. ' + q.q + (q.good ? '　好答案：' + q.good : '') + (q.red ? '　红旗：' + q.red : '')); });
    lines.push('', '## 模型自述的不确定处'); o.caveats.forEach(function (c) { lines.push('- ' + c); });
    lines.push('', '---', '', '## 附：速查表原文', '', sheetMarkdown(s));
    return lines.join('\n');
  }

  /* ---------- 事件 ---------- */
  function needConsent(id) { if (!$('#consent').checked) { status(id, '请先勾选上面的确认。', true); return false; } return true; }
  function localDate(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fileStem() { return ((LAST && LAST.sheet.name) || 'review').replace(/[\\/:*?"<>|\s]+/g, '-') + '-' + localDate(new Date()); }

  function init() {
    buildForm();
    var sel = $('#provider');
    Object.keys(PROVIDERS).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = PROVIDERS[k].name; sel.appendChild(o); });
    function syncProvider() {
      var p = PROVIDERS[sel.value]; $('#provider-note').textContent = p.note; $('#base-field').hidden = sel.value !== 'custom';
      $('#model').value = p.model; $('#model-list').innerHTML = '';
      var saved = null; try { saved = JSON.parse(localStorage.getItem(KEY_KEY) || 'null'); } catch (e) { }
      if (saved && saved.provider === sel.value) { $('#key').value = saved.key || ''; $('#remember').checked = true; } else { $('#key').value = ''; $('#remember').checked = false; }
    }
    try { var saved0 = JSON.parse(localStorage.getItem(KEY_KEY) || 'null'); if (saved0 && PROVIDERS[saved0.provider]) sel.value = saved0.provider; } catch (e) { }
    sel.addEventListener('change', syncProvider); syncProvider();
    $('#remember').addEventListener('change', function () { try { if (this.checked) localStorage.setItem(KEY_KEY, JSON.stringify({ provider: sel.value, key: $('#key').value })); else localStorage.removeItem(KEY_KEY); } catch (e) { } });
    $('#key').addEventListener('input', function () { try { if ($('#remember').checked) localStorage.setItem(KEY_KEY, JSON.stringify({ provider: sel.value, key: this.value })); } catch (e) { } });
    $$('input[name=mode]').forEach(function (r) { r.addEventListener('change', function () { $('#mode-a').classList.toggle('on', r.value === 'a' && r.checked); $('#mode-b').classList.toggle('on', r.value === 'b' && r.checked); }); });
    $$('.mode h3').forEach(function (h) { h.addEventListener('click', function () { var r = $('input', h); if (!r.checked) { r.checked = true; r.dispatchEvent(new Event('change')); } }); });
    $('#sheet').addEventListener('input', saveDraft); $('#sheet').addEventListener('change', saveDraft);
    loadDraft();

    $('#btn-sample').addEventListener('click', function () { writeSheet(SAMPLE); saveDraft(); });
    $('#btn-clear').addEventListener('click', function () { writeSheet({ axes: [], gates: {}, premises: [] }); try { localStorage.removeItem(DRAFT_KEY); } catch (e) { } });
    $('#btn-copy-sheet').addEventListener('click', function () { copyText(sheetMarkdown(readSheet())).then(function () { status('status-a', '速查表已复制。'); }, function () { status('status-a', '复制失败，请手动选择。', true); }); });

    $('#btn-models').addEventListener('click', function (e) {
      e.preventDefault(); var key = $('#key').value.trim(); if (!key) { status('status-a', '先填密钥。', true); return; }
      var p = currentProvider(); if (!p.base) { status('status-a', '先填接口地址。', true); return; }
      status('status-a', '正在读取模型列表…');
      listModels(p, key).then(function (ids) { $('#model-list').innerHTML = ids.map(function (id) { return '<option value="' + esc(id) + '">'; }).join(''); status('status-a', ids.length ? '读到 ' + ids.length + ' 个模型，在模型名框里下拉选择。' : '服务商没有返回模型列表。'); }, function (err) { status('status-a', '读取失败：' + maskErr(String(err.message || err), key), true); });
    });

    $('#btn-run').addEventListener('click', function () {
      if (!needConsent('status-a')) return;
      var key = $('#key').value.trim(), model = $('#model').value.trim(), p = currentProvider();
      if (!key) { status('status-a', '请填入你的 API 密钥。', true); return; }
      if (!model) { status('status-a', '请填模型名。', true); return; }
      if (!p.base || !/^https:\/\//.test(p.base)) { status('status-a', '接口地址必须以 https:// 开头。', true); return; }
      var sheet = readSheet(); var btn = $('#btn-run'); btn.disabled = true; status('status-a', '已发送给 ' + p.name + '，通常 20 到 90 秒…');
      callModel(p, key, model, PROMPT_SYSTEM, userMessage(sheet)).then(function (text) {
        try { render(sheet, parseOutput(text), text, p.name + ' · ' + model); status('status-a', '完成。'); }
        catch (e) { status('status-a', e.message, true); $('#raw').textContent = text; $('#raw').hidden = false; $('#result').classList.add('show'); }
      }, function (err) { status('status-a', String(err.message || err), true); }).then(function () { btn.disabled = false; });
    });

    $('#btn-copy-prompt').addEventListener('click', function () { if (!needConsent('status-b')) return; copyText(fullPrompt(readSheet())).then(function () { status('status-b', '提示词已复制。去任意对话模型粘贴，把它回复的 JSON 贴到下面。'); }, function () { status('status-b', '复制失败，请点"查看提示词"手动复制。', true); }); });
    $('#btn-show-prompt').addEventListener('click', function () { var pv = $('#prompt-view'); pv.textContent = fullPrompt(readSheet()); pv.hidden = !pv.hidden; if (!pv.hidden) pv.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    $('#btn-parse').addEventListener('click', function () {
      if (!needConsent('status-b')) return; var text = $('#paste').value; if (!text.trim()) { status('status-b', '先粘贴模型的回复。', true); return; }
      try { render(readSheet(), parseOutput(text), text, '零接口 · 手动粘贴'); status('status-b', '完成。'); } catch (e) { status('status-b', e.message, true); }
    });

    $('#btn-export-md').addEventListener('click', function () { if (!LAST) return; copyText(reportMarkdown()).then(function () { status('status-r', 'Markdown 已复制。'); }, function () { status('status-r', '复制失败。', true); }); });
    $('#btn-dl-md').addEventListener('click', function () { if (LAST) download(fileStem() + '.md', reportMarkdown(), 'text/markdown;charset=utf-8'); });
    $('#btn-dl-json').addEventListener('click', function () { if (LAST) download(fileStem() + '.json', JSON.stringify({ tool: 'seal-growth-review-v1', method: 'V3', generated_at: LAST.at.toISOString(), source: LAST.source, disclaimer: 'AI 辅助自评，未经独立核验，不代表海豹增长背书，不构成投资建议，不承诺融资或收益。', sheet: LAST.sheet, output: LAST.out, final_tiers: LAST.tiers, overall_reference: LAST.ref }, null, 2), 'application/json;charset=utf-8'); });
    $('#btn-raw').addEventListener('click', function () { var r = $('#raw'); r.hidden = !r.hidden; });
  }
  window.SEAL_REVIEW = { version: 'review-tool-v1', method: 'V3', PROMPT_SYSTEM: PROMPT_SYSTEM, AXES: AXES, ANCHORS: ANCHORS, PROVIDERS: PROVIDERS, SAMPLE: SAMPLE, parseOutput: parseOutput, reference: reference, sheetMarkdown: sheetMarkdown, fullPrompt: fullPrompt, readSheet: readSheet };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
