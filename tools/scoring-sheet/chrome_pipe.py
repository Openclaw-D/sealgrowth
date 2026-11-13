"""Small, synchronous CDP client. Standard library + local Chrome, no TCP port.

A real deadline covers fonts, image decoding, layout and printing. Nothing relies
on virtual time, dump-dom timing, repeated launches or a silent fallback.
"""
import base64
import fcntl
import json
import os
from pathlib import Path
import select
import subprocess
import sys
import time


class ChromeError(RuntimeError):
    pass


class ChromePipe:
    def __init__(self, args, timeout=60):
        self.deadline = time.monotonic() + timeout
        self.sequence = 0
        self.buffer = bytearray()
        self.session = None
        self.pending = {}
        self.events = []
        incoming, writer = os.pipe()
        reader, outgoing = os.pipe()
        # The launcher maps high-numbered descriptors onto Chrome's FD 3/4.
        # It avoids preexec_fn (unsafe in threaded programs) and FD collisions.
        read_fd = fcntl.fcntl(incoming, fcntl.F_DUPFD, 10)
        write_fd = fcntl.fcntl(outgoing, fcntl.F_DUPFD, 10)
        launcher = ('import os,sys; '
                    'os.dup2(int(sys.argv[1]),3,inheritable=True); '
                    'os.dup2(int(sys.argv[2]),4,inheritable=True); '
                    'os.closerange(5,256); os.execv(sys.argv[3],sys.argv[3:])')
        try:
            self.process = subprocess.Popen(
                [sys.executable, '-c', launcher, str(read_fd), str(write_fd),
                 *map(str, args), '--remote-debugging-pipe', 'about:blank'],
                pass_fds=(read_fd, write_fd), stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except OSError as error:
            os.close(reader); os.close(writer)
            raise ChromeError('本机 Chrome 无法启动') from error
        finally:
            for fd in (incoming, outgoing, read_fd, write_fd):
                os.close(fd)
        self.reader, self.writer = reader, writer

    def __enter__(self):
        try:
            self.call('Browser.getVersion', session=False)
            target = self.call('Target.createTarget', {'url': 'about:blank'}, session=False)
            attached = self.call('Target.attachToTarget', {'targetId': target['targetId'], 'flatten': True}, session=False)
            self.session = attached['sessionId']
            self.call('Page.enable')
            self.call('Page.setLifecycleEventsEnabled', {'enabled':True})
            self.call('Runtime.enable')
            # Self-contained reports have no external resources. Block them in
            # Chrome too; this also prevents accidental edits adding a network path.
            self.call('Network.enable')
            self.call('Network.setBlockedURLs', {'urls': ['http://*', 'https://*']})
            return self
        except BaseException:
            self.close()
            raise

    def remaining(self):
        value = self.deadline - time.monotonic()
        if value <= 0:
            raise ChromeError('本机 Chrome 等待超时')
        return value

    def message(self):
        while b'\0' not in self.buffer:
            ready, _, _ = select.select([self.reader], [], [], self.remaining())
            if not ready:
                raise ChromeError('本机 Chrome 等待超时')
            chunk = os.read(self.reader, 1024 * 1024)
            if not chunk:
                raise ChromeError('本机 Chrome 调试管道已关闭（可能受系统限制）')
            self.buffer.extend(chunk)
        raw, _, tail = self.buffer.partition(b'\0')
        self.buffer = bytearray(tail)
        try:
            return json.loads(raw)
        except (ValueError, UnicodeError) as error:
            raise ChromeError('本机 Chrome 返回无效检查数据') from error

    def call(self, method, params=None, session=True):
        self.remaining()
        self.sequence += 1
        sequence = self.sequence
        request = {'id': sequence, 'method': method, 'params': params or {}}
        if session and self.session:
            request['sessionId'] = self.session
        raw = json.dumps(request).encode() + b'\0'
        try:
            while raw:
                count = os.write(self.writer, raw)
                raw = raw[count:]
            while sequence not in self.pending:
                response = self.message()
                if 'id' in response:
                    self.pending[response['id']] = response
                else:
                    self.events.append(response)
            response = self.pending.pop(sequence)
        except (BrokenPipeError, OSError) as error:
            raise ChromeError('本机 Chrome 调试管道不可用') from error
        if 'error' in response:
            raise ChromeError('本机 Chrome 未完成命令：' + method)
        return response.get('result', {})

    def evaluate(self, expression):
        response = self.call('Runtime.evaluate', {
            'expression': expression, 'awaitPromise': True, 'returnByValue': True})
        if response.get('exceptionDetails'):
            raise ChromeError('页面排版程序执行失败（系统原因，非内容问题）')
        return response.get('result', {}).get('value')

    def load(self, page):
        navigation = self.call('Page.navigate', {'url': Path(page).resolve().as_uri()})
        if navigation.get('errorText'):
            raise ChromeError('本机 Chrome 无法加载离线报告')
        loader = navigation.get('loaderId')
        def loaded(event):
            return (event.get('sessionId')==self.session and event.get('method')=='Page.lifecycleEvent'
                    and event.get('params',{}).get('loaderId')==loader
                    and event.get('params',{}).get('name')=='load')
        while not any(loaded(event) for event in self.events):
            self.events.append(self.message())
        # The load event belongs to this navigation, so evaluate cannot race the
        # previous about:blank execution context. awaitPromise waits for actual
        # document.fonts.ready, image decoding, animation frame and inspection.
        self.evaluate('window.reportReady')


    def layout(self, mode):
        width = 1920 if mode == 'landscape' else 430
        self.call('Emulation.setDeviceMetricsOverride', {
            'width': width, 'height': 1080, 'deviceScaleFactor': 1, 'mobile': False})
        self.call('Emulation.setEmulatedMedia', {'media': 'print'})
        result = self.evaluate(f'window.prepareReportPrint({json.dumps(mode)})')
        if not isinstance(result, dict) or result.get('done') is not True or not isinstance(result.get('failures'),list):
            raise ChromeError('排版检查未返回完成信号')
        return result

    def pdf(self, target, width, height):
        result = self.call('Page.printToPDF', {
            'landscape': False, 'displayHeaderFooter': False, 'printBackground': True,
            'preferCSSPageSize': True, 'paperWidth': width / 96,
            'paperHeight': height / 96, 'marginTop': 0, 'marginRight': 0,
            'marginBottom': 0, 'marginLeft': 0, 'scale': 1})
        if not result.get('data'):
            raise ChromeError('本机 Chrome 未返回 PDF')
        Path(target).write_bytes(base64.b64decode(result['data'], validate=True))

    def close(self):
        if getattr(self, 'process', None):
            if self.process.poll() is None:
                self.process.terminate()
                try:
                    self.process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    self.process.kill(); self.process.wait(timeout=3)
            for fd in (self.reader, self.writer):
                os.close(fd)
            self.process = None

    def __exit__(self, *args):
        self.close()
