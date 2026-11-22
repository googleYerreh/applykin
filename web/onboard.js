// "Get started": a few one-tap questions before adding a resume, so jobs are sorted
// for the person from the first visit. Answers stay in this browser.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'applykin.onboard.v1';

export function initOnboard({ el, getPlace, setPrefs, finish }) {
  let a = {};
  try { a = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
  let i = 0;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {} };

  const Q = [
    { id: 'looking', q: 'Are you looking for a new job?', options: [['yes', '✓', 'Yes', "I'm actively applying right now."], ['maybe', '?', 'Kind of', "Just seeing what's out there."], ['no', '✕', 'No', 'I want my resume ready for later.']] },
    { id: 'place', q: 'Where are you based?', sub: 'Jobs near you come first. You can change this anytime.', form: true },
    { id: 'kind', q: 'What kind of work do you want?', sub: 'Pick as many as you like.', multi: true, options: [['full-time', '▣', 'Full-time', 'A main job.'], ['part-time', '½', 'Part-time', 'Fewer hours, alongside other things.'], ['contract', '✎', 'Contract or freelance', 'Projects and gigs, often remote.'], ['internship', '★', 'Internship', 'To get started in a field.']] },
    { id: 'where', q: 'Where do you want to work?', options: [['near', '◎', 'Near me', 'Jobs in my city and state first.'], ['remote', '⌂', 'Remote first', 'Work from home, open to my country.'], ['both', '⇄', 'Either is fine', 'Show the best matches first.']] },
  ];

  function render() {
    const s = Q[i];
    const pct = Math.round(((i + 1) / (Q.length + 1)) * 100);
    let body = '';
    if (s.form) {
      const p = a.place || getPlace();
      body = `<div class="ob-form">
        <label><span>City</span><input id="ob-city" value="${esc(p.city)}" placeholder="e.g. Temecula" autocomplete="address-level2"></label>
        <label><span>State or region</span><input id="ob-region" value="${esc(p.region)}" placeholder="e.g. CA" autocomplete="address-level1"></label>
        <label><span>Country</span><input id="ob-country" value="${esc(p.country)}" placeholder="e.g. United States" autocomplete="country-name"></label>
        <button type="button" class="btn big" data-ob-next>Continue →</button></div>`;
    } else {
      const sel = s.multi ? new Set(a[s.id] || []) : a[s.id];
      body = `<div class="ob-opts">${s.options.map(([v, ic, t, d]) => `
        <button type="button" class="ob-opt" data-ob-pick="${v}" aria-pressed="${s.multi ? sel.has(v) : sel === v}"><span class="ob-ic">${ic}</span><span><b>${esc(t)}</b><small>${esc(d)}</small></span></button>`).join('')}</div>
        ${s.multi ? `<button type="button" class="btn big" data-ob-next ${sel.size ? '' : 'disabled'}>Continue →</button>` : ''}`;
    }
    el.innerHTML = `<div class="ob">
      <div class="ob-bar"><i style="width:${pct}%"></i></div>
      <h1>${esc(s.q)}</h1>${s.sub ? `<p class="ob-sub">${esc(s.sub)}</p>` : ''}
      ${body}
      <div class="ob-foot">${i ? '<button type="button" class="linkish" data-ob-back>← Back</button>' : '<a class="linkish" href="#home">← Home</a>'}<button type="button" class="linkish" data-ob-skip>Skip questions</button></div>
    </div>`;
    el.querySelector('input, .ob-opt')?.focus({ preventScroll: true });
  }

  function apply() {
    const types = (a.kind || []).flatMap((k) => (k === 'contract' ? ['contract'] : [k]));
    setPrefs({
      place: a.place,
      types: types.length && types.length < 4 ? types : [],
      sort: a.where === 'remote' ? 'remote' : a.where === 'both' ? 'match' : 'near',
    });
  }
  function next() {
    if (Q[i].form) {
      a.place = { city: el.querySelector('#ob-city').value.trim(), region: el.querySelector('#ob-region').value.trim(), country: el.querySelector('#ob-country').value.trim() };
    }
    save();
    if (i < Q.length - 1) { i++; render(); return; }
    a.done = true; save(); apply(); finish(a);
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const s = Q[i];
    if (b.dataset.obPick) {
      if (s.multi) {
        const set = new Set(a[s.id] || []);
        set.has(b.dataset.obPick) ? set.delete(b.dataset.obPick) : set.add(b.dataset.obPick);
        a[s.id] = [...set]; save(); render();
      } else { a[s.id] = b.dataset.obPick; next(); }
    }
    if (b.hasAttribute('data-ob-next')) next();
    if (b.hasAttribute('data-ob-back')) { i = Math.max(0, i - 1); render(); }
    if (b.hasAttribute('data-ob-skip')) { a.skipped = true; save(); finish(a); }
  });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') next(); });

  return { start() { i = 0; render(); }, answers: () => a, done: () => !!(a.done || a.skipped) };
}
