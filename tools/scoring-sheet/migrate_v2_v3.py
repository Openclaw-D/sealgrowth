#!/usr/bin/env python3
"""只读取 IN、写入 OUT；迁移为必须人工补齐的 V3 草稿，不作评审。"""
import copy
import json
from pathlib import Path
import sys


def migrate(source):
    data = copy.deepcopy(source)
    mapping = {1: 'unknown', 2: 'weak', 3: 'normal', 4: 'strong', 5: 'strong'}
    data['meta']['version'] = 'V3'
    data.pop('confirmation', None)
    data.pop('_saved_at', None)
    for axis in data['axes']:
        for key in ('level', 'suggested'):
            if type(axis.get(key)) is not int or axis[key] not in mapping:
                raise ValueError(f'axes.{key}：V2 档位须为 1–5 的整数')
            axis[key] = mapping[axis[key]]
        axis['next'] = '待填'
        axis['public_reason'] = '待填'
        axis['confidence'] = 'none'
    data['overall'] = {'level': None}
    data['gates'] = {**dict.fromkeys(('fraud', 'tech', 'cash', 'integrity'), 'unchecked'), 'note': '待填'}
    data['premises'] = [{'id': i, 'text': '待填', 'status': 'unverified', 'critical': i == 1, 'sources': []} for i in (1, 2)]
    for item in data['problems']:
        item['by'] = '待填'; item['pass'] = '待填'
    entry = {'text': '待填', 'evidence': '推断', 'sources': []}
    data['analysis'] = {'summary': '待填', 'macro': [{**entry, 'effect': '需求'}],
                        'meso': [copy.deepcopy(entry)], 'micro': [copy.deepcopy(entry)], 'chain': ['待填'],
                        'cash': {'runway_months': None, 'note': '待填'}, 'terms': {'note': '待填'}, 'requests': ['待填']}
    return data


def main():
    if len(sys.argv) != 3:
        raise ValueError('用法：python3 migrate_v2_v3.py IN OUT')
    source, target = map(Path, sys.argv[1:])
    if source.resolve() == target.resolve():
        raise ValueError('IN 与 OUT 不得相同，请保留 V2 原稿')
    data = migrate(json.loads(source.read_text(encoding='utf-8')))
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    print('已写入 V3 草稿骨架；待填字段必须人工补齐，不能确认对外。')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f'迁移失败：{error}', file=sys.stderr)
        sys.exit(1)
