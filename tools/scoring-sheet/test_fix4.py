"""Retained typography/PDF gates, updated V3 capacity and transactional delivery."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import build
from test_app import fixture


class CapacityTests(unittest.TestCase):
    def test_exact_capacity_shape(self):
        d=fixture('capacity');build.validate(d)
        self.assertEqual([len(x['text']) for x in d['judgments']],[36,34,32,28,20])
        self.assertEqual([(len(p['text']),len(p['verify']),len(p['by']),len(p['pass'])) for p in d['problems']],[(29,22,6,12)]*5)
        self.assertEqual([len(a['public_reason']) for a in d['axes']],[24]*6)
        self.assertEqual([len(p['text']) for p in d['premises']],[40]*5)
        self.assertTrue(all(p['critical'] for p in d['premises']))
        self.assertEqual([len(d['card'][k]) for k in ('founder','team','vision')],[10]*3)
        self.assertEqual(len(d['sources']),3)

    def test_unknown_capacity_and_overflow(self):
        self.assertEqual([len(x) for x in fixture('unknown')['analysis']['requests']],[30]*8)
        self.assertEqual([len(p['text']) for p in fixture('overflow')['judgments'][:2]],[96,96])

    def test_exact_six_color_palette_and_no_numeric_tokens(self):
        self.assertEqual(list(build.LEVELS),['unknown','weak','normal','strong','na','hold'])
        self.assertEqual([v['color'] for v in build.LEVELS.values()],['#6B3FA0','#D93025','#F2C200','#2E8B3E','#9AA0A6','#1F1F1F'])
        for p in build.APP.glob('*.css'):self.assertNotIn('#1F6FD1',p.read_text())
        for p in (build.APP/'sheet.js',build.APP/'render-founder.js'):
            self.assertNotIn('杰出',p.read_text());self.assertNotIn('薄弱',p.read_text())

    def test_preflight_failure_names_element_and_keeps_old_files(self):
        d=fixture();original=(build.DATA,build.OUTPUT)
        with tempfile.TemporaryDirectory() as tmp:
            build.configure(out_dir=tmp);build.QA.mkdir()
            for audience in build.VERSIONS:
                for suffix in ('.html','-landscape.pdf','-portrait.pdf'):
                    (build.OUTPUT/f'fixture-five-{audience}-preview{suffix}').write_bytes(b'previous')
            strings=build.printable_strings(build.public_data(d,'founder',True))
            try:
                with patch.object(build,'CHROME',build.APP/'build.py'),patch('chrome_pipe.ChromePipe') as driver,patch('render_pdf.render',return_value={'width':1920,'height':1080,'pixel_sha256':'same'}),patch('pdf_unicode.repair_pdf',return_value=(b'fake',{})),patch('pdfcheck.inspect_pdf',return_value={'pages':1,'size_ok':True,'text':' '.join(strings),'metadata':''}):
                    chrome=driver.return_value.__enter__.return_value
                    chrome.layout.side_effect=[{'done':True,'width':1920,'height':1080,'bodySize':24,'markup':'<main id="report"></main>','failures':[]},{'done':True,'failures':['问题第2条']}]
                    chrome.pdf.side_effect=lambda path,*args:path.write_bytes(b'fake')
                    with self.assertRaisesRegex(build.ValidationError,'请缩短：问题第2条'):build.build_report(d,preview=True)
                    self.assertEqual(chrome.pdf.call_count,1)
                    self.assertTrue(all(p.read_bytes()==b'previous' for p in build.OUTPUT.glob('*.*')))
                    self.assertFalse(any(build.QA.iterdir()))
            finally:build.configure(*original)

    def test_incomplete_browser_is_not_a_content_failure(self):
        from chrome_pipe import ChromeError
        d=fixture();original=(build.DATA,build.OUTPUT)
        with tempfile.TemporaryDirectory() as tmp:
            build.configure(out_dir=tmp)
            try:
                with patch.object(build,'CHROME',build.APP/'build.py'),patch('chrome_pipe.ChromePipe',side_effect=ChromeError('未取得完成信号')):
                    with self.assertRaisesRegex(build.SystemBuildError,'系统原因，非内容问题'):build.build_report(d,preview=True)
            finally:build.configure(*original)

    def test_printable_strings_new_fields_and_only_ink(self):
        d=fixture()
        for audience in build.VERSIONS:
            p=build.public_data(d,audience,True);s=build.printable_strings(p)
            for item in d['problems']:
                if item['external']:
                    for k in ('text','verify','by','pass'):self.assertIn(item[k],s)
            self.assertNotIn('founder',s);self.assertNotIn('normal',s);self.assertNotIn('unverified',s)
        self.assertEqual(build.PublicDOMText('<main id="report"><svg><title>非正文</title><text>正文</text></svg></main>').strings,['正文'])


if __name__=='__main__':unittest.main()
