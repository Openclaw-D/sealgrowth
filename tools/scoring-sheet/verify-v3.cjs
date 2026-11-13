'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const words={unknown:'未知',weak:'弱点',normal:'正常',strong:'优秀',na:'不适用',hold:'暂缓'};
const publicIn=markup=>JSON.parse(markup.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
function renderStatic(APP,markup){
  const report={dataset:{},innerHTML:''};
  const doc={getElementById:id=>id==='report'?report:{textContent:markup.match(new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)<\\/script>`))[1]}};
  const context=vm.createContext({document:doc});
  const p=publicIn(markup);
  vm.runInContext(fs.readFileSync(path.join(APP,`render-${p.audience}.js`),'utf8'),context);
  const common=fs.readFileSync(path.join(APP,'render.js'),'utf8');
  vm.runInContext(common.slice(0,common.indexOf('  const root ='))+'})();',context);
  // Exercise the real geometry function with synthetic bounding boxes. This is
  // algebra/DOM-string coverage only; it does not claim font or browser QA.
  if(p.axes){
    const shell={innerHTML:'',getBoundingClientRect:()=>({width:576}),parentElement:{getBoundingClientRect:()=>({height:780}),querySelector:selector=>({getBoundingClientRect:()=>({height:selector.includes('heading')?52:404})})}};
    context.document.documentElement={dataset:{printLayout:'landscape'}};
    context.getComputedStyle=()=>({gridTemplateColumns:'552px 699px 589px'});
    const fake={ownerDocument:{defaultView:{}},querySelector:()=>shell,getBoundingClientRect:()=>({width:1920})};
    context.fake=fake;context.payload=p;
    vm.runInContext('ReportAudience.fit(fake,payload)',context);
    report.innerHTML=report.innerHTML.replace('<div class="radar-shell"></div>',`<div class="radar-shell">${shell.innerHTML}</div>`);
  }
  return report.innerHTML;
}
function sourceChecks(APP,label,markup,check){
  const p=publicIn(markup),dom=renderStatic(APP,markup),investor=p.audience==='investor';
  check(label+'：共用响应式 viewport / 离线 CSP',markup.includes('width=device-width, initial-scale=1')&&markup.includes("connect-src 'none'"));
  check(label+'：数据无概率/影响/内部字段',!JSON.stringify(p).match(/"(?:analysis|reason|next|suggested|confidence|internal_notes|likelihood|impact|gates)"\s*:/));
  check(label+'：问题顺序、期限与通过线',p.problems.every((x,i)=>x.number===i+1&&dom.includes(x.by+' · 通过线：'+x.pass)));
  check(label+'：新增正文在 DOM 中',p.problems.every(x=>dom.includes(x.verify))&&(p.premises||[]).every(x=>dom.includes(x.text))&&(p.axes||[]).every(x=>dom.includes(x.public_reason)));
  check(label+'：预览页脚标记与正式审阅互斥、无居中大字',!dom.includes('class="preview-watermark"')&&(p.preview?dom.includes('class="preview-footer"')&&!p.review:!dom.includes('class="preview-footer"')&&!!p.review&&dom.includes('审阅 '+p.review.by)));
  check(label+'：两版均无矩阵',!dom.includes('risk-matrix')&&!dom.includes('matrix-cell'));
  if(investor){
    check(label+'：源码与投影无评级组件',!['level-data','radar-svg','level-chip','public_reason','top-overall','request-list'].some(x=>markup.includes(x))&&!['axes','overall','requests','gates'].some(k=>k in p));
    check(label+'：卡片三项和前提',(dom.match(/class="identity-card"/g)||[]).length===3&&(dom.match(/class="premise-copy"/g)||[]).length===p.premises.length);
  }else{
    check(label+'：没有企业卡片',!('card' in p)&&!dom.includes('class="identity-card"'));
    check(label+'：最弱前提占独立一行',dom.includes('class="weakest-line"')&&dom.indexOf('class="weakest-line"')<dom.indexOf('class="column judgments-column"'));
    const expected=p.overall.rating===null?'未定档':p.overall.rating==='insufficient'?'资料不足':words[p.overall.rating];
    check(label+'：综合按优先级显示',dom.includes(expected));
    if(p.requests){
      check(label+'：索证清单无雷达或六维行',dom.includes('索证清单')&&!dom.includes('class="radar-svg"')&&!dom.includes('class="axis-reason"')&&p.requests.every(s=>dom.includes(s)));
    }else{
      const rated=p.axes.filter(a=>['weak','normal','strong'].includes(a.level)).length;
      check(label+'：三层六角网格，六轴无圆椭圆',(dom.match(/class="radar-grid"/g)||[]).length===3&&(dom.match(/class="radar-axis"/g)||[]).length===6&&!/<(?:circle|ellipse)\b/.test(dom));
      check(label+'：已评顶点与未知空心标记分离',(dom.match(/class="radar-dot"/g)||[]).length===rated&&(dom.match(/class="radar-empty"/g)||[]).length===6-rated);
      check(label+'：六行理由与图例',(dom.match(/class="axis-reason"/g)||[]).length===6&&dom.includes('未知＝尚未证明，不计入'));
      const legend=dom.match(/class="level-legend"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';
      const expected=['unknown','weak','normal','strong',...(p.axes.some(a=>a.level==='na')?['na']:[])];
      check(label+'：图例顺序和按需不适用',JSON.stringify([...legend.matchAll(/data-rating="([^"]+)"/g)].map(x=>x[1]))===JSON.stringify(expected));
      check(label+'：token 评分无数字',p.axes.every(a=>typeof a.level==='string'&&Object.hasOwn(words,a.level)));
    }
  }
  return {public:p,dom};
}
async function layoutChecks(page,label,data,check){
  const p=await page.locator('#report-data').textContent().then(JSON.parse);
  for(const mode of ['landscape','portrait']){
    await page.setViewportSize({width:1920,height:1080});await page.emulateMedia({media:'print'});
    const result=await page.evaluate(m=>window.prepareReportPrint(m),mode);
    const m=await page.evaluate(()=>{
      const report=document.getElementById('report'),q=s=>report.querySelector(s),all=s=>[...report.querySelectorAll(s)];
      const svg=q('.radar-svg'),factor=document.documentElement.dataset.printLayout==='portrait'?1080/430:1;
      const sizes=selector=>all(selector).map(e=>parseFloat(getComputedStyle(e).fontSize)*factor);
      const card=q('.enterprise-card'),premises=q('.premises-block');
      return {width:report.getBoundingClientRect().width,height:report.getBoundingClientRect().height,dateLines:ReportLayout.textLines(q('.as-of')).length,
        areas:ReportLayout.areaFailures(report),clips:all(ReportLayout.typeSelectors).filter(e=>ReportLayout.textClipped(e)).map(e=>e.className),orphans:ReportLayout.findOrphans(report),
        body:sizes('.judgment-meta,.verify-copy,.deadline-copy,.premise-copy,.axis-reason,.weakest-line,.request-list li'),items:sizes('.judgment-copy,.problem-copy'),headings:sizes('.column h2'),top:sizes('.top-cell'),footer:sizes('.report-footer'),
        radius:svg?Number(svg.dataset.radius)*svg.getBoundingClientRect().width/svg.viewBox.baseVal.width:null,labelSizes:sizes('.radar-label'),rings:all('.radar-grid').length,dots:all('.radar-dot').map(e=>e.dataset.axis),empty:all('.radar-empty').map(e=>e.dataset.axis),
        poly:svg?.querySelector('.radar-polygon')?.getAttribute('points')||'',circles:all('circle,ellipse').length,
        palette:document.getElementById('level-data')?JSON.parse(document.getElementById('level-data').textContent):{},
        marks:all('.radar-dot,.radar-empty').map(e=>({axis:Number(e.dataset.axis),x:Number(e.getAttribute('x'))+5,y:Number(e.getAttribute('y'))+5,fill:e.getAttribute('fill'),empty:e.classList.contains('radar-empty')})),
        view:svg?{width:svg.viewBox.baseVal.width,height:svg.viewBox.baseVal.height,radius:Number(svg.dataset.radius)}:null,
        legendTokens:all('.level-legend .level-chip').map(e=>e.dataset.rating),legendSizes:sizes('.level-legend .level-chip'),
        whiteGap:card&&premises?premises.getBoundingClientRect().top-card.getBoundingClientRect().bottom:0,
        confidential:all('.confidential-mark').filter(e=>e.getBoundingClientRect().width>0).map(e=>{const b=e.getBoundingClientRect(),r=document.getElementById('report').getBoundingClientRect();return {text:[...e.querySelectorAll(':scope>span')].map(s=>s.textContent).join(''),img:!!e.querySelector('img'),inside:b.left>=r.left-.5&&b.right<=r.right+.5&&b.top>=r.top-.5&&b.bottom<=r.bottom+.5,alpha:Number((getComputedStyle(e).color.match(/[\d.]+(?=\))/)||[1])[0])};}),
        previewFooter:q('.preview-footer')?.textContent,
        segments:all('.fund-segment').map(e=>({label:e.getAttribute('aria-label'),moved:e.querySelector('.fund-label').hidden})),legend:all('.fund-legend-entry').map(e=>e.textContent),
        overall:q('.top-overall')?.textContent,overallColor:q('.top-overall .level-chip')?getComputedStyle(q('.top-overall .level-chip')).backgroundColor:null,
        axisLines:all('.axis-reason').map(e=>ReportLayout.textLines(e).length),problemLines:all('.problem-copy').map(e=>ReportLayout.textLines(e).length),
        gaps:all('.item-list').map(list=>{const lines=[...list.children].map(e=>ReportLayout.textLines(e.lastElementChild));return lines.slice(1).map((rows,i)=>rows[0].top-lines[i].at(-1).bottom);})};
    });
    check(`${label} ${mode}：真实预检通过`,result.done&&!result.failures.length,result.failures);
    check(`${label} ${mode}：区域无越界/相交，全文无裁切/孤字`,!m.areas.length&&!m.clips.length&&!m.orphans.length,{areas:m.areas,clips:m.clips,orphans:m.orphans});
    check(`${label} ${mode}：日期单行`,m.dateLines===1);
    check(`${label} ${mode}：画布尺寸`,mode==='landscape'?m.width===1920&&m.height<=1080.5:result.width===1080&&result.height%8===0&&m.height<=result.height+.5,{width:m.width,height:m.height,page:result.height});
    check(`${label} ${mode}：字号底线`,mode==='landscape'?m.body.every(x=>x>=24)&&m.items.every(x=>x>=28)&&m.top.every(x=>x>=32)&&m.headings.every(x=>x>=36)&&m.footer.every(x=>x>=16):m.body.every(x=>x>=40),{body:m.body,items:m.items,top:m.top,headings:m.headings});
    if(p.axes){
      const rated=p.axes.map((a,i)=>['weak','normal','strong'].includes(a.level)?String(i):null).filter(x=>x!==null);
      check(`${label} ${mode}：雷达三环六轴、顶点及空心标记`,m.rings===3&&m.dots.join()===rated.join()&&m.dots.length+m.empty.length===6&&m.circles===0&&m.poly.split(' ').length===rated.length,m);
      const fraction={weak:1/3,normal:2/3,strong:1};
      check(`${label} ${mode}：顶点坐标及颜色按 token 正确`,m.marks.every(dot=>{const token=p.axes[dot.axis].level,angle=(-90+dot.axis*60)*Math.PI/180,f=fraction[token]??1;return Math.abs(dot.x-(m.view.width/2+Math.cos(angle)*m.view.radius*f))<.02&&Math.abs(dot.y-(m.view.height/2+Math.sin(angle)*m.view.radius*f))<.02&&dot.fill===(dot.empty?'white':m.palette[token].color);}),m.marks);
      check(`${label} ${mode}：图例字号与顺序`,m.legendSizes.every(x=>x>=16)&&JSON.stringify(m.legendTokens)===JSON.stringify(['unknown','weak','normal','strong',...(p.axes.some(a=>a.level==='na')?['na']:[])]));
      if(mode==='landscape')check(label+'：最大可用雷达半径不低于110，理由两行',m.radius>=110&&m.labelSizes.every(x=>x>=24)&&m.axisLines.every(x=>x<=2),{radius:m.radius,labelSizes:m.labelSizes,axisLines:m.axisLines});
    }
    if(p.requests)check(label+'：资料不足无雷达，暂缓优先',m.radius===null&&(p.overall.rating==='hold'?m.overallColor==='rgb(31, 31, 31)':m.overallColor===null),m.overall);
    if(p.audience==='investor')check(`${label} ${mode}：卡片与前提空带≤120px`,m.whiteGap<=120.5,m.whiteGap);
    check(`${label} ${mode}：海豹小水印九组、在纸内、透明度≤0.1`,m.confidential.length===9&&m.confidential.every(c=>c.text==='商业机密外泄违约'&&c.img&&c.inside&&c.alpha<=.1),m.confidential);
    if(p.preview)check(`${label} ${mode}：预览页脚标记为真实文字`,m.previewFooter==='内部预览 · 未确认');
    if(mode==='landscape')check(label+'：问题正文≤两行、相邻间隔差≤8px',m.problemLines.every(n=>n<=2)&&m.gaps.every(g=>!g.length||Math.max(...g)-Math.min(...g)<=8),{lines:m.problemLines,gaps:m.gaps});
    if(m.segments.some(x=>x.moved))check(label+'：资金图例包含全部分段',JSON.stringify(m.legend)===JSON.stringify(m.segments.map(x=>x.label)));
  }
}
async function areaRegression(page,check){
  await page.emulateMedia({media:'print'});
  for(const mode of ['landscape','portrait']){
    const result=await page.evaluate(m=>window.prepareReportPrint(m),mode);
    const v=await page.evaluate(({width,height})=>{
      const report=document.getElementById('report'),support=report.querySelector('.stage-funds'),heading=report.querySelector('.report-header');
      support.style.transform='translateY(1000px)';const escaped=ReportLayout.areaFailures(report);support.style.removeProperty('transform');
      heading.style.transform='translateY(60px)';const overlap=ReportLayout.areaFailures(report);heading.style.removeProperty('transform');
      return {escaped,overlap,page:ReportLayout.pageFailures(report,{width,height:report.getBoundingClientRect().height-2})};
    },result);
    check(`区域回归 ${mode}：越界/相交/超页均拒绝`,v.escaped.length>0&&v.overlap.some(x=>x.includes('重叠'))&&v.page.length>0,v);
  }
}
module.exports={words,publicIn,renderStatic,sourceChecks,layoutChecks,areaRegression};
