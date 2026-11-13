"""V3 schema, derived judgments and audience-specific public projections (offline)."""
import copy
from datetime import date
import hashlib
import json
import re
from pdf_unicode import normalize

AXES = ['市场需求', '商业模式', '资本效率', '竞争壁垒', '执行能力', '投资回报']
STAGES = ['概念', '原理验证', '样机', '试点', '付费', '量产']
LEVELS = {
    'unknown': {'word': '未知', 'color': '#6B3FA0', 'ink': '#FFFFFF'},
    'weak': {'word': '弱点', 'color': '#D93025', 'ink': '#FFFFFF'},
    'normal': {'word': '正常', 'color': '#F2C200', 'ink': '#000000'},
    'strong': {'word': '优秀', 'color': '#2E8B3E', 'ink': '#FFFFFF'},
    'na': {'word': '不适用', 'color': '#9AA0A6', 'ink': '#000000'},
    'hold': {'word': '暂缓', 'color': '#1F1F1F', 'ink': '#FFFFFF'},
}
AXIS_LEVELS = tuple(LEVELS)[:5]
OVERALL_LEVELS = ('unknown', 'weak', 'normal', 'strong', 'hold', None)
CONFIDENCE = ('high', 'medium', 'low', 'none')
GATES = ('fraud', 'tech', 'cash', 'integrity')
STATUS = {'false': '不成立', 'unverified': '未核实', 'partial': '部分核实', 'verified': '已核实'}
EVIDENCE = ('公司自述', '文件佐证', '独立核验')
LABELS = {'meta': '报告信息', 'company': '企业信息', 'axes': '六维', 'overall': '综合',
          'premises': '关键前提', 'gates': '关卡', 'judgments': '判断', 'problems': '问题',
          'analysis': '分析底稿', 'sources': '来源', 'card': '企业卡片', 'internal_notes': '内部备注',
          'name': '名称', 'level': '档位', 'public_reason': '对外理由', 'next': '下一步',
          'reason': '内部依据', 'confidence': '置信度', 'text': '正文', 'by': '期限', 'pass': '通过线',
          'verify': '验证方式', 'critical': '关键标记', 'status': '状态', 'external': '对外开关',
          'version': '版本', 'stage': '阶段', 'fund_use': '资金用途', 'round': '融资', 'amount': '金额',
          'valuation': '估值', 'dilution': '出让比例', 'founder': '创始人', 'team': '团队',
          'summary': '摘要', 'macro': '宏观', 'meso': '行业', 'micro': '公司', 'chain': '因果链',
          'cash': '现金', 'terms': '条款', 'requests': '索证清单', 'note': '备注'}


def field_label(path):
    return '.'.join(LABELS.get(p, p) for p in re.split(r'[.\[\]]+', path) if p)


class ValidationError(ValueError):
    def __init__(self, errors):
        self.errors = errors if isinstance(errors, list) else [str(errors)]
        super().__init__('；'.join(self.errors))


class SystemBuildError(ValidationError):
    pass


def require(condition, message):
    if not condition:
        raise ValidationError(message)


def valid_id(value):
    require(isinstance(value, str) and re.fullmatch(r'[a-z0-9-]{1,64}', value, re.ASCII),
            'company.id：企业 id 仅允许 1–64 位小写英文字母、数字和连字符')
    return value


def public_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from public_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from public_strings(item)


def pending_paths(value, path=''):
    result = []
    if isinstance(value, str) and '待填' in value:
        result.append(path)
    elif isinstance(value, dict):
        for key, item in value.items():
            if key not in ('confirmation', '_saved_at'):
                result.extend(pending_paths(item, f'{path}.{key}' if path else key))
    elif isinstance(value, list):
        for i, item in enumerate(value):
            result.extend(pending_paths(item, f'{path}[{i}]'))
    return result


def assessed(data):
    return [a['level'] for a in data['axes'] if a.get('level') in ('weak', 'normal', 'strong')]


def reference(data):
    levels = assessed(data)
    if len(levels) < 3:
        return '资料不足'
    # Integer half-up rounding; the numerical intermediate is never exported.
    total = sum(('weak', 'normal', 'strong').index(v) + 1 for v in levels)
    return LEVELS[('weak', 'normal', 'strong')[(2 * total + len(levels)) // (2 * len(levels)) - 1]]['word']


def insufficient(data):
    return len(assessed(data)) < 3 or all(data['card'][key].startswith('待确认') for key in ('founder', 'team'))


def weakest(data):
    critical = [p for p in data['premises'] if p.get('critical')]
    return min(critical, key=lambda p: tuple(STATUS).index(p['status'])) if critical else None


def blocked(data):
    return any(data.get('gates', {}).get(key) == 'block' for key in GATES)


def content_sha256(data):
    content = {k: v for k, v in data.items() if k not in ('confirmation', '_saved_at')}
    return hashlib.sha256(json.dumps(content, sort_keys=True, separators=(',', ':'),
                                     ensure_ascii=False, allow_nan=False).encode('utf-8')).hexdigest()


class Validator:
    def __init__(self):
        self.errors = []

    def check(self, ok, path, message):
        if not ok:
            self.errors.append(f'{field_label(path)}（{path}）：{message}')
        return ok

    def obj(self, value, path, keys):
        if not self.check(isinstance(value, dict), path, '必须是对象'):
            return {}
        for key in keys:
            self.check(key in value, f'{path}.{key}', '缺少字段')
        return value

    def seq(self, value, path, low, high):
        if not self.check(isinstance(value, list), path, '必须是数组'):
            return []
        self.check(low <= len(value) <= high, path, f'必须有 {low}–{high} 项')
        return value

    def text(self, value, path, limit, empty=False):
        if self.check(isinstance(value, str), path, '必须是文字'):
            self.check(empty or bool(value.strip()), path, '不能为空')
            self.check(len(value) <= limit, path, f'最多 {limit} 字')
            self.check(not any(ord(c) < 32 and c not in '\n\t' for c in value), path, '含控制字符')

    def enum(self, value, path, values):
        self.check(value in values, path, '须为 ' + ' / '.join('null' if v is None else str(v) for v in values))

    def integer(self, value, path, low, high):
        self.check(type(value) is int and low <= value <= high, path, f'必须是 {low}–{high} 的整数')


def validation_errors(data, external_ready=True, allow_pending=False, require_overall=False):
    v = Validator()
    d = v.obj(data, '数据', ['meta', 'company', 'analysis', 'axes', 'overall', 'premises', 'gates', 'judgments', 'problems', 'card', 'sources'])
    meta = v.obj(d.get('meta'), 'meta', ['version', 'as_of', 'brand_cn', 'brand_en', 'fa_disclosure', 'disclaimer'])
    for key in ('version', 'as_of', 'brand_cn', 'brand_en', 'fa_disclosure', 'disclaimer'):
        v.text(meta.get(key), f'meta.{key}', 120, empty=key == 'fa_disclosure')
    v.check(meta.get('version') == 'V3', 'meta.version', '必须是 V3')
    try:
        assert isinstance(meta.get('as_of'), str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', meta['as_of'])
        date.fromisoformat(meta['as_of'])
    except (ValueError, AssertionError):
        v.check(False, 'meta.as_of', '请填写有效的 YYYY-MM-DD 日期')
    v.check(meta.get('brand_cn') == '海豹增长' and meta.get('brand_en') == 'SEAL Growth', 'meta', '品牌必须为 海豹增长 / SEAL Growth')
    company = v.obj(d.get('company'), 'company', ['id', 'name', 'sector', 'business', 'stage', 'round', 'fund_use'])
    try:
        valid_id(company.get('id'))
    except ValidationError as e:
        v.errors.extend(e.errors)
    for key in ('name', 'sector', 'business'):
        v.text(company.get(key), f'company.{key}', 120)
    v.enum(company.get('stage'), 'company.stage', STAGES)
    rnd = v.obj(company.get('round'), 'company.round', ['name', 'amount', 'valuation', 'dilution'])
    for key in ('name', 'amount', 'valuation', 'dilution'):
        v.text(rnd.get(key), f'company.round.{key}', 40)
    funds = v.seq(company.get('fund_use'), 'company.fund_use', 0, 6)
    total = 0
    for i, item in enumerate(funds):
        p = f'company.fund_use[{i}]'; item = v.obj(item, p, ['label', 'pct'])
        v.text(item.get('label'), p + '.label', 12)
        v.integer(item.get('pct'), p + '.pct', 0, 100)
        if type(item.get('pct')) is int:
            total += item['pct']
    v.check(not funds or total == 100, 'company.fund_use', '非空资金用途合计必须为 100')
    axes = v.seq(d.get('axes'), 'axes', 6, 6)
    for i, axis in enumerate(axes):
        p = f'axes[{i}]'; axis = v.obj(axis, p, ['name', 'suggested', 'level', 'reason', 'next', 'public_reason', 'confidence'])
        v.check(i < 6 and axis.get('name') == AXES[i], p + '.name', '名称及顺序必须为 ' + '、'.join(AXES))
        for key in ('suggested', 'level'):
            v.enum(axis.get(key), p + '.' + key, AXIS_LEVELS)
        v.text(axis.get('reason'), p + '.reason', 100)
        v.text(axis.get('next'), p + '.next', 60, empty=axis.get('level') not in ('unknown', 'weak'))
        v.text(axis.get('public_reason'), p + '.public_reason', 24)
        v.enum(axis.get('confidence'), p + '.confidence', CONFIDENCE)
    overall = v.obj(d.get('overall'), 'overall', ['level'])
    v.enum(overall.get('level'), 'overall.level', OVERALL_LEVELS)
    if require_overall:
        v.check(overall.get('level') is not None, 'overall.level', '未定档，不可确认对外')
    gates = v.obj(d.get('gates'), 'gates', [*GATES, 'note'])
    for key in GATES:
        v.enum(gates.get(key), 'gates.' + key, ('unchecked', 'pass', 'block'))
    v.text(gates.get('note'), 'gates.note', 200, empty=True)
    v.check(any(gates.get(k) == 'block' for k in GATES) == (overall.get('level') == 'hold'), 'overall.level', '关卡阻断当且仅当综合为暂缓')
    source_ids = []
    for i, source in enumerate(v.seq(d.get('sources'), 'sources', 1, 30)):
        p = f'sources[{i}]'; source = v.obj(source, p, ['id', 'short'])
        v.integer(source.get('id'), p + '.id', 1, 999)
        v.text(source.get('short'), p + '.short', 120)
        if type(source.get('id')) is int:
            v.check(source['id'] not in source_ids, p + '.id', '来源编号不得重复')
            source_ids.append(source['id'])

    def refs(item, p, minimum=0):
        seen = []
        for j, n in enumerate(v.seq(item.get('sources'), p + '.sources', minimum, 10)):
            v.check(type(n) is int and n in source_ids, f'{p}.sources[{j}]', '来源编号必须存在')
            v.check(n not in seen, p + '.sources', '来源编号不得重复')
            seen.append(n)

    premises = v.seq(d.get('premises'), 'premises', 2, 5)
    ids = []
    for i, item in enumerate(premises):
        p = f'premises[{i}]'; item = v.obj(item, p, ['id', 'text', 'status', 'critical', 'sources'])
        v.integer(item.get('id'), p + '.id', 1, 999)
        v.check(item.get('id') not in ids, p + '.id', '编号不得重复'); ids.append(item.get('id'))
        v.text(item.get('text'), p + '.text', 40)
        v.enum(item.get('status'), p + '.status', tuple(STATUS))
        v.check(type(item.get('critical')) is bool, p + '.critical', '必须是布尔值')
        refs(item, p)
    v.check(any(isinstance(p, dict) and p.get('critical') is True for p in premises), 'premises', '至少一条 critical 关键前提')
    for key in ('judgments', 'problems'):
        ids = []; count = 0
        for i, item in enumerate(v.seq(d.get(key), key, 1, 5)):
            p = f'{key}[{i}]'
            fields = ['id', 'text', 'external', 'sources'] + (['evidence'] if key == 'judgments' else ['verify', 'by', 'pass', 'likelihood', 'impact'])
            item = v.obj(item, p, fields)
            v.integer(item.get('id'), p + '.id', 1, 999)
            v.check(item.get('id') not in ids, p + '.id', '编号不得重复'); ids.append(item.get('id'))
            v.text(item.get('text'), p + '.text', 100)
            v.check(type(item.get('external')) is bool, p + '.external', '必须是布尔值')
            count += item.get('external') is True
            refs(item, p, 1)
            if key == 'judgments':
                v.enum(item.get('evidence'), p + '.evidence', EVIDENCE)
            else:
                for field, limit in (('verify', 22), ('by', 6), ('pass', 12)):
                    v.text(item.get(field), p + '.' + field, limit, empty=not (external_ready and item.get('external')))
                for field in ('likelihood', 'impact'):
                    v.integer(item.get(field), p + '.' + field, 1, 3)
        if external_ready:
            v.check(3 <= count <= 5, key, f'对外条目需选 3–5 条，当前 {count} 条')
    card = v.obj(d.get('card'), 'card', ['founder', 'team', 'business', 'vision', 'vision_source'])
    for key in ('founder', 'team', 'business', 'vision', 'vision_source'):
        v.text(card.get(key), 'card.' + key, 100)
    a = v.obj(d.get('analysis'), 'analysis', ['summary', 'macro', 'meso', 'micro', 'chain', 'cash', 'terms', 'requests'])
    v.text(a.get('summary'), 'analysis.summary', 300)
    for key, low, high in (('macro', 0, 3), ('meso', 1, 5), ('micro', 1, 8)):
        for i, item in enumerate(v.seq(a.get(key), 'analysis.' + key, low, high)):
            p = f'analysis.{key}[{i}]'
            item = v.obj(item, p, ['text', 'evidence', 'sources'] + (['effect'] if key == 'macro' else []))
            v.text(item.get('text'), p + '.text', 100)
            v.enum(item.get('evidence'), p + '.evidence', (*EVIDENCE, '推断'))
            refs(item, p)
            if key == 'macro':
                v.enum(item.get('effect'), p + '.effect', ('需求', '准入', '成本', '定价'))
    for i, item in enumerate(v.seq(a.get('chain'), 'analysis.chain', 0, 6)):
        v.text(item, f'analysis.chain[{i}]', 60)
    cash = v.obj(a.get('cash'), 'analysis.cash', ['runway_months', 'note'])
    v.check(cash.get('runway_months') is None or type(cash.get('runway_months')) is int, 'analysis.cash.runway_months', '须为整数或 null')
    v.text(cash.get('note'), 'analysis.cash.note', 100)
    terms = v.obj(a.get('terms'), 'analysis.terms', ['note'])
    v.text(terms.get('note'), 'analysis.terms.note', 200)
    lacking = (sum(isinstance(x, dict) and x.get('level') in ('weak', 'normal', 'strong') for x in axes) < 3 or
               all(isinstance(card.get(k), str) and card[k].startswith('待确认') for k in ('founder', 'team')))
    for i, item in enumerate(v.seq(a.get('requests'), 'analysis.requests', 1, 12)):
        v.text(item, f'analysis.requests[{i}]', 30 if lacking and external_ready and i < 8 else 60)
    if 'internal_notes' in d:
        v.text(d['internal_notes'], 'internal_notes', 10000, empty=True)
    if not allow_pending:
        for path in pending_paths(d):
            v.check(False, path, '含待填，不可确认对外')
    return list(dict.fromkeys(v.errors))


def validate(data, external_ready=True, allow_pending=False, require_overall=False):
    errors = validation_errors(data, external_ready, allow_pending, require_overall)
    if errors:
        raise ValidationError(errors)
    return data


def public_data(data, version, preview=False):
    require(version in ('founder', 'investor'), 'version：请选择 founder 或 investor')
    validate(data, allow_pending=preview)
    lacking = insufficient(data)
    require(version != 'investor' or not lacking, '资料不足：投资人版不生成')
    result = {
        'audience': version,
        'meta': {k: data['meta'][k] for k in ('as_of', 'brand_cn', 'brand_en', 'fa_disclosure', 'disclaimer')},
        'company': {k: data['company'][k] for k in ('name', 'sector', 'business', 'stage')},
    }
    rnd = data['company']['round']
    result['company']['round'] = {'headline': ('待确认' if rnd['amount'] == '待确认' else rnd['amount'] + '（轮次待确认）') if rnd['name'] == '待确认' else rnd['name'] + ' ' + rnd['amount'],
                                  'valuation': rnd['valuation'], 'dilution': rnd['dilution']}
    if rnd['name'] == '待确认' and rnd['amount'] == '待确认':
        result['company']['round'] = {'headline': '待确认'}
    result['company']['fund_use'] = [{k: x[k] for k in ('label', 'pct')} for x in data['company']['fund_use']]
    for key, extra in (('judgments', ['evidence']), ('problems', ['verify', 'by', 'pass'])):
        result[key] = [{'number': i, **{k: copy.deepcopy(item[k]) for k in ('text', 'sources', *extra)}}
                       for i, item in enumerate((x for x in data[key] if x['external']), 1)]
    if version == 'founder':
        p = weakest(data)
        result['weakest'] = {k: copy.deepcopy(p[k]) for k in ('text', 'status', 'sources')}
        result['overall'] = {'rating': 'hold' if blocked(data) else 'insufficient' if lacking else data['overall']['level']}
        if lacking:
            result['requests'] = data['analysis']['requests'][:8]
        else:
            result['axes'] = [{k: a[k] for k in ('name', 'level', 'public_reason')} for a in data['axes']]
    else:
        result['card'] = {k: data['card'][k] for k in ('founder', 'team', 'vision', 'vision_source')}
        result['premises'] = [{k: copy.deepcopy(p[k]) for k in ('text', 'status', 'sources')} for p in data['premises'] if p['critical']]
    cited = {n for key in ('judgments', 'problems', 'premises') for item in result.get(key, []) for n in item['sources']}
    cited.update(result.get('weakest', {}).get('sources', []))
    result['sources'] = [{k: s[k] for k in ('id', 'short')} for s in sorted(data['sources'], key=lambda s: s['id']) if s['id'] in cited]
    if preview:
        result['preview'] = True
    elif isinstance(data.get('confirmation'), dict):
        result['review'] = {k: data['confirmation'][k] for k in ('by', 'at', 'version')}
    check_public(result, version)
    return result


# Recursive schema: extensions in input never cross this boundary.
COMMON = {'audience': str, 'meta': {k: str for k in ('as_of', 'brand_cn', 'brand_en', 'fa_disclosure', 'disclaimer')},
          'company': {'name': str, 'sector': str, 'business': str, 'stage': str,
                      'round': {'headline': str, 'valuation': str, 'dilution': str}, 'fund_use': [{'label': str, 'pct': int}]},
          'judgments': [{'number': int, 'text': str, 'sources': [int], 'evidence': str}],
          'problems': [{'number': int, 'text': str, 'sources': [int], 'verify': str, 'by': str, 'pass': str}],
          'sources': [{'id': int, 'short': str}], 'preview': bool, 'review': {'by': str, 'at': str, 'version': str}}
PREMISE = {'text': str, 'status': str, 'sources': [int]}
SCHEMAS = {
    'founder': {**COMMON, 'weakest': PREMISE, 'overall': {'rating': (str, type(None))},
                'axes': [{'name': str, 'level': str, 'public_reason': str}], 'requests': [str]},
    'investor': {**COMMON, 'card': {k: str for k in ('founder', 'team', 'vision', 'vision_source')}, 'premises': [PREMISE]},
}


def check_public(value, version):
    def walk(item, schema, path):
        if isinstance(schema, dict):
            require(isinstance(item, dict), path + '：公开投影类型错误')
            for key, child in item.items():
                require(key in schema, path + '.' + key + '：不在公开白名单')
                walk(child, schema[key], path + '.' + key)
        elif isinstance(schema, list):
            require(isinstance(item, list), path + '：公开投影类型错误')
            for i, child in enumerate(item):
                walk(child, schema[0], f'{path}[{i}]')
        else:
            require(type(item) in (schema if isinstance(schema, tuple) else (schema,)), path + '：公开投影类型错误')
    walk(value, SCHEMAS[version], version)


def private_strings(data, version='founder', preview=False):
    public = set(public_strings(public_data(data, version, preview)))
    private = [data.get('internal_notes', ''), data['gates']['note'], data['analysis']]
    private.extend({k: a[k] for k in ('reason', 'next')} for a in data['axes'])
    if version == 'investor':
        private.extend(a['public_reason'] for a in data['axes'])
    for key in ('judgments', 'problems'):
        private.extend(item for item in data[key] if not item['external'])
    # Fixed schema enums are governed by the structural whitelist, not substring
    # matching (e.g. CSS "none" is not a leaked confidence value).
    enums = set((*AXIS_LEVELS, *CONFIDENCE, *EVIDENCE, '推断', '需求', '准入', '成本', '定价'))
    # CC 2026-11-03：短于 6 字的通用短语（如"未披露"）和被某条对外文字整体包含的字符串不算内部专用，
    # 否则对外句子里的常见词会被误判为泄露。哨兵与真正的内部句子都远长于 6 字。
    public_list = list(public)
    return sorted({s for s in public_strings(private)
                   if s.strip() and len(s.strip()) >= 6 and s not in public and s not in enums
                   and not any(s in p for p in public_list)})


def narrative_warnings(public):
    if public['audience'] != 'investor':
        return []
    words = [s['word'] for s in LEVELS.values()]
    hits = sorted({w for s in public_strings(public) for w in words if w in normalize(s)})
    return ['投资人版叙述含档位同词，请复核：' + '、'.join(hits)] if hits else []
