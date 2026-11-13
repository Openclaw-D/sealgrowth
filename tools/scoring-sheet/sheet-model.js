/* Offline-testable V3 state rules. Only the server can attest a confirmation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SheetState=api;})(globalThis,function(){
  'use strict';
  const levels={unknown:'未知',weak:'弱点',normal:'正常',strong:'优秀',na:'不适用',hold:'暂缓'};
  const statuses={false:'不成立',unverified:'未核实',partial:'部分核实',verified:'已核实'};
  const gates=['fraud','tech','cash','integrity'];
  const assessed=data=>data.axes.filter(a=>['weak','normal','strong'].includes(a.level));
  const blocked=data=>gates.some(k=>data.gates[k]==='block');
  const reference=data=>{const a=assessed(data);return a.length<3?'资料不足':['弱点','正常','优秀'][Math.floor(a.reduce((s,x)=>s+['weak','normal','strong'].indexOf(x.level)+1,0)/a.length+.5)-1];};
  const insufficient=data=>assessed(data).length<3||['founder','team'].every(k=>data.card[k].startsWith('待确认'));
  const weakest=data=>data.premises.filter(p=>p.critical).reduce((a,b)=>!a||Object.keys(statuses).indexOf(b.status)<Object.keys(statuses).indexOf(a.status)?b:a,null);
  function setGate(data,key,value){const was=blocked(data);data.gates[key]=value;if(blocked(data))data.overall.level='hold';else if(was)data.overall.level=null;}
  const numbers=items=>new Map(items.filter(x=>x.external).map((x,i)=>[x.id,i+1]));
  function labels(items){let outside=0,inside=0;return new Map(items.map(x=>[x.id,x.external?String(++outside):`内${++inside}`]));}
  const length=text=>Array.from(text).length;
  function normalized(data,defaults){const d=JSON.parse(JSON.stringify(data));for(const k of ['amount','valuation','dilution'])d.company.round[k]=d.company.round[k].trim()||defaults[k];return d;}
  function pending(value){if(typeof value==='string')return value.includes('待填');if(Array.isArray(value))return value.some(pending);if(value&&typeof value==='object')return Object.entries(value).some(([k,v])=>!['confirmation','_saved_at'].includes(k)&&pending(v));return false;}
  function blockedReasons(data){
    const errors=[];
    if(data.meta.version!=='V3')errors.push('版本必须是 V3');
    if(!['unknown','weak','normal','strong','hold'].includes(data.overall.level))errors.push('综合未定档，请选择档位');
    if(blocked(data)!==(data.overall.level==='hold'))errors.push('关卡阻断与综合暂缓必须一致');
    for(const key of gates)if(!['unchecked','pass','block'].includes(data.gates[key]))errors.push('关卡状态无效');
    if(length(data.gates.note)>200)errors.push('关卡备注最多200字');
    if(data.axes.length!==6)errors.push('须有六个维度');
    for(const a of data.axes){
      if(!['unknown','weak','normal','strong','na'].includes(a.level))errors.push(a.name+'档位无效');
      if(!a.public_reason.trim()||length(a.public_reason)>24)errors.push(a.name+'对外理由需1–24字');
      if(['unknown','weak'].includes(a.level)&&!a.next.trim())errors.push(a.name+'下一步待补齐');
      if(!['high','medium','low','none'].includes(a.confidence))errors.push(a.name+'置信度无效');
    }
    if(data.premises.length<2||data.premises.length>5||!data.premises.some(p=>p.critical))errors.push('须有2–5条前提且至少一条关键前提');
    for(const p of data.premises){if(!p.text.trim()||length(p.text)>40)errors.push('前提正文需1–40字');if(!(p.status in statuses))errors.push('前提状态无效');}
    for(const [key,label] of [['judgments','判断'],['problems','问题']]){
      const items=data[key].filter(x=>x.external);
      if(items.length<3||items.length>5)errors.push(`${label}需选 3–5 条（当前 ${items.length} 条）`);
      for(const item of items){
        for(const [field,title,limit] of [['text','内容',100],...(key==='problems'?[['verify','验证方式',22],['by','期限',6],['pass','通过线',12]]:[])]){
          if(!item[field].trim())errors.push(label+title+'不能为空');
          if(length(item[field])>limit)errors.push(label+title+`最多${limit}字`);
        }
      }
    }
    if(insufficient(data)&&data.analysis.requests.slice(0,8).some(x=>length(x)>30))errors.push('资料不足时前8条索证各最多30字');
    if(pending(data))errors.push('含待填字段，请补齐后再确认');
    return [...new Set(errors)];
  }
  return {levels,statuses,gates,assessed,reference,insufficient,weakest,blocked,setGate,numbers,labels,length,normalized,blockedReasons};
});
