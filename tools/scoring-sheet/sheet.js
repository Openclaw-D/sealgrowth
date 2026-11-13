(() => {
  'use strict';
  const LEVELS = [
    {token:'unknown',word:'未知',color:'#6B3FA0',ink:'#FFFFFF'},
    {token:'weak',word:'弱点',color:'#D93025',ink:'#FFFFFF'},
    {token:'normal',word:'正常',color:'#F2C200',ink:'#000000'},
    {token:'strong',word:'优秀',color:'#2E8B3E',ink:'#FFFFFF'},
    {token:'na',word:'不适用',color:'#9AA0A6',ink:'#000000'},
    {token:'hold',word:'暂缓',color:'#1F1F1F',ink:'#FFFFFF'}
  ];
  const id = new URLSearchParams(location.search).get('id') || 'sample-company';
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const $ = selector => document.querySelector(selector);
  const S = SheetState;
  let data, defaults, selectedProblem, busy = false, dirty = false, savedAt = null, toastTimer, saveTimer, savePulse = false;
  const savedTime = () => savedAt ? new Date(savedAt).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit',hour12:false}) : '';
  function status(message, error = false) {
    $('#status').textContent = message;
    $('#status').dataset.error = String(error);
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message; $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 6000);
  }
  function updateActions() {
    const reasons = data ? S.blockedReasons(data, defaults) : ['正在读取资料'];
    $('#save').disabled = busy || !data;
    $('#confirm').disabled = busy || reasons.length > 0;
    $('#confirm').textContent = '确认对外';
    $('#preview').disabled = busy || !data;
    $('#generate-reason').textContent = reasons.join('；');
    $('#generate-reason').hidden = !reasons.length;
    $('#confirm').title = reasons.join('；');
    $('#unsaved-dot').hidden = !dirty;
    $('#save-label').textContent = busy ? '保存中…' : savePulse ? '✓ 已保存' : '保存';
    document.documentElement.dataset.dirty = String(dirty);
  }
  function markDirty() {
    dirty = true;
    $('#confirmation-state').textContent = data.confirmation ? '内容已改，确认失效' : '未确认对外';
    clearTimeout(saveTimer); savePulse = false;
    $('#report-links').replaceChildren();
    status('有未保存的修改');
    updateActions();
  }
  function swatches(kind,index,selected) {
    const choices = LEVELS.filter(x=>kind==='axis'?x.token!=='hold':x.token!=='na');
    return `<div class="swatches" role="group" aria-label="${kind==='axis'?esc(data.axes[index].name):'综合'}">${choices.map((spec,i)=>`<button type="button" class="swatch" data-kind="${kind}" data-index="${index}" data-level="${spec.token}" aria-pressed="${selected===spec.token}" tabindex="${selected===spec.token||selected===null&&i===0?0:-1}" style="--color:${spec.color};--ink:${spec.ink}">${spec.word}</button>`).join('')}</div>`;
  }
  function initScores() {
    $('#axis-rows').innerHTML=data.axes.map((axis,index)=>`<div class="axis-row" data-axis="${index}"><div class="axis-name">${esc(axis.name)}</div><div>${swatches('axis',index,axis.level)}<p class="axis-explanation">${esc(axis.reason)}<span class="changed-marker" hidden>已偏离建议</span></p><p class="axis-explanation">下一步：${esc(axis.next)}</p><div class="public-reason-field"><label>对外理由<textarea class="axis-public" data-axis="${index}" rows="1" maxlength="24" aria-label="${axis.name}对外理由">${esc(axis.public_reason)}</textarea></label><span class="public-count">${S.length(axis.public_reason)}/24</span><label>置信度<select class="confidence" data-axis="${index}" aria-label="${axis.name}置信度">${[['high','高'],['medium','中'],['low','低'],['none','无']].map(([token,word])=>`<option value="${token}" ${axis.confidence===token?'selected':''}>${word}</option>`).join('')}</select></label></div></div></div>`).join('');
    $('#overall-row').innerHTML=`<div class="axis-row overall-row"><div class="axis-name">综合</div><div>${swatches('overall',0,data.overall.level)}<p class="axis-explanation" id="overall-reference"></p><p class="axis-explanation" id="weakest-premise"></p></div></div>`;
    updateScores();
  }
  function updateScores() {
    for(const button of document.querySelectorAll('.swatch')) {
      const selected=button.dataset.kind==='axis'?data.axes[Number(button.dataset.index)].level:data.overall.level;
      const active=selected===button.dataset.level;
      button.setAttribute('aria-pressed',String(active));
      button.disabled=button.dataset.kind==='overall' && (S.blocked(data)?button.dataset.level!=='hold':button.dataset.level==='hold');
      button.tabIndex=active||selected===null&&button.dataset.level==='unknown'?0:-1;
    }
    data.axes.forEach((axis,i)=>{$(`.axis-row[data-axis="${i}"] .changed-marker`).hidden=axis.level===axis.suggested;});
    $('#overall-reference').textContent=`参考：${S.reference(data)}（已评 ${S.assessed(data).length} 维）`;
    const p=S.weakest(data);
    $('#weakest-premise').textContent=p?`最弱关键前提：${p.text}（${S.statuses[p.status]}）`:'至少选择一条关键前提';
  }
  function initReview() {
    $('#gates-editor').innerHTML=[['fraud','造假'],['tech','关键技术不可行'],['cash','现金即将断流'],['integrity','诚信与关联交易']].map(([key,label])=>`<label class="gate-field">${label}<select data-gate="${key}" aria-label="${label}">${[['unchecked','未核查'],['pass','通过'],['block','阻断']].map(([value,word])=>`<option value="${value}" ${data.gates[key]===value?'selected':''}>${word}</option>`).join('')}</select></label>`).join('');
    $('#gates-note').value=data.gates.note;
    $('#premises-editor').innerHTML=data.premises.map((p,i)=>`<div class="premise-editor" data-index="${i}"><b>前提 ${p.id}</b><textarea rows="1" maxlength="40" data-premise="text" aria-label="前提${p.id}正文">${esc(p.text)}</textarea><span class="premise-count">${S.length(p.text)}/40</span><label>状态<select data-premise="status" aria-label="前提${p.id}状态">${Object.entries(S.statuses).map(([key,word])=>`<option value="${key}" ${p.status===key?'selected':''}>${word}</option>`).join('')}</select></label><label><input type="checkbox" data-premise="critical" ${p.critical?'checked':''}>关键</label></div>`).join('');
  }
  function initMatrix() {
    $('#problem-picker').innerHTML = data.problems.map(item => `<button type="button" class="problem-select" data-problem="${item.id}"></button>`).join('');
    $('#matrix-editor').innerHTML = `<div class="edit-y-label">概率 ↑</div><div class="edit-y-ticks"><span>高</span><span>中</span><span>低</span></div><div class="edit-matrix-grid">${[3,2,1].flatMap(likelihood => [1,2,3].map(impact => `<button type="button" class="edit-matrix-cell" data-likelihood="${likelihood}" data-impact="${impact}" aria-label="概率${["","低","中","高"][likelihood]} 影响${["","低","中","高"][impact]}"></button>`)).join('')}</div><div class="edit-x-ticks"><span>低</span><span>中</span><span>高</span></div><div class="edit-x-label">影响 →</div>`;
    updateMatrix(false);
  }
  function updateMatrix(animate = true) {
    const old = new Map([...document.querySelectorAll('.risk-dot')].map(dot => [dot.dataset.id, dot.getBoundingClientRect()]));
    const nums = S.numbers(data.problems);
    const labels = S.labels(data.problems);
    const selected = data.problems.find(item => item.id === selectedProblem);
    for (const item of data.problems) {
      const label = labels.get(item.id);
      const picker = $(`.problem-select[data-problem="${item.id}"]`);
      picker.textContent = `问题 ${label}`; picker.title = item.text;
      picker.setAttribute('aria-pressed', String(selectedProblem===item.id));
      picker.dataset.external = String(item.external);
      picker.dataset.number = item.external ? String(nums.get(item.id)) : '';
      picker.dataset.label = label;
      const cell = $(`.edit-matrix-cell[data-likelihood="${item.likelihood}"][data-impact="${item.impact}"]`);
      let dot = $(`.risk-dot[data-id="${item.id}"]`);
      if (!dot) { dot = document.createElement('span'); dot.className = 'risk-dot'; dot.dataset.id = item.id; }
      dot.getAnimations().forEach(animation => animation.cancel());
      dot.textContent = label; dot.dataset.external = String(item.external);
      dot.dataset.label = label;
      dot.dataset.number = item.external ? String(nums.get(item.id)) : '';
      dot.dataset.selected = String(selectedProblem===item.id);
      cell.append(dot);
    }
    // First/Last/Invert/Play: move the same chip nodes and animate their displacement.
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const dot of document.querySelectorAll('.risk-dot')) {
        const first = old.get(dot.dataset.id), last = dot.getBoundingClientRect();
        if (first && (Math.abs(first.left-last.left)>.5 || Math.abs(first.top-last.top)>.5)) {
          dot.animate([{transform:`translate(${first.left-last.left}px, ${first.top-last.top}px)`},{transform:'translate(0, 0)'}], {duration:250,easing:'cubic-bezier(0.25, 0.1, 0.25, 1)'});
        }
      }
    }
    $('#matrix-hint').textContent = `已选问题 ${labels.get(selected.id)}，点格子移动`;
    $('#matrix-hint').dataset.label = labels.get(selected.id);
  }
  function textField(key,item,index,field) {
    const label=key==='judgments'?'判断':'问题';
    const titles={text:'内容',verify:'验证方式',by:'期限',pass:'通过线'},limits={text:100,verify:22,by:6,pass:12};
    return `<label class="short-field">${titles[field]}<textarea class="item-input" rows="1" data-field="${field}" maxlength="${limits[field]}" aria-label="${label}${index+1}${titles[field]}">${esc(item[field])}</textarea><span class="length-hint"><span class="${field}-length">${S.length(item[field])}</span>/${limits[field]}</span></label>`;
  }
  function initItems() {
    for (const key of ['judgments','problems']) {
      $(`#${key}-editor`).innerHTML = data[key].map((item,index) => `<div class="editable-item" data-list="${key}" data-id="${item.id}"><div class="item-toggle-row"><b class="item-display-number"></b><label class="external-toggle"><input type="checkbox" role="switch" data-field="external" ${item.external?'checked':''} aria-label="${key==='judgments'?'判断':'问题'}${index+1}对外">对外</label></div>${textField(key,item,index,'text')}${key==='problems'?`<div class="verify-field"><span class="verify-label">验证</span><div>${textField(key,item,index,'verify')}</div></div><div class="problem-deadline">${textField(key,item,index,'by')}${textField(key,item,index,'pass')}</div>`:''}</div>`).join('');
    }
    updateCounters();
  }
  function autoHeight(input) {
    input.style.height = 'auto'; input.style.height = `${input.scrollHeight + 2}px`;
  }
  function fitTextareas() { document.querySelectorAll('textarea').forEach(autoHeight); }
  function updateCounters() {
    for (const key of ['judgments','problems']) {
      const nums = S.numbers(data[key]), count = nums.size, labels = S.labels(data[key]);
      const element = $(`#${key}-count`);
      element.textContent = `对外 ${count} / 3–5${count<3||count>5?' · 需调整':''}`;
      element.dataset.valid = String(count>=3 && count<=5);
      for (const item of data[key]) {
        const block = $(`#${key}-editor .editable-item[data-id="${item.id}"]`);
        block.querySelector('.item-display-number').textContent = labels.get(item.id);
        block.dataset.label = labels.get(item.id);
        for (const control of block.querySelectorAll('[data-field]')) {
          const kind = control.dataset.field;
          control.setAttribute('aria-label', `${key==='judgments'?'判断':'问题'} ${labels.get(item.id)}${kind==='external'?'对外':(({verify:'验证方式',by:'期限',pass:'通过线'})[kind]||'内容')}`);
        }
        block.dataset.number = item.external ? String(nums.get(item.id)) : '';
      }
    }
    updateActions();
  }
  function renderFinance() {
    for (const field of ['amount','valuation','dilution']) {
      const input = $(`#round-${field}`);
      input.value = data.company.round[field]; input.placeholder = `默认：${defaults[field]}`; autoHeight(input);
    }
  }
  function chooseSwatch(button) {
    if (busy || button.disabled) return;
    if (button.dataset.kind === 'axis') data.axes[Number(button.dataset.index)].level = button.dataset.level;
    else data.overall.level = button.dataset.level;
    updateScores(); markDirty();
  }
  for (const selector of ['#axis-rows','#overall-row']) {
    $(selector).addEventListener('click', event => {
      const button = event.target.closest('.swatch');
      if (button) chooseSwatch(button);
    });
    $(selector).addEventListener('keydown', event => {
      const button = event.target.closest('.swatch');
      if (!button || busy || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const row = [...button.parentElement.querySelectorAll('.swatch:not(:disabled)')], i = row.indexOf(button);
      const next = event.key==='Home'?0:event.key==='End'?row.length-1:(i+(['ArrowLeft','ArrowUp'].includes(event.key)?row.length-1:1))%row.length;
      row[next].focus(); chooseSwatch(row[next]);
    });
  }
  $('#problem-picker').addEventListener('click', event => {
    const button = event.target.closest('.problem-select');
    if (!button || busy) return;
    selectedProblem = Number(button.dataset.problem); updateMatrix(false);
  });
  $('#matrix-editor').addEventListener('click', event => {
    const cell = event.target.closest('.edit-matrix-cell');
    if (!cell || busy) return;
    const item = data.problems.find(item => item.id === selectedProblem);
    item.likelihood = Number(cell.dataset.likelihood); item.impact = Number(cell.dataset.impact);
    updateMatrix(); markDirty();
  });
  for (const key of ['judgments','problems']) {
    $(`#${key}-editor`).addEventListener('input', event => {
      const field = event.target.dataset.field;
      if (!field || busy) return;
      const block = event.target.closest('.editable-item');
      const item = data[key].find(item => item.id === Number(block.dataset.id));
      item[field] = field === 'external' ? event.target.checked : event.target.value;
      if (['text','verify','by','pass'].includes(field)) {
        block.querySelector(`.${field}-length`).textContent = String(S.length(item[field])); autoHeight(event.target);
      }
      markDirty(); updateCounters();
      if (field === 'external' || (key === 'problems' && field === 'text')) updateMatrix();
    });
    $(`#${key}-editor`).addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target.matches('input[role="switch"]') && !busy) { event.preventDefault(); event.target.click(); }
    });
  }
  for (const field of ['amount','valuation','dilution']) {
    $(`#round-${field}`).addEventListener('input', event => {
      if (busy) return;
      data.company.round[field] = event.target.value; autoHeight(event.target); markDirty();
    });
  }
  $('#axis-rows').addEventListener('input',event=>{
    if(busy)return;
    const i=Number(event.target.dataset.axis);
    if(event.target.matches('.axis-public')){data.axes[i].public_reason=event.target.value;event.target.closest('.public-reason-field').querySelector('.public-count').textContent=S.length(event.target.value)+'/24';autoHeight(event.target);markDirty();}
    if(event.target.matches('.confidence')){data.axes[i].confidence=event.target.value;markDirty();}
  });
  $('#gates-editor').addEventListener('change',event=>{if(!busy&&event.target.dataset.gate){S.setGate(data,event.target.dataset.gate,event.target.value);updateScores();markDirty();}});
  $('#gates-note').addEventListener('input',event=>{if(!busy){data.gates.note=event.target.value;autoHeight(event.target);markDirty();}});
  $('#premises-editor').addEventListener('input',event=>{
    const field=event.target.dataset.premise;if(!field||busy)return;
    const block=event.target.closest('.premise-editor'),p=data.premises[Number(block.dataset.index)];
    p[field]=field==='critical'?event.target.checked:event.target.value;
    if(field==='text'){autoHeight(event.target);block.querySelector('.premise-count').textContent=S.length(p.text)+'/40';}
    updateScores();markDirty();
  });
  function showLinks(files,preview=false){
    $('#report-links').replaceChildren();
    for(const [audience,links] of Object.entries(files||{}))for(const [key,label] of [['html','HTML'],['landscape_pdf','横版 PDF'],['portrait_pdf','竖版 PDF']]){
      if(!links[key])continue;const link=document.createElement('a');link.href=links[key];
      link.textContent=`${audience==='founder'?'创始人':'投资人'}${preview?'预览':''} ${label}`;
      link.target='_blank';link.rel='noopener';if(key.endsWith('_pdf'))link.download='';$('#report-links').append(link);
    }
  }
  function confirmationStatus(confirmation,invalidated=false){
    $('#confirmation-state').textContent=invalidated?'内容已改，确认失效':confirmation?`已确认对外 ${confirmation.at} · 版本 ${confirmation.version}`:'未确认对外';
  }
  async function persist(action='save'){
    if(busy||!data||(action==='confirm'&&S.blockedReasons(data).length))return;
    busy=true;updateActions();$('#editor').inert=true;$('#report-links').replaceChildren();
    try{
      const response=await fetch(`/api/${action}?id=${encodeURIComponent(id)}`,{method:'POST',headers:{'Content-Type':'application/json','X-Judge-Local':'1'},body:JSON.stringify(S.normalized(data,defaults)),cache:'no-store'});
      const payload=await response.json();
      // All three operations save first. Reload the canonical copy even if the
      // subsequent validation/build failed, so echoed immutable metadata is fresh.
      const reload=await fetch(`/api/sheet?id=${encodeURIComponent(id)}`,{cache:'no-store'});
      const current=await reload.json();
      if(reload.ok&&(response.ok||(current.data._saved_at||null)!==savedAt)){data=current.data;defaults=current.defaults;savedAt=data._saved_at||null;dirty=false;updateScores();renderFinance();confirmationStatus(current.confirmation,payload.invalidated||action!=='save'&&!current.confirmation&&$('#confirmation-state').textContent.includes('失效'));}
      if(!response.ok||!payload.ok)throw new Error((payload.errors||[payload.error||'本机保存失败']).join('；'));
      savePulse=true;clearTimeout(saveTimer);status(payload.message||`已保存 ${savedTime()}`);
      confirmationStatus(action==='confirm'?payload.confirmation:current.confirmation,payload.invalidated);
      showLinks(payload.files||(current.confirmation?current.outputs:{}),action==='preview');
      if(payload.skipped?.length||payload.warnings?.length)toast([...(payload.skipped||[]).map(x=>x.reason),...(payload.warnings||[])].join('；'));
    }catch(error){status(dirty?'有未保存的修改':savedAt?`已保存 ${savedTime()}`:'尚未保存',true);toast(error.message);}
    finally{busy=false;$('#editor').inert=false;updateActions();if(savePulse)saveTimer=setTimeout(()=>{savePulse=false;updateActions();},1200);}
  }
  $('#save').addEventListener('click',()=>persist('save'));
  $('#confirm').addEventListener('click',()=>persist('confirm'));
  $('#preview').addEventListener('click',()=>persist('preview'));
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); persist('save'); }
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('resize', fitTextareas);
  async function start() {
    if (!/^[a-z0-9-]{1,64}$/.test(id)) throw new Error('企业 id 格式无效');
    const response = await fetch(`/api/sheet?id=${encodeURIComponent(id)}`, {cache:'no-store'});
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '无法读取本机资料');
    data = S.normalized(payload.data, payload.defaults); defaults = payload.defaults; selectedProblem = data.problems[0].id;
    savedAt = data._saved_at || null;
    $('#company-name').textContent = `${data.company.name} · ${data.company.sector}`;
    initScores(); initReview(); initMatrix(); initItems(); renderFinance();
    confirmationStatus(payload.confirmation);showLinks(payload.confirmation?payload.outputs:{}); $('#editor').hidden = false;
    await document.fonts.ready; fitTextareas(); updateActions();
    ReportLayout.preventOrphans($('#editor'));
    status((payload.loaded_from==='sheet'?'已载入打分表':'已载入建议稿')+(savedAt?` · 已保存 ${savedTime()}`:'，尚未保存'));
    document.documentElement.dataset.sheetReady = 'true';
  }
  start().catch(error => { status(error.message, true); toast(error.message); });
})();
