// Jobs, Tracker and Settings tabs. Everything stays on this device.
import { rankJobs, tailorResume, templateLetter, letterPrompt, generate, PROVIDERS, fetchBoards, dedupeJobs,
  STAGES, STAGE_LABELS, trackJob, moveApplication, updateApplication, removeApplication } from '../core/index.js';
import { SAMPLE_JOBS } from './sample-jobs.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'applykin.jobs.v1';
const OLD_KEY = 'openstep.jobs.v1'; // data saved before the rename
const EMPTY_RESUME = { basics: {}, work: [], education: [], skills: [] };

export function initJobs(ctx) {
  const st = { jobs: [], feedInfo: '', apps: [], ai: { provider: '', model: '', baseUrl: '', apiKey: '' }, selected: null, letter: '', filters: { q: '', loc: '', remote: false } };

  // ---------- storage ----------
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify({ jobs: st.jobs.slice(0, 400), feedInfo: st.feedInfo, apps: st.apps, ai: st.ai })); } catch {}
  };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY) || '{}')); } catch {}

  const resume = () => ctx.getResume() || EMPTY_RESUME;
  const hasResume = () => !!ctx.getResume();

  // ---------- feed loading ----------
  async function loadFeed(url) {
    status(`Loading ${url}…`);
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const feed = await res.json();
      const jobs = Array.isArray(feed) ? feed : feed.jobs || [];
      setJobs(jobs, `${jobs.length} jobs from the feed${feed.generatedAt ? `, updated ${new Date(feed.generatedAt).toLocaleString()}` : ''}`);
    } catch (e) {
      status(`Couldn't load the feed (${e.message}).${ctx.isHosted() ? ' This hosted page cannot reach other websites; use the downloadable app or the sample listings.' : ''}`, true);
    }
  }

  async function loadLive(text) {
    const boards = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
      const [source, slug] = l.split(/[:\s]+/);
      return source === 'arbeitnow' ? { source, pages: Number(slug) || 1 } : { source, slug };
    });
    if (!boards.length) return status('Add at least one board, e.g. "greenhouse:gitlab".', true);
    status(`Fetching ${boards.length} boards…`);
    const { jobs, errors } = await fetchBoards(boards, fetch, { onProgress: (n, t) => status(`Fetched ${n} of ${t} boards…`) });
    setJobs(dedupeJobs([...jobs, ...st.jobs.filter((j) => j.source !== 'sample')]), `${jobs.length} jobs fetched live`);
    if (errors.length) status(`${errors.length} boards failed: ${errors.slice(0, 3).join('; ')}${ctx.isHosted() ? '. This hosted page cannot reach other websites.' : '. Some boards block requests from browsers; the scheduled feed does not have that problem.'}`, true);
  }

  function addPasted() {
    const title = $('#pj-title').value.trim(), company = $('#pj-company').value.trim(), description = $('#pj-desc').value.trim(), url = $('#pj-url').value.trim();
    if (!title || description.length < 40) return status('Add a job title and paste the full job description.', true);
    const job = { id: `pasted:${Date.now()}`, source: 'pasted', sourceLabel: 'Pasted', attribution: 'Pasted by you', company: company || 'Unknown company', title, location: '', remote: /remote/i.test(description),
      description, url: url || '', applyUrl: url || '', postedAt: new Date().toISOString(), salary: null };
    st.jobs = [job, ...st.jobs];
    ['#pj-title', '#pj-company', '#pj-desc', '#pj-url'].forEach((s) => ($(s).value = ''));
    save(); renderList(); select(job.id);
  }

  function setJobs(jobs, info) {
    st.jobs = jobs; st.feedInfo = info; st.selected = null;
    save(); status(''); renderList(); renderDetail();
  }

  function status(msg, err) {
    const el = $('#jobs-status');
    el.hidden = !msg; el.textContent = msg; el.className = 'status' + (err ? ' error' : '');
  }

  // ---------- list ----------
  let ranked = [];
  function renderList() {
    const f = st.filters;
    ranked = rankJobs(resume(), st.jobs, { query: f.q, location: f.loc, remote: f.remote, limit: 150 });
    $('#feed-info').textContent = st.jobs.length ? `${st.feedInfo || st.jobs.length + ' jobs'} · showing ${ranked.length}` : '';
    $('#no-resume-note').hidden = hasResume();
    const tracked = new Set(st.apps.map((a) => a.id));
    $('#job-list').innerHTML = ranked.length ? ranked.map(({ job, match }) => `
      <li class="job ${st.selected === job.id ? 'sel' : ''}" data-id="${esc(job.id)}" tabindex="0">
        <div class="job-score" data-band="${!hasResume() ? 'none' : match.score >= 70 ? 'good' : match.score >= 45 ? 'ok' : 'low'}">${hasResume() ? match.score : '–'}<small>${hasResume() ? 'match' : ''}</small></div>
        <div class="job-main">
          <div class="job-title">${esc(job.title)}</div>
          <div class="job-meta">${esc(job.company)}${job.location ? ' · ' + esc(job.location) : ''}${job.remote ? ' · <b>Remote</b>' : ''}${job.salary?.text ? ' · ' + esc(job.salary.text) : ''}</div>
          ${hasResume() && match.reasons.length ? `<div class="job-why">${esc(match.reasons.join(' · '))}</div>` : ''}
          <div class="job-src">${esc(job.attribution || job.sourceLabel || '')}${job.postedAt ? ' · ' + ago(job.postedAt) : ''}${tracked.has(job.id) ? ' · <b>In tracker</b>' : ''}</div>
        </div>
      </li>`).join('') : `<li class="empty">${st.jobs.length ? 'No jobs match these filters.' : 'No jobs loaded yet. Load the feed, fetch boards, paste a job, or try the sample listings.'}</li>`;
  }

  function ago(iso) {
    const d = Math.round((Date.now() - Date.parse(iso)) / 864e5);
    return d <= 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`;
  }

  // ---------- detail: tailoring + letter ----------
  function select(id) {
    st.selected = id;
    const job = st.jobs.find((j) => j.id === id) || st.apps.find((a) => a.id === id)?.job;
    const app = st.apps.find((a) => a.id === id);
    st.letter = app?.letter || (job && hasResume() ? templateLetter(resume(), job) : '');
    renderList(); renderDetail();
    if (window.innerWidth < 900) $('#job-detail').scrollIntoView({ behavior: 'smooth' });
  }

  function renderDetail() {
    const el = $('#job-detail');
    const job = st.jobs.find((j) => j.id === st.selected) || st.apps.find((a) => a.id === st.selected)?.job;
    if (!job) { el.innerHTML = '<div class="placeholder">Pick a job to see how your resume fits, what to change, and a cover letter draft.</div>'; return; }
    const t = hasResume() ? tailorResume(resume(), job) : null;
    const tracked = st.apps.some((a) => a.id === job.id);
    const chips = (arr, cls) => arr.map((k) => `<span class="chip ${cls}">${esc(k)}</span>`).join('');
    el.innerHTML = `
      <div class="detail-head">
        <div><h2>${esc(job.title)}</h2><div class="job-meta">${esc(job.company)}${job.location ? ' · ' + esc(job.location) : ''}${job.remote ? ' · Remote' : ''}${job.salary?.text ? ' · ' + esc(job.salary.text) : ''}</div>
        <div class="job-src">${esc(job.attribution || '')}</div></div>
        <div class="detail-actions">
          <button class="btn ${tracked ? 'ghost' : ''}" type="button" id="track-btn">${tracked ? 'In tracker' : 'Save to tracker'}</button>
          ${job.applyUrl ? `<a class="btn ghost" href="${esc(job.applyUrl)}" target="_blank" rel="noopener">Open posting ↗</a>` : ''}
        </div>
      </div>
      ${t ? `
      <section class="tailor">
        <h3>Fit with your resume${t.coverage !== null ? ` <span class="cov">${t.coverage}% of the skills it names</span>` : ''}</h3>
        ${t.matched.length ? `<p class="lbl">Shown in your bullets</p><div>${chips(t.matched, 'good')}</div>` : ''}
        ${t.listedOnly.length ? `<p class="lbl">Listed, but no bullet proves it</p><div>${chips(t.listedOnly, 'ok')}</div>` : ''}
        ${t.missing.length ? `<p class="lbl">Not on your resume</p><div>${chips(t.missing, 'low')}</div>` : ''}
        ${t.suggestions.length ? `<ul class="sugg">${t.suggestions.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
        ${t.changes.length ? `<button class="btn ghost" type="button" id="apply-tailor">Reorder my bullets and skills for this job</button><p class="hint">Moves your most relevant points first. Adds nothing.</p>` : ''}
      </section>
      <section class="letter">
        <div class="letter-head"><h3>Cover letter</h3>
          <span>${ctx.isHosted() ? '' : `<button class="btn ghost" type="button" id="ai-letter">${st.ai.provider ? 'Improve with AI' : 'Set up AI…'}</button>`}
          <button class="btn ghost" type="button" id="letter-reset">Reset draft</button>
          <button class="btn ghost" type="button" id="letter-copy">Copy</button>
          <button class="btn ghost" type="button" id="letter-dl">Download .txt</button></span></div>
        <textarea id="letter-text" rows="16">${esc(st.letter)}</textarea>
        <p class="hint" id="letter-note">Built only from your resume's facts. Read it, make it yours, then send.${ctx.isHosted() ? ' AI rewriting works in the downloadable app.' : ''}</p>
      </section>` : '<p class="placeholder">Add your resume on the Resume tab to see your fit and get a cover letter draft.</p>'}
      <details class="desc" ${t ? '' : 'open'}><summary>Job description</summary><div class="desc-body">${esc(job.description).replace(/\n/g, '<br>')}</div></details>`;
  }

  async function aiLetter() {
    if (!st.ai.provider) { ctx.showTab('settings'); return; }
    const job = st.jobs.find((j) => j.id === st.selected) || st.apps.find((a) => a.id === st.selected)?.job;
    const note = $('#letter-note'), btn = $('#ai-letter');
    btn.disabled = true; note.textContent = `Asking ${PROVIDERS[st.ai.provider].label}…`;
    try {
      const out = await generate(st.ai, letterPrompt(resume(), job, $('#letter-text').value, { locale: ctx.getLocale() }));
      st.letter = out; $('#letter-text').value = out; persistLetter();
      note.textContent = 'AI draft. Check every sentence against your real experience before sending.';
    } catch (e) {
      note.textContent = `AI request failed: ${e.message}${st.ai.provider === 'ollama' ? ' (Is Ollama running? Start it with OLLAMA_ORIGINS=* so this page may call it.)' : ''}`;
    } finally { btn.disabled = false; }
  }

  function persistLetter() {
    if (st.apps.some((a) => a.id === st.selected)) { st.apps = updateApplication(st.apps, st.selected, { letter: st.letter }); save(); }
  }

  function onDetailClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const job = st.jobs.find((j) => j.id === st.selected) || st.apps.find((a) => a.id === st.selected)?.job;
    if (b.id === 'track-btn' && job) { st.apps = trackJob(st.apps, job, 'saved'); st.apps = updateApplication(st.apps, job.id, { letter: st.letter }); save(); renderList(); renderDetail(); renderTracker(); }
    if (b.id === 'apply-tailor' && job) { ctx.setResume(tailorResume(resume(), job).tailoredResume); renderDetail(); b.textContent = 'Done'; }
    if (b.id === 'letter-reset' && job) { st.letter = templateLetter(resume(), job); $('#letter-text').value = st.letter; persistLetter(); }
    if (b.id === 'letter-copy') navigator.clipboard?.writeText($('#letter-text').value).then(() => (b.textContent = 'Copied'), () => (b.textContent = 'Copy blocked'));
    if (b.id === 'letter-dl' && job) ctx.download(`cover-letter-${(job.company || 'job').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`, $('#letter-text').value, 'text/plain');
    if (b.id === 'ai-letter') aiLetter();
  }

  // ---------- tracker ----------
  function renderTracker() {
    $('#tracker-count').textContent = st.apps.length ? `(${st.apps.length})` : '';
    $('#board').innerHTML = STAGES.map((s) => {
      const items = st.apps.filter((a) => a.stage === s);
      return `<div class="col"><h4>${STAGE_LABELS[s]} <small>${items.length}</small></h4>${items.map((a) => `
        <div class="card" data-id="${esc(a.id)}">
          <div class="card-title">${esc(a.job.title)}</div>
          <div class="job-meta">${esc(a.job.company)}${a.job.location ? ' · ' + esc(a.job.location) : ''}</div>
          <select data-stage aria-label="Stage">${STAGES.map((x) => `<option value="${x}" ${x === a.stage ? 'selected' : ''}>${STAGE_LABELS[x]}</option>`).join('')}</select>
          <textarea data-notes rows="2" placeholder="Notes: contact, dates, next step">${esc(a.notes)}</textarea>
          <div class="card-actions"><button type="button" data-open>Letter &amp; fit</button>${a.job.applyUrl ? `<a href="${esc(a.job.applyUrl)}" target="_blank" rel="noopener">Posting ↗</a>` : ''}<button type="button" data-remove>Remove</button></div>
          <div class="card-date">Updated ${new Date(a.updatedAt).toLocaleDateString()}</div>
        </div>`).join('') || '<div class="col-empty">—</div>'}</div>`;
    }).join('');
    $('#tracker-empty').hidden = st.apps.length > 0;
  }

  let removeArmed = '';
  function onBoard(e) {
    const card = e.target.closest('.card'); if (!card) return;
    const id = card.dataset.id;
    if (e.type === 'change' && e.target.matches('[data-stage]')) { st.apps = moveApplication(st.apps, id, e.target.value); save(); renderTracker(); }
    if (e.type === 'input' && e.target.matches('[data-notes]')) { st.apps = updateApplication(st.apps, id, { notes: e.target.value }); save(); }
    if (e.type === 'click' && e.target.matches('[data-open]')) { ctx.showTab('jobs'); select(id); }
    if (e.type === 'click' && e.target.matches('[data-remove]')) {
      if (removeArmed === id) { st.apps = removeApplication(st.apps, id); save(); renderTracker(); renderList(); removeArmed = ''; }
      else { removeArmed = id; e.target.textContent = 'Click again to remove'; setTimeout(() => { if (removeArmed === id) { removeArmed = ''; e.target.textContent = 'Remove'; } }, 3000); }
    }
  }

  // ---------- settings ----------
  function renderSettings() {
    $('#ai-provider').innerHTML = `<option value="">Off (template letters only)</option>` + Object.entries(PROVIDERS).map(([k, p]) => `<option value="${k}">${esc(p.label)}</option>`).join('');
    $('#ai-provider').value = st.ai.provider || '';
    syncSettings();
  }
  function syncSettings() {
    const p = PROVIDERS[st.ai.provider];
    $('#ai-model').value = st.ai.model || ''; $('#ai-model').placeholder = p?.model || '';
    $('#ai-base').value = st.ai.baseUrl || ''; $('#ai-base').placeholder = p?.baseUrl || '';
    $('#ai-key').value = st.ai.apiKey || '';
    $('#ai-key-row').hidden = !p?.needsKey;
    $('#ai-fields').hidden = !p;
    $('#ai-hosted').hidden = !ctx.isHosted();
  }
  function onSettings(e) {
    const t = e.target;
    if (t.id === 'ai-provider') { st.ai = { provider: t.value, model: '', baseUrl: '', apiKey: st.ai.apiKey && PROVIDERS[t.value]?.needsKey ? st.ai.apiKey : '' }; syncSettings(); }
    if (t.id === 'ai-model') st.ai.model = t.value.trim();
    if (t.id === 'ai-base') st.ai.baseUrl = t.value.trim();
    if (t.id === 'ai-key') st.ai.apiKey = t.value.trim();
    save();
  }
  async function testAI() {
    const out = $('#ai-test-out'); out.textContent = 'Testing…';
    try { out.textContent = 'Works: ' + (await generate(st.ai, { system: 'Reply with one short sentence.', prompt: 'Say hello to a job seeker.' })).slice(0, 160); }
    catch (e) { out.textContent = 'Failed: ' + e.message; }
  }

  // ---------- wire ----------
  const defaultFeed = () => (location.protocol.startsWith('http') && !ctx.isHosted() ? new URL('jobs.json', location.href).href : '');
  $('#feed-url').value = defaultFeed();
  $('#load-feed').addEventListener('click', () => { const u = $('#feed-url').value.trim(); if (u) loadFeed(u); else status('Enter the address of a jobs.json feed.', true); });
  $('#load-live').addEventListener('click', () => loadLive($('#live-boards').value));
  $('#load-sample').addEventListener('click', () => setJobs(SAMPLE_JOBS.map((j) => ({ ...j })), `${SAMPLE_JOBS.length} fictional sample listings`));
  $('#pj-add').addEventListener('click', addPasted);
  $('#f-q').addEventListener('input', (e) => { st.filters.q = e.target.value; renderList(); });
  $('#f-loc').addEventListener('input', (e) => { st.filters.loc = e.target.value; renderList(); });
  $('#f-remote').addEventListener('change', (e) => { st.filters.remote = e.target.checked; renderList(); });
  $('#job-list').addEventListener('click', (e) => { const li = e.target.closest('.job'); if (li) select(li.dataset.id); });
  $('#job-list').addEventListener('keydown', (e) => { const li = e.target.closest('.job'); if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(li.dataset.id); } });
  $('#job-detail').addEventListener('click', onDetailClick);
  $('#job-detail').addEventListener('input', (e) => { if (e.target.id === 'letter-text') { st.letter = e.target.value; persistLetter(); } });
  ['change', 'input', 'click'].forEach((ev) => $('#board').addEventListener(ev, onBoard));
  $('#settings').addEventListener('input', onSettings);
  $('#settings').addEventListener('change', onSettings);
  $('#ai-test').addEventListener('click', testAI);
  $('#ai-clear').addEventListener('click', () => { st.ai = { provider: '', model: '', baseUrl: '', apiKey: '' }; save(); renderSettings(); });
  $('#hosted-note').hidden = !ctx.isHosted();

  renderList(); renderDetail(); renderTracker(); renderSettings();
  // Auto-load the published feed when served next to one and nothing is loaded yet.
  if (!st.jobs.length && defaultFeed()) loadFeed(defaultFeed());

  return {
    onResumeChange() { renderList(); if (st.selected) { const app = st.apps.find((a) => a.id === st.selected); if (!app?.letter) { const job = st.jobs.find((j) => j.id === st.selected); if (job) st.letter = templateLetter(resume(), job); } renderDetail(); } },
    onShow(tab) { if (tab === 'jobs') renderList(); if (tab === 'tracker') renderTracker(); },
    hostedChanged() { renderDetail(); syncSettings(); $('#hosted-note').hidden = !ctx.isHosted(); $('#feed-url').value = defaultFeed(); },
  };
}
