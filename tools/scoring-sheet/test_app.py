"""V3 non-browser checks. Mutations use synthetic fixtures and isolated directories."""
import copy
from datetime import datetime, timedelta
from email.message import Message
import io
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zlib
from unittest.mock import patch
import build
import model
import pdfcheck
import pdf_unicode
import serve


def fixture(kind='five'):
    return build.loads((build.APP / f'test-fixtures/fixture-{kind}.json').read_text(encoding='utf-8'))


class ValidationTests(unittest.TestCase):
    def test_synthetic_draft_is_identical_and_valid(self):
        self.assertEqual((build.APP.parent.parent/'examples/synthetic/sample-company.draft.json').read_bytes(), (build.APP/'data-v3/sample-company.draft.json').read_bytes())
        d = build.read_draft('sample-company'); build.validate(d)
        self.assertEqual(d['overall']['level'], 'normal')
        self.assertEqual(d['company']['id'], 'sample-company')
        self.assertEqual(d['company']['name'], '示例公司（合成数据）')
        self.assertEqual(d['company']['sector'], '工业视觉检测（虚构）')
        self.assertEqual(d['company']['stage'], '样机')
        self.assertEqual(d['meta']['as_of'], '2026-11-05')
        self.assertEqual([a['level'] for a in d['axes']], ['normal', 'unknown', 'na', 'strong', 'normal', 'weak'])
        self.assertEqual(d['gates'], {**dict.fromkeys(build.GATES, 'unchecked'), 'note': ''})
        self.assertEqual(len(d['premises']), 3)
        self.assertEqual(len({p['status'] for p in d['premises']}), 3)
        self.assertTrue(any(p['critical'] for p in d['premises']))
        for key in ('judgments', 'problems'):
            self.assertTrue(3 <= len(d[key]) <= 5)
            self.assertEqual(sum(p['external'] for p in d[key]), 3)
        self.assertEqual(sum(p['pct'] for p in d['company']['fund_use']), 100)
        self.assertTrue(all(s['short'].startswith('合成示例：') for s in d['sources']))
        for audience in build.VERSIONS:
            build.public_data(d, audience)
            self.assertEqual(build.private_strings(d, audience), [])
        d['overall']['level'] = None
        build.validate(d)
        self.assertIsNone(d['overall']['level'])
        with self.assertRaisesRegex(build.ValidationError, '未定档'):
            build.validate(d, require_overall=True)

    def test_all_eight_fixtures(self):
        for name in ('three','five','overflow','unknown','capacity','hold','na','hold-unknown'):
            with self.subTest(name=name): build.validate(fixture(name))

    def test_reference_all_combinations_and_half_up(self):
        import itertools
        choices = ('unknown','weak','normal','strong','na')
        d = fixture()
        for values in itertools.product(choices, repeat=6):
            for a, value in zip(d['axes'], values): a['level'] = value
            rated = [choices.index(x) for x in values if x in ('weak','normal','strong')]
            expected = '资料不足' if len(rated)<3 else ['弱点','正常','优秀'][int(sum(rated)/len(rated)+.5)-1]
            self.assertEqual(build.reference(d), expected)

    def test_founder_team_prefix_and_assessed_count(self):
        d = fixture(); d['card'].update(founder='待确认创始人', team='待确认团队')
        self.assertTrue(build.insufficient(d)); d['card']['team']='团队已提供'
        self.assertFalse(build.insufficient(d)); self.assertTrue(build.insufficient(fixture('unknown')))
        self.assertEqual(len(model.assessed(fixture('na'))),5)

    def test_weakest_only_critical_and_stable_tie(self):
        d = fixture(); d['premises'][0].update(status='false',critical=False)
        self.assertEqual(build.weakest(d)['id'],d['premises'][1]['id'])
        d['premises'][0]['critical']=True
        self.assertEqual(build.weakest(d)['status'],'false')

    def test_null_and_pending_preview_but_not_release(self):
        d=fixture();d['overall']['level']=None;d['axes'][0]['public_reason']='待填'
        build.validate(d,allow_pending=True)
        build.render_html(d,preview=True)
        with self.assertRaises(build.ValidationError):build.validate(d,require_overall=True)

    def test_analysis_inference_and_null_runway(self):
        d=fixture();d['analysis']['micro'][0]['evidence']='推断';d['analysis']['cash']['runway_months']=None
        build.validate(d)
        d['judgments'][0]['evidence']='推断'
        self.assertTrue(any('judgments[0].evidence' in x for x in build.validation_errors(d)))

    def test_analysis_boundary_counts_and_lengths(self):
        limits={'macro':(0,3),'meso':(1,5),'micro':(1,8),'chain':(0,6),'requests':(1,12)}
        for key,(low,high) in limits.items():
            for n in (low,high,high+1):
                d=fixture();seed=d['analysis'][key][0];d['analysis'][key]=[copy.deepcopy(seed) for _ in range(n)]
                errors=build.validation_errors(d)
                self.assertEqual(any('analysis.'+key in x for x in errors),n>high,(key,n,errors))
        for path,limit in (('summary',300),('cash',100),('terms',200)):
            for n in (limit,limit+1):
                d=fixture()
                if path=='summary':d['analysis'][path]='字'*n
                else:d['analysis'][path]['note']='字'*n
                self.assertEqual(any('analysis.'+path in x for x in build.validation_errors(d)),n>limit)

    def test_external_requests_limit_only_first_eight(self):
        d=fixture('unknown');d['analysis']['requests'] += ['合'*60]
        build.validate(d)
        d['analysis']['requests'][0]='合'*31
        with self.assertRaisesRegex(build.ValidationError,'analysis.requests'):build.validate(d)
        build.validate(d,external_ready=False)

    def test_every_error_and_pending_path_reported(self):
        d=fixture();d['meta']['version']='V2';d['axes'][0]['level']=1
        d['axes'][2]['public_reason']='待填';d['problems'][0]['by']='';d['analysis']['summary']='待填'
        errors=build.validation_errors(d)
        for path in ('meta.version','axes[0].level','axes[2].public_reason','problems[0].by','analysis.summary'):
            self.assertTrue(any(path in x for x in errors),path)
        self.assertEqual(build.pending_paths(d),['analysis.summary','axes[2].public_reason'] if list(d).index('analysis')<list(d).index('axes') else ['axes[2].public_reason','analysis.summary'])

    def test_malformed_roots_collect_without_crash(self):
        for bad in (None,[],{}, {'meta':[], 'company':None, 'axes':[None]*7, 'overall':[], 'gates':0, 'analysis':0}):
            self.assertGreater(len(build.validation_errors(bad)),5)

    def test_json_duplicate_nan_bad_date(self):
        for text in ('{"x":1,"x":2}','{"x":NaN}','{'):
            with self.assertRaises(build.ValidationError):build.loads(text)
        d=fixture();d['meta']['as_of']='2026-02-31'
        self.assertTrue(any('meta.as_of' in x for x in build.validation_errors(d)))


# Independent invalid-field cases retain paths in the error messages.
def invalid_case(name, mutate, path):
    def check(self):
        d=fixture();mutate(d)
        self.assertTrue(any(path in e for e in build.validation_errors(d)),build.validation_errors(d))
    setattr(ValidationTests,'test_reject_'+name,check)

for name,mutate,path in [
 ('five_axes',lambda d:d['axes'].pop(),'axes'),
 ('axis_order',lambda d:d['axes'].reverse(),'axes[0].name'),
 ('hold_axis',lambda d:d['axes'][0].update(level='hold'),'axes[0].level'),
 ('numeric_axis',lambda d:d['axes'][0].update(level=3),'axes[0].level'),
 ('boolean_axis',lambda d:d['axes'][0].update(level=True),'axes[0].level'),
 ('bad_suggestion',lambda d:d['axes'][0].update(suggested='bad'),'axes[0].suggested'),
 ('reason_long',lambda d:d['axes'][0].update(reason='字'*101),'axes[0].reason'),
 ('next_long',lambda d:d['axes'][0].update(next='字'*61),'axes[0].next'),
 ('next_missing',lambda d:d['axes'][0].update(level='unknown',next=''),'axes[0].next'),
 ('public_reason_long',lambda d:d['axes'][0].update(public_reason='字'*25),'axes[0].public_reason'),
 ('confidence',lambda d:d['axes'][0].update(confidence='certain'),'axes[0].confidence'),
 ('na_overall',lambda d:d['overall'].update(level='na'),'overall.level'),
 ('block_without_hold',lambda d:d['gates'].update(tech='block'),'overall.level'),
 ('hold_without_block',lambda d:d['overall'].update(level='hold'),'overall.level'),
 ('gate_enum',lambda d:d['gates'].update(fraud='verified'),'gates.fraud'),
 ('no_critical',lambda d:[p.update(critical=False) for p in d['premises']],'premises'),
 ('premise_long',lambda d:d['premises'][0].update(text='字'*41),'premises[0].text'),
 ('premise_status',lambda d:d['premises'][0].update(status='yes'),'premises[0].status'),
 ('premise_boolean',lambda d:d['premises'][0].update(critical=1),'premises[0].critical'),
 ('premise_source',lambda d:d['premises'][0].update(sources=[999]),'premises[0].sources'),
 ('judgment_inference',lambda d:d['judgments'][0].update(evidence='推断'),'judgments[0].evidence'),
 ('judgment_count',lambda d:[p.update(external=i<2) for i,p in enumerate(d['judgments'])],'judgments'),
 ('problem_count',lambda d:[p.update(external=i<2) for i,p in enumerate(d['problems'])],'problems'),
 ('empty_deadline',lambda d:d['problems'][0].update(by=''),'problems[0].by'),
 ('deadline_long',lambda d:d['problems'][0].update(by='字'*7),'problems[0].by'),
 ('empty_pass',lambda d:d['problems'][0].update(**{'pass':''}),'problems[0].pass'),
 ('pass_long',lambda d:d['problems'][0].update(**{'pass':'字'*13}),'problems[0].pass'),
 ('verify_long',lambda d:d['problems'][0].update(verify='字'*23),'problems[0].verify'),
 ('invalid_matrix',lambda d:d['problems'][0].update(impact=0),'problems[0].impact'),
 ('private_source',lambda d:d['problems'][0].update(external=False,sources=[999]),'problems[0].sources'),
 ('unknown_stage',lambda d:d['company'].update(stage='上市'),'company.stage'),
 ('bad_fund_sum',lambda d:d['company']['fund_use'][0].update(pct=99),'company.fund_use'),
 ('fractional_pct',lambda d:d['company']['fund_use'][0].update(pct=1.5),'company.fund_use[0].pct'),
 ('missing_analysis',lambda d:d.pop('analysis'),'analysis'),
 ('macro_effect',lambda d:d['analysis']['macro'][0].update(effect='其他'),'analysis.macro[0].effect'),
 ('analysis_evidence',lambda d:d['analysis']['micro'][0].update(evidence='猜想'),'analysis.micro[0].evidence'),
 ('analysis_source',lambda d:d['analysis']['micro'][0].update(sources=[999]),'analysis.micro[0].sources'),
 ('runway_type',lambda d:d['analysis']['cash'].update(runway_months=True),'analysis.cash.runway_months'),
 ('meta_version',lambda d:d['meta'].update(version='V2'),'meta.version'),
 ('source_duplicate',lambda d:d['sources'].append(copy.deepcopy(d['sources'][0])),'sources'),
]: invalid_case(name,mutate,path)


class ProjectionTests(unittest.TestCase):
    def test_audience_recursive_whitelist(self):
        for version in build.VERSIONS:
            d=fixture();d['axes'][0]['extension']={'secret':'extension secret'}
            p=build.public_data(d,version);build.check_public(p,version)
            self.assertNotIn('extension',json.dumps(p))
            p['company']['round']['secret']='bad'
            with self.assertRaisesRegex(build.ValidationError,'白名单'):build.check_public(p,version)

    def test_investor_source_has_no_rating_payload_or_components(self):
        d=fixture();p=build.public_data(d,'investor');source=build.render_html(d,'investor',preview=True)
        for word in ('level-data','level-chip','radar-','public_reason','top-overall','request-list','六维','综合','索证清单'):
            self.assertTrue(word not in source,word)
        for key in ('axes','overall','gates','requests'):self.assertNotIn(key,p)
        self.assertNotIn('likelihood',json.dumps(p));self.assertNotIn('impact',json.dumps(p))

    def test_founder_has_no_card_matrix_internal_or_unused_premises(self):
        d=fixture();p=build.public_data(d,'founder');source=build.render_html(d,preview=True)
        for key in ('analysis','gates','card','premises'):self.assertNotIn(key,p)
        self.assertNotIn('risk-matrix',source)
        for private in build.private_strings(d,'founder',True):self.assertNotIn(private,source)

    def test_shared_internal_public_sentence_is_allowed(self):
        d=fixture();d['analysis']['meso'][0]['text']=d['judgments'][0]['text'];d['axes'][0]['reason']=d['judgments'][0]['text']
        for audience in build.VERSIONS:build.render_html(d,audience,True)

    def test_private_sentinel_leaks_in_both_forms_are_rejected(self):
        d=fixture()
        for version in build.VERSIONS:
            for text in ('内部备注秘密哨兵行人辰长','内部备注秘密哨兵⾏⼈⾠⻓'):
                with self.assertRaises(build.ValidationError):build.check_leaks(text,d,version,True)

    def test_narrative_level_words_warn_only(self):
        d=fixture();d['judgments'][0]['text']='团队优秀，正常交付还需验证'
        p=build.public_data(d,'investor');self.assertEqual(len(build.narrative_warnings(p)),1)
        build.render_html(d,'investor',True)
        build.check_level_words('团队优秀，正常交付','investor')
        for s in ('<div class="radar-svg">','{"overall":"优秀"}','{"public_reason":"优秀"}','<span data-rating="优秀">'):
            with self.assertRaises(build.ValidationError):build.check_level_words(s,'investor')

    def test_insufficient_and_hold_precedence(self):
        for name,word in (('unknown','insufficient'),('hold-unknown','hold')):
            d=fixture(name);p=build.public_data(d,'founder')
            self.assertEqual(p['overall']['rating'],word);self.assertEqual(len(p['requests']),8);self.assertNotIn('axes',p)
            with self.assertRaisesRegex(build.ValidationError,'资料不足'):build.public_data(d,'investor')

    def test_only_premise_source_is_in_footer(self):
        d=fixture('capacity')
        for version in build.VERSIONS:self.assertIn(3,[s['id'] for s in build.public_data(d,version)['sources']])

    def test_source_sort_and_external_numbering(self):
        d=fixture('three');d['sources'].reverse()
        for version in build.VERSIONS:
            p=build.public_data(d,version)
            self.assertEqual([x['number'] for x in p['problems']],[1,2,3])
            self.assertEqual([s['id'] for s in p['sources']],sorted(s['id'] for s in p['sources']))

    def test_partial_unknown_round_and_no_empty_funds(self):
        d=fixture();d['company']['round']['name']='待确认';d['company']['round']['amount']='合成 17 示例单位'
        p=build.public_data(d,'investor');self.assertEqual(p['company']['round']['headline'],'合成 17 示例单位（轮次待确认）')
        d['company']['round']['amount']='待确认';d['company']['fund_use']=[];d['meta']['fa_disclosure']=''
        p=build.public_data(d,'founder');self.assertEqual(p['company']['round'],{'headline':'待确认'});self.assertEqual(p['company']['fund_use'],[])

    def test_json_script_injection_is_escaped(self):
        d=fixture();d['judgments'][0]['text']='</script><script>坏代码</script>'
        s=build.render_html(d,'founder',True)
        self.assertNotIn(d['judgments'][0]['text'],s);self.assertIn('\\u003c/script',s)

    def test_preview_no_review_and_real_dom_watermark_source(self):
        d=fixture();d['confirmation']={'by':'测试审阅人','at':'2026-11-03','version':'test'}
        for audience in build.VERSIONS:
            p=build.public_data(d,audience,True)
            self.assertTrue(p['preview']);self.assertNotIn('review',p)
            self.assertIn('内部预览 · 未确认',build.render_html(d,audience,True))
            self.assertIn('内部预览 · 未确认',build.printable_strings(p))

    def test_confidential_marks_in_every_version(self):
        d=fixture();src=(build.APP/'render.js').read_text()
        self.assertIn("const CONFIDENTIAL = ['%s','%s'];"%build.CONFIDENTIAL_MARK,src)
        for audience in build.VERSIONS:
            for preview in (False,True):
                p=build.public_data(d,audience,preview) if preview else build.public_data(d,audience)
                for s in build.CONFIDENTIAL_MARK:self.assertIn(s,build.printable_strings(p))


class IsolatedData(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='judge-v3-')
        # resolve()：macOS 默认临时目录是符号链接（/var -> /private/var），build.inside 只接受真实路径
        self.root=Path(self.tmp.name).resolve();self.original=(build.DATA,build.OUTPUT)
        self.data=self.root/'data';self.out=self.root/'out';self.data.mkdir();self.out.mkdir()
        build.configure(self.data,self.out)
        self.d=fixture();self.cid=self.d['company']['id']
        (self.data/f'{self.cid}.draft.json').write_text(json.dumps(self.d,ensure_ascii=False))
        # Only isolated test data receives this synthetic signature file.
        (self.data/'reviewer.txt').write_text('测试审阅人\n第二行不得使用\n')
        class Clock:
            n=0
            @classmethod
            def now(cls):
                cls.n+=1
                return datetime(2026,11,3,12,0,0)+timedelta(seconds=cls.n)
        self.clock=patch.object(serve,'datetime',Clock);self.clock.start()

    def tearDown(self):
        self.clock.stop();build.configure(*self.original);self.tmp.cleanup()

    def confirmed(self):
        with patch.object(serve,'generate',return_value={'files':{}}):
            saved=serve.save_sheet(self.cid,self.d);serve.confirm_saved(self.cid,saved)
        return build.read_sheet(self.cid)[0]

    def request(self,path,data,host=None,origin=None):
        h=serve.Handler.__new__(serve.Handler);h.path=path;h.command='POST';h.server=type('Server',(),{'server_address':('127.0.0.1',8766)})()
        h.headers=Message();h.headers['Host']=host or '127.0.0.1:8766';h.headers['Content-Type']='application/json';h.headers['X-Judge-Local']='1'
        if origin:h.headers['Origin']=origin
        raw=json.dumps(data,ensure_ascii=False).encode();h.headers['Content-Length']=str(len(raw));h.rfile=io.BytesIO(raw)
        result=[];h.response=lambda *args:result.extend(args)
        h.do_POST();return result[0],result[1]


class ServerTests(IsolatedData):
    def test_save_response_and_snapshot(self):
        code,result=self.request('/api/save?id='+self.cid,self.d)
        self.assertEqual(code,200);self.assertEqual(set(result),{'ok','saved_at','confirmation','invalidated','message'})
        self.assertIsNone(result['confirmation']);self.assertFalse(result['invalidated'])
        versions=list((self.data/'versions').glob('*.json'));self.assertEqual(len(versions),1)
        self.assertEqual(json.loads(versions[0].read_text()),build.read_sheet(self.cid)[0])

    def test_no_change_save_preserves_confirmation(self):
        d=self.confirmed();confirmation=d['confirmation'];self.assertTrue(build.confirmation_valid(d))
        result=serve.save_sheet(self.cid,d)
        self.assertEqual(result['confirmation'],confirmation);self.assertFalse(result['invalidated']);self.assertTrue(build.confirmation_valid(result['data']))

    def test_any_edit_invalidates(self):
        for group in ('axis','premise','gate','external','text','confidence','deadline','finance'):
            d=build.read_sheet(self.cid)[0];self.d=d;d=self.confirmed()
            if group=='axis':d['axes'][0]['level']='weak'
            elif group=='premise':d['premises'][0]['status']='verified'
            elif group=='gate':d['gates']['cash']='pass'
            elif group=='external':d['problems'][0]['external']=False
            elif group=='text':d['judgments'][0]['text']='变更后的合成文字'
            elif group=='confidence':d['axes'][0]['confidence']='high'
            elif group=='deadline':d['problems'][0]['by']='明年内'
            else:d['company']['round']['amount']='合成变更金额'
            result=serve.save_sheet(self.cid,d)
            self.assertTrue(result['invalidated'],group);self.assertEqual(result['message'],'内容已改，确认失效');self.assertIsNone(result['confirmation'])

    def test_manual_confirmation_changes_fail(self):
        d=self.confirmed()
        for key,value in (('by','手写署名'),('at','2026-11-03T00:00:00'),('version','../escape'),('content_sha256','0'*64)):
            changed=copy.deepcopy(d);changed['confirmation'][key]=value
            self.assertFalse(build.confirmation_valid(changed),key)
        changed=copy.deepcopy(d);changed['axes'][0]['level']='strong';self.assertFalse(build.confirmation_valid(changed))

    def test_no_reviewer_refuses_after_saving(self):
        (self.data/'reviewer.txt').unlink()
        code,p=self.request('/api/confirm?id='+self.cid,self.d)
        self.assertEqual(code,422);self.assertFalse(p['ok']);self.assertIn('reviewer.txt',' '.join(p['errors']))
        self.assertTrue((self.data/f'{self.cid}.sheet.json').exists())

    def test_blank_reviewer_refused(self):
        (self.data/'reviewer.txt').write_text('\n')
        code,p=self.request('/api/confirm?id='+self.cid,self.d)
        self.assertEqual(code,422);self.assertIn('第一行',' '.join(p['errors']))

    def test_confirm_success_first_line_signature(self):
        with patch.object(serve,'generate',return_value={'files':{'founder':{'html':'/outputs/test.html'}}}):
            code,p=self.request('/api/confirm?id='+self.cid,self.d)
        self.assertEqual(code,200);self.assertEqual(p['confirmation']['by'],'测试审阅人')
        self.assertTrue(build.confirmation_valid(build.read_sheet(self.cid)[0]))

    def test_confirmation_failure_keeps_saved_content_and_no_links(self):
        with patch.object(serve,'generate',side_effect=build.ValidationError('合成打印失败')):
            code,p=self.request('/api/confirm?id='+self.cid,self.d)
        self.assertEqual(code,422);self.assertEqual(p['errors'],['合成打印失败'])
        d=build.read_sheet(self.cid)[0];self.assertNotIn('confirmation',d);self.assertEqual(serve.output_links(d),{})

    def test_outside_whitelist_422_and_names_fields(self):
        changes=[('reason',lambda d:d['axes'][0].update(reason='改')),('next',lambda d:d['axes'][0].update(next='改')),('suggested',lambda d:d['axes'][0].update(suggested='weak')),('analysis.summary',lambda d:d['analysis'].update(summary='改')),('company.name',lambda d:d['company'].update(name='改')),('confirmation',lambda d:d.update(confirmation={})),('sources',lambda d:d['sources'].reverse()),('premises',lambda d:d['premises'].reverse()),('new_field',lambda d:d.update(new_field=1))]
        for key,change in changes:
            d=copy.deepcopy(self.d);change(d);code,p=self.request('/api/save?id='+self.cid,d)
            self.assertEqual(code,422,key);self.assertIn(key,' '.join(p['errors']))

    def test_all_new_editable_fields(self):
        d=copy.deepcopy(self.d);d['axes'][0].update(level='na',public_reason='尚未到此阶段',confidence='none')
        d['premises'][0].update(text='修改合成前提',critical=False,status='verified')
        d['gates'].update(tech='pass',note='修改合成备注');d['problems'][0].update(by='本轮内',**{'pass':'确认完成'})
        self.assertEqual(serve.apply_changes(self.d,d),d)

    def test_gate_block_and_last_unblock_clear_overall(self):
        d=copy.deepcopy(self.d);d['gates']['tech']='block';d=serve.apply_changes(self.d,d)
        self.assertEqual(d['overall']['level'],'hold')
        e=copy.deepcopy(d);e['gates']['tech']='pass';e=serve.apply_changes(d,e)
        self.assertIsNone(e['overall']['level'])
        with self.assertRaisesRegex(build.ValidationError,'未定档'):build.validate(e,require_overall=True)

    def test_incomplete_selection_and_pending_can_save(self):
        self.d['overall']['level']=None;self.d['axes'][0]['public_reason']='待填'
        for p in self.d['problems']:p['external']=False
        result=serve.save_sheet(self.cid,self.d);self.assertIsNone(result['confirmation'])
        with self.assertRaises(build.ValidationError):serve.confirm_saved(self.cid,result)

    def test_finance_blank_uses_draft_defaults(self):
        changed=copy.deepcopy(self.d);changed['company']['round']['amount']=' '
        self.assertEqual(serve.apply_changes(self.d,changed)['company']['round'],self.d['company']['round'])

    def test_preview_and_disabled_legacy_endpoint(self):
        with patch.object(serve,'generate',return_value={'files':{}}) as gen:
            code,p=self.request('/api/preview?id='+self.cid,self.d)
        self.assertEqual(code,200);gen.assert_called_once_with(self.cid,preview=True)
        code,p=self.request('/api/build?id='+self.cid,self.d);self.assertEqual(code,410)

    def test_output_links_only_when_valid_and_complete(self):
        d=self.confirmed();self.assertEqual(serve.output_links(d),{})
        for audience in build.VERSIONS:
            for suffix in ('.html','-landscape.pdf','-portrait.pdf'):(self.out/f'{self.cid}-{audience}{suffix}').write_text(build.render_html(d,audience) if suffix=='.html' else '合成旧文件')
        self.assertEqual(len(serve.output_links(d)),2)
        d['premises'][0]['status']='false';self.assertEqual(serve.output_links(d),{})
        self.assertEqual(len(list(self.out.iterdir())),6)

    def test_bad_origin_host_and_path(self):
        for host,origin in (('evil.test:8766',None),(None,'https://evil.test')):
            code,_=self.request('/api/save?id='+self.cid,self.d,host=host,origin=origin);self.assertEqual(code,422)
        code,_=self.request('/api/save?id=../../escape',self.d);self.assertEqual(code,422)

    def get_request(self,path):
        h=serve.Handler.__new__(serve.Handler);h.path=path;h.command='GET';h.server=type('Server',(),{'server_address':('127.0.0.1',8766)})()
        h.headers=Message();h.headers['Host']='127.0.0.1:8766'
        result=[];h.response=lambda *args:result.extend(args)
        h.do_GET();return result

    def test_get_sheet_and_output_route(self):
        d=self.confirmed()
        for audience in build.VERSIONS:
            for suffix in ('.html','-landscape.pdf','-portrait.pdf'):
                name=f'{self.cid}-{audience}{suffix}'
                (self.out/name).write_text(build.render_html(d,audience) if suffix=='.html' else '合成 PDF')
                result=self.get_request('/outputs/'+name)
                self.assertEqual(result[0],200)
                self.assertEqual(result[2],'text/html; charset=utf-8' if suffix=='.html' else 'application/pdf')
        code,payload=self.get_request('/api/sheet?id='+self.cid)
        self.assertEqual(code,200);self.assertIsNotNone(payload['confirmation']);self.assertEqual(len(payload['outputs']),2)
        (self.out/f'{self.cid}-investor.html').write_text('过期文件')
        self.assertEqual(self.get_request('/api/sheet?id='+self.cid)[1]['outputs'],{})
        self.assertEqual(self.get_request('/outputs/'+self.cid+'-onepage.html')[0],404)

    def test_canonical_hash_all_fields_except_metadata(self):
        d=self.d;h=build.content_sha256(d)
        e=dict(reversed(list(d.items())));e['_saved_at']='now';e['confirmation']={'by':'fake'}
        self.assertEqual(h,build.content_sha256(e));e['new_private_field']='test'
        self.assertNotEqual(h,build.content_sha256(e))

    def test_two_snapshots_and_symlink_escape(self):
        serve.save_sheet(self.cid,self.d);d=build.read_sheet(self.cid)[0];serve.save_sheet(self.cid,d)
        self.assertEqual(len(list((self.data/'versions').glob('*.json'))),2)
        (self.data/'escape').symlink_to(self.out,target_is_directory=True)
        with self.assertRaisesRegex(build.ValidationError,'路径超出'):build.inside(self.data/'escape/a.json',self.data)


class BuildTests(IsolatedData):
    @staticmethod
    def fake_pdfs(page,data,version,preview,staging):
        files=[]
        for mode in ('landscape','portrait'):
            p=staging/(page.stem+'-'+mode+'.pdf');p.write_text('合成 PDF 占位，仅事务测试');files.append(p)
        return files,[],{}

    def test_six_files_and_failure_during_second_audience_preserve_old(self):
        d=self.confirmed()
        with patch.object(build,'render_pdfs',side_effect=self.fake_pdfs):first=build.build_report(d)
        before={p.name:p.read_bytes() for p in self.out.glob('*.*')}
        calls=0
        def fail(*args):
            nonlocal calls
            calls+=1
            if calls==2:raise build.ValidationError('中途失败')
            return self.fake_pdfs(*args)
        with patch.object(build,'render_pdfs',side_effect=fail):
            with self.assertRaisesRegex(build.ValidationError,'中途失败'):build.build_report(d)
        self.assertEqual(len(before),6);self.assertEqual(before,{p.name:p.read_bytes() for p in self.out.glob('*.*')})
        self.assertFalse(any(build.QA.iterdir()))

    def test_commit_failure_restores_all_six(self):
        d=self.confirmed()
        with patch.object(build,'render_pdfs',side_effect=self.fake_pdfs):build.build_report(d)
        before={p.name:p.read_bytes() for p in self.out.glob('*.*')};real=os.replace;calls=0
        def fail(source,target):
            nonlocal calls
            calls+=1
            if calls==5:raise OSError('模拟第五次替换失败')
            return real(source,target)
        with patch.object(build,'render_pdfs',side_effect=self.fake_pdfs),patch.object(build.os,'replace',side_effect=fail):
            with self.assertRaises(OSError):build.build_report(d)
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.out.glob('*.*')})

    def test_content_change_during_build_refuses_commit(self):
        d=self.confirmed()
        def change(*args):
            current=copy.deepcopy(d);current['axes'][0]['level']='strong'
            (self.data/f'{self.cid}.sheet.json').write_text(json.dumps(current))
            return self.fake_pdfs(*args)
        with patch.object(build,'render_pdfs',side_effect=change):
            with self.assertRaisesRegex(build.ValidationError,'内容已改'):build.build_report(d)
        self.assertFalse(list(self.out.glob('*.html')))
        self.assertFalse(list(self.out.glob('*.pdf')))

    def test_preview_qa_dont_touch_formal(self):
        d=self.confirmed()
        with patch.object(build,'render_pdfs',side_effect=self.fake_pdfs):build.build_report(d)
        before={p.name:p.read_bytes() for p in self.out.glob('*.*')}
        preview=build.build_report(d,preview=True,html_only=True)
        qa=build.build_report(d,preview=True,html_only=True,fixture=True)
        for name,content in before.items():self.assertEqual((self.out/name).read_bytes(),content)
        self.assertTrue(all('-preview.html' in x['html'] for x in preview['files'].values()))
        self.assertTrue(all(Path(x['html']).parent==build.QA for x in qa['files'].values()))

    def test_insufficient_skip_and_explicit_investor_failure(self):
        d=fixture('unknown')
        r=build.build_report(d,preview=True,html_only=True,fixture=True)
        self.assertEqual(list(r['files']),['founder']);self.assertEqual(r['skipped'][0]['version'],'investor')
        with self.assertRaisesRegex(build.ValidationError,'资料不足'):build.build_report(d,preview=True,html_only=True,fixture=True,version='investor')

    def test_nonpreview_html_only_and_unconfirmed_refused(self):
        with self.assertRaisesRegex(build.ValidationError,'html-only'):build.build_report(self.d,html_only=True)
        with self.assertRaisesRegex(build.ValidationError,'未确认对外'):build.build_report(self.d)

    def test_formal_id_uses_confirmation(self):
        d=self.confirmed()
        with patch.object(sys,'argv',['build.py','--id',self.cid,'--data-dir',str(self.data),'--out-dir',str(self.out)]),patch.object(build,'render_pdfs',side_effect=self.fake_pdfs):
            self.assertTrue(build.main()['pdf_generated'])
        d['axes'][0]['level']='strong';(self.data/f'{self.cid}.sheet.json').write_text(json.dumps(d))
        with patch.object(sys,'argv',['build.py','--id',self.cid,'--data-dir',str(self.data),'--out-dir',str(self.out)]):
            with self.assertRaisesRegex(build.ValidationError,'未确认对外'):build.main()

    def test_all_skips_invalid_and_drafts(self):
        self.confirmed();other=copy.deepcopy(self.d);other['company']['id']='fixture-stale';other['confirmation']={'content_sha256':'bad'}
        (self.data/'fixture-stale.sheet.json').write_text(json.dumps(other))
        with patch.object(sys,'argv',['build.py','--all','--data-dir',str(self.data),'--out-dir',str(self.out)]),patch.object(build,'render_pdfs',side_effect=self.fake_pdfs):r=build.main()
        self.assertTrue(r['ok']);self.assertEqual(len(r['companies']),1);self.assertEqual(r['skipped'][0]['id'],'fixture-stale')

    def test_cli_json_failure_and_fixture_escape(self):
        def cli(*args,stdin=None):
            r=subprocess.run([sys.executable,str(build.APP/'build.py'),*args],input=stdin,capture_output=True,text=True)
            return r,json.loads(r.stdout)
        r,p=cli('--id','fixture-five','--fixture',str(self.data/f'{self.cid}.draft.json'),'--validate-only');self.assertNotEqual(r.returncode,0);self.assertIn('路径超出',str(p))
        r,p=cli('--assume-confirmed','--validate-only');self.assertNotEqual(r.returncode,0)
        r,p=cli('--include-drafts');self.assertNotEqual(r.returncode,0)
        r,p=cli('--stdin','--validate-only',stdin=json.dumps({'meta':{'version':'V2'}}));self.assertGreater(len(p['errors']),5)
        r,p=cli('--id','fixture-five','--fixture','test-fixtures/fixture-five.json','--html-only','--out-dir',str(self.out));self.assertEqual(r.returncode,0,r.stderr)
        self.assertTrue(all(Path(f['html']).parent==build.QA for f in p['files'].values()))

    def test_fixture_symlink_escape_and_nonfixture_id_rejected(self):
        with tempfile.TemporaryDirectory(dir=build.APP/'test-fixtures') as folder:
            root=Path(folder);(root/'escape.json').symlink_to(self.data/f'{self.cid}.draft.json')
            for path in (root/'escape.json',build.APP/'test-fixtures/v2-sample-company.json'):
                with patch.object(sys,'argv',['build.py','--id',self.cid,'--fixture',str(path),'--validate-only']):
                    with self.assertRaises(build.ValidationError):build.main()

    def test_migration_preserves_and_all_pending_paths_reported(self):
        from migrate_v2_v3 import migrate
        source=build.loads((build.APP/'test-fixtures/v2-sample-company.json').read_text())
        d=migrate(source)
        for k in ('company','judgments','card','sources','internal_notes'):self.assertEqual(d[k],source[k])
        self.assertEqual([x['reason'] for x in d['axes']],[x['reason'] for x in source['axes']])
        self.assertEqual(d['overall']['level'],None);self.assertTrue(build.pending_paths(d))
        errors=build.validation_errors(d)
        for path in build.pending_paths(d):self.assertTrue(any(path in e for e in errors),path)
        r=subprocess.run([sys.executable,str(build.APP/'build.py'),'--stdin','--validate-only'],input=json.dumps(d),capture_output=True,text=True)
        self.assertNotEqual(r.returncode,0);self.assertEqual(set(json.loads(r.stdout)['pending']),set(build.pending_paths(d)))
        for level,token in ((1,'unknown'),(2,'weak'),(3,'normal'),(4,'strong'),(5,'strong')):
            x=copy.deepcopy(source)
            for a in x['axes']:a.update(level=level,suggested=level)
            self.assertTrue(all(a['level']==token for a in migrate(x)['axes']))


class PDFTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.original_qa=build.QA
        build.QA=Path(self.tmp.name).resolve()  # macOS 默认临时目录是符号链接，build.inside 只接受真实路径

    def tearDown(self):
        build.QA=self.original_qa
        self.tmp.cleanup()

    @staticmethod
    def synthetic_pdf(cmap_text=None, compressed=True):
        body=cmap_text or b'2 beginbfchar <41> <2FA0> <42> <2F08> endbfchar'
        mapping=(b'/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n'
                 b'/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n'
                 b'/CMapName /Synthetic-UCS def\n/CMapType 2 def\n'
                 b'1 begincodespacerange <00> <FF> endcodespacerange\n'+body+
                 b'\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend')
        compressed_map=zlib.compress(mapping) if compressed else mapping
        paint=b'BT /F1 48 Tf 72 700 Td (AB) Tj ET'
        objects={
            (1,0):b'<< /Type /Catalog /Pages 2 0 R >>',
            (2,0):b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            (3,0):b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1440 810] /Resources << /Font << /F1 4 0 R >> >> /Contents 6 0 R >>',
            (4,0):b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /ToUnicode 5 0 R >>',
            (5,0):(b'<< /Length '+str(len(compressed_map)).encode()+(b' /Filter /FlateDecode' if compressed else b'')
                   +b' >>\nstream\n'+compressed_map+b'\nendstream'),
            (6,0):b'<< /Length '+str(len(paint)).encode()+b' >>\nstream\n'+paint+b'\nendstream',
            (9,2):b'<< /Title (Synthetic text test) /Creator (Chrome) >>',
        }
        return pdf_unicode.rewrite(objects,{"Root":pdfcheck.Ref((1,0)),"Info":pdfcheck.Ref((9,2))})

    def test_unicode_table_copy_header_and_whole_radical_mapping(self):
        self.assertEqual(hashlib.sha256(pdf_unicode.TABLE.read_bytes()).hexdigest(),
                         'c86c80f6a0d1d47c9a5aadfbf1c26f1a732d662d9ccb0ed2d397919ecc47bf72')
        self.assertTrue(pdf_unicode.TABLE.read_text().startswith('# EquivalentUnifiedIdeograph-18.0.0.txt'))
        self.assertIn('# © 2026 Unicode®, Inc.', pdf_unicode.TABLE.read_text())
        self.assertIn('For terms of use and license, see https://www.unicode.org/terms_of_use.html', pdf_unicode.TABLE.read_text())
        for source,target in pdf_unicode.equivalents().items():
            self.assertEqual(pdf_unicode.normalize(chr(source)),chr(target))
        self.assertEqual(pdf_unicode.normalize('示例⾠、⻓、⾏、⼈'),'示例辰、长、行、人')

    def test_synthetic_cmap_bfchar_ranges_arrays_and_supplementary_targets(self):
        source=b'''1 begincodespacerange <00> <FF> endcodespacerange
2 beginbfchar <01> <2FA0> <02> <2E87> endbfchar
2 beginbfrange <03> <04> <2F08> <05> <06> [<2F8F><2ED3>] endbfrange'''
        result,count=pdf_unicode.repair_cmap(source)
        self.assertEqual(count,6)
        self.assertEqual(pdfcheck.decode_text(bytes.fromhex('010203040506'),pdfcheck.cmap(result)),
                         pdf_unicode.normalize('⾠⺇⼈⼉⾏⻓'))
        self.assertIn(bytes.fromhex('D841DE28'),pdfcheck.cmap(result)[b'\x02'].encode('utf-16-be'))
        self.assertIn(b'begincodespacerange <00> <FF>',result)

    def test_pdf_rewrite_valid_xref_recompressed_lengths_and_unchanged_paint(self):
        for compressed in (True,False):
            with self.subTest(compressed=compressed):
                raw=self.synthetic_pdf(compressed=compressed)
                self.assertEqual(pdfcheck.inspect_pdf(raw)['text'],'⾠⼈')
                fixed,stats=pdf_unicode.repair_pdf(raw,'辰人')
                self.assertEqual(pdfcheck.inspect_pdf(fixed)['text'],'辰人')
                self.assertEqual(stats['changed_glyphs'],2)
                original,_=pdf_unicode.document(raw);objects,trailer=pdf_unicode.document(fixed)
                self.assertEqual(trailer['Info'],pdfcheck.Ref((9,2)))
                self.assertEqual(trailer['Size'],10)
                for key in original:
                    if key!=(5,0):self.assertEqual(original[key],objects[key])
                header,_=pdfcheck.value_at(list(pdfcheck.tokens(objects[(5,0)].split(b'stream\n')[0])))
                stored=objects[(5,0)].split(b'stream\n',1)[1][:-len(b'\nendstream')]
                self.assertEqual(header['Length'],len(stored))
                self.assertEqual(header['Filter'],pdfcheck.Name('FlateDecode'))
                self.assertNotIn('⾠',pdfcheck.stream_bytes(objects[(5,0)]).decode())
                self.assertEqual(pdf_unicode.repair_pdf(fixed,'辰人')[0],fixed)

    def test_only_exact_public_radical_is_preserved(self):
        raw=self.synthetic_pdf()
        fixed,stats=pdf_unicode.repair_pdf(raw,'公开部首 ⾠，其余为人')
        self.assertEqual(pdfcheck.inspect_pdf(fixed)['text'],'⾠人')
        self.assertEqual(stats['preserved_public_radicals'],['U+2FA0'])

    def test_pdf_public_coverage_and_normalized_privacy_checks(self):
        data=fixture();strings=build.printable_strings(build.public_data(data,'founder'))
        checked={'text':'\n'.join(strings),'metadata':''}
        build.check_pdf_text(checked,data,strings)
        with self.assertRaisesRegex(build.ValidationError,'缺少公开文字'):
            build.check_pdf_text({'text':data['company']['name'],'metadata':''},data,strings)
        with self.assertRaisesRegex(build.ValidationError,'CJK 部首'):
            build.check_pdf_text({'text':checked['text']+'⾏','metadata':''},data,strings)
        # An exact radical in public data is permitted, but cannot hide a leak.
        data['axes'][0]['reason']='内部行人辰长'
        for location in ('text','metadata'):
            leaked=dict(checked)
            leaked['text']+='⾏⼈⾠⻓'
            leaked[location]+='内部⾏⼈⾠⻓'
            with self.assertRaisesRegex(build.ValidationError,'内部文字'):
                build.check_pdf_text(leaked,data,strings+['⾏⼈⾠⻓'])

    def test_broken_xref_refused(self):
        raw=self.synthetic_pdf().replace(b'0000000015 00000 n',b'0000000016 00000 n')
        with self.assertRaisesRegex(pdfcheck.PDFError,'xref'):
            pdf_unicode.document(raw)

    @unittest.skipUnless(sys.platform == 'darwin','macOS 原生 PDF 栅格比对')
    def test_synthetic_cmap_fix_is_pixel_identical_at_1920_1080(self):
        import render_pdf
        with tempfile.TemporaryDirectory(prefix='.unicode-unit-',dir=build.APP/'test-fixtures') as temporary:
            folder=Path(temporary);raw=self.synthetic_pdf();fixed,_=pdf_unicode.repair_pdf(raw,'辰人')
            source=folder/'before.pdf';target=folder/'after.pdf';source.write_bytes(raw);target.write_bytes(fixed)
            with tempfile.TemporaryDirectory(prefix='.unicode-qa-',dir=build.QA) as raster:
                before=render_pdf.render(source,Path(raster)/'before.png')
                after=render_pdf.render(target,Path(raster)/'after.png')
                self.assertEqual(before['pixel_sha256'],after['pixel_sha256'])
                self.assertEqual((after['width'],after['height']),(1920,1080))

    def test_cmap_char_ranges_and_arrays(self):
        mapping=pdfcheck.cmap(b'1 beginbfchar <0001> <4E2D> endbfchar 2 beginbfrange <0002> <0003> <6587> <0004> <0005> [<6D4B><8BD5>] endbfrange')
        self.assertEqual(pdfcheck.decode_text(bytes.fromhex("0001000200040005"),mapping),"中文测试")

    def test_chrome_pdf_structure_text_and_metadata(self):
        raw=b'''%PDF-1.7
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 1440 810] /Resources << /Font << /F1 4 0 R >> >> /Contents 6 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type0 /ToUnicode 5 0 R >> endobj
5 0 obj << >> stream
2 beginbfchar <0001> <4E2D> <0002> <6587> endbfchar
endstream endobj
6 0 obj << >> stream
BT /F1 24 Tf <00010002> Tj ET
endstream endobj
7 0 obj << /Title <FEFF6D4B8BD5> /Creator (Chrome) >> endobj
%%EOF'''
        result=pdfcheck.inspect_pdf(raw)
        self.assertEqual(result["text"],"中文")
        self.assertIn("测试",result["metadata"])
        self.assertEqual(result["pages"],1); self.assertTrue(result["size_ok"])

    def test_empty_pdf_cannot_pass_privacy_check(self):
        with self.assertRaises(pdfcheck.PDFError): pdfcheck.inspect_pdf(b"%PDF-1.7\n%%EOF")

    @unittest.skipUnless(sys.platform == "darwin", "macOS 原生 PDF 渲染辅助程序")
    def test_native_pdf_renderer_smoke(self):
        # A complete synthetic PDF fixture, with a real xref; never the company report.
        import render_pdf
        with tempfile.TemporaryDirectory(prefix=".pdf-unit-",dir=build.APP/"test-fixtures") as temporary:
            source=Path(temporary)/"synthetic.pdf"
            target=build.QA/".synthetic-renderer-smoke.png"
            content=b"BT /F1 48 Tf 72 700 Td (Synthetic renderer test) Tj ET"
            objects=[b"<< /Type /Catalog /Pages 2 0 R >>",b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                     b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1440 810] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
                     b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
                     b"<< /Length "+str(len(content)).encode()+b" >>\nstream\n"+content+b"\nendstream"]
            raw=bytearray(b"%PDF-1.4\n");offsets=[0]
            for i,obj in enumerate(objects,1):
                offsets.append(len(raw));raw.extend(str(i).encode()+b" 0 obj\n"+obj+b"\nendobj\n")
            xref=len(raw);raw.extend(b"xref\n0 6\n0000000000 65535 f \n")
            for offset in offsets[1:]:raw.extend(f"{offset:010d} 00000 n \n".encode())
            raw.extend(b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n"+str(xref).encode()+b"\n%%EOF\n")
            source.write_bytes(raw)
            try:
                render_pdf.render(source,target)
                png=target.read_bytes()
                self.assertEqual(int.from_bytes(png[16:20],"big"),1920)
                self.assertEqual(int.from_bytes(png[20:24],"big"),1080)
            finally:
                target.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
