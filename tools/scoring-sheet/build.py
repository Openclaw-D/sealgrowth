#!/usr/bin/env python3
"""V3：本机校验、两版报告、水印预览及经确认的事务式构建。"""
import argparse
import base64
import copy
from datetime import datetime
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
from pdf_unicode import normalize, radicals
from model import (AXES, STAGES, LEVELS, GATES, STATUS, ValidationError, SystemBuildError,
                   require, valid_id, validate, validation_errors, pending_paths, reference,
                   insufficient, weakest, blocked, content_sha256, public_data, public_strings,
                   private_strings, check_public, narrative_warnings, field_label)

APP = Path(__file__).resolve().parent
DATA = APP / 'data-v3'
OUTPUT = APP / 'outputs'
QA = OUTPUT / 'onepage-qa'
CHROME = Path(os.environ.get('SCORING_SHEET_CHROME') or shutil.which('google-chrome')
              or shutil.which('chromium') or 'chrome').expanduser().resolve()
LOGO = APP / 'brand-transparent.png'
CONFIDENTIAL_MARK = ('商业机密', '外泄违约')  # 与 render.js 的 CONFIDENTIAL 保持一致
VERSIONS = ('founder', 'investor')


def inside(path, folder):
    path, folder = Path(path), Path(folder).absolute()
    require(folder.resolve() == folder, '允许目录本身不得为指向别处的符号链接')
    require(path.resolve().is_relative_to(folder), '路径超出允许目录')
    return path


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f'JSON 含重复字段：{key}')
        result[key] = value
    return result


def loads(raw):
    try:
        return json.loads(raw, object_pairs_hook=unique_object,
                          parse_constant=lambda _: (_ for _ in ()).throw(ValidationError('JSON 不允许非有限数值')))
    except (json.JSONDecodeError, UnicodeError) as error:
        raise ValidationError(f'JSON 无效：{error}') from error


def configure(data_dir=None, out_dir=None, chrome=None):
    global DATA, OUTPUT, QA, CHROME
    if data_dir is not None:
        DATA = Path(data_dir).expanduser().resolve()
    if out_dir is not None:
        OUTPUT = Path(out_dir).expanduser().resolve()
    if chrome is not None:
        CHROME = Path(chrome).expanduser().resolve()
    QA = OUTPUT / 'onepage-qa'


def find_data_file(company_id, suffix):
    valid_id(company_id)
    candidates = [inside(path, DATA) for path in DATA.rglob(f'{company_id}.{suffix}.json')]
    require(len(candidates) <= 1, f'企业 {company_id} 有多个同类资料文件，请先消除重复')
    return candidates[0] if candidates else inside(DATA / f'{company_id}.{suffix}.json', DATA)


def company_folder(company_id):
    for suffix in ('sheet', 'draft'):
        path = find_data_file(company_id, suffix)
        if path.is_file():
            return path.parent
    return DATA


def read_draft(company_id):
    path = find_data_file(company_id, 'draft')
    require(path.is_file(), f'未找到 {company_id} 的建议稿')
    data = loads(path.read_text(encoding='utf-8'))
    require(data.get('company', {}).get('id') == company_id, '建议稿企业 id 与文件名不一致')
    require('confirmation' not in data, 'confirmation：确认只能由服务器写入打分表，不可写入草稿')
    return data


def read_sheet(company_id, check=True):
    for suffix in ('sheet', 'draft'):
        path = find_data_file(company_id, suffix)
        if path.is_file():
            data = loads(path.read_text(encoding='utf-8'))
            require(data.get('company', {}).get('id') == company_id, '文件中的企业 id 与文件名不一致')
            require(suffix == 'sheet' or 'confirmation' not in data, 'confirmation：确认只能出现在打分表')
            if check:
                validate(data, external_ready=False, allow_pending=True)
            return data, suffix
    raise ValidationError(f'未找到 {company_id} 的打分表或建议稿')


def confirmation_valid(data):
    """Hash binds all content; the saved snapshot also binds by/at/version.

    This is a local workflow attestation, not a signature against an administrator
    who can rewrite both the sheet and its version archive.
    """
    c = data.get('confirmation')
    if not isinstance(c, dict) or set(c) != {'by', 'at', 'content_sha256', 'version'}:
        return False
    if not all(isinstance(v, str) and v.strip() for v in c.values()):
        return False
    if c['content_sha256'] != content_sha256(data):
        return False
    cid = data.get('company', {}).get('id', '')
    if not re.fullmatch(re.escape(cid) + r'-\d{8}-\d{6}\.json', c['version']):
        return False
    try:
        datetime.fromisoformat(c['at'])
        path = inside(company_folder(cid) / 'versions' / c['version'], DATA)
        recorded = loads(path.read_text(encoding='utf-8'))
        return recorded.get('confirmation') == c and content_sha256(recorded) == c['content_sha256']
    except (OSError, ValueError, TypeError):
        return False


def safe_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')


def check_level_words(value, version='founder'):
    value = normalize(value)
    require(not re.search(r'(?i)\b(?:level|rating|score|overall)[\s\"\x27:=]+[0-9]+\b', value), '公开评级字段不得含数字')
    if version == 'investor':
        forbidden_fields = r'["\x27](?:axes|overall|rating|level|score|public_reason|requests|gates|reference|mean)["\x27]\s*:'
        forbidden_components = r'(?:data-(?:level|rating|score)\s*=|(?:id|class)=["\x27][^"\x27]*(?:level-chip|level-data|radar-|top-overall|axis-reason|request-list))'
        require(not re.search(forbidden_fields, value) and not re.search(forbidden_components, value),
                '投资人版检出评级字段或组件')


def check_leaks(value, data, version, preview=False):
    normalized = normalize(html.unescape(value))
    for private in private_strings(data, version, preview):
        require(normalize(private) not in normalized and normalize(safe_json(private)[1:-1]) not in normalize(value),
                f'对外内容检出内部专用文字（{private[:24]}）；本次未更新文件')
    check_level_words(value, version)


def render_html(data, version='founder', preview=False):
    public = public_data(data, version, preview)
    result = (APP / f'template-{version}.html').read_text(encoding='utf-8')
    tokens = (APP / 'tokens.css').read_text(encoding='utf-8')
    if version == 'investor':
        tokens = '\n'.join(line for line in tokens.splitlines() if '--quality-' not in line)
    replacements = {
        '<!-- TITLE -->': html.escape(f'{public["company"]["name"]} · 海豹增长 · {"创始人版" if version == "founder" else "投资人版"}{" · 内部预览" if preview else ""}'),
        '/* INLINE_TOKENS */': tokens,
        '/* INLINE_STYLE */': (APP / 'style.css').read_text(encoding='utf-8') + (APP / f'style-{version}.css').read_text(encoding='utf-8'),
        '/* INLINE_DATA */': safe_json(public),
        '/* INLINE_LOGO */': safe_json('data:image/png;base64,' + base64.b64encode(LOGO.read_bytes()).decode('ascii')),
        '/* INLINE_AUDIENCE */': (APP / f'render-{version}.js').read_text(encoding='utf-8'),
        '/* INLINE_LAYOUT */': (APP / 'layout.js').read_text(encoding='utf-8'),
        '/* INLINE_RENDER */': (APP / 'render.js').read_text(encoding='utf-8'),
    }
    if version == 'founder':
        replacements['/* INLINE_LEVELS */'] = safe_json(LEVELS)
    for marker, value in replacements.items():
        require(result.count(marker) == 1, f'模板占位符错误：{marker}')
        result = result.replace(marker, value)
    check_leaks(result, data, version, preview)
    return result


class PublicDOMText(HTMLParser):
    """Painted strings only: schema tokens and accessibility labels are not ink."""
    def __init__(self, markup):
        super().__init__(convert_charrefs=True)
        self.in_report = False
        self.skip = 0
        self.strings = []
        self.feed(markup)

    def handle_starttag(self, tag, attrs):
        if tag in ('title', 'style', 'script'):
            self.skip += 1
        if tag == 'main' and dict(attrs).get('id') == 'report':
            self.in_report = True

    def handle_endtag(self, tag):
        if tag in ('title', 'style', 'script'):
            self.skip = max(0, self.skip - 1)
        if tag == 'main':
            self.in_report = False

    def handle_data(self, value):
        if self.in_report and not self.skip and value.strip():
            self.strings.append(value)


def printable_strings(public):
    # Content completeness is checked independently of the rendered DOM so an
    # accidentally omitted field cannot pass merely because it was never drawn.
    m, c = public['meta'], public['company']
    result = [m[k] for k in ('brand_cn', 'brand_en', 'as_of', 'fa_disclosure', 'disclaimer') if m[k]]
    result += [c[k] for k in ('name', 'sector', 'business', 'stage')]
    result += list(public_strings(c['round']))
    result += [p['label'] for p in c['fund_use']]
    for key in ('judgments', 'problems'):
        for item in public[key]:
            result.extend(item[k] for k in ('text', 'evidence', 'verify', 'by', 'pass') if k in item)
    result.extend(s['short'] for s in public['sources'])
    result.extend(public.get('requests', []))
    for a in public.get('axes', []):
        result += [a['name'], a['public_reason'], LEVELS[a['level']]['word']]
    for p in public.get('premises', []) + ([public['weakest']] if 'weakest' in public else []):
        result += [p['text'], STATUS[p['status']]]
    if 'card' in public:
        result += list(public_strings(public['card']))
    if 'overall' in public:
        rating = public['overall']['rating']
        result += ['资料不足' if rating == 'insufficient' else '未定档' if rating is None else LEVELS[rating]['word']]
    result += ['内部预览 · 未确认'] if public.get('preview') else list(public_strings(public.get('review', {})))
    result += list(CONFIDENTIAL_MARK)  # CC 2026-11-03：每版浅色水印文字
    return result


def check_pdf_text(checked, data, strings, version='founder', preview=False):
    compact = lambda value: re.sub(r'\s+', '', value)
    value = checked['text'] + '\n' + checked['metadata']
    check_level_words(value, version)
    require(not (radicals(value) - radicals('\n'.join(strings))), 'PDF 仍含公开文字之外的 CJK 部首，不能确认文字映射完整')
    extracted = compact(checked['text'])
    require(compact(data['company']['name']) in extracted, 'PDF 未检出企业名称，不能确认文字提取完整')
    require(all(compact(s) in extracted for s in strings), 'PDF 缺少公开文字；本次未更新对外文件')
    for private in private_strings(data, version, preview):
        require(all(compact(normalize(private)) not in compact(normalize(checked[k])) for k in ('text', 'metadata')), 'PDF 检出内部文字；本次未更新对外文件')


def chrome_args(profile):
    return [str(CHROME), '--headless', '--no-first-run', '--no-default-browser-check',
            '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
            '--disable-extensions', '--disable-sync', '--metrics-recording-only',
            '--window-size=1920,1080', '--force-device-scale-factor=1', f'--user-data-dir={profile}']


def atomic_publish(pairs, staging):
    """Stage all files first; rollback every replaced file on any commit failure."""
    backups, installed = {}, []
    for i, (_, target) in enumerate(pairs):
        if target.exists():
            old = staging / f'rollback-{i}'
            shutil.copy2(target, old)
            backups[target] = old
    try:
        for source, target in pairs:
            os.replace(source, target)
            installed.append(target)
    except BaseException:
        for target in reversed(installed):
            if target in backups:
                os.replace(backups[target], target)
            else:
                target.unlink(missing_ok=True)
        raise


def render_pdfs(page, data, version, preview, staging):
    from chrome_pipe import ChromePipe, ChromeError
    from pdfcheck import PDFError, inspect_pdf
    from pdf_unicode import repair_pdf
    from render_pdf import render
    require(CHROME.is_file(), '未找到本机 Chrome；请用 --chrome 指定路径，或用 --preview --html-only 生成 HTML')
    results = {}; pdfs = []; proofs = []
    public = public_data(data, version, preview)
    try:
        with ChromePipe(chrome_args(staging / ('chrome-' + version)), timeout=100) as chrome:
            chrome.load(page)
            for mode in ('landscape', 'portrait'):
                preflight = chrome.layout(mode)
                require(not preflight.get('failures'), f'{"横版" if mode == "landscape" else "竖版"}单页排版未通过；请缩短：' + '、'.join(preflight.get('failures', [])))
                pdf = staging / (page.stem + '-' + mode + '.pdf')
                chrome.pdf(pdf, preflight['width'], preflight['height'])
                strings = printable_strings(public) + PublicDOMText(preflight['markup']).strings
                prefix = page.stem + '-pdf-' + mode
                before = staging / (prefix + '-before-unicode.png')
                after = staging / (prefix + '-after-unicode.png')
                before_render = render(pdf, before, allowed_dir=QA)
                fixed, stats = repair_pdf(pdf.read_bytes(), '\n'.join(strings))
                pdf.write_bytes(fixed)
                after_render = render(pdf, after, allowed_dir=QA)
                identical = before_render['pixel_sha256'] == after_render['pixel_sha256']
                require(identical, 'PDF 修正前后栅格图不一致；本次未更新对外文件')
                checked = inspect_pdf(pdf, expected_size=(preflight['width'] * .75, preflight['height'] * .75))
                require(checked['pages'] == 1 and checked['size_ok'], f'{mode} PDF 必须为一页且符合测得尺寸')
                check_pdf_text(checked, data, strings, version, preview)
                stats.update(raster_identical=identical, before_pixel_sha256=before_render['pixel_sha256'], after_pixel_sha256=after_render['pixel_sha256'], width=after_render['width'], height=after_render['height'], pdf_sha256=hashlib.sha256(fixed).hexdigest())
                for suffix, payload in (('unicode-check', stats), ('layout', {k: v for k, v in preflight.items() if k != 'markup'})):
                    proof = staging / (prefix + '-' + suffix + '.json')
                    proof.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
                    proofs.append(proof)
                proofs.extend((before, after)); pdfs.append(pdf)
                results[mode] = {'width': preflight['width'], 'height': preflight['height'], 'body_size': preflight['bodySize']}
    except ChromeError as error:
        raise SystemBuildError(f'排版检查或打印未完成（系统原因，非内容问题）：{error}；本次未更新对外文件') from error
    except (PDFError, KeyError, IndexError, ValueError) as error:
        if isinstance(error, ValidationError):
            raise
        raise SystemBuildError(f'PDF 文字或尺寸无法核验（系统原因）：{error}') from error
    return pdfs, proofs, results


def build_report(data, html_only=False, preview=False, version=None, fixture=False, assume_confirmed=False):
    validate(data, allow_pending=preview, require_overall=not preview)
    require(not html_only or preview, '--html-only 只对预览有效')
    require(version in (None, *VERSIONS), 'version：请选择 founder 或 investor')
    require(not assume_confirmed or fixture, '--assume-confirmed 只对 test-fixtures 夹具生效')
    cid = valid_id(data['company']['id'])
    require(not fixture or cid.startswith('fixture-'), '测试资料 id 必须以 fixture- 开头')
    if not preview:
        require((fixture and assume_confirmed) or confirmation_valid(data), '未确认对外；可用 --preview 生成内部预览')
    selected = [version] if version else list(VERSIONS)
    skipped = []
    if insufficient(data) and 'investor' in selected:
        require(version != 'investor', '资料不足：投资人版不生成')
        selected.remove('investor'); skipped.append({'version': 'investor', 'reason': '资料不足，投资人版不生成'})
    OUTPUT.mkdir(parents=True, exist_ok=True)
    inside(QA, OUTPUT).mkdir(parents=True, exist_ok=True)
    folder = QA if fixture else OUTPUT
    files = {}; layouts = {}; warnings = []; pairs = []
    with tempfile.TemporaryDirectory(prefix=f'.{cid}-build-', dir=QA) as tmp:
        staging = Path(tmp)
        for audience in selected:
            stem = f'{cid}-{audience}' + ('-preview' if preview else '')
            page = staging / (stem + '.html')
            page.write_text(render_html(data, audience, preview), encoding='utf-8')
            artifacts = [page]
            files[audience] = {'html': str(inside(folder / page.name, OUTPUT))}
            if not html_only:
                pdfs, proofs, metrics = render_pdfs(page, data, audience, preview, staging)
                artifacts.extend(pdfs); layouts[audience] = metrics
                for mode, pdf in zip(('landscape', 'portrait'), pdfs):
                    files[audience][mode + '_pdf'] = str(inside(folder / pdf.name, OUTPUT))
                pairs.extend((proof, inside(QA / proof.name, OUTPUT)) for proof in proofs)
            pairs.extend((artifact, inside(folder / artifact.name, OUTPUT)) for artifact in artifacts)
            warnings.extend(narrative_warnings(public_data(data, audience, preview)))
        if not preview and not assume_confirmed:
            current, source = read_sheet(cid)
            require(source == 'sheet' and confirmation_valid(current) and current.get('confirmation') == data.get('confirmation') and content_sha256(current) == content_sha256(data),
                    '内容已改，确认失效；本次未更新对外文件')
        # HTML carries the public review stamp. Install both HTML files last so
        # restart-time download discovery cannot bless PDFs from an older review.
        pairs.sort(key=lambda pair: pair[1].suffix == '.html')
        atomic_publish(pairs, staging)
    return {'ok': True, 'id': cid, 'files': files, 'skipped': skipped, 'warnings': warnings,
            'pdf_generated': not html_only, 'preview': preview, 'layouts': layouts}


def batch_candidates():
    result = {}
    for path in sorted(DATA.rglob('*.sheet.json')):
        inside(path, DATA)
        cid = valid_id(path.name[:-len('.sheet.json')])
        require(cid not in result, f'企业 {cid} 有多个同类资料文件')
        result[cid] = path
    return result


class JSONArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        raise ValidationError('命令参数无效：' + message)


def main():
    parser = JSONArgumentParser(description=__doc__)
    parser.add_argument('--id', default='sample-company')
    parser.add_argument('--data-dir', type=Path, default=DATA)
    parser.add_argument('--out-dir', type=Path, default=OUTPUT)
    parser.add_argument('--chrome', type=Path, default=CHROME)
    for flag in ('all', 'validate-only', 'stdin', 'html-only', 'draft', 'preview', 'assume-confirmed'):
        parser.add_argument('--' + flag, action='store_true')
    parser.add_argument('--fixture', type=Path)
    parser.add_argument('--version', choices=VERSIONS)
    args = parser.parse_args()
    configure(args.data_dir, args.out_dir, args.chrome)
    require(not args.assume_confirmed or args.fixture, '--assume-confirmed 仅可与 --fixture 同用')
    require(not args.stdin or args.validate_only, '--stdin 必须与 --validate-only 一起使用')
    require(sum(bool(v) for v in (args.stdin, args.fixture, args.draft)) <= 1, '--stdin / --fixture / --draft 不可同时使用')
    preview = args.preview or args.draft or bool(args.fixture and not args.assume_confirmed)
    require(not args.html_only or preview, '--html-only 只对预览有效')
    if args.all:
        require(not any((args.stdin, args.fixture, args.draft, args.preview, args.html_only, args.validate_only)), '--all 只构建已确认打分表，不可与单份输入或预览选项同用')
        companies = []; skipped = []
        for cid, path in batch_candidates().items():
            try:
                data = loads(path.read_text(encoding='utf-8'))
                require(data.get('company', {}).get('id') == cid, 'company.id：企业 id 与文件名不一致')
                if not confirmation_valid(data):
                    skipped.append({'id': cid, 'reason': '未确认对外或确认失效'}); continue
                companies.append(build_report(data, version=args.version))
            except (ValidationError, OSError) as e:
                companies.append({'ok': False, 'id': cid, 'errors': getattr(e, 'errors', [str(e)])})
        return {'ok': all(c['ok'] for c in companies), 'companies': companies, 'skipped': skipped}
    valid_id(args.id)
    source = None
    if args.stdin:
        data = loads(sys.stdin.read())
    elif args.fixture:
        fixture = inside(args.fixture if args.fixture.is_absolute() else APP / args.fixture, APP / 'test-fixtures')
        data = loads(fixture.read_text(encoding='utf-8'))
        cid = data.get('company', {}).get('id', '')
        require(isinstance(cid, str) and cid.startswith('fixture-'), '测试资料 id 必须以 fixture- 开头')
        require(cid == args.id, '测试资料 id 与 --id 不一致')
    elif args.draft:
        data = read_draft(args.id)
    else:
        data, source = read_sheet(args.id, check=False)
    if args.validate_only:
        errors = validation_errors(data)
        return {'ok': not errors, 'validation': '未通过' if errors else '通过', 'errors': errors, 'pending': pending_paths(data)}
    if not preview and not args.fixture:
        require(source == 'sheet' and confirmation_valid(data), '未确认对外；可用 --preview 生成内部预览')
    if args.assume_confirmed:
        data = copy.deepcopy(data)
        data['confirmation'] = {'by': '测试审阅人', 'at': datetime.now().astimezone().isoformat(timespec='seconds'),
                                'content_sha256': content_sha256(data), 'version': 'fixture-test'}
    return build_report(data, html_only=args.html_only, preview=preview, version=args.version,
                        fixture=bool(args.fixture), assume_confirmed=args.assume_confirmed)


if __name__ == '__main__':
    try:
        payload = main()
    except (ValidationError, OSError) as error:
        payload = {'ok': False, 'errors': getattr(error, 'errors', [str(error)])}
    print(json.dumps(payload, ensure_ascii=False, allow_nan=False))
    if not payload.get('ok'):
        for error in payload.get('errors', []):
            print(error, file=sys.stderr)
        sys.exit(1)
