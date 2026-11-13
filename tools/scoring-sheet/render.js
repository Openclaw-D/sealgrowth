(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('report-data').textContent);
  const logo = JSON.parse(document.getElementById('brand-data').textContent);
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const refs = ids => `<span class="source-refs">${ids.map(id=>`[${id}]`).join('')}</span>`;
  const stages = ['概念','原理验证','样机','试点','付费','量产'];
  const shades = ['var(--gray-600)','var(--gray-300)','var(--gray-200)','var(--gray-100)','var(--gray-400)','var(--gray-500)'];
  const report = document.getElementById('report');
  // CC 2026-11-03：所有版本（正式件与预览）加浅色小水印：灰海豹 + 两行字。文字只在此处改。
  // 预览居中的"内部预览 · 未确认"大字已按用户要求删去；预览仍由页脚小字、文件名与标题区分。
  // 每页九组，均匀斜向分布：横版（及宽屏）三行三列，每行左移 6%，组与组连成与文字同向的斜线；
  // 竖版（及窄屏）页面很长，九组自上而下等距，横向右中左循环，同样连成斜线。
  const CONFIDENTIAL = ['商业机密','外泄违约'];
  const CONFIDENTIAL_SPOTS = {
    wide:[18,50,82].flatMap((y,row)=>[22,55,88].map(x=>[x-row*6,y])),
    tall:Array.from({length:9},(_,i)=>[[78,50,22][i%3],6+i*11])};
  report.dataset.audience = data.audience;
  const problems = `<ol class="item-list problems">${data.problems.map(item=>`<li class="report-item" data-number="${item.number}"><span class="item-number">${item.number}</span><div><p class="problem-copy" data-max-lines="2">${esc(item.text)} ${refs(item.sources)}</p><p class="verify-copy">验证：${esc(item.verify)}</p><p class="deadline-copy" data-fit>${esc(item.by)} · 通过线：${esc(item.pass)}</p></div></li>`).join('')}</ol>`;
  report.innerHTML = `<header class="report-header">
    <div class="brand"><img src="${logo}" alt="灰色海豹标志"><div><div class="brand-cn">${esc(data.meta.brand_cn)}</div><div class="brand-en">${esc(data.meta.brand_en)}</div></div></div>
    <h1 class="company-title">${esc(data.company.name)} · ${esc(data.company.sector)}</h1>
    <div class="header-meta"><time class="as-of">${esc(data.meta.as_of)}</time><span class="audience-label" data-fit>${ReportAudience.label}</span></div></header>
    <section class="top-strip" aria-label="企业概况"><div class="top-cell top-business"><b class="top-key">业务</b><span class="top-value">${esc(data.company.business)}</span></div>
    <div class="top-cell top-stage"><b class="top-key">阶段</b><span class="top-value">${esc(data.company.stage)}</span></div>
    <div class="top-cell top-round"><b class="top-key">本轮</b><span class="top-value"><span class="round-line">${esc(data.company.round.headline)}</span>${data.company.round.valuation===undefined?'':`<span class="round-line">估值 ${esc(data.company.round.valuation)} · 出让 ${esc(data.company.round.dilution)}</span>`}</span></div>${ReportAudience.top(data)}</section>
    ${ReportAudience.before(data, refs)}
    <section class="column judgments-column"><h2>${ReportAudience.judgments}</h2>
      <ol class="item-list judgments">${data.judgments.map(item=>`<li class="report-item" data-number="${item.number}"><span class="item-number">${item.number}</span><div><p class="judgment-copy">${esc(item.text)}</p><p class="judgment-meta">${esc(item.evidence)} · ${refs(item.sources)}</p></div></li>`).join('')}</ol>
      <div class="stage-funds"><div class="stage-bar" aria-label="项目阶段">${stages.map(stage=>`<span class="stage" data-current="${stage===data.company.stage}">${stage}</span>`).join('')}</div>
      ${data.company.fund_use.length?`<div class="fund-bar" aria-label="资金用途">${data.company.fund_use.filter(part=>part.pct>0).map((part,i)=>`<span class="fund-segment" aria-label="${esc(part.label)} ${part.pct}%" style="width:${part.pct}%;background:${shades[i]};color:${i===0?'#fff':'#171717'}"><span class="fund-label">${esc(part.label)} ${part.pct}%</span></span>`).join('')}</div><div class="fund-legend" aria-label="资金用途图例"></div>`:'<div class="fund-unknown">资金用途 待确认</div>'}</div></section>
    ${ReportAudience.columns(data,refs,problems)}
    <footer class="report-footer">来源：${data.sources.map(s=>`[${s.id}] ${esc(s.short)}`).join('　')}　${['截至 '+data.meta.as_of,data.meta.fa_disclosure,data.meta.disclaimer,...(data.review?['审阅 '+data.review.by+' '+data.review.at,'版本 '+data.review.version]:[])].filter(s=>s.trim()).map(esc).join(' · ')}${data.preview?'<span class="preview-footer">内部预览 · 未确认</span>':''}</footer>
    <div class="confidential-marks" aria-hidden="true">${Object.entries(CONFIDENTIAL_SPOTS).flatMap(([set,spots])=>spots.map(([x,y])=>`<span class="confidential-mark" data-set="${set}" style="left:${x}%;top:${y}%"><img src="${logo}" alt=""><span>${CONFIDENTIAL.join('</span><span>')}</span></span>`)).join('')}</div>`;
  const root = document.documentElement;
  const frame = () => new Promise(resolve=>requestAnimationFrame(resolve));
  function fitLabels() {
    const factor = root.dataset.printLayout==='portrait' ? 1080/430 : 1;
    const legend = report.querySelector('.fund-legend');
    if (!legend) return;
    legend.replaceChildren();
    const segments = [...report.querySelectorAll('.fund-segment')];
    let moved = false;
    for (const segment of segments) {
      const label = segment.querySelector('.fund-label'); label.hidden = false;
      const fits = label.getBoundingClientRect().width <= segment.getBoundingClientRect().width-4*factor;
      label.hidden = !fits; moved ||= !fits;
    }
    if (moved) for (const segment of segments) {
      const entry = document.createElement('span'); entry.className = 'fund-legend-entry';
      const swatch = document.createElement('i'); swatch.className = 'fund-swatch'; swatch.style.background=segment.style.background;
      const label = document.createElement('span'); label.className = 'fund-legend-label'; label.textContent = segment.getAttribute('aria-label');
      entry.append(swatch,label); legend.append(entry);
    }
  }
  function inspect() {
    // Remove earlier line-binding spans so a rotation never retains old breaks.
    ReportLayout.clearOrphans(report);
    ReportLayout.resetCapacity(report);
    fitLabels();
    window.reportTypography=ReportLayout.fitType(report);
    ReportLayout.preventOrphans(report);
    ReportLayout.fitLandscapeColumns(report);
    ReportAudience.fit(report, data);
    window.reportTypography = ReportLayout.fitType(report);
    if (root.dataset.printLayout==='landscape') {
      const footer=report.querySelector('.report-footer');
      for (const tracking of [-.25,-.4,-.55]) {
        footer.style.letterSpacing=tracking+'px';
        if (footer.scrollWidth<=footer.clientWidth) break;
      }
    }
    // CC 2026-11-03：列宽与字号在上面两步仍会变化，早先绑定的孤字组会失效；
    // 在最终排版之后重做孤字绑定并复核字号容量，最多三轮。
    for (let round = 0; round < 3 && root.dataset.printLayout; round++) {
      ReportLayout.clearOrphans(report);
      ReportLayout.preventOrphans(report);
      window.reportTypography = ReportLayout.fitType(report);
      if (!ReportLayout.findOrphans(report).length) break;
    }
    const failures = ReportLayout.inspect(report, {orphans:!!root.dataset.printLayout, areas:!!root.dataset.printLayout});
    if (!root.dataset.printLayout && root.scrollWidth > root.clientWidth) failures.push('页面横向越界');
    root.dataset.layoutStatus = failures.length ? 'error' : 'ok';
    root.dataset.layoutError = [...new Set(failures)].join('、');
    return failures;
  }
  window.reportReady = (async()=>{
    await document.fonts.ready;
    await Promise.all([...document.images].map(img=>img.decode()));
    await frame();
    inspect();
    root.dataset.layoutDone='true';
    return true;
  })();
  window.reportReady.catch(()=>{
    root.dataset.layoutStatus='system-error';
    root.dataset.layoutError='排版检查未完成（系统原因，非内容问题）';
    root.dataset.layoutDone='true';
  });
  window.checkReportLayout = async()=>{
    await window.reportReady;
    await frame();
    const failures=inspect();
    return {done:true,failures};
  };
  window.prepareReportPrint = async mode => {
    if (!['landscape','portrait'].includes(mode)) throw new Error('不支持的打印版式');
    await window.reportReady;
    root.dataset.printLayout=mode;
    let pageStyle=document.getElementById('print-page-size');
    if(!pageStyle){pageStyle=document.createElement('style');pageStyle.id='print-page-size';document.head.append(pageStyle);}
    pageStyle.textContent=`@page { size: ${mode==='landscape'?1920:1080}px ${mode==='landscape'?1080:10000}px; margin:0; }`;
    await frame();await frame();
    inspect();
    const width=mode==='landscape'?1920:1080;
    // Rounded upward, never truncated. Chrome snaps the PDF page to whole points and then to 1/300 inch,
    // so a multiple of 8px (6pt) is the only height it prints exactly; at most 7px of blank tail.
    const height=mode==='landscape'?1080:Math.ceil(report.getBoundingClientRect().height/8)*8;
    pageStyle.textContent=`@page { size: ${width}px ${height}px; margin:0; }`;
    await frame();
    const failures=inspect();
    failures.push(...ReportLayout.pageFailures(report,{width,height}));
    const box=report.getBoundingClientRect();
    if(Math.abs(box.width-width)>.5 || box.height>height+.5)failures.push('打印画布尺寸');
    return {done:true,mode,width,height,typography:window.reportTypography,failures:[...new Set(failures)],markup:root.outerHTML,
      bodySize:parseFloat(getComputedStyle(report).getPropertyValue('--type-body'))*(mode==='portrait'?1080/430:1)};
  };
  let resize;
  window.addEventListener('resize',()=>{
    if(root.dataset.printLayout)return;
    clearTimeout(resize);
    resize=setTimeout(()=>window.checkReportLayout().catch(()=>{}),60);
  });
  window.addEventListener('beforeprint',()=>{
    // Standalone browser printing defaults to the landscape deliverable.
    if(!root.dataset.printLayout)root.dataset.printLayout='landscape';
  });
  window.addEventListener('afterprint',()=>{
    delete root.dataset.printLayout;
    window.checkReportLayout().catch(()=>{});
  });
})();
