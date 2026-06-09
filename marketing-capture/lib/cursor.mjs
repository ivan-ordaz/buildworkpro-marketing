// A fake, visible cursor injected into the page for video scenes.
// Playwright's real mouse leaves no on-screen pointer in recordings, so we
// draw our own arrow that follows mousemove events plus a click ripple.
// Injected via addInitScript so it survives every navigation.
export const CURSOR_INIT = `
(() => {
  if (window.__mktCursorInstalled) return;
  window.__mktCursorInstalled = true;

  const style = document.createElement('style');
  style.textContent =
    '#__mkt_cursor{position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;' +
    'pointer-events:none;transition:transform .09s ease-out;will-change:transform;' +
    'transform:translate(-100px,-100px)}' +
    '#__mkt_cursor svg{display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}' +
    '#__mkt_ripple{position:fixed;left:0;top:0;width:36px;height:36px;margin:-18px 0 0 -18px;' +
    'z-index:2147483646;border-radius:50%;background:rgba(37,99,235,.45);pointer-events:none;opacity:0}' +
    '@keyframes __mkt_pulse{0%{transform:scale(.25);opacity:.7}100%{transform:scale(1.5);opacity:0}}';

  const mount = () => {
    if (!document.body || document.getElementById('__mkt_cursor')) return;
    document.head.appendChild(style);

    const cursor = document.createElement('div');
    cursor.id = '__mkt_cursor';
    cursor.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none">' +
      '<path d="M5 2.5l13.5 6.8-5.8 1.9-1.9 5.8L5 2.5z" fill="#fff" stroke="#0f172a" ' +
      'stroke-width="1.3" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cursor);

    const ripple = document.createElement('div');
    ripple.id = '__mkt_ripple';
    document.body.appendChild(ripple);

    window.__mktMove = (x, y) => {
      cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    };
    window.__mktRipple = (x, y) => {
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.style.animation = 'none';
      void ripple.offsetWidth;
      ripple.style.animation = '__mkt_pulse .5s ease-out';
    };
    window.__mktHide = (hidden) => {
      cursor.style.display = hidden ? 'none' : 'block';
    };

    document.addEventListener(
      'mousemove',
      (e) => window.__mktMove(e.clientX, e.clientY),
      true
    );
  };

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
`;

// CSS to freeze animations/transitions for crisp, deterministic screenshots.
export const FREEZE_MOTION = `
(() => {
  const s = document.createElement('style');
  s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;' +
    'caret-color:transparent!important;scroll-behavior:auto!important}';
  const add = () => document.head && document.head.appendChild(s);
  if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
})();
`;
