/* This template contains only facts, verification questions and critical premises. */
const ReportAudience = (() => {
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const words = {verified:'已核实',partial:'部分核实',unverified:'未核实',false:'不成立'};
  function top(data) {
    return `<div class="top-cell top-founder"><b class="top-key">创始人</b><span class="top-value">${esc(data.card.founder)}</span></div>`;
  }
  function columns(data, refs, problems) {
    return `<section class="column enterprise-column"><h2>企业与前提</h2><div class="enterprise-card">
      ${[['创始人','founder'],['团队','team'],['愿景','vision']].map(([label,key])=>`<div class="identity-card"><b>${label}</b><span class="card-copy" data-fit>${esc(data.card[key])}${key==='vision'?` <span class="source-refs">[${esc(data.card.vision_source)}]</span>`:''}</span></div>`).join('')}</div>
      <div class="premises-block"><h3>关键前提</h3><ol class="premise-list">${data.premises.map((p,i)=>`<li class="premise-copy" data-fit data-label="关键前提第${i+1}条">${esc(p.text)} <span class="premise-status">（${words[p.status]}）</span>${refs(p.sources)}</li>`).join('')}</ol></div>
      </section><section class="column problems-column"><h2>问题与验证</h2>${problems}</section>`;
  }
  return {label:'投资人版',judgments:'判断',top,before:()=>'',columns,fit:()=>{}};
})();
