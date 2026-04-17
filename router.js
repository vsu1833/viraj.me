// Smart SPA Router — only swaps <main>, keeping the video banner alive

// Fix scrollbar layout shift: reserve gutter space so the scrollbar
// appearing/disappearing on shorter pages doesn't shift the layout.
document.documentElement.style.scrollbarGutter = 'stable';
document.documentElement.style.overflowY = 'scroll';
const cache = new Map();

// Prefetch pages on hover
async function prefetch(url) {
  if (cache.has(url)) return;
  try {
    const res = await fetch(url);
    if (res.ok) cache.set(url, await res.text());
  } catch (_) {}
}

document.addEventListener('mouseover', (e) => {
  const link = e.target.closest('a');
  if (link && isLocal(link)) prefetch(link.href);
}, { passive: true });

function isLocal(link) {
  if (!link.href) return false;

  // Never intercept mailto:, tel:, or other non-http protocols
  if (!link.href.startsWith('http')) return false;

  // Exclude index.html / root from SPA — it's a Next.js export that needs
  // a full reload so all its inline DOM-manipulation scripts execute.
  const pathname = new URL(link.href, location.origin).pathname;
  const isHome = pathname === '/' || pathname.endsWith('/index.html');

  return (
    link.href.startsWith(window.location.origin) &&
    !link.href.includes('#') &&
    link.target !== '_blank' &&
    link.getAttribute('download') === null &&
    !isHome
  );
}

function handleThemeToggle() {
  const root = document.documentElement;
  const next = root.classList.contains('dark') ? 'light' : 'dark';
  root.classList.remove('light', 'dark');
  root.classList.add(next);
  root.style.colorScheme = next;
  try { localStorage.setItem('theme', next); } catch (_) {}
}

function bindThemeToggle() {
  const btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;
  // Clone removes ALL existing listeners (fixes double-bind from inline scripts)
  const fresh = btn.cloneNode(true);
  btn.parentNode.replaceChild(fresh, btn);
  fresh.addEventListener('click', handleThemeToggle);
}

async function navigate(targetUrl) {
  if (targetUrl === window.location.href) return;

  const currentMain = document.querySelector('main');

  // Fade only the <main> content — video stays alive!
  if (currentMain) {
    currentMain.style.transition = 'opacity 0.08s ease-out';
    currentMain.style.opacity = '0';
  } else {
    document.body.style.transition = 'opacity 0.08s ease-out';
    document.body.style.opacity = '0';
  }

  try {
    let htmlText = cache.get(targetUrl);
    if (!htmlText) {
      const res = await fetch(targetUrl);
      if (!res.ok) throw new Error('fetch failed');
      htmlText = await res.text();
      cache.set(targetUrl, htmlText);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Wait for fade-out
    await new Promise(r => setTimeout(r, 80));

    // Update page title
    document.title = doc.title;

    const newMain = doc.querySelector('main');

    if (currentMain && newMain) {
      // ── Swap only <main> — video banner is outside <main> and stays untouched ──

      // Update desktop nav active state
      const currentNav = document.querySelector('nav');
      const newNav = doc.querySelector('nav');
      if (currentNav && newNav) {
        currentNav.innerHTML = newNav.innerHTML;
        bindThemeToggle();
      }

      // Update mobile bottom nav active state
      const curMobileNav = document.querySelector('body > div.fixed.bottom-0');
      const newMobileNav = doc.querySelector('body > div.fixed.bottom-0');
      if (curMobileNav && newMobileNav) {
        curMobileNav.innerHTML = newMobileNav.innerHTML;
      }

      // Replace main
      newMain.style.opacity = '0';
      currentMain.replaceWith(newMain);

      // Re-execute inline scripts inside new <main>
      document.querySelector('main').querySelectorAll('script').forEach(old => {
        if (old.src) return;
        const s = document.createElement('script');
        Array.from(old.attributes).forEach(a => s.setAttribute(a.name, a.value));
        s.textContent = old.textContent;
        old.replaceWith(s);
      });

    } else {
      // Fallback: full body swap (e.g. pages without <main>)
      doc.body.style.opacity = '0';
      document.body.replaceWith(doc.body);
      document.body.querySelectorAll('script').forEach(old => {
        if (old.src) return;
        const s = document.createElement('script');
        Array.from(old.attributes).forEach(a => s.setAttribute(a.name, a.value));
        s.textContent = old.textContent;
        old.replaceWith(s);
      });
      bindThemeToggle();
    }

    window.history.pushState({ path: targetUrl }, '', targetUrl);
    window.scrollTo(0, 0);

    // Fade in new <main>
    void document.body.offsetHeight;
    const m = document.querySelector('main');
    if (m) {
      m.style.transition = 'opacity 0.08s ease-in';
      m.style.opacity = '1';
    } else {
      document.body.style.transition = 'opacity 0.08s ease-in';
      document.body.style.opacity = '1';
    }

  } catch (_) {
    window.location.href = targetUrl;
  }
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link && isLocal(link)) {
    e.preventDefault();
    navigate(link.href);
  }
});

window.addEventListener('popstate', () => window.location.reload());

// Bind theme toggle on first load
bindThemeToggle();
