#!/usr/bin/env python3
"""仅本机打分表服务；Python 标准库，默认 127.0.0.1:8766。"""
import argparse
import copy
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import parse_qs, urlsplit

import build

LOCK = threading.RLock()
MAX_BODY = 262144
STATIC = {"/sheet.html": ("sheet.html", "text/html; charset=utf-8"),
          "/tokens.css": ("tokens.css", "text/css; charset=utf-8"),
          "/sheet.css": ("sheet.css", "text/css; charset=utf-8"),
          "/sheet.js": ("sheet.js", "text/javascript; charset=utf-8"),
          "/sheet-model.js": ("sheet-model.js", "text/javascript; charset=utf-8")}
STATIC["/layout.js"] = ("layout.js", "text/javascript; charset=utf-8")


def apply_changes(base, submitted):
    """A full form may echo immutable fields; only changed leaves are writable."""
    build.require(isinstance(submitted, dict), '数据：必须是对象')
    submitted = copy.deepcopy(submitted)
    defaults_path = build.find_data_file(base['company']['id'], 'draft')
    defaults = build.loads(defaults_path.read_text(encoding='utf-8'))['company']['round'] if defaults_path.exists() else base['company']['round']
    rnd = submitted.get('company', {}).get('round', {}) if isinstance(submitted.get('company'), dict) else {}
    if isinstance(rnd, dict):
        for field in ('amount', 'valuation', 'dilution'):
            if isinstance(rnd.get(field), str) and not rnd[field].strip():
                rnd[field] = defaults[field]
    allowed = {f'company.round.{k}' for k in ('amount', 'valuation', 'dilution')} | {'overall.level'}
    allowed |= {f'gates.{k}' for k in (*build.GATES, 'note')}
    for i in range(len(base['axes'])):
        allowed |= {f'axes[{i}].{k}' for k in ('level', 'public_reason', 'confidence')}
    for i in range(len(base['premises'])):
        allowed |= {f'premises[{i}].{k}' for k in ('text', 'status', 'critical')}
    for key in ('judgments', 'problems'):
        for i in range(len(base[key])):
            fields = ('text', 'external') if key == 'judgments' else ('text', 'external', 'verify', 'by', 'pass', 'likelihood', 'impact')
            allowed |= {f'{key}[{i}].{k}' for k in fields}
    errors = []
    def compare(old, new, path=''):
        if type(old) is type(new) and old == new:
            return
        if path in allowed:
            return
        if isinstance(old, dict) and isinstance(new, dict):
            for key in sorted(set(old) | set(new)):
                child = f'{path}.{key}' if path else key
                if key not in old or key not in new:
                    errors.append(f'{build.field_label(child)}（{child}）：不在可修改白名单，不可增删字段')
                else:
                    compare(old[key], new[key], child)
        elif isinstance(old, list) and isinstance(new, list) and len(old) == len(new):
            for i, (a, b) in enumerate(zip(old, new)):
                compare(a, b, f'{path}[{i}]')
        else:
            errors.append(f'{build.field_label(path)}（{path}）：不在可修改白名单，不可增删、重排或修改')
    compare(base, submitted)
    if errors:
        raise build.ValidationError(errors)
    if any(base['gates'][k] != submitted['gates'][k] for k in build.GATES):
        if build.blocked(submitted):
            submitted['overall']['level'] = 'hold'
        elif build.blocked(base):
            submitted['overall']['level'] = None
    return build.validate(submitted, external_ready=False, allow_pending=True)


def atomic_json(path, data):
    path = build.inside(path, build.DATA)
    descriptor, temporary = tempfile.mkstemp(prefix=".sheet-", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def save_sheet(company_id, submitted):
    build.valid_id(company_id)
    with LOCK:
        base, _ = build.read_sheet(company_id)
        data = apply_changes(base, submitted)
        invalidated = bool(base.get('confirmation')) and (not build.confirmation_valid(base) or build.content_sha256(data) != base['confirmation']['content_sha256'])
        if invalidated:
            data.pop('confirmation', None)
        folder = build.company_folder(company_id)
        versions = build.inside(folder / "versions", build.DATA)
        versions.mkdir(exist_ok=True)
        # The contract specifies seconds in snapshot names. Wait at most one second
        # for a second save in the same second, rather than overwriting a snapshot.
        for _ in range(3):
            now = datetime.now().astimezone()
            snapshot = build.inside(versions / f'{company_id}-{now:%Y%m%d-%H%M%S}.json', build.DATA)
            if not snapshot.exists():
                break
            time.sleep(max(.01, 1 - now.microsecond / 1000000))
        else:
            raise build.ValidationError("快照时间冲突；未保存，请稍后再试")
        data["_saved_at"] = now.isoformat(timespec="seconds")
        # Reserve the version name before replacing the current sheet.
        with snapshot.open("x", encoding="utf-8") as stream:
            os.chmod(snapshot, 0o600)
            json.dump(data, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        try:
            atomic_json(folder / f"{company_id}.sheet.json", data)
        except OSError:
            snapshot.unlink()
            raise
        return {'data': data, 'saved_at': data['_saved_at'], 'snapshot': snapshot.name,
                'confirmation': data.get('confirmation'), 'invalidated': invalidated,
                'message': '内容已改，确认失效' if invalidated else '已保存'}


def output_links(data):
    if not build.confirmation_valid(data):
        return {}
    cid = data['company']['id']
    audiences = ('founder',) if build.insufficient(data) else build.VERSIONS
    result = {}
    for version in audiences:
        files = {key: f'{cid}-{version}{suffix}' for key, suffix in
                 (('html', '.html'), ('landscape_pdf', '-landscape.pdf'), ('portrait_pdf', '-portrait.pdf'))}
        if not all(build.inside(build.OUTPUT / name, build.OUTPUT).is_file() for name in files.values()):
            return {}
        try:
            markup = (build.OUTPUT / files['html']).read_text(encoding='utf-8')
            match = re.search(r'<script id="report-data" type="application/json">(.*?)</script>', markup, re.S)
            public = build.loads(match[1]) if match else {}
            stamp = {k: data['confirmation'][k] for k in ('by', 'at', 'version')}
            if public.get('review') != stamp or public.get('audience') != version:
                return {}
        except (OSError, ValueError, TypeError):
            return {}
        result[version] = {key: '/outputs/' + name for key, name in files.items()}
    return result


def generate(company_id, preview=False):
    command = [sys.executable, str(build.APP / 'build.py'), '--id', company_id,
               '--data-dir', str(build.DATA), '--out-dir', str(build.OUTPUT),
               '--chrome', str(build.CHROME)]
    if preview:
        command.append('--preview')
    try:
        result = subprocess.run(command, cwd=build.APP, capture_output=True, text=True, timeout=300, check=False)
    except subprocess.TimeoutExpired as error:
        raise build.ValidationError('已保存，生成超时；请检查本机 Chrome') from error
    payload = build.loads(result.stdout) if result.stdout.strip() else {}
    build.require(result.returncode == 0, payload.get('errors') or [result.stderr.strip() or '生成失败，请查看本机环境'])
    build.require(payload.get('pdf_generated'), '未生成 PDF，请检查构建结果')
    return {**payload, 'files': {audience: {key: '/outputs/' + Path(path).name for key, path in files.items()}
                               for audience, files in payload['files'].items()}}


def confirm_saved(company_id, saved):
    data = saved['data']
    errors = build.validation_errors(data, require_overall=True)
    reviewer_path = build.inside(build.DATA / 'reviewer.txt', build.DATA)
    try:
        lines = reviewer_path.read_text(encoding='utf-8').splitlines()
        by = lines[0].strip() if lines else ''
        if not by or len(by) > 120:
            errors.append('data-v3/reviewer.txt：第一行须为 1–120 字审阅署名')
    except OSError:
        by = ''
        errors.append('缺少数据目录中的 reviewer.txt（默认 data-v3/reviewer.txt）：请建立一行审阅署名后再确认')
    if errors:
        raise build.ValidationError(errors)
    data['confirmation'] = {'by': by, 'at': datetime.now().astimezone().isoformat(timespec='seconds'),
                            'content_sha256': build.content_sha256(data), 'version': saved['snapshot']}
    folder = build.company_folder(company_id)
    snapshot = build.inside(folder / 'versions' / saved['snapshot'], build.DATA)
    sheet = build.inside(folder / f'{company_id}.sheet.json', build.DATA)
    try:
        atomic_json(snapshot, data)
        atomic_json(sheet, data)
        result = generate(company_id)
    except BaseException:
        # A failed build must not make old files appear to belong to this review.
        data.pop('confirmation', None)
        atomic_json(snapshot, data)
        atomic_json(sheet, data)
        raise
    return {'ok': True, 'confirmation': data['confirmation'], 'files': result['files'],
            'skipped': result.get('skipped', []), 'warnings': result.get('warnings', [])}


class Handler(BaseHTTPRequestHandler):
    server_version = "JudgeLocal/3"

    def log_message(self, format_string, *args):
        # Do not write posted text or JSON into logs.
        sys.stderr.write(f"本机请求 {self.command} {urlsplit(self.path).path}\n")

    def response(self, status, body=b"", content_type="application/json; charset=utf-8"):
        if not isinstance(body, bytes):
            body = json.dumps(body, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.end_headers()
        self.wfile.write(body)

    def local_request(self, post=False):
        port = self.server.server_address[1]
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        host = self.headers.get("Host", "")
        build.require(host in hosts, "仅允许本机 Host，拒绝其他主机名")
        origin = self.headers.get("Origin")
        build.require(origin is None or origin == f"http://{host}", "拒绝跨站请求")
        build.require(self.headers.get("Sec-Fetch-Site", "") not in ("cross-site",), "拒绝跨站请求")
        if post:
            build.require(self.headers.get("X-Judge-Local") == "1", "缺少本机表单标记")
            build.require(self.headers.get("Content-Type", "").split(";")[0].strip() == "application/json", "只接受 application/json")
            build.require(not self.headers.get("Transfer-Encoding") and not self.headers.get("Content-Encoding"), "不接受编码请求体")

    def company_id(self, query):
        params = parse_qs(query, keep_blank_values=True)
        build.require(set(params) == {"id"} and len(params["id"]) == 1, "请提供唯一企业 id")
        return build.valid_id(params["id"][0])

    def do_GET(self):
        try:
            self.local_request()
            parsed = urlsplit(self.path)
            if parsed.path in ("/", "/favicon.ico"):
                if parsed.path == "/favicon.ico":
                    return self.response(204)
                return self.response(200, b'<a href="/sheet.html?id=sample-company">Open local scoring sheet</a>', "text/html; charset=utf-8")
            if parsed.path in STATIC:
                filename, mime = STATIC[parsed.path]
                return self.response(200, (build.APP / filename).read_bytes(), mime)
            if parsed.path == "/brand.png":
                return self.response(200, build.LOGO.read_bytes(), "image/png")
            if parsed.path == "/api/sheet":
                company_id = self.company_id(parsed.query)
                with LOCK:
                    data, source = build.read_sheet(company_id)
                    draft = build.find_data_file(company_id,"draft")
                    defaults = build.loads(draft.read_text(encoding="utf-8"))["company"]["round"] if draft.exists() else data["company"]["round"]
                return self.response(200, {'data': data, 'loaded_from': source, 'defaults': defaults,
                                           'confirmation': data.get('confirmation') if build.confirmation_valid(data) else None,
                                           'outputs': output_links(data)})
            match = re.fullmatch(r"/outputs/([a-z0-9-]+)-(founder|investor)(-preview)?(?:-(landscape|portrait))?\.(html|pdf)", parsed.path, re.ASCII)
            if match:
                build.valid_id(match[1])
                build.require((match[5]=='html' and not match[4]) or (match[5]=='pdf' and match[4]),"报告文件名无效")
                path = build.inside(build.OUTPUT / parsed.path.removeprefix('/outputs/'), build.OUTPUT)
                if path.is_file():
                    return self.response(200, path.read_bytes(), "text/html; charset=utf-8" if match[5] == "html" else "application/pdf")
            self.response(404, {"error": "未找到本机资源"})
        except build.ValidationError as error:
            self.response(400, {"error": str(error)})
        except OSError:
            self.response(404, {"error": "无法读取本机文件"})

    def do_POST(self):
        try:
            self.local_request(post=True)
            parsed = urlsplit(self.path)
            if parsed.path == '/api/build':
                return self.response(410, {'ok': False, 'errors': ['旧构建接口已停用，请使用确认对外或内部预览']})
            build.require(parsed.path in ('/api/save', '/api/confirm', '/api/preview'), '未知保存操作')
            company_id = self.company_id(parsed.query)
            raw_length = self.headers.get('Content-Length', '')
            build.require(raw_length.isdigit() and 0 < int(raw_length) <= MAX_BODY, '请求体须为 1–262144 字节')
            submitted = build.loads(self.rfile.read(int(raw_length)))
            with LOCK:
                saved = save_sheet(company_id, submitted)
                if parsed.path == '/api/confirm':
                    payload = confirm_saved(company_id, saved)
                elif parsed.path == '/api/preview':
                    generated = generate(company_id, preview=True)
                    payload = {'ok': True, 'files': generated['files'], 'skipped': generated.get('skipped', []), 'warnings': generated.get('warnings', [])}
                else:
                    payload = {'ok': True, **{k: saved[k] for k in ('saved_at', 'confirmation', 'invalidated', 'message')}}
            self.response(200, payload)
        except build.ValidationError as error:
            self.response(422, {'ok': False, 'errors': error.errors})
        except OSError:
            self.response(500, {'ok': False, 'errors': ['本机写入失败；请检查目录权限或磁盘空间']})

    def do_OPTIONS(self):
        self.response(403, {"error": "不开放跨站访问"})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--data-dir",type=Path,default=build.DATA)
    parser.add_argument("--out-dir",type=Path,default=build.OUTPUT)
    parser.add_argument("--chrome",type=Path,default=build.CHROME)
    args = parser.parse_args()
    build.configure(args.data_dir,args.out_dir,args.chrome)
    build.require(1 <= args.port <= 65535, "端口须为 1–65535")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.daemon_threads = True
    print(f"本机打分表：http://127.0.0.1:{args.port}/sheet.html?id=sample-company", flush=True)
    print("仅绑定 127.0.0.1；按 Ctrl+C 停止。", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    try:
        main()
    except (build.ValidationError, OSError) as error:
        print(f"无法启动：{error}", file=sys.stderr)
        sys.exit(1)
