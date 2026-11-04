#!/usr/bin/env node
'use strict';
// --static-only never launches Chrome or binds a port. Full mode uses a configured local Chrome.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const V3=require('./verify-v3.cjs'),Runner=require('./verify-runner.cjs');
const APP=__dirname,OUT=path.resolve(APP,process.env.SCORING_SHEET_OUT_DIR||'outputs'),QA=path.join(OUT,'onepage-qa');
const PLAYWRIGHT=process.env.PLAYWRIGHT_MODULE||'playwright';
const CHROME=process.env.SCORING_SHEET_CHROME;
const staticOnly=process.argv.includes('--static-only');
const checks=[],screenshots=[],pageErrors=[],external=[];
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'judge-fix5-qa-'));
const workOut=staticOnly?path.join(scratch,'out'):OUT;
const fixtureNames=['three','five','overflow','unknown','capacity','hold','na','hold-unknown'];
const staticFiles=new Map(),builtFiles=new Map();
const load=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixtures=()=>fixtureNames.map(name=>({id:'fixture-'+name,name,data:load(path.join(APP,'test-fixtures','fixture-'+name+'.json'))}));
function check(name,pass,detail){checks.push({name,pass:!!pass,...(!pass?{detail}: {})});if(!pass)process.stderr.write('FAIL '+name+' '+JSON.stringify(detail||'').slice(0,1000)+'\n');}
const attempt=(name,fn)=>Runner.attempt(name,fn,check);
function command(args,{input,allowFailure=false,timeout=300000}={}){
  const p=spawnSync(args[0],args.slice(1),{cwd:APP,encoding:'utf8',input,timeout,maxBuffer:32*1024*1024});
  if(p.error)throw p.error;
  if(!allowFailure&&p.status!==0)throw new Error((p.stderr||p.stdout||'命令失败').slice(-3500));
  return p;
}
function build(args,opts={}){const p=command(['python3','build.py',...args],opts);let data;try{data=JSON.parse(p.stdout);}catch{throw new Error('构建 stdout 不是单个 JSON 对象');}return {...data,exit:p.status};}
function instrument(page){
  page.on('pageerror',e=>pageErrors.push(String(e)));
  page.on('console',msg=>{if(msg.type()==='error')pageErrors.push(msg.text());});
  page.on('request',req=>{if(!/^(?:file:|data:|http:\/\/127\.0\.0\.1:\d+\/)/.test(req.url()))external.push(req.url());});
  page.on('response',res=>{if(res.status()>=400)pageErrors.push(`${res.status()} ${res.url()}`);});
}
async function shot(page,name,options={}){
  const file=path.join(QA,name);await page.screenshot({path:file,...options});
  const png=fs.readFileSync(file);const dimensions={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
  screenshots.push({file,...dimensions});return dimensions;
}
function details(data,version,preview){
  const p=command(['python3','-c',`import sys,json,build\nx=json.load(sys.stdin)\np=build.public_data(x['data'],x['version'],x['preview'])\nprint(json.dumps({'private':build.private_strings(x['data'],x['version'],x['preview']),'printable':build.printable_strings(p)},ensure_ascii=False))`],{input:JSON.stringify({data,version,preview})});
  return JSON.parse(p.stdout);
}
async function staticChecks(){
  const py=command(['python3','-m','unittest','discover','-p','test*.py','-q'],{allowFailure:true});
  fs.writeFileSync(path.join(scratch,'python.log'),py.stdout+py.stderr);
  check('全部 Python 测试',py.status===0,py.stderr.slice(-3000));
  const n=command(['node','test_logic.cjs'],{allowFailure:true});check('Node 状态与几何测试',n.status===0,n.stderr);
  for(const file of fs.readdirSync(APP).filter(x=>/\.(py|js|cjs)$/.test(x))){
    const p=command(file.endsWith('.py')?['python3','-m','py_compile',file]:['node','--check',file],{allowFailure:true});
    check('语法 '+file,p.status===0,p.stderr);
  }
  for(const sample of [...fixtures(),{id:'sample-company',data:load(path.join(APP,'data-v3/sample-company.draft.json'))}]){
    const args=sample.id==='sample-company'?['--id','sample-company','--draft','--out-dir',path.join(workOut,'onepage-qa')]:['--id',sample.id,'--fixture',`test-fixtures/${sample.id}.json`,'--out-dir',workOut];
    const r=build([...args,'--html-only']);
    check(sample.id+'：离线 HTML 两版/跳过规则',r.ok&&Object.keys(r.files).length===(['fixture-unknown','fixture-hold-unknown'].includes(sample.id)?1:2),r.errors);
    staticFiles.set(sample.id,r);
    for(const [version,files] of Object.entries(r.files||{})){
      const label=sample.id+' '+version,markup=fs.readFileSync(files.html,'utf8');
      const {public:p,dom}=V3.sourceChecks(APP,label,markup,check);
      const info=details(sample.data,version,true);
      const plain=dom.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,'');
      check(label+'：独立全文清单含新字段',info.printable.every(s=>plain.includes(s.replace(/\s+/g,''))));
      check(label+'：内部哨兵和专用句零泄露',info.private.every(s=>!markup.includes(s)&&!dom.includes(s)));
      check(label+'：QA 文件名和目录',files.html.includes(`${sample.id}-${version}-preview.html`)&&files.html.includes('onepage-qa'));
      if(sample.id==='fixture-capacity')check(label+'：仅前提引用来源进页脚',p.sources.some(s=>s.id===3)&&dom.includes('[3] 合成示例：来源3'));
    }
  }
  check('样例复制完全相同',digest(path.join(APP,'../../examples/synthetic/sample-company.draft.json'))===digest(path.join(APP,'data-v3/sample-company.draft.json')));
  const sample=load(path.join(APP,'data-v3/sample-company.draft.json'));
  const validate=build(['--stdin','--validate-only'],{input:JSON.stringify(sample)});check('合成 V3 样例校验',validate.ok);
  for(const template of ['founder','investor'])check('模板独立载荷 '+template,fs.readFileSync(path.join(APP,`template-${template}.html`),'utf8').includes('INLINE_AUDIENCE'));
  return {python:(py.stderr.match(/Ran (\d+) tests/)||[])[1],node:(n.stdout.match(/(\d+) tests passed/)||[])[1]};
}
async function inspectPDF(sample,version,files,preview){
  for(const mode of ['landscape','portrait']){
    const pdf=files[mode+'_pdf'];
    const publicData=V3.publicIn(fs.readFileSync(files.html,'utf8'));
    const p=command(['python3','-c',`import sys,json,build,pdfcheck\nx=json.load(sys.stdin)\np=pdfcheck.inspect_pdf(x['pdf'])\nbuild.check_pdf_text(p,x['data'],build.printable_strings(x['public']),x['version'],x['preview'])\nbox=p['boxes'][0]\nprint(json.dumps({'pages':p['pages'],'width':(box[2]-box[0])*4/3,'height':(box[3]-box[1])*4/3,'watermark':'内部预览' in p['text'],'complete':p['extraction_complete']}))`],{input:JSON.stringify({pdf,data:sample.data,public:publicData,version,preview})});
    const m=JSON.parse(p.stdout);
    check(`${sample.id} ${version} ${mode}：PDF页数/全文/元数据/泄露`,m.pages===1&&m.complete&&(!preview||m.watermark),m);
    check(`${sample.id} ${version} ${mode}：真实PDF尺寸`,Math.abs(m.width-(mode==='landscape'?1920:1080))<.6&&(mode==='landscape'?Math.abs(m.height-1080)<.6:Math.abs(m.height/8-Math.round(m.height/8))<.1),m);
  }
}
async function printScreenshots(page,sample,version,files){
  for(const mode of ['landscape','portrait']){
    await page.setViewportSize({width:1920,height:1080});await page.emulateMedia({media:'print'});
    const layout=await page.evaluate(m=>window.prepareReportPrint(m),mode);
    const name=`${sample.id}-${version}-${mode}.png`;
    // CC 2026-11-03：竖版高于视口，需整页截图再裁切；页高取 8px 倍数后比内容高至多 7px，整页截图只到内容高度，先把文档撑到页高，截完复原。
    if(mode==='portrait')await page.evaluate(h=>{document.documentElement.style.minHeight=h+'px';},layout.height);
    const dims=await shot(page,name,{clip:{x:0,y:0,width:layout.width,height:layout.height},fullPage:mode==='portrait'});
    if(mode==='portrait')await page.evaluate(()=>{document.documentElement.style.minHeight='';});
    check(name+'：截图实际尺寸',dims.width===layout.width&&dims.height===layout.height,dims);
    if(files?.[mode+'_pdf']){
      const raster=path.join(QA,`${sample.id}-${version}-${mode}-pdf.png`);
      command(['python3','render_pdf.py',files[mode+'_pdf'],raster]);
      const comparison=command(['python3','compare_rasters.py',path.join(QA,name),raster],{allowFailure:true});
      check(name+'：HTML与PDF栅格比较',comparison.status===0,comparison.stdout.slice(0,1500));
    }
  }
}
async function browserChecks(browser){
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  try{
    for(const sample of [...fixtures().filter(x=>x.name!=='overflow'),{id:'sample-company',data:load(path.join(APP,'data-v3/sample-company.draft.json'))}]){
      let r;
      process.stderr.write('真实构建与检查：'+sample.id+'\n');
      await attempt(sample.id+'：真实构建',async()=>{
        r=sample.id==='sample-company'?build(['--id','sample-company','--draft','--out-dir',QA]):build(['--id',sample.id,'--fixture',`test-fixtures/${sample.id}.json`,'--assume-confirmed','--out-dir',OUT]);
        builtFiles.set(sample.id,r);check(sample.id+'：真实PDF已生成',r.ok&&r.pdf_generated,r.errors);
        for(const [version,files] of Object.entries(r.files))await inspectPDF(sample,version,files,!!r.preview);
      });
      // A failed PDF must not prevent screenshots/diagnostics of its HTML preview.
      const inspect=r?.files||staticFiles.get(sample.id).files;
      for(const [version,files] of Object.entries(inspect))await attempt(sample.id+' '+version+'：布局与截图',async()=>{
        const page=await context.newPage();instrument(page);
        try{
          await page.goto(pathToFileURL(files.html).href);await page.evaluate(()=>window.reportReady);
          const markup=fs.readFileSync(files.html,'utf8');V3.sourceChecks(APP,sample.id+' '+version,markup,check);
          await V3.layoutChecks(page,sample.id+' '+version,sample.data,check);
          if(sample.id==='fixture-capacity')await V3.areaRegression(page,check);
          await printScreenshots(page,sample,version,files);
        }finally{await page.close();}
      });
    }
    await attempt('溢出拒绝且不覆盖旧产物',async()=>{
      const folder=path.join(QA,'overflow-check');fs.mkdirSync(folder,{recursive:true});
      const r=build(['--id','fixture-overflow','--fixture','test-fixtures/fixture-overflow.json','--assume-confirmed','--out-dir',folder],{allowFailure:true});
      check('两条96字溢出夹具：按元素名拒绝',r.exit!==0&&JSON.stringify(r.errors).includes('请缩短'),r.errors);
      check('溢出夹具：无半成品',!fs.readdirSync(path.join(folder,'onepage-qa')).some(x=>/\.(html|pdf)$/.test(x)));
    });
    for(const [version,files] of Object.entries(staticFiles.get('sample-company').files))await require('./verify-responsive.cjs')({browser,file:files.html,label:'sample-company-'+version,check,attempt,instrument,shot});
    await attempt('真实裁切/孤字夹具',async()=>{
      const page=await context.newPage();instrument(page);
      try{
        await page.goto(pathToFileURL(path.join(APP,'test-fixtures/layout-check.html')).href);await page.evaluate(()=>document.fonts.ready);
        const m=await page.evaluate(()=>['fit','vertical','horizontal'].map(id=>ReportLayout.textClipped(document.getElementById(id))));
        check('Range检查拒绝真实水平/垂直裁切',JSON.stringify(m)==='[false,true,true]',m);
      }finally{await page.close();}
    });
    // Keep the previously required 20+20 stability gate; never retry failures.
    for(const id of ['sample-company','fixture-five'])await attempt(id+'：连续20次真实构建',async()=>{
      if(!builtFiles.get(id)?.ok){check(id+'：初构建失败，连建未执行',false);return;}
      let passed=0;
      for(let n=0;n<20;n++){
        process.stderr.write(`${id} 连建 ${n+1}/20\n`);
        const r=id==='sample-company'?build(['--id',id,'--draft','--out-dir',QA],{allowFailure:true}):build(['--id',id,'--fixture',`test-fixtures/${id}.json`,'--assume-confirmed','--out-dir',OUT],{allowFailure:true});
        if(r.exit!==0){check(`${id}：连续构建第${n+1}次失败，停止同类循环`,false,r.errors);break;}passed++;
      }
      check(id+'：20次无重试完成',passed===20,passed);
    });
  }finally{await context.close();}
}
async function freePort(){const net=require('node:net');return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
async function sheetFlow(browser){
  const dataDir=path.join(scratch,'flow-data');fs.mkdirSync(dataDir);
  const d=load(path.join(APP,'test-fixtures/fixture-five.json'));d.company.id='fixture-flow';d.overall.level=null;
  fs.writeFileSync(path.join(dataDir,'fixture-flow.draft.json'),JSON.stringify(d));fs.writeFileSync(path.join(dataDir,'reviewer.txt'),'测试审阅人\n');
  const out=fs.mkdtempSync(path.join(QA,'flow-')),port=await freePort(),base=`http://127.0.0.1:${port}`;
  const log=fs.openSync(path.join(out,'server.log'),'w');
  const server=spawn('python3',['serve.py','--port',String(port),'--data-dir',dataDir,'--out-dir',out],{cwd:APP,stdio:['ignore',log,log]});
  const ctx=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});const page=await ctx.newPage();instrument(page);
  try{
    let ready=false;for(let n=0;n<100;n++){try{const r=await fetch(base+'/api/sheet?id=fixture-flow');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
    if(!ready)throw new Error('临时本机服务未就绪');
    await page.goto(base+'/sheet.html?id=fixture-flow');await page.waitForFunction(()=>document.documentElement.dataset.sheetReady==='true');
    check('打分表：null无预选、确认被禁用',await page.locator('#overall-row [aria-pressed="true"]').count()===0&&await page.locator('#confirm').isDisabled());
    await page.locator('.swatch[data-kind="axis"][data-index="0"][data-level="na"]').click();
    await page.locator('[data-gate="tech"]').selectOption('block');
    check('关卡阻断自动综合暂缓',await page.locator('#overall-row .swatch[data-level="hold"]').getAttribute('aria-pressed')==='true');
    await page.locator('[data-gate="tech"]').selectOption('pass');
    check('解除最后阻断综合回到null',await page.locator('#overall-row [aria-pressed="true"]').count()===0&&await page.locator('#confirm').isDisabled());
    await page.locator('[data-gate="tech"]').selectOption('block');
    await page.locator('.premise-editor').first().locator('select').selectOption('verified');
    await page.locator('#problems-editor [data-field="by"]').first().fill('本轮交割前');
    await page.locator('#problems-editor [data-field="pass"]').first().fill('书面核验完成');
    for(const width of [1280,1440,1512,1920]){
      await page.setViewportSize({width,height:1080});
      const metrics=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
        clipped:[...document.querySelectorAll('textarea')].filter(e=>e.scrollHeight>e.clientHeight+2).map(e=>e.getAttribute('aria-label')),
        cells:[...document.querySelectorAll('.edit-matrix-cell')].map(e=>e.getBoundingClientRect().height)}));
      check(`打分表 ${width}：无横溢、输入完整、矩阵整像素`,metrics.client===metrics.scroll&&!metrics.clipped.length&&metrics.cells.every(n=>Math.abs(n-Math.round(n))<=.5),metrics);
    }
    const confirmedResponse=page.waitForResponse(r=>r.url().includes('/api/confirm'),{timeout:300000});
    await page.locator('#confirm').click();const confirmed=await (await confirmedResponse).json();await page.waitForFunction(()=>!document.getElementById('save').disabled);
    check('确认对外：两版六个文件',confirmed.ok&&Object.values(confirmed.files||{}).flatMap(Object.values).length===6,confirmed.errors);
    check('确认状态与六个链接',await page.locator('#report-links a').count()===6&&(await page.locator('#confirmation-state').textContent()).includes('已确认对外'));
    const loaded=()=>fetch(base+'/api/sheet?id=fixture-flow').then(r=>r.json());
    let current=await loaded();check('表单所有新字段已保存',current.data.axes[0].level==='na'&&current.data.overall.level==='hold'&&current.data.premises[0].status==='verified'&&current.data.problems[0].pass==='书面核验完成');
    const stamp=JSON.stringify(current.confirmation),oldFiles=Object.values(confirmed.files||{}).flatMap(Object.values).map(url=>path.join(out,path.basename(url)));
    const oldHashes=oldFiles.map(digest);
    let response=page.waitForResponse(r=>r.url().includes('/api/save'));await page.locator('#save').click();await response;await page.waitForFunction(()=>!document.getElementById('save').disabled);
    current=await loaded();check('无改动保存保留确认',JSON.stringify(current.confirmation)===stamp);
    const dims=await shot(page,'sheet-1920x1080.png');check('打分表实际截图1920×1080',dims.width===1920&&dims.height===1080,dims);
    await shot(page,'sheet-full.png',{fullPage:true});
    await page.locator('.axis-public').first().fill('合成理由已修改');
    response=page.waitForResponse(r=>r.url().includes('/api/save'));await page.locator('#save').click();const invalid=await (await response).json();await page.waitForFunction(()=>!document.getElementById('save').disabled);
    current=await loaded();check('改一处保存：确认失效且下载隐藏',invalid.invalidated&&current.confirmation===null&&Object.keys(current.outputs).length===0&&(await page.locator('#confirmation-state').textContent()).includes('确认失效')&&await page.locator('#report-links a').count()===0);
    const rejected=build(['--id','fixture-flow','--data-dir',dataDir,'--out-dir',out],{allowFailure:true});check('失效后--id拒绝',rejected.exit!==0&&JSON.stringify(rejected.errors).includes('未确认对外'));
    const all=build(['--all','--data-dir',dataDir,'--out-dir',out]);check('--all跳过失效公司',all.companies.length===0&&all.skipped.length===1);
    response=page.waitForResponse(r=>r.url().includes('/api/preview'),{timeout:300000});await page.locator('#preview').click();const preview=await (await response).json();await page.waitForFunction(()=>!document.getElementById('save').disabled);
    check('确认失效仍可生成两版水印预览',preview.ok&&Object.values(preview.files||{}).flatMap(Object.values).every(url=>url.includes('-preview')),preview.errors);
    check('预览不覆盖六个正式文件',oldFiles.every((f,i)=>digest(f)===oldHashes[i]));
    current=await loaded();
    for(const [audience,files] of Object.entries(preview.files||{})){
      const paths=Object.fromEntries(Object.entries(files).map(([k,url])=>[k,path.join(out,path.basename(url))]));
      await inspectPDF({id:'fixture-flow-preview',data:current.data},audience,paths,true);
    }
  }finally{await ctx.close();server.kill('SIGTERM');await new Promise(resolve=>server.exitCode!==null?resolve():server.once('exit',resolve));fs.closeSync(log);}
}
(async()=>{
  let counts={},browser;
  try{
    if(!staticOnly)fs.mkdirSync(QA,{recursive:true});
    counts=await staticChecks();
    if(!staticOnly){
      const {chromium}=require(PLAYWRIGHT);
      browser=await chromium.launch({executablePath:CHROME||command(['python3','-c','import build;print(build.CHROME)']).stdout.trim(),headless:true,args:['--disable-background-networking','--disable-component-update','--force-device-scale-factor=1']});
      await browserChecks(browser);await attempt('Playwright过本机服务器完整确认流程',()=>sheetFlow(browser));
    }
  }catch(e){check('验证器完成',false,String(e.stack||e).slice(0,3000));}
  finally{
    if(browser)await browser.close();
    if(!staticOnly){check('零控制台/页面/HTTP错误',pageErrors.length===0,pageErrors);check('零外部请求',external.length===0,external);
      for(const audience of ['founder','investor'])for(const mode of ['landscape','portrait'])check('截图齐全 sample-company '+audience+' '+mode,screenshots.some(x=>path.basename(x.file)===`sample-company-${audience}-${mode}.png`));
    }
    const result={mode:staticOnly?'static-only':'local-chrome',at:new Date().toISOString(),passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,counts,checks,screenshots,
      pending:staticOnly?['本机 Chrome：真实PDF/布局/端到端/截图及20+20连建','1920×1080横版和1080宽竖版目视审阅']:['目视审阅与验收']};
    fs.mkdirSync(QA,{recursive:true});
    const target=path.join(QA,staticOnly?'verification-static.json':'verification-v3.json');fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');
    // Full mode keeps QA artifacts. Static mode leaves only its compact manifest.
    fs.rmSync(scratch,{recursive:true,force:true});
    console.log(`V3 checks: ${result.passed} passed, ${result.failed} failed; Python ${counts.python||'?'}; Node ${counts.node||'?'}`);
    process.exitCode=result.failed?1:0;
  }
})();
