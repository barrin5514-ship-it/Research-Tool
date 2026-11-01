import {referenceRecorderScript} from './reference-recorder.mjs';
import {setTimeout as delay} from 'node:timers/promises';
import {collectSaved,syncWarning} from './saved-sync.mjs';
/** Read-only Saved grid: never opens a post, clicks controls, downloads or extracts credentials. */
export async function readSavedPage({browserPath,profile,known,active,startBrowser,wait=delay,collection,limit=30,postUrl,captureVideo=false,captureThumbnail=false,captureImages=false}){
 const browser=await startBrowser({browserPath,profileDir:profile,args:[`--user-data-dir=${profile}`,'--headless=new','--no-first-run','--no-default-browser-check','--disable-sync','--autoplay-policy=user-gesture-required','about:blank']});
 let remove=()=>{};try{let blocked=false;const cdp=browser.cdp;const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});const page=(method,params={})=>Promise.race([cdp.send(method,params,sessionId),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Saved page timed out.')),15000);timer.unref();})]);const evalPage=async expression=>{const r=await page('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error('Saved page could not be read.');return r.result?.value;};
 await page('Page.enable');await page('Network.enable');await page('Browser.setDownloadBehavior',{behavior:'deny'});const imageBodies=new Map();remove=cdp.on(e=>{if(e.sessionId===sessionId&&e.method==='Network.responseReceived'&&[401,403,429].includes(e.params.response.status)&&/^https:\/\/(?:[^/]+\.)?instagram\.com\//.test(e.params.response.url)){blocked=true;if(captureVideo)cdp.send('Runtime.evaluate',{expression:"window.dispatchEvent(new Event('research-handoff-stop'))"},sessionId).catch(()=>{});}if(captureImages&&e.sessionId===sessionId&&e.method==='Network.responseReceived'&&e.params.type==='Image'&&/cdninstagram|fbcdn/i.test(e.params.response.url)){const requestId=e.params.requestId;cdp.send('Network.getResponseBody',{requestId},sessionId).then(body=>{const value=body?.body??body?.result?.body;if(value)imageBodies.set(e.params.response.url,Buffer.from(value,body?.base64Encoded||body?.result?.base64Encoded?'base64':'utf8'));}).catch(()=>{});}});
 await page('Page.navigate',{url:postUrl||'https://www.instagram.com/'});await wait(4500);let warning=await evalPage(`({path:location.pathname,text:document.body?.innerText||'',password:!!document.querySelector('input[type=password]'),captcha:!!document.querySelector('iframe[src*=captcha]'),alert:!!document.querySelector('[role=alert]')?.textContent?.trim(),dialog:!!document.querySelector('[role=dialog]')?.textContent?.trim()})`);if(syncWarning({...warning,blocked}))throw Object.assign(Error('Instagram access check.'),{safetyStop:true});
 if(postUrl){const metadata=await evalPage(`(()=>{const caption=document.querySelector('main article h1')?.textContent?.trim()||document.querySelector('meta[property="og:description"]')?.content||'';const labels=Array.from(document.querySelectorAll('main [aria-label]')).map(e=>e.getAttribute('aria-label')||'').join(' ');const countMatches=Array.from(labels.matchAll(/(?:slide|photo|image)\\s+\\d+\\s+(?:of|\\/)\\s*(\\d+)/gi));let mediaCount=countMatches.length?Math.max(...countMatches.map(m=>Number(m[1]))):null;const hasVideo=!!document.querySelector('main video');if(!mediaCount&&hasVideo&&/^\\/reels?\\//.test(location.pathname))mediaCount=1;const description=document.querySelector('meta[property="og:description"]')?.content||'';const username=(description.match(/-\s*([A-Za-z0-9._]+)\s+on\s+/)||description.match(/^\s*([A-Za-z0-9._]+)\s+on\s+/))?.[1]||null;const imageUrls=Array.from(document.querySelectorAll('main article img')).map(img=>{const variants=(img.srcset||'').split(',').map(s=>s.trim().split(/\\s+/)).filter(v=>v[0]).sort((a,b)=>(parseInt(b[1])||0)-(parseInt(a[1])||0));return variants[0]?.[0]||img.currentSrc||img.src;});return {caption,username,captionSource:'visible_heading_or_meta_description',postedAt:document.querySelector('main article time[datetime]')?.getAttribute('datetime')||null,mediaCount,hasVideo,imageUrls:[...new Set(imageUrls)],thumbnailUrl:document.querySelector('meta[property="og:image"]')?.content||imageUrls[0]||document.querySelector('main video')?.getAttribute('poster')||null,pageTitle:document.title};})()`);  if(captureImages){
    // Walk carousel slides and save the post's own image bytes. No AI call.
    const urls=new Set();
    const collect=async()=>{const found=await evalPage(`Array.from(document.querySelectorAll('main article img')).map(img=>img.currentSrc||img.src).filter(Boolean)`);for(const url of found||[])if(/^https:\/\//.test(url))urls.add(url);if(metadata.thumbnailUrl)urls.add(metadata.thumbnailUrl);};
    await collect();
    const slides=metadata.mediaCount?Math.min(20,Math.max(1,metadata.mediaCount)):20;
    for(let index=1;index<slides;index++){
      const moved=await evalPage(`(()=>{const button=Array.from(document.querySelectorAll('button')).find(b=>/next/i.test((b.getAttribute('aria-label')||'')+' '+(b.textContent||''))&&!b.disabled);if(!button)return false;button.click();return true;})()`);
      if(!moved)break;
      await wait(1300);
      await collect();
    }
    await wait(700);
    const urlsToFetch=[...urls].slice(0,20);
    let fetched=[];
    try{
      const expression=`(async()=>{const out=[];for(const url of ${JSON.stringify(urlsToFetch)}){try{const r=await fetch(url,{credentials:'include'});if(!r.ok)continue;const blob=await r.blob();if(!blob.size||blob.size>15*1024*1024)continue;const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));out.push({url,type:blob.type,base64:btoa(binary)});}catch{}}return out;})()`;
      const response=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      fetched=response.result?.value||[];
    }catch{}
    const images=fetched.map(item=>({url:item.url,type:item.type||'image/jpeg',bytes:Buffer.from(item.base64,'base64')})).filter(item=>item.bytes.length);
    if(!images.length)for(const url of urlsToFetch){const bytes=imageBodies.get(url);if(bytes?.length)images.push({url,type:'image/jpeg',bytes});}
    if(!images.length){
      // The CDN blocked page fetch; reuse the image bytes already loaded by the browser.
      const wanted=new Set(urlsToFetch.map(url=>new URL(url).pathname));
      for(const [url,bytes] of imageBodies){try{if(!wanted.has(new URL(url).pathname)||!bytes?.length)continue;images.push({url,type:'image/jpeg',bytes});}catch{}}
    }
    if(!images.length){
      // Last resort: keep large CDN images already loaded by the browser, skipping avatars.
      for(const [url,bytes] of imageBodies){try{if(!bytes?.length||bytes.length<20_000||/profile_pic|s150x150|s100x100/i.test(url))continue;images.push({url,type:'image/jpeg',bytes});}catch{}}
    }
    if(!images.length)throw Error('Instagram did not expose the post image files.');
    return {...metadata,images,mediaCount:metadata.mediaCount||images.length};
  }
if(captureThumbnail){
    // Prefer the post's own cover image. Navigating to it uses the signed-in browser,
    // so the CDN cannot hand back a blank or black placeholder.
    if(metadata.thumbnailUrl){
      try{await page('Page.navigate',{url:metadata.thumbnailUrl});await wait(1400);const coverShot=await page('Page.captureScreenshot',{format:'jpeg',quality:70,clip:{x:0,y:0,width:700,height:700,scale:1}});if(coverShot.data)return {...metadata,thumbnailBase64:coverShot.data,thumbnailSource:'cover'};}catch{}
    }
    const rect=await evalPage(`(()=>{const img=document.querySelector('main article img');const el=img||document.querySelector('main article')||document.querySelector('main');if(!el)return null;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:Math.max(0,r.x),y:Math.max(0,r.y),width:Math.max(160,Math.min(700,r.width)),height:Math.max(160,Math.min(700,r.height))};})()`);
    await wait(500);
    if(!rect)throw Error('No thumbnail area was visible on the post page.');
    const shot=await page('Page.captureScreenshot',{format:'jpeg',quality:70,clip:{...rect,scale:1}});
    if(!shot.data)throw Error('The thumbnail could not be captured.');
    return {...metadata,thumbnailBase64:shot.data,thumbnailSource:'article'};
  }
  if(captureVideo){if(blocked)throw Object.assign(Error('Instagram requires attention.'),{safetyStop:true});const response=await Promise.race([cdp.send('Runtime.evaluate',{expression:referenceRecorderScript(),awaitPromise:true,returnByValue:true},sessionId),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Recording timed out.')),110000);timer.unref();})]);const media=response.result?.value;if(blocked||media?.safetyStop)throw Object.assign(Error('Instagram requires attention.'),{safetyStop:true});if(!media?.base64)throw Error('A full browser recording was unavailable.');return {...media,bytes:Buffer.from(media.base64,'base64'),base64:undefined};}return metadata;}
 let saved=await evalPage(`Array.from(document.querySelectorAll('a[href]')).map(a=>a.href).find(h=>{try{return new URL(h).origin===location.origin&&/^\\/[^/]+\\/saved\\/?$/.test(new URL(h).pathname)}catch{return false}})||null`);if(!saved)saved=await evalPage(`(()=>{const a=Array.from(document.querySelectorAll('a[href]')).find(a=>/^\\/[^/]+\\/?$/.test(new URL(a.href).pathname)&&new URL(a.href).origin===location.origin&&(/profile/i.test((a.getAttribute('aria-label')||'')+' '+a.innerText)||a.querySelector('img[alt*=profile]')));return a?new URL(new URL(a.href).pathname.replace(/\\/?$/,'/')+'saved/',location.origin).href:null})()`);if(!saved)throw Error('Signed-in Saved page link was not found.');await page('Page.navigate',{url:saved});await wait(4500);
 warning=await evalPage(`({path:location.pathname,text:document.body?.innerText||'',password:!!document.querySelector('input[type=password]'),captcha:!!document.querySelector('iframe[src*=captcha]'),alert:!!document.querySelector('[role=alert]')?.textContent?.trim(),dialog:!!document.querySelector('[role=dialog]')?.textContent?.trim()})`);if(syncWarning({...warning,blocked}))throw Object.assign(Error('Instagram access check.'),{safetyStop:true});
 if(collection){const target=JSON.stringify(collection.trim().toLowerCase());let collectionUrl=null;for(let attempt=0;attempt<4&&!collectionUrl;attempt++){const check=await evalPage(`({path:location.pathname,text:document.body?.innerText||'',password:!!document.querySelector('input[type=password]'),captcha:!!document.querySelector('iframe[src*=captcha]'),alert:!!document.querySelector('[role=alert]')?.textContent?.trim(),dialog:!!document.querySelector('[role=dialog]')?.textContent?.trim()})`);if(syncWarning({...check,blocked}))throw Object.assign(Error('Instagram access check.'),{safetyStop:true});collectionUrl=await evalPage(`Array.from(document.querySelectorAll('a[href]')).find(a=>{try{return new URL(a.href).origin===location.origin&&new URL(a.href).pathname.includes('/saved/')&&((a.innerText||'').split('\\n')[0].trim().toLowerCase()===${target}||(a.getAttribute('aria-label')||'').trim().toLowerCase()===${target})}catch{return false}})?.href||null`);if(!collectionUrl){await wait(4500);await evalPage('window.scrollBy(0,500)');}}if(!collectionUrl)throw Error('The reference saved collection could not be found.');await page('Page.navigate',{url:collectionUrl});await wait(4500);}
 const allPosts=await evalPage(`Array.from(document.querySelectorAll('a[href]')).map(a=>a.href).find(h=>{try{return new URL(h).origin===location.origin&&/\\/saved\\/all-posts\\/?$/.test(new URL(h).pathname)}catch{return false}})||null`);if(allPosts&&!collection){await page('Page.navigate',{url:allPosts});await wait(4500);}
 return await collectSaved({known,active,wait,limit,snapshot:async()=>({...await evalPage(`({path:location.pathname,text:document.body?.innerText||'',password:!!document.querySelector('input[type=password]'),captcha:!!document.querySelector('iframe[src*=captcha]'),alert:!!document.querySelector('[role=alert]')?.textContent?.trim(),dialog:!!document.querySelector('[role=dialog]')?.textContent?.trim(),savedPage:/\\/saved(?:\\/|$)/.test(location.pathname),links:Array.from(document.querySelectorAll('main a[href]')).map(a=>a.href).filter(h=>/\\/(?:p|reels?)\\//.test(h)).slice(0,30)})`),blocked}),scroll:()=>evalPage('window.scrollBy(0,500)')});
 }finally{remove();await browser.stop();}
}
