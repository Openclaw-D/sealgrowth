"""Build deterministic test fixtures solely from the public synthetic sample.

The stress lengths, selection gaps, source references and privacy sentinels
exercise the original assertions; none of these records describe a company.
"""
import copy
import json
from pathlib import Path

APP = Path(__file__).resolve().parent


def padded(prefix, length):
    return (prefix + '仅用于合成边界测试' * length)[:length]


def fixtures():
    base = json.loads((APP / 'data-v3/sample-company.draft.json').read_text(encoding='utf-8'))
    base['company'].update(id='fixture-five', name='合成测试企业（不存在）')
    for i, (axis, level) in enumerate(zip(base['axes'], ('unknown', 'weak', 'normal', 'strong', 'normal', 'strong'))):
        axis.update(level=level, suggested=level, confidence='low',
                    reason=f'内部合成依据哨兵第{i + 1}项', next=f'内部合成下一步哨兵第{i + 1}项',
                    public_reason=f'合成公开理由第{i + 1}项')
    for i, premise in enumerate(base['premises']):
        premise.update(text=f'合成前提第{i + 1}项仅供验证流程', status='partial' if i == 0 else 'unverified', critical=True, sources=[1])
    base['judgments'] = [dict(id=(i + 1) * 11, text=f'合成判断第{i + 1}项仅供渲染测试',
                              external=True, evidence='公司自述', sources=[1]) for i in range(5)]
    base['problems'] = [dict(id=(i + 1) * 11, text=f'合成问题第{i + 1}项仅供流程测试', external=True,
                            sources=[1], verify='核对合成演示记录', by='合成期内',
                            **{'pass': '合成检查完成'}, likelihood=3 if i < 4 else 1,
                            impact=2 if i < 4 else 1) for i in range(5)]
    base['sources'] = [{'id': 1, 'short': '合成示例：公开测试来源'}, {'id': 6, 'short': '合成示例：未引用测试来源'}]
    base['analysis'] = {
        'summary': '内部合成分析摘要哨兵',
        'macro': [{'text': '内部合成宏观分析哨兵', 'evidence': '推断', 'sources': [1], 'effect': '需求'}],
        'meso': [{'text': '内部合成行业分析哨兵', 'evidence': '推断', 'sources': [1]}],
        'micro': [{'text': '内部合成企业分析哨兵', 'evidence': '推断', 'sources': [1]}],
        'chain': ['内部合成因果链条哨兵'],
        'cash': {'runway_months': None, 'note': '内部合成现金分析哨兵'},
        'terms': {'note': '内部合成条款分析哨兵'}, 'requests': ['补充合成测试材料'],
    }
    base['internal_notes'] = '内部备注秘密哨兵行人辰长'
    result = {}
    for name in ('three', 'five', 'overflow', 'unknown', 'capacity', 'hold', 'na', 'hold-unknown'):
        data = copy.deepcopy(base)
        data['company']['id'] = 'fixture-' + name
        if name == 'three':
            for key in ('judgments', 'problems'):
                for i, item in enumerate(data[key]):
                    item['external'] = i < 3
                    if i >= 3:
                        item['text'] = f'内部合成未选条目哨兵{key}{i + 1}'
        if name == 'overflow':
            for i in range(2):
                data['judgments'][i]['text'] = padded(f'合成溢出判断第{i + 1}项', 96)
        if name in ('unknown', 'hold-unknown'):
            for i, axis in enumerate(data['axes']):
                axis['level'] = axis['suggested'] = 'normal' if i < 2 else 'unknown'
            data['analysis']['requests'] = [padded(f'合成索证第{i + 1}项', 30) for i in range(8)]
        if name in ('hold', 'hold-unknown'):
            data['gates']['tech'] = 'block'
            data['overall']['level'] = 'hold'
        if name == 'na':
            data['axes'][0]['level'] = data['axes'][0]['suggested'] = 'na'
        if name == 'capacity':
            data['sources'] = [{'id': i, 'short': f'合成示例：来源{i}'} for i in (1, 2, 3)]
            for i, (item, length) in enumerate(zip(data['judgments'], (36, 34, 32, 28, 20))):
                item.update(text=padded(f'合成容量判断第{i + 1}项', length), sources=[1])
            for i, item in enumerate(data['problems']):
                item.update(text=padded(f'合成容量问题第{i + 1}项', 29), sources=[2],
                            verify=padded('合成验证方法', 22), by='合成期限之内',
                            **{'pass': padded('合成通过标准', 12)})
            for axis in data['axes']:
                axis['public_reason'] = padded('合成公开理由', 24)
            data['premises'] = [dict(id=i + 1, text=padded(f'合成容量前提第{i + 1}项', 40),
                                     status='unverified', critical=True, sources=[3]) for i in range(5)]
            for key in ('founder', 'team', 'vision'):
                data['card'][key] = padded('合成身份卡片', 10)
        result['fixture-' + name + '.json'] = data
    legacy = json.loads((APP / 'data-v3/sample-company.draft.json').read_text(encoding='utf-8'))
    legacy['meta']['version'] = 'V2'
    for axis, level in zip(legacy['axes'], (1, 2, 3, 4, 5, 3)):
        axis['level'] = axis['suggested'] = level
    result['v2-sample-company.json'] = legacy
    return result


if __name__ == '__main__':
    target = APP / 'test-fixtures'
    target.mkdir(exist_ok=True)
    for name, data in fixtures().items():
        (target / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Generated 8 V3 fixtures and 1 V2 fixture from synthetic data.')
