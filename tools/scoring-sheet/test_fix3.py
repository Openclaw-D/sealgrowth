"""FIX3: real filesystem integration, failure gates and pipe protocol tests.

Synthetic CDP tests test orchestration only; they never count as Chrome builds.
"""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
import build
import serve
from chrome_pipe import ChromePipe, ChromeError
from test_app import fixture
import test_app


class PipeTests(unittest.TestCase):
    def test_real_descriptor_framing_events_and_awaited_result(self):
        # A tiny fake protocol peer, not a browser and not a PDF proof.
        script='''import json,os,sys
stream=os.fdopen(3,'rb',buffering=0)
while True:
 raw=bytearray()
 while True:
  c=stream.read(1)
  if not c:sys.exit()
  if c==b'\\0':break
  raw.extend(c)
 q=json.loads(raw);m=q['method'];r={}
 if m=='Target.createTarget':r={'targetId':'target'}
 if m=='Target.attachToTarget':r={'sessionId':'session'}
 if m=='Page.navigate':
  r={'loaderId':'loader'}
  os.write(4,json.dumps({'method':'Page.lifecycleEvent','sessionId':'session','params':{'loaderId':'loader','name':'load'}}).encode()+b'\\0')
 if m=='Runtime.evaluate':
  assert q['params']['awaitPromise'] is True
  r={'result':{'value':{'done':True,'failures':[],'width':1080,'height':2500}}}
 response=json.dumps({'id':q['id'],'result':r}).encode()+b'\\0'
 os.write(4,response[:7]);os.write(4,response[7:])
'''
        with tempfile.TemporaryDirectory() as temporary:
            source=Path(temporary)/'peer.py';source.write_text(script)
            with ChromePipe([sys.executable,source],timeout=5) as peer:
                peer.load(source)
                result=peer.layout('portrait')
                self.assertTrue(result['done']);self.assertEqual(result['height'],2500)
    def test_incomplete_layout_result_is_system_error(self):
        peer=ChromePipe.__new__(ChromePipe)
        with patch.object(peer,'call',return_value={}),patch.object(peer,'evaluate',return_value=None):
            with self.assertRaisesRegex(ChromeError,'完成信号'):peer.layout('portrait')
    def test_real_deadline_is_bounded(self):
        with tempfile.TemporaryDirectory() as temporary:
            script=Path(temporary)/'silent.py';script.write_text('import time;time.sleep(5)')
            start=time.monotonic()
            with self.assertRaisesRegex(ChromeError,'超时'):
                with ChromePipe([sys.executable,script],timeout=.1):pass
            self.assertLess(time.monotonic()-start,2)


class PortraitPDFTests(unittest.TestCase):
    def test_generic_size_and_native_raster_are_not_forced_landscape(self):
        import pdfcheck,pdf_unicode,render_pdf
        raw=test_app.PDFTests.synthetic_pdf()
        objects,trailer=pdf_unicode.document(raw)
        objects[(3,0)]=objects[(3,0)].replace(b'1440 810',b'810 1875')
        raw=pdf_unicode.rewrite(objects,trailer)
        checked=pdfcheck.inspect_pdf(raw,expected_size=(810,1875))
        self.assertEqual(checked['pages'],1);self.assertTrue(checked['size_ok'])
        self.assertFalse(pdfcheck.inspect_pdf(raw)['size_ok'])
        if sys.platform=='darwin':
            with tempfile.TemporaryDirectory() as temporary:
                root=Path(temporary).resolve()  # macOS 默认临时目录是符号链接，build.inside 只接受真实路径
                pdf=root/'portrait.pdf';png=pdf.with_suffix('.png');pdf.write_bytes(raw)
                result=render_pdf.render(pdf,png,allowed_dir=root)
                self.assertEqual((result['width'],result['height']),(1080,2500))


class DeliveryGatesTests(unittest.TestCase):
    def test_injected_error_filter_is_exact_url_method_step_and_header(self):
        script="""const assert=require('node:assert/strict'),{expectedFailure:f,expectedConsole:c}=require('./verify-errors.cjs');
        const url='http://127.0.0.1:8767/api/save?id=fixture-flow';
        const e={url,step:'injected-save-failure',method:'POST',status:500,injected:true,text:'Failed to load resource: the server responded with a status of 500 (Internal Server Error)'};
        assert.equal(f(e,url),true);assert.equal(c(e,url),true);
        for(const change of [{url:url+'x'},{step:'real-save'},{method:'GET'},{status:422},{injected:false}])assert.equal(f({...e,...change},url),false);
        assert.equal(c({...e,text:'Uncaught TypeError: real error'},url),false);
        """
        result=subprocess.run(['node','-e',script],cwd=build.APP,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)

    def test_raster_comparison_rejects_missing_or_reflowed_content(self):
        from derive_brand import encode
        from compare_rasters import compare
        with tempfile.TemporaryDirectory() as temporary:
            a,b=Path(temporary)/'a.png',Path(temporary)/'b.png'
            white=bytes([255,255,255,255])*256
            a.write_bytes(encode(16,16,white));b.write_bytes(encode(16,16,white))
            self.assertTrue(compare(a,b)['pass'])
            b.write_bytes(encode(16,16,bytes([0,0,0,255])*256))
            self.assertFalse(compare(a,b)['pass'])
            b.write_bytes(encode(8,16,white[:8*16*4]))
            self.assertFalse(compare(a,b)['pass'])




class DirectoryV3Tests(test_app.IsolatedData):
    def test_nested_save_and_confirmation_stay_in_company_folder(self):
        nested=self.data/'nested';nested.mkdir()
        (self.data/f'{self.cid}.draft.json').rename(nested/f'{self.cid}.draft.json')
        d=self.confirmed()
        self.assertTrue((nested/f'{self.cid}.sheet.json').exists())
        self.assertTrue((nested/'versions'/d['confirmation']['version']).exists())
        self.assertTrue(build.confirmation_valid(d))

    def test_duplicate_ids_and_disallowed_directory(self):
        nested=self.data/'nested';nested.mkdir()
        (nested/f'{self.cid}.draft.json').write_text(json.dumps(self.d))
        with self.assertRaisesRegex(build.ValidationError,'多个同类'):build.read_sheet(self.cid)

    def test_custom_directories_pass_to_generator(self):
        response=type('Result',(),{'returncode':0,'stdout':json.dumps({'pdf_generated':True,'files':{'founder':{'html':str(self.out/'fixture-five-founder.html')}}}),'stderr':''})()
        with patch.object(serve.subprocess,'run',return_value=response) as run:
            result=serve.generate(self.cid,preview=True)
        args=run.call_args.args[0]
        self.assertIn(str(self.data),args);self.assertIn(str(self.out),args);self.assertIn('--preview',args)
        self.assertEqual(args[args.index('--chrome') + 1], str(build.CHROME))
        self.assertEqual(result['files']['founder']['html'],'/outputs/fixture-five-founder.html')

    def test_confirmation_in_draft_is_refused(self):
        self.d['confirmation']={'by':'手写确认'}
        (self.data/f'{self.cid}.draft.json').write_text(json.dumps(self.d))
        with self.assertRaisesRegex(build.ValidationError,'confirmation'):build.read_draft(self.cid)
        with self.assertRaisesRegex(build.ValidationError,'confirmation'):build.read_sheet(self.cid)

if __name__=='__main__':unittest.main()
