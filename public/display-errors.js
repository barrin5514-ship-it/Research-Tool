// Display errors are reported in the existing status line instead of failing silently.
addEventListener('error',event=>{const message=document.getElementById('message');if(message)message.textContent='The page could not finish loading: '+(event.message||'A local display file was unavailable.');});
addEventListener('unhandledrejection',event=>{const message=document.getElementById('message');if(message)message.textContent='The display could not finish loading: '+(event.reason?.message||'Please reload the page.');});

// A server started before a UI update can serve the new page with the old asset
// allowlist. Tell the owner plainly instead of showing an unstyled page.
addEventListener('DOMContentLoaded',()=>{
  const link=document.querySelector('link[href="/theme.css"]');
  if(!link)return;
  const loaded=[...document.styleSheets].some(sheet=>String(sheet.href||'').endsWith('/theme.css'));
  if(loaded)return;
  const banner=document.createElement('div');
  banner.className='stale-banner';
  banner.setAttribute('role','alert');
  banner.textContent='This dashboard is still running an older server. Close it and start Research Library again so the new interface can load.';
  document.body.prepend(banner);
});
