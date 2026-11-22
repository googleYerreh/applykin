// Landing page: header dropdowns, the rotating product preview and the live design rail.
const $ = (s) => document.querySelector(s);

export function initHome({ renderTemplate, templates, atsLabel, atsScore }) {
  // ---------- header dropdowns: open on hover or click, close on Esc / outside click ----------
  const dds = [...document.querySelectorAll('nav.menu .dd')];
  const setOpen = (dd, open) => {
    dd.classList.toggle('open', open);
    dd.querySelector('.dd-btn').setAttribute('aria-expanded', String(open));
  };
  const closeAll = (except) => dds.forEach((d) => d !== except && setOpen(d, false));
  for (const dd of dds) {
    const btn = dd.querySelector('.dd-btn');
    let timer;
    let hoverAt = 0;
    btn.addEventListener('click', () => {
      // A click right after hovering open shouldn't snap the menu shut.
      const open = Date.now() - hoverAt < 800 ? true : !dd.classList.contains('open');
      hoverAt = 0; closeAll(dd); setOpen(dd, open);
    });
    dd.addEventListener('mouseenter', () => { if (!matchMedia('(hover: hover)').matches) return; clearTimeout(timer); closeAll(dd); if (!dd.classList.contains('open')) hoverAt = Date.now(); setOpen(dd, true); });
    dd.addEventListener('mouseleave', () => { if (!matchMedia('(hover: hover)').matches) return; timer = setTimeout(() => setOpen(dd, false), 160); });
    dd.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => closeAll()));
  }
  document.addEventListener('click', (e) => { if (!e.target.closest('nav.menu')) closeAll(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

  // ---------- hero preview: four steps that rotate until you pick one ----------
  const tabs = [...document.querySelectorAll('[data-hstep]')];
  const slides = [...document.querySelectorAll('[data-hslide]')];
  let cur = 0, auto = !matchMedia('(prefers-reduced-motion: reduce)').matches, rot;
  const show = (i) => {
    cur = i;
    tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === i)));
    slides.forEach((s, k) => (s.hidden = k !== i));
  };
  tabs.forEach((t, i) => t.addEventListener('click', () => { auto = false; show(i); }));
  const win = $('.h-window');
  win?.addEventListener('mouseenter', () => (win.dataset.hover = '1'));
  win?.addEventListener('mouseleave', () => delete win.dataset.hover);
  function tick() { if (auto && !win?.dataset.hover && !$('[data-panel=home]').hidden) show((cur + 1) % slides.length); }

  // ---------- designs rail: real renders of each template with a sample resume ----------
  let railDone = false;
  function fillRail() {
    if (railDone) return;
    railDone = true;
    renderRail($('#h-rail'));
  }
  // Also used by the product pages. Scores are the sample resume's real ATS readability per design.
  function renderRail(rail, { scores = false } = {}) {
    rail.innerHTML = Object.entries(templates).map(([k, t]) => `
      <a class="h-tpl" href="#designs" data-tpl="${k}"><div class="frame">${scores ? `<span class="tpl-score" data-ats="${t.ats}"><b>${atsScore(k)}</b> ATS</span>` : ''}<iframe title="${t.label} design preview" loading="lazy" tabindex="-1"></iframe></div>
      <p>${t.label}<span data-ats="${t.ats}">${atsLabel(t.ats)}</span></p></a>`).join('');
    rail.querySelectorAll('.h-tpl').forEach((a) => { a.querySelector('iframe').srcdoc = renderTemplate(a.dataset.tpl); });
  }
  document.querySelectorAll('[data-scroll]').forEach((b) => b.addEventListener('click', () => {
    const rail = $('#h-rail');
    rail.scrollBy({ left: Number(b.dataset.scroll) * (rail.clientWidth * 0.8), behavior: 'smooth' });
  }));

  return {
    onShow() {
      fillRail();
      clearInterval(rot);
      rot = setInterval(tick, 4500);
    },
    onHide() { clearInterval(rot); closeAll(); },
    renderRail,
  };
}
