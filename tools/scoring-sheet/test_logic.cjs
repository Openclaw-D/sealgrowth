'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Layout = require('./layout.js');
const S = require('./sheet-model.js');
const fixture = () => JSON.parse(fs.readFileSync(path.join(__dirname,'test-fixtures/fixture-five.json'),'utf8'));
let count = 0;
function test(name, fn) { fn(); count++; }
for (const sample of JSON.parse(fs.readFileSync(path.join(__dirname,'test-fixtures/layout-rects.json'),'utf8'))) {
  test(`B1 ${sample.name}`, () => {
    assert.equal(Layout.outside(sample.text, sample.box), sample.clipped);
    // Exercise the actual Range consumer; deliberately misleading scrollHeight must not affect it.
    let next = true;
    const node = {textContent:'Synthetic text',parentElement:{closest:()=>null}};
    const element = {getBoundingClientRect:()=>sample.box, scrollHeight:999, clientHeight:40,
      ownerDocument:{createTreeWalker:()=>({nextNode:()=>{if(next){next=false;return node;}return null;}}),
        createRange:()=>({selectNodeContents:()=>{},getClientRects:()=>[sample.text]})}};
    assert.equal(Layout.textClipped(element), sample.clipped);
  });
}
test('V3 reference ignores unknown/na and never fills null overall',()=>{
  const data=fixture();data.axes.forEach((a,i)=>a.level=['weak','normal','strong','unknown','na','na'][i]);
  assert.equal(S.reference(data),'正常');data.overall.level=null;assert.equal(data.overall.level,null);
  data.axes[0].level='unknown';assert.equal(S.reference(data),'资料不足');assert.equal(S.insufficient(data),true);
});
test('H3 external numbers ignore internal gaps and update immediately', () => {
  const data=fixture();data.problems[1].external=false;
  assert.deepEqual([...S.numbers(data.problems)],[[11,1],[33,2],[44,3],[55,4]]);
  data.problems[0].external=false;
  assert.deepEqual([...S.numbers(data.problems)],[[33,1],[44,2],[55,3]]);
  assert.equal(S.blockedReasons(data,data.company.round).length,0);
  data.problems[2].external=false;
  assert.ok(S.blockedReasons(data,data.company.round).includes('问题需选 3–5 条（当前 2 条）'));
});
test('H3 finance blanks use draft defaults without mutating editing state', () => {
  const data=fixture(),defaults={...data.company.round};
  data.company.round.amount='';data.company.round.valuation=' ';data.company.round.dilution='';
  const normalized=S.normalized(data,defaults);
  assert.deepEqual(normalized.company.round,defaults);assert.equal(data.company.round.amount,'');
  assert.deepEqual(S.normalized(normalized,defaults),normalized);
});
test('L6 live validation blocks empty fields but permits decimal free text', () => {
  const data=fixture(),defaults={...data.company.round};
  data.judgments[0].text='';assert.ok(S.blockedReasons(data,defaults).includes('判断内容不能为空'));
  data.judgments[0].external=false;assert.ok(!S.blockedReasons(data,defaults).includes('判断内容不能为空'));
  data.company.round.amount='合成估值 7.3 示例单位';data.problems[0].text='合成尺寸 2.6 mm，虚构日期 2026.11';
  assert.deepEqual(S.blockedReasons(data,defaults),[]);
  assert.equal(S.normalized(data,defaults).problems[0].text,'合成尺寸 2.6 mm，虚构日期 2026.11');
});
test('L1 every selection pattern has unique labels and continuous independent sequences', () => {
  for(let mask=0;mask<32;mask++) {
    const items=fixture().problems;items.forEach((item,i)=>{item.external=!!(mask&(1<<i));});
    const labels=S.labels(items), all=[...labels.values()];
    assert.equal(new Set(all).size,items.length);
    assert.deepEqual(items.filter(x=>x.external).map(x=>labels.get(x.id)),items.filter(x=>x.external).map((_,i)=>String(i+1)));
    assert.deepEqual(items.filter(x=>!x.external).map(x=>labels.get(x.id)),items.filter(x=>!x.external).map((_,i)=>`内${i+1}`));
  }
});
test('V1 final line with one or two CJK characters fails, three passes', () => {
  assert.equal(Layout.orphanLines([{text:'甲乙丙丁'},{text:'印证'}]),true);
  assert.equal(Layout.orphanLines([{text:'甲乙丙丁'},{text:'证 [2]'}]),true);
  assert.equal(Layout.orphanLines([{text:'甲乙丙丁'},{text:'产业印证'}]),false);
  assert.equal(Layout.orphanLines([{text:'印证'}]),false);
  assert.equal(Layout.orphanLines([{text:'甲乙丙丁'},{text:'1.5 nm'}]),false);
});
// FIX4: the grid boundary is independent of a child's own text box.
test('A3 overlap tolerance is at most half a pixel in both dimensions',()=>{
  const a={left:0,top:0,right:100,bottom:40};
  assert.equal(Layout.intersects(a,{left:99.5,top:0,right:200,bottom:40}),false);
  assert.equal(Layout.intersects(a,{left:99.49,top:0,right:200,bottom:40}),true);
  assert.equal(Layout.intersects(a,{left:0,top:39.49,right:100,bottom:80}),true);
  assert.equal(Layout.intersects(a,{left:0,top:40,right:100,bottom:80}),false);
});
test('A3 computes grid areas including spans, gaps, padding origin and portrait scale',()=>{
  const boxes=Layout.gridAreaBoxes({rows:[['header','header'],['judgments','enterprise'],['judgments','cards']],columnSizes:[100,200],rowSizes:[40,200,80],columnGap:16,rowGap:8,left:24,top:16,scale:2});
  assert.deepEqual(boxes.header,{left:24,top:16,right:656,bottom:96,width:632,height:80});
  assert.deepEqual(boxes.judgments,{left:24,top:112,right:224,bottom:688,width:200,height:576});
  assert.equal(boxes.enterprise.bottom+16,boxes.cards.top);
  assert.equal(Layout.outside({left:24,top:112,right:224,bottom:689,width:200,height:577},boxes.judgments,.5),true);
});
test('A3 actual area inspector rejects contained text with escaping area geometry',()=>{
  const rect=(x,y,w,h)=>({left:x,top:y,right:x+w,bottom:y+h,width:w,height:h});
  const doc={documentElement:{dataset:{printLayout:'portrait'}},createTreeWalker:()=>({nextNode:()=>null})};
  const node=(name,b)=>({tagName:'SECTION',name,b,dataset:{},ownerDocument:doc,style:{},classList:{contains:()=>false},closest:()=>null,getBoundingClientRect(){return this.b;},querySelectorAll:()=>[]});
  const report=node('report',rect(0,0,100,100));report.offsetWidth=100;
  const header=node('header',rect(0,0,100,40)),cards=node('cards',rect(0,50,100,50));report.children=[header,cards];
  const child=node('child',rect(0,0,100,40));header.querySelectorAll=()=>[child];report.querySelectorAll=()=>[header,child,cards];
  doc.defaultView={getComputedStyle:e=>e===report?{gridTemplateAreas:'"header" "cards"',gridTemplateColumns:'100px',gridTemplateRows:'40px 50px',rowGap:'10px',columnGap:'0px',paddingLeft:'0px',paddingTop:'0px',borderLeftWidth:'0px',borderTopWidth:'0px'}:{gridArea:e.name}};
  assert.deepEqual(Layout.areaFailures(report),[]);
  child.b=rect(0,0,100,55);
  assert.equal(Layout.textClipped(child),false);
  assert.ok(Layout.areaFailures(report).some(s=>s.includes('页头超出版面')));
  child.b=rect(0,0,100,40);header.b=rect(0,0,100,55);
  assert.ok(Layout.areaFailures(report).some(s=>s.includes('重叠')));
  assert.ok(Layout.pageFailures(report,{width:100,height:99}).length>0);
});


test('V3 block sets hold; removing last block clears overall',()=>{
  const d=fixture();S.setGate(d,'fraud','block');assert.equal(d.overall.level,'hold');
  S.setGate(d,'cash','block');S.setGate(d,'fraud','pass');assert.equal(d.overall.level,'hold');
  S.setGate(d,'cash','unchecked');assert.equal(d.overall.level,null);assert.ok(S.blockedReasons(d).some(s=>s.includes('未定档')));
});
test('V3 weakest critical premise and pending checks',()=>{
  const d=fixture();d.premises[0].status='false';assert.equal(S.weakest(d).status,'false');
  d.premises[0].critical=false;assert.equal(S.weakest(d).status,'unverified');
  d.axes[0].public_reason='待填';assert.ok(S.blockedReasons(d).some(s=>s.includes('待填')));
});
test('V3 public fields enforce limits and external requirement',()=>{
  for(const [key,n] of [['verify',22],['by',6],['pass',12]]){
    const d=fixture();d.problems[0][key]='字'.repeat(n);assert.deepEqual(S.blockedReasons(d),[]);
    d.problems[0][key]+='字';assert.ok(S.blockedReasons(d).length);
    d.problems[0][key]='';assert.ok(S.blockedReasons(d).length);
    d.problems[0].external=false;assert.deepEqual(S.blockedReasons(d),[]);
  }
  const d=fixture();d.axes[0].public_reason='字'.repeat(25);assert.ok(S.blockedReasons(d).length);
});
test('V3 insufficient uses both card prefixes and hold takes priority',()=>{
  const d=fixture();d.card.founder='待确认创始人';d.card.team='待确认团队';assert.equal(S.insufficient(d),true);
  S.setGate(d,'tech','block');assert.equal(d.overall.level,'hold');assert.deepEqual(S.blockedReasons(d),[]);
});
console.log(`Node geometry/state: ${count} tests passed`);
