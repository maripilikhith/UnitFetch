(() => {
  if (document.getElementById('unifetch-launcher')) return;
  const host = document.createElement('div');
  host.id = 'unifetch-launcher';
  const root = host.attachShadow({mode:'open'});
  const style = document.createElement('style');
  style.textContent = `:host{all:initial;position:fixed;right:20px;bottom:22px;z-index:2147483646;display:block;width:42px;height:42px}:host([hidden]){display:none}button{box-sizing:border-box;width:42px;height:42px;border:1px solid #ffffff66;border-radius:14px;display:grid;place-items:center;background:#2563eb;color:white;box-shadow:0 3px 14px #15366b38;cursor:pointer;transition:background .15s,transform .15s}button:hover{background:#1d4ed8;transform:translateY(-2px)}button:focus-visible{outline:3px solid #93c5fd;outline-offset:3px}svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.tip{position:absolute;right:51px;top:7px;white-space:nowrap;font:12px/1.5 'Segoe UI',sans-serif;background:#17243c;color:#fff;padding:5px 9px;border-radius:6px;opacity:0;pointer-events:none}button:hover+.tip,button:focus-visible+.tip{opacity:1}@media(prefers-reduced-motion:reduce){button{transition:none}}`;
  const button = document.createElement('button');
  button.type = 'button'; button.setAttribute('aria-label','Open UniFetch side panel');
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  const path = document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4');svg.append(path);button.append(svg);
  const tip = document.createElement('span');tip.className='tip';tip.textContent='Open UniFetch';
  root.append(style,button,tip);
  function update() {
    const url = new URL(location.href);
    const id = url.hostname.endsWith('youtu.be') ? url.pathname.split('/')[1] : url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(shorts|embed|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : '';
    host.hidden = !/^[\w-]{11}$/.test(id || '') || Boolean(document.fullscreenElement);
  }
  button.addEventListener('click',async event=>{
    if (!event.isTrusted) return;
    try {
      const reply = await chrome.runtime.sendMessage({type:'OPEN_SIDE_PANEL'});
      if (!reply?.ok) throw new Error(reply?.error || 'Could not open the panel.');
      tip.textContent='Open UniFetch';
    } catch {tip.textContent='Reload this page to reconnect UniFetch';button.title=tip.textContent;}
  });
  document.documentElement.append(host);
  document.addEventListener('yt-navigate-finish',update);
  document.addEventListener('fullscreenchange',update);
  window.addEventListener('popstate',update);
  window.addEventListener('pageshow',update);
  update();
})();
