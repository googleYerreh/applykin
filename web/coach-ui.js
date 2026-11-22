// The resume coach screen: a step list, then a two-sided workspace. Left: a chat that walks through
// suggestions one at a time (accept, edit, skip, or answer a question) and a Styling tab.
// Right: the live resume, updated after every change.
import { COACH_STEPS, coachSuggestions, coachOverview, applyOps } from '../core/coach.js';
import { generate } from '../core/ai.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = (s) => esc(s).replace(/\n/g, '<br>');

export function initCoach(ctx) {
  const el = document.querySelector('#coach');
  const st = { view: 'steps', step: null, tab: 'chat', log: [], skipped: new Set(), current: null, page: 0 };

  // ---------- step list ----------
  function renderSteps() {
    const r = ctx.getResume();
    if (!r) { el.innerHTML = `<div class="co-empty"><h1>Add your resume first</h1><p>The coach works from the resume you already have.</p><a class="btn big" href="#resume">Add my resume</a></div>`; return; }
    const ov = coachOverview(r).map((s) => ({ ...s, remaining: s.id === 'editor' ? 0 : remaining(r, s.id) }));
    const active = ov.findIndex((s) => s.remaining > 0);
    const cur = active === -1 ? ov.length - 1 : active;
    const sc = ctx.score(r);
    el.innerHTML = `<div class="co-steps">
      <div class="co-score-top"><span class="co-ring" style="--v:${sc.quality}"><b>${sc.quality}</b></span><small>Resume score</small></div>
      <h1>Let's improve your resume<br>step by step 🙌</h1>
      <ol class="co-list">${ov.map((s, i) => `
        <li class="${i === cur ? 'on' : i < cur ? 'done' : 'later'}">
          <span class="co-dot"></span>
          <div><p class="co-n">Step ${i + 1}</p><p class="co-l">${esc(s.label)}</p>
            ${i === cur ? `<p class="co-b">${esc(s.blurb)}${s.remaining ? ` · ${s.remaining} suggestion${s.remaining === 1 ? '' : 's'}` : ''}</p><button type="button" class="btn co-go" data-step="${s.id}">${i < ov.length - 1 ? 'Continue' : 'Open the editor'}</button>` : ''}
          </div>
          ${s.id !== 'editor' ? `<button type="button" class="co-state" data-step="${s.id}" title="${s.remaining ? s.remaining + ' to review' : 'Done'}">${s.remaining ? s.remaining : '✓'}</button>` : ''}
        </li>`).join('')}</ol>
      <p class="co-foot">Every suggestion comes from a check on your resume, and nothing is added that you didn't write or type.</p>
    </div>`;
  }
  const remaining = (r, step) => coachSuggestions(r, step).filter((s) => !st.skipped.has(s.id)).length;

  // ---------- workspace ----------
  function openStep(step) {
    if (step === 'editor') { ctx.openEditor(); return; }
    st.view = 'work'; st.step = step; st.log = []; st.tab = 'chat'; st.page = 0;
    const meta = COACH_STEPS.find((s) => s.id === step);
    const n = remaining(ctx.getResume(), step);
    say(n ? `Let's work on your ${meta.label.toLowerCase()}. I found ${n} thing${n === 1 ? '' : 's'} worth changing, starting with the ones that matter most.` : `Your ${meta.label.toLowerCase()} already looks good. Nothing to change here.`);
    next();
  }
  function say(text, who = 'coach') { st.log.push({ who, text }); }
  function next() {
    const r = ctx.getResume();
    const list = coachSuggestions(r, st.step).filter((s) => !st.skipped.has(s.id));
    st.current = list[0] || null;
    if (!st.current) {
      const i = COACH_STEPS.findIndex((s) => s.id === st.step);
      st.log.push({ who: 'coach', done: true, nextStep: COACH_STEPS[i + 1]?.id, nextLabel: COACH_STEPS[i + 1]?.label });
    }
    renderWork();
  }

  function card(s) {
    const g = s.gain && (s.gain.quality || s.gain.ats) ? `<span class="co-gain">+${s.gain.quality || 0} quality${s.gain.ats ? ` · +${s.gain.ats} ATS` : ''}</span>` : '';
    const where = s.where ? `<p class="co-where">${esc(s.where)}</p>` : '';
    if (s.kind === 'ask') return `<div class="co-card ask"><div class="co-card-h"><b>${esc(s.title)}</b>${g}</div>${where}<p class="co-why">${esc(s.why)}</p><p class="co-q">${nl(s.question)}</p>
      <div class="co-actions"><button type="button" class="btn ghost small" data-co="skip">Skip</button></div></div>`;
    return `<div class="co-card"><div class="co-card-h"><b>${esc(s.title)}</b>${g}</div>${where}<p class="co-why">${esc(s.why)}</p>
      ${s.fields.map((f, i) => `<label class="co-field ${f.old ? 'old' : ''}"><span>${esc(f.label)}</span>${f.readonly ? `<div class="co-ro">${nl(f.value)}</div>` : `<textarea data-field="${i}" rows="${Math.min(6, Math.max(2, Math.ceil(f.value.length / 70)))}">${esc(f.value)}</textarea>`}</label>`).join('')}
      <div class="co-actions">
        ${s.bullet && ctx.ai() ? '<button type="button" class="btn ghost small" data-co="ai">✦ Reword with AI</button>' : ''}
        <button type="button" class="btn ghost small" data-co="skip">Skip</button>
        ${s.fields.some((f) => !f.readonly) ? '<button type="button" class="btn ghost small" data-co="edit">Edit</button>' : ''}
        <button type="button" class="btn small" data-co="accept">✓ Accept</button>
      </div></div>`;
  }

  function renderWork() {
    const r = ctx.getResume();
    const meta = COACH_STEPS.find((s) => s.id === st.step);
    const sc = ctx.score(r);
    const log = st.log.map((m) => {
      if (m.done) return `<div class="co-msg coach"><span class="co-av">A</span><div class="co-bubble">✓ That's everything for <b>${esc(meta.label.toLowerCase())}</b>. Your resume score is now <b>${sc.quality}</b>.
        <div class="co-actions left">${m.nextStep ? `<button type="button" class="btn small" data-step="${m.nextStep}">Next: ${esc(m.nextLabel)} →</button>` : ''}<button type="button" class="btn ghost small" data-co="steps">All steps</button></div></div></div>`;
      return `<div class="co-msg ${m.who}">${m.who === 'coach' ? '<span class="co-av">A</span>' : ''}<div class="co-bubble">${nl(m.text)}</div></div>`;
    }).join('') + (st.current ? `<div class="co-msg coach"><span class="co-av">A</span>${card(st.current)}</div>` : '');
    const ask = st.current?.kind === 'ask';
    el.innerHTML = `<div class="co-work">
      <div class="co-left">
        <div class="co-top"><button type="button" class="co-back" data-co="steps" aria-label="Back to steps">‹</button>
          <div class="co-tabs" role="tablist"><button type="button" data-tab="chat" aria-selected="${st.tab === 'chat'}">Coach</button><button type="button" data-tab="style" aria-selected="${st.tab === 'style'}">Styling</button></div>
          <span class="co-pill"><span class="co-ring sm" style="--v:${sc.quality}"><b>${sc.quality}</b></span>Score</span></div>
        ${st.tab === 'chat' ? `
        <div class="co-log" id="co-log">${log}</div>
        <form class="co-input" id="co-form"><textarea id="co-answer" rows="1" placeholder="${ask ? esc(st.current.placeholder || 'Type your answer…') : st.current ? 'Type your own version, or press Accept' : 'All done for this step'}" ${st.current ? '' : 'disabled'}></textarea><button type="submit" aria-label="Send" ${st.current ? '' : 'disabled'}>↑</button></form>`
        : styling()}
      </div>
      <div class="co-right">
        <div class="co-prev-bar"><button type="button" data-co="refresh" title="Refresh preview">⟳</button><span class="co-prev-note">Live preview · ${esc(ctx.templateLabel())}</span>
          <span class="co-pages"><button type="button" data-co="pg" data-d="-1" aria-label="Previous page">‹</button><span id="co-pg">1 / 1</span><button type="button" data-co="pg" data-d="1" aria-label="Next page">›</button></span></div>
        <div class="co-sheet"><iframe id="co-frame" title="Your resume"></iframe></div>
      </div></div>`;
    const logEl = el.querySelector('#co-log');
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
    renderPreview();
  }

  function styling() {
    const t = ctx.getTemplate(), d = ctx.getDesign();
    return `<div class="co-style">
      <p class="co-h">Design</p>
      <div class="co-tpls">${Object.entries(ctx.templates).map(([k, v]) => `<button type="button" data-tpl="${k}" aria-pressed="${k === t}"><b>${esc(v.label)}</b><small data-ats="${v.ats}">${esc(ctx.atsLabel(v.ats))}</small></button>`).join('')}</div>
      <p class="co-h">Accent color</p>
      <div class="co-swatches">${ctx.accents.map((c) => `<button type="button" data-accent="${c}" style="background:${c}" aria-pressed="${(d.accent || ctx.templates[t].accent).toLowerCase() === c.toLowerCase()}" aria-label="Accent ${c}"></button>`).join('')}</div>
      <p class="co-h">Font</p>
      <select id="co-font"><option value="">Design default</option>${Object.entries(ctx.fonts).map(([k, f]) => `<option value="${k}" ${d.font === k ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select>
      <p class="co-h">Text size <output>${d.textSize}%</output></p>
      <input type="range" id="co-size" min="85" max="115" step="1" value="${d.textSize}">
      <p class="co-note">Designs marked "Best for ATS" are safest for online applications.</p>
    </div>`;
  }

  // ---------- preview with pages ----------
  const PAGE_H = 1056; // US Letter at 96 dpi; A4 is close enough for paging the preview
  function renderPreview() {
    const f = el.querySelector('#co-frame');
    if (!f) return;
    f.srcdoc = ctx.renderHTML(ctx.getResume());
    f.onload = () => {
      const doc = f.contentDocument;
      const h = doc?.documentElement.scrollHeight || PAGE_H;
      const pages = Math.max(1, Math.round(h / PAGE_H + 0.2));
      st.pages = pages; st.page = Math.min(st.page, pages - 1);
      f.style.height = h + 'px';
      fit(); paginate();
    };
  }
  function fit() {
    const box = el.querySelector('.co-sheet'), f = el.querySelector('#co-frame');
    if (!box || !f) return;
    const scale = Math.min(1, (box.clientWidth - 2) / 816);
    f.style.transform = `scale(${scale})`;
    const h = parseFloat(f.style.height) || 1056;
    f.style.marginBottom = `${-(h * (1 - scale))}px`; // scaled iframes keep their full layout height
    f.style.marginRight = `${-(816 * (1 - scale))}px`;
    box.style.setProperty('--scale', scale);
  }
  function paginate() {
    const box = el.querySelector('.co-sheet'), pg = el.querySelector('#co-pg');
    if (!box) return;
    const scale = Number(getComputedStyle(box).getPropertyValue('--scale')) || 1;
    box.scrollTo({ top: st.page * PAGE_H * scale, behavior: 'smooth' });
    if (pg) pg.textContent = `${st.page + 1} / ${st.pages || 1}`;
  }
  window.addEventListener('resize', () => { if (st.view === 'work' && !el.hidden) fit(); });

  // ---------- actions ----------
  function accept(valueOverride) {
    const s = st.current; if (!s) return;
    const before = ctx.score(ctx.getResume());
    let ops = s.ops;
    // If the person edited the suggested text, apply their version instead.
    const edited = [...el.querySelectorAll('[data-field]')].map((t) => ({ f: s.fields[Number(t.dataset.field)], v: t.value.trim() }));
    if (valueOverride != null && s.fields) { const f = s.fields.find((x) => !x.readonly); if (f) edited.splice(0, edited.length, { f, v: valueOverride }); }
    if (edited.length) {
      ops = ops.map((op) => {
        const e = edited[0];
        if (op.op === 'set' && /keywords$/.test(op.path) && e) return { ...op, value: e.v.split(',').map((x) => x.trim()).filter(Boolean) };
        if (op.op === 'set' && e) return { ...op, value: e.v };
        if (op.op === 'splitBullet' && e) return { ...op, value: e.v.split('\n').map((x) => x.trim()).filter(Boolean) };
        if (op.op === 'addSkills' && e) return { ...op, value: e.v.split(',').map((x) => x.trim()).filter(Boolean) };
        if (op.op === 'set' && /keywords$/.test(op.path) && e) return { ...op, value: e.v.split(',').map((x) => x.trim()).filter(Boolean) };
        return op;
      });
    }
    commit(ops, before, valueOverride != null ? valueOverride : null);
  }
  function answer(text) {
    const s = st.current; if (!s || !text.trim()) return;
    if (s.kind !== 'ask') { accept(text.trim()); return; }
    say(text.trim(), 'me');
    const ops = s.answer(text);
    if (ops === null) { say("I couldn't read that. Try the format in the example, or press Skip."); renderWork(); return; }
    if (!ops.length) { st.skipped.add(s.id); say('No problem, skipped.'); next(); return; }
    commit(ops, ctx.score(ctx.getResume()), null);
  }
  function commit(ops, before, typed) {
    if (typed) say(typed, 'me');
    const r = applyOps(ctx.getResume(), ops);
    ctx.setResume(r);
    const after = ctx.score(r);
    const d = after.quality - before.quality, da = after.ats - before.ats;
    say(`Done. ${d > 0 ? `Quality ${before.quality} → ${after.quality}` : 'Updated'}${da > 0 ? `, ATS ${before.ats} → ${after.ats}` : ''}.`);
    next();
  }
  async function aiReword() {
    const s = st.current; const ta = el.querySelector('[data-field]:not([readonly])');
    if (!s || !ta) return;
    const btn = el.querySelector('[data-co=ai]'); btn.disabled = true; btn.textContent = 'Rewording…';
    try {
      const out = await generate(ctx.ai(), {
        system: 'You reword one resume bullet. Keep every fact, number, name and claim exactly as given. Do not add numbers, tools, results or responsibilities that are not in the original. Start with a strong past-tense verb. Return only the bullet, under 30 words.',
        prompt: `ORIGINAL: ${s.bullet}\nCURRENT DRAFT: ${ta.value}`,
      });
      ta.value = String(out).trim().replace(/^[-•*]\s*/, '').split('\n')[0];
      say('Here is a reworded version. Check that every fact is still true, then Accept or edit it.');
    } catch (e) { say(`The AI provider didn't answer (${e.message}). The suggestion above still works without it.`); }
    btn.disabled = false; btn.textContent = '✦ Reword with AI';
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.step) return openStep(b.dataset.step);
    if (b.dataset.tab) { st.tab = b.dataset.tab; return renderWork(); }
    if (b.dataset.tpl) { ctx.setTemplate(b.dataset.tpl); return renderWork(); }
    if (b.dataset.accent) { ctx.setDesign({ accent: b.dataset.accent }); return renderWork(); }
    const a = b.dataset.co;
    if (a === 'steps') { st.view = 'steps'; renderSteps(); window.scrollTo(0, 0); }
    if (a === 'skip' && st.current) { st.skipped.add(st.current.id); say('Skipped. You can always change it later in the editor.'); next(); }
    if (a === 'edit') { const t = el.querySelector('[data-field]'); t?.focus(); t?.setSelectionRange(t.value.length, t.value.length); }
    if (a === 'accept') accept();
    if (a === 'ai') aiReword();
    if (a === 'refresh') renderPreview();
    if (a === 'pg') { st.page = Math.max(0, Math.min((st.pages || 1) - 1, st.page + Number(b.dataset.d))); paginate(); }
  });
  el.addEventListener('submit', (e) => { e.preventDefault(); const t = el.querySelector('#co-answer'); const v = t.value; t.value = ''; answer(v); });
  el.addEventListener('keydown', (e) => { if (e.target.id === 'co-answer' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.querySelector('#co-form').requestSubmit(); } });
  el.addEventListener('change', (e) => {
    if (e.target.id === 'co-font') { ctx.setDesign({ font: e.target.value }); renderWork(); }
    if (e.target.id === 'co-size') { ctx.setDesign({ textSize: Number(e.target.value) }); renderWork(); }
  });

  return {
    show() { if (st.view === 'work' && ctx.getResume()) renderWork(); else { st.view = 'steps'; renderSteps(); } },
    reset() { st.view = 'steps'; st.skipped.clear(); st.log = []; },
  };
}
