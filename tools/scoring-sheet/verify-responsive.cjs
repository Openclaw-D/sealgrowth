'use strict';
const {pathToFileURL}=require('node:url');
module.exports=async function({browser,file,label,check,attempt,instrument,shot}){
  const sizes=[[320,568],[375,812],[402,874],[874,402],[430,932],[768,1024],[1023,768],[1024,768],[1280,800],[1440,900],[1920,1080]];
  const ctx=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  const page=await ctx.newPage();instrument(page);
  try{
    await page.goto(pathToFileURL(file).href);await page.evaluate(()=>window.reportReady);
    for(const [width,height] of sizes)await attempt(`${label} 响应式 ${width}`,async()=>{
      await page.setViewportSize({width,height});await page.evaluate(()=>window.checkReportLayout());
      const m=await page.evaluate(()=>{
        const report=document.getElementById('report'),columns=[...report.querySelectorAll('.column')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};});
        return {client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,width:innerWidth,scale:visualViewport.scale,viewport:document.querySelector('meta[name="viewport"]').content,
          clips:ReportLayout.inspect(report,{orphans:false,areas:false}),columns,transform:getComputedStyle(report).transform,zoom:getComputedStyle(document.body).zoom,date:ReportLayout.textLines(report.querySelector('.as-of')).length,
          textSize:Math.min(...[...report.querySelectorAll('.judgment-copy,.problem-copy,.verify-copy,.deadline-copy')].map(e=>parseFloat(getComputedStyle(e).fontSize)))};
      });
      check(`${label} ${width}：原生比例无横溢、文字不裁切`,m.width===width&&m.client===m.scroll&&m.scale===1&&!m.clips.length&&m.transform==='none'&&Number(m.zoom)===1&&m.date===1&&m.textSize>=(width<1024?16:18),m);
      check(`${label} ${width}：DOM 同序单列/三列`,m.columns.every((c,i)=>!i||(width<1024?c.top>=m.columns[i-1].bottom:c.left>=m.columns[i-1].right)),m.columns);
      if(width===402)await shot(page,label+'-phone-402x874.png',{fullPage:true});
    });
    await page.setViewportSize({width:402,height:874});await page.evaluate(()=>window.checkReportLayout());
    await page.setViewportSize({width:874,height:402});await page.evaluate(()=>window.checkReportLayout());
    await page.setViewportSize({width:402,height:874});
    check(label+'：旋转后无横溢',await page.evaluate(async()=>{await window.checkReportLayout();return document.documentElement.scrollWidth===402;}));
    const cdp=await ctx.newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:640,height:400,deviceScaleFactor:2,mobile:false,screenWidth:1280,screenHeight:800});
    check(label+'：200%等效重排',await page.evaluate(async()=>{await window.checkReportLayout();return innerWidth===640&&document.documentElement.scrollWidth===640&&!ReportLayout.inspect(document.getElementById('report'),{orphans:false,areas:false}).length;}));
    await cdp.detach();
    const phone=await browser.newContext({viewport:{width:402,height:874},screen:{width:402,height:874},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    try{
      const mobile=await phone.newPage();instrument(mobile);await mobile.goto(pathToFileURL(file).href);await mobile.evaluate(()=>window.reportReady);
      check(label+'：手机环境402×874无横溢',await mobile.evaluate(async()=>{await window.checkReportLayout();return innerWidth===402&&document.documentElement.scrollWidth===402&&visualViewport.scale===1;}));
      await shot(mobile,label+'-mobile-402x874-full.png',{fullPage:true});
    }finally{await phone.close();}
  }finally{await ctx.close();}
};
