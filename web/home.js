// Landing page: header dropdowns, the rotating product preview and the live design rail.
const $ = (s) => document.querySelector(s);

export function initHome({ renderTemplate, templates, atsLabel, atsScore, qualityOf }) {
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
  // Also used by the product pages. Scores are the sample resumes' real scores per design.
  function card(k, t, sample, cls, badge) {
    return `<a class="h-tpl ${cls}" href="#designs" data-tpl="${k}" data-sample="${sample}"><div class="frame">${badge}<iframe title="${t.label} design preview" loading="lazy" tabindex="-1"></iframe>${cls === 'after' ? '<span class="tpl-opt">✦ Improved with Applykin</span>' : ''}</div>
      <p>${t.label}<span data-ats="${t.ats}">${atsLabel(t.ats)}</span></p></a>`;
  }
  function renderRail(rail, { scores = false, beforeAfter = false } = {}) {
    const all = Object.entries(templates);
    let html = '';
    if (beforeAfter) {
      const q = qualityOf('weak');
      html += all.slice(0, 3).map(([k, t]) => card(k, t, 'weak', 'before', `<span class="tpl-score low"><b>${q}</b> Score</span>`)).join('');
      html += '<div class="tpl-divider" aria-hidden="true"><span>Before</span><i></i><span>After</span></div>';
      const qs = qualityOf('strong');
      html += all.map(([k, t]) => card(k, t, 'strong', 'after', `<span class="tpl-score" data-ats="${t.ats}"><b>${qs}</b> Score</span>`)).join('');
    } else {
      html = all.map(([k, t]) => card(k, t, 'strong', '', scores ? `<span class="tpl-score" data-ats="${t.ats}"><b>${atsScore(k)}</b> ATS</span>` : '')).join('');
    }
    rail.innerHTML = html;
    rail.querySelectorAll('.h-tpl').forEach((a) => { a.querySelector('iframe').srcdoc = renderTemplate(a.dataset.tpl, a.dataset.sample); });
    // Open centered on the before/after line, so both sides are in view.
    const div = rail.querySelector('.tpl-divider');
    if (div) requestAnimationFrame(() => { rail.scrollLeft = div.offsetLeft - rail.offsetLeft - rail.clientWidth / 2 + div.offsetWidth / 2; });
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
