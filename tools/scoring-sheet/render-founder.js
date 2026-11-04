/* Loaded only into the founder template. No numeric levels in the payload. */
const ReportAudience = (() => {
  const levels = JSON.parse(document.getElementById('level-data').textContent);
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const words = {verified:'已核实',partial:'部分核实',unverified:'未核实',false:'不成立'};
  const chip = (level, text='') => `<span class="level-chip" data-rating="${level}" style="background:${levels[level].color};color:${levels[level].ink}" data-fit>${esc(text || levels[level].word)}</span>`;
  function top(data) {
    const token = data.overall.rating;
    return `<div class="top-cell top-overall"><b class="top-key">综合</b>${token===null?'<span class="muted">未定档</span>':token==='insufficient'?'<span class="muted">资料不足</span>':chip(token)}</div>`;
  }
  function before(data, refs) {
    const p = data.weakest;
    return `<p class="weakest-line" data-fit>最弱关键前提：${esc(p.text)}（${words[p.status]}）${refs(p.sources)}</p>`;
  }
  function columns(data, refs, problems) {
    let right;
    if (data.requests) {
      right = `<h2>索证清单</h2><ol class="request-list">${data.requests.map((text,i)=>`<li data-orphan data-label="索证第${i+1}条" data-fit>${esc(text)}</li>`).join('')}</ol>`;
    } else {
      const tokens = ['unknown','weak','normal','strong',...(data.axes.some(a=>a.level==='na')?['na']:[])];
      right = `<div class="column-heading"><h2>六维</h2><div class="legend-block"><div class="level-legend" aria-label="档位图例">${tokens.map(t=>chip(t)).join('')}</div><span class="legend-note" data-fit>未知＝尚未证明，不计入</span></div></div>
        <div class="radar-shell"></div><div class="axis-reasons">${data.axes.map(a=>`<p class="axis-reason" data-max-lines="2" data-fit data-label="${a.name}对外理由">${chip(a.level,a.name+'·'+levels[a.level].word)} <span>${esc(a.public_reason)}</span></p>`).join('')}</div>`;
    }
    return `<section class="column problems-column"><h2>下一步要证明什么</h2>${problems}</section><section class="column auxiliary-column">${right}</section>`;
  }
  function fit(report, data) {
    const shell = report.querySelector('.radar-shell');
    if (!shell) return;
    const win = report.ownerDocument.defaultView, root = document.documentElement;
    const factor = root.dataset.printLayout === 'portrait' ? 1080/430 : 1;
    const width = shell.getBoundingClientRect().width / factor;
    const column = shell.parentElement, heading = column.querySelector('.column-heading'), reasons = column.querySelector('.axis-reasons');
    const three = getComputedStyle(report).gridTemplateColumns.split(' ').length === 3;
    const available = column.getBoundingClientRect().height / factor - heading.getBoundingClientRect().height / factor - reasons.getBoundingClientRect().height / factor - 16;
    const large = three && (root.dataset.printLayout === 'landscape' || report.getBoundingClientRect().width >= 1900);
    const labelSize = large ? 24 : 18;
    const margin = labelSize * 4 + 12;
    const widthRadius = Math.max(60,(width - (margin+8)*2)/Math.sqrt(3));
    const radius = large ? Math.max(110,Math.min(widthRadius,(available-64)/2)) : Math.min(120,widthRadius);
    const height = radius*2+64, cx = width/2, cy = height/2;
    const point = (i, f) => {const a=(-90+i*60)*Math.PI/180;return [cx+Math.cos(a)*radius*f,cy+Math.sin(a)*radius*f];};
    const coords = pts => pts.map(p=>p.map(x=>x.toFixed(3)).join(',')).join(' ');
    const scale = {weak:1/3,normal:2/3,strong:1};
    const assessed = data.axes.map((a,i)=>({a,i,p:point(i,scale[a.level]??1)})).filter(x=>x.a.level in scale);
    const description = data.axes.map(a=>a.name+'：'+levels[a.level].word).join('；');
    shell.innerHTML = `<svg class="radar-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="六维，三层网格。${esc(description)}" data-radius="${radius}">
      <title>${esc(description)}</title>${[1/3,2/3,1].map(f=>`<polygon class="radar-grid" points="${coords(data.axes.map((_,i)=>point(i,f)))}"/>`).join('')}
      ${data.axes.map((_,i)=>{const p=point(i,1);return `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}"/>`;}).join('')}
      ${assessed.length>=3?`<polygon class="radar-polygon" points="${coords(assessed.map(x=>x.p))}"/>`:''}
      ${data.axes.map((a,i)=>{const known=a.level in scale,p=point(i,scale[a.level]??1);return `<rect class="${known?'radar-dot':'radar-empty'}" data-axis="${i}" data-rating="${a.level}" x="${p[0]-5}" y="${p[1]-5}" width="10" height="10" fill="${known?levels[a.level].color:'white'}"/>`;}).join('')}
      ${data.axes.map((a,i)=>{const p=point(i,1);let x=p[0]-margin/2,y=p[1]-labelSize*.7;if(i===0)y=0;if(i===3)y=height-32;if(i===1||i===2)x=p[0]+8;if(i===4||i===5)x=p[0]-margin-8;return `<foreignObject x="${x}" y="${y}" width="${margin}" height="32"><div xmlns="http://www.w3.org/1999/xhtml" class="radar-label" data-fit style="font-size:${labelSize}px">${a.name}</div></foreignObject>`;}).join('')}</svg>`;
  }
  return {label:'创始人版',judgments:'优势',top,before,columns,fit};
})();
