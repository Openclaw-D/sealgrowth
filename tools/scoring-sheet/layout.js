/* Shared by the report preflight, Node geometry tests and real-browser fixtures. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReportLayout = api;
})(globalThis, function () {
  'use strict';
  function outside(rect, box, tolerance = 1) {
    return rect.width > 0 && rect.height > 0 &&
      (rect.left < box.left - tolerance || rect.right > box.right + tolerance ||
       rect.top < box.top - tolerance || rect.bottom > box.bottom + tolerance);
  }
  function textRects(element) {
    const doc = element.ownerDocument;
    const walker = doc.createTreeWalker(element, 4); // NodeFilter.SHOW_TEXT
    const rects = [];
    for (let node; (node = walker.nextNode());) {
      if (!node.textContent.trim() || (node.parentElement.closest('script,style') || (node.parentElement.closest('svg') && !node.parentElement.closest('foreignObject')))) continue;
      const range = doc.createRange();
      // Whitespace has no ink: a space that hangs past the line end at a soft wrap is not clipped text.
      if (typeof range.setStart === 'function') {
        for (const run of node.textContent.matchAll(/\S+/g)) {
          range.setStart(node, run.index);
          range.setEnd(node, run.index + run[0].length);
          rects.push(...range.getClientRects());
        }
      } else {
        range.selectNodeContents(node);
        rects.push(...range.getClientRects());
      }
    }
    return rects;
  }
  function textClipped(element, tolerance = 1) {
    const box = element.getBoundingClientRect();
    return textRects(element).some(rect => outside(rect, box, tolerance));
  }
  // Font size alone is not the glyph height (notably PingFang on macOS).
  // Measure the actual system-font CJK/Latin Range, in unzoomed CSS pixels,
  // after fonts.ready and again when the responsive type steps change.
  const typeSelectors = '.brand-cn,.brand-en,.company-title,.as-of,.top-cell,.round-line,.column h2,.item-number,.judgment-copy,.problem-copy,.judgment-meta,.verify-copy,.stage,.fund-label,.fund-legend-label,.fund-unknown,.identity-card,.identity-card b,.report-footer,[data-fit]';
  function fitType(report) {
    const doc=report.ownerDocument, win=doc.defaultView, cache=new Map(), samples=[];
    const elements=[...report.querySelectorAll(typeSelectors)];
    for (const e of elements) e.style.removeProperty('line-height');
    for (const e of elements) {
      if (!e.getBoundingClientRect().height) continue;
      const style=win.getComputedStyle(e), key=[style.fontFamily,style.fontSize,style.fontWeight,style.fontStyle].join('|');
      let glyph=cache.get(key);
      if (glyph===undefined) {
        const probe=doc.createElement('span');
        Object.assign(probe.style,{position:'fixed',left:'0',top:'0',visibility:'hidden',display:'block',whiteSpace:'nowrap',padding:'0',border:'0',height:'100px',lineHeight:'100px',fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,fontStyle:style.fontStyle});
        probe.textContent='海豹增长国测 Ag 2026-11-02'; doc.body.append(probe);
        const range=doc.createRange(); range.selectNodeContents(probe);
        glyph=range.getBoundingClientRect().height/(probe.getBoundingClientRect().height/100);
        probe.remove(); cache.set(key,glyph);
      }
      const leading=Math.max(parseFloat(style.lineHeight)||0,Math.ceil(glyph+2));
      e.style.lineHeight=leading+'px';
      samples.push({font:style.fontFamily,size:parseFloat(style.fontSize),weight:style.fontWeight,glyph,leading});
    }
    return samples;
  }
  function resetCapacity(report) {
    for (const e of report.querySelectorAll('.column,.item-list,.report-item,.stage-funds')) {
      for (const key of ['min-height','max-height','row-gap','margin-top','--separator-offset']) e.style.removeProperty(key);
    }
  }
  function fitLandscapeColumns(report) {
    const win = report.ownerDocument.defaultView;
    if (win.getComputedStyle(report).gridTemplateColumns.split(' ').length !== 3) return;
    const print = report.ownerDocument.documentElement.dataset.printLayout === 'landscape';
    for (const column of report.querySelectorAll('.column')) {
      const list = column.querySelector(':scope > .item-list');
      if (!list) continue;
      const height = e => e.getBoundingClientRect().height;
      const children = [...column.children], others = children.filter(e=>e!==list);
      const items = [...list.children], gap = parseFloat(win.getComputedStyle(column).rowGap)||0;
      const used = items.reduce((sum,e)=>sum+height(e),0);
      const support = column.querySelector(':scope > .stage-funds');
      const base = others.reduce((sum,e)=>sum+height(e),0) + gap * (children.length-1);
      const minimum = base + used + Math.max(0,items.length-1)*8;
      if (!print) column.style.minHeight = Math.ceil(minimum)+'px';
      const free = Math.max(0,height(column)-base-used);
      const spacing = Math.max(8,free / Math.max(1,items.length));
      list.style.rowGap = spacing+'px';
      list.style.setProperty('--separator-offset',(-spacing/2)+'px');
      if (support) support.style.marginTop = Math.max(0,spacing-gap)+'px';
    }
  }
  function intersects(a,b,tolerance=.5) {
    return Math.min(a.right,b.right)-Math.max(a.left,b.left)>tolerance &&
      Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>tolerance;
  }
  function gridAreaBoxes({rows,columns,rowSizes,columnSizes,rowGap,columnGap,left,top,scale=1}) {
    const result={};
    rows.forEach((row,y)=>row.forEach((name,x)=>{
      if (name==='.') return;
      const x0=left+(columnSizes.slice(0,x).reduce((a,b)=>a+b,0)+columnGap*x)*scale;
      const y0=top+(rowSizes.slice(0,y).reduce((a,b)=>a+b,0)+rowGap*y)*scale;
      const cell={left:x0,top:y0,right:x0+columnSizes[x]*scale,bottom:y0+rowSizes[y]*scale};
      const box=result[name];
      result[name]=box?{left:Math.min(box.left,cell.left),top:Math.min(box.top,cell.top),right:Math.max(box.right,cell.right),bottom:Math.max(box.bottom,cell.bottom)}:cell;
    }));
    return Object.fromEntries(Object.entries(result).map(([key,b])=>[key,{...b,width:b.right-b.left,height:b.bottom-b.top}]));
  }
  const areaLabels={header:'页头',strip:'概况栏',weakest:'最弱前提行',judgments:'判断栏',auxiliary:'右栏',problems:'问题栏',enterprise:'企业与前提栏',footer:'来源与说明'};
  function gridAreas(report) {
    const style=report.ownerDocument.defaultView.getComputedStyle(report),box=report.getBoundingClientRect();
    const scale=box.width/report.offsetWidth;
    const rows=[...style.gridTemplateAreas.matchAll(/"([^"]+)"/g)].map(m=>m[1].trim().split(/\s+/));
    return gridAreaBoxes({rows,columnSizes:style.gridTemplateColumns.split(' ').map(parseFloat),rowSizes:style.gridTemplateRows.split(' ').map(parseFloat),rowGap:parseFloat(style.rowGap)||0,columnGap:parseFloat(style.columnGap)||0,scale,
      left:box.left+(parseFloat(style.paddingLeft)+parseFloat(style.borderLeftWidth))*scale,top:box.top+(parseFloat(style.paddingTop)+parseFloat(style.borderTopWidth))*scale});
  }
  const painted = element => !['SCRIPT','STYLE','BR'].includes(element.tagName) &&
    !(element.closest('svg') && !element.closest('foreignObject') && element.tagName.toLowerCase()!=='svg');
  function areaFailures(report) {
    const failures=[],boxes=gridAreas(report),areas=[...report.children].filter(e=>!e.classList.contains('preview-watermark')&&!e.classList.contains('confidential-marks')).map(element=>({element,name:report.ownerDocument.defaultView.getComputedStyle(element).gridArea.split(' / ')[0]}));
    for (const {element,name} of areas) {
      const box=boxes[name];
      if (!box) {failures.push('未取得区域边界');continue;}
      for (const child of [element,...element.querySelectorAll('*')].filter(painted)) {
        if (outside(child.getBoundingClientRect(),box,.5)) failures.push(`${areaLabels[name]}超出版面：${elementLabel(child)}`);
      }
      if (textRects(element).some(rect=>outside(rect,box,.5))) failures.push(`${areaLabels[name]}文字超出版面`);
    }
    for (let i=0;i<areas.length;i++) for(let j=i+1;j<areas.length;j++) {
      if (intersects(areas[i].element.getBoundingClientRect(),areas[j].element.getBoundingClientRect())) failures.push(`${areaLabels[areas[i].name]}与${areaLabels[areas[j].name]}重叠`);
    }
    return [...new Set(failures)];
  }
  function pageFailures(report,{width,height}) {
    const origin=report.getBoundingClientRect(),box={left:origin.left,top:origin.top,right:origin.left+width,bottom:origin.top+height};
    const failures=[];
    for (const e of [report,...report.querySelectorAll('*')].filter(painted)) if (outside(e.getBoundingClientRect(),box,.5)) failures.push('页面内容超出纸张：'+elementLabel(e));
    if (textRects(report).some(r=>outside(r,box,.5))) failures.push('页面文字超出纸张');
    return [...new Set(failures)];
  }
  const orphanSelectors = '.judgment-copy,.problem-copy,.judgment-meta,.verify-copy,.deadline-copy,.round-line,.top-value,.card-copy,.premise-copy,.weakest-line,[data-orphan],[data-max-lines],.axis-explanation,.selection-note,.report-footer,.company-title,textarea';
  function textLines(element) {
    const doc = element.ownerDocument;
    if (element.tagName === 'TEXTAREA') {
      // Range does not expose a textarea's live value. Measure an invisible
      // normal block with the exact width, padding and text style instead.
      const style = doc.defaultView.getComputedStyle(element), mirror = doc.createElement('div');
      for (const key of ['font','lineHeight','letterSpacing','paddingTop','paddingRight','paddingBottom','paddingLeft','textWrap','overflowWrap','wordBreak']) mirror.style[key] = style[key];
      Object.assign(mirror.style,{position:'fixed',left:'0',top:'0',visibility:'hidden',boxSizing:'border-box',width:`${element.clientWidth}px`,whiteSpace:'pre-wrap'});
      mirror.textContent = element.value; doc.body.append(mirror);
      try { return textLines(mirror); } finally { mirror.remove(); }
    }
    const lines = [], walker = doc.createTreeWalker(element, 4);
    for (let node; (node = walker.nextNode());) {
      if (!node.textContent.trim() || (node.parentElement.closest('script,style') || (node.parentElement.closest('svg') && !node.parentElement.closest('foreignObject')))) continue;
      let offset = 0;
      for (const char of node.textContent) {
        const start = offset; offset += char.length;
        if (!char.trim()) continue;
        const range = doc.createRange(); range.setStart(node,start); range.setEnd(node,offset);
        const rect = [...range.getClientRects()].find(r => r.width > 0 && r.height > 0);
        if (!rect) continue;
        let line = lines.find(row => Math.min(row.bottom,rect.bottom)-Math.max(row.top,rect.top) > Math.min(row.height,rect.height)/2);
        if (!line) { line={top:rect.top,bottom:rect.bottom,height:rect.height,glyphs:[]}; lines.push(line); }
        line.glyphs.push({char,node,start,end:offset,left:rect.left});
      }
    }
    return lines.sort((a,b)=>a.top-b.top).map(line=>({...line,text:line.glyphs.sort((a,b)=>a.left-b.left).map(g=>g.char).join('')}));
  }
  function orphanLines(lines) {
    if (lines.length < 2) return false;
    const last = lines[lines.length-1].text;
    const count = (last.match(/\p{Script=Han}/gu)||[]).length;
    // CC 2026-11-03：末行若另有至少三个非中文可见字符（引用号 [n] 不计，如页脚的时间与版本名），不算孤字。
    const other = last.replace(/\[\d+\]/g,'').replace(/\p{Script=Han}/gu,'').trim().length;
    return count > 0 && count <= 2 && other < 3;
  }
  const orphaned = element => orphanLines(textLines(element));
  function findOrphans(root) {
    return [...root.querySelectorAll(orphanSelectors)].filter(orphaned).map(e=>e.className||e.tagName);
  }
  function preventOrphans(root) {
    for (const element of root.querySelectorAll(orphanSelectors)) {
      if (element.tagName === 'TEXTAREA') continue; // Never change free-form input.
      const lines = textLines(element);
      if (!orphanLines(lines)) continue;
      const han = lines.flatMap(line=>line.glyphs).filter(g=>/\p{Script=Han}/u.test(g.char));
      if (han.length < 3) continue;
      // Keep the final three CJK characters and their inline source refs on one
      // line. DOM textContent remains byte-for-byte identical; no hidden glyphs.
      const first = han[han.length-3], range = element.ownerDocument.createRange();
      range.selectNodeContents(element); range.setStart(first.node,first.start);
      const group = element.ownerDocument.createElement('span'); group.className='no-orphan';
      group.append(range.extractContents()); range.insertNode(group);
      // CC 2026-11-03：绑定组若宽过所在元素的 85%（如页脚"审阅 时间 · 版本 文件名"这类长尾），
      // 整体不换行会撑出版面：撤销绑定。这种长尾的末行不会只剩一两个中文字，见 orphanLines。
      if (group.getBoundingClientRect().width > element.getBoundingClientRect().width*0.85) { group.replaceWith(...group.childNodes); element.normalize(); }
    }
  }
  function clearOrphans(root) {
    for (const span of [...root.querySelectorAll('.no-orphan')]) span.replaceWith(...span.childNodes);
    root.normalize();
  }
  const labels = {'top-cell':'概况信息','company-title':'企业名称与行业',brand:'品牌','as-of':'日期','report-item':'条目',stage:'项目阶段','fund-segment':'资金用途','fund-legend-label':'资金用途图例','identity-card':'企业卡片','report-footer':'来源与说明','weakest-line':'最弱关键前提行','preview-watermark':'内部预览水印'};
  function elementLabel(element) {
    if (element.closest('[data-label]')) return element.closest('[data-label]').dataset.label;
    const item=element.closest('.report-item');
    if (item) return `${item.closest('.judgments')?'判断':'问题'}第${item.dataset.number}条`;
    return Object.entries(labels).find(([key])=>element.classList.contains(key))?.[1] || '页面文字';
  }
  function inspect(report, {orphans=true,areas=!!report.ownerDocument.documentElement.dataset.printLayout}={}) {
    const failures = [];
    const selectors = typeSelectors+',.brand,.report-item,.fund-segment';
    for (const element of report.querySelectorAll(selectors)) {
      if (textClipped(element)) failures.push(elementLabel(element));
    }
    const canvas = report.getBoundingClientRect();
    for (const element of report.querySelectorAll('*')) {
      if ((element.closest('svg') && !element.closest('foreignObject')) || ['SCRIPT', 'STYLE', 'BR'].includes(element.tagName)) continue;
      if (outside(element.getBoundingClientRect(), canvas)) failures.push('画布越界：'+elementLabel(element));
      // A clipped descendant can be inside its parent's box yet hide its own text.
      const style = element.ownerDocument.defaultView.getComputedStyle(element);
      if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX) ||
          ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY)) {
        if (textClipped(element)) failures.push('文字裁切');
      }
    }
    if (orphans) failures.push(...[...report.querySelectorAll(orphanSelectors)].filter(orphaned).map(element=>'孤字：'+elementLabel(element)));
    if (areas) failures.push(...areaFailures(report));
    if (report.ownerDocument.documentElement.dataset.printLayout === 'landscape') {
      for (const e of report.querySelectorAll('[data-max-lines]')) {
        if (textLines(e).length > Number(e.dataset.maxLines)) failures.push('请缩短：'+elementLabel(e));
      }
    }
    return [...new Set(failures)];
  }
  return {outside, textRects, textClipped, textLines, orphanLines, orphaned, findOrphans, preventOrphans, clearOrphans, typeSelectors, fitType, resetCapacity, fitLandscapeColumns, intersects, gridAreaBoxes, gridAreas, areaFailures, pageFailures, inspect};
});
