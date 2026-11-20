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
  const st = { jobs: [], feedInfo: '', apps: [], ai: { provider: '', model: '', baseUrl: '', apiKey: '' }, answers: {}, drafts: {}, selected: null, applyStep: null, filters: { q: '', loc: '', remote: false } };

  // ---------- storage ----------
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify({ jobs: st.jobs.slice(0, 400), feedInfo: st.feedInfo, apps: st.apps, ai: st.ai, answers: st.answers, drafts: st.drafts })); } catch {}
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
    st.applyStep = null;
    renderList(); renderDetail();
    if (window.innerWidth < 900) $('#job-detail').scrollIntoView({ behavior: 'smooth' });
  }

  const currentJob = () => st.jobs.find((j) => j.id === st.selected) || st.apps.find((a) => a.id === st.selected)?.job;
  const appFor = (id) => st.apps.find((a) => a.id === id);
  const chips = (arr, cls) => arr.map((k) => `<span class="chip ${cls}">${esc(k)}</span>`).join('');
  const slug = (x) => String(x || '').replace(/[\\/:*?"<>|]+/g, '').trim();

  // The per-job draft: tailoring options, the tailored resume, and the letter.
  function draftFor(job) {
    st.drafts ||= {};
    const d = st.drafts[job.id] ||= { trimOlder: false, headline: false, letter: '' };
    const t = tailorResume(resume(), job, d);
    if (!d.letter) d.letter = appFor(job.id)?.letter || templateLetter(t.tailoredResume, job);
    return { d, t };
  }

  function renderDetail() {
    const el = $('#job-detail');
    const job = currentJob();
    if (!job) { el.innerHTML = '<div class="placeholder">Pick a job to see how your resume fits, then apply with a resume tailored to it.</div>'; return; }
    if (st.applyStep && hasResume()) return renderApply(job);
    const t = hasResume() ? tailorResume(resume(), job) : null;
    const app = appFor(job.id);
    el.innerHTML = `
      <div class="detail-head">
        <div><h2>${esc(job.title)}</h2><div class="job-meta">${esc(job.company)}${job.location ? ' · ' + esc(job.location) : ''}${job.remote ? ' · Remote' : ''}${job.salary?.text ? ' · ' + esc(job.salary.text) : ''}</div>
        <div class="job-src">${esc(job.attribution || '')}${app ? ` · <b>${esc(STAGE_LABELS[app.stage])}</b>` : ''}</div></div>
        <div class="detail-actions">
          ${hasResume() ? `<button class="btn" type="button" data-apply-start>${app?.stage === 'applied' ? 'Apply again' : 'Apply with Applykin'}</button>` : ''}
          <button class="btn ghost" type="button" id="track-btn">${app ? 'In tracker' : 'Save'}</button>
        </div>
      </div>
      ${t ? `
      <section class="tailor">
        <h3>Fit with your resume${t.coverage !== null ? ` <span class="cov">${t.coverage}% of the skills it names</span>` : ''}</h3>
        ${t.matched.length ? `<p class="lbl">Shown in your bullets</p><div>${chips(t.matched, 'good')}</div>` : ''}
        ${t.listedOnly.length ? `<p class="lbl">Listed, but no bullet proves it</p><div>${chips(t.listedOnly, 'ok')}</div>` : ''}
        ${t.missing.length ? `<p class="lbl">Not on your resume</p><div>${chips(t.missing, 'low')}</div>` : ''}
        ${t.suggestions.length ? `<ul class="sugg">${t.suggestions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      </section>` : '<p class="placeholder">Add your resume on the Resume tab to see your fit and apply with a tailored resume.</p>'}
      <details class="desc" ${t ? '' : 'open'}><summary>Job description</summary><div class="desc-body">${esc(job.description).replace(/\n/g, '<br>')}</div></details>`;
  }

  // ---------- Apply with Applykin: Tailor -> Letter -> Apply ----------
  const APPLY_STEPS = [['tailor', 'Tailor resume'], ['letter', 'Cover letter'], ['send', 'Apply']];
  function renderApply(job) {
    const el = $('#job-detail');
    const { d, t } = draftFor(job);
    const stepIdx = APPLY_STEPS.findIndex(([k]) => k === st.applyStep);
    const head = `
      <div class="apply-head"><button type="button" class="linkish" data-apply-close>← ${esc(job.title)} at ${esc(job.company)}</button>
      <ol class="apply-steps">${APPLY_STEPS.map(([k, label], i) => `<li class="${i < stepIdx ? 'done' : i === stepIdx ? 'current' : ''}"><button type="button" data-apply-step="${k}"><span>${i < stepIdx ? '✓' : i + 1}</span>${label}</button></li>`).join('')}</ol></div>`;
    let body = '';
    if (st.applyStep === 'tailor') {
      const sc = ctx.scoreOf(t.tailoredResume);
      body = `
        <h3>Your resume, tailored to this job</h3>
        <p class="hint">Applykin only rearranges and renames what is already in your resume. It never adds skills, results or experience. Your main resume is not changed.</p>
        <div class="opts">
          <label class="check"><input type="checkbox" checked disabled> Put the most relevant bullets and skills first, and use the job ad's spelling for skills you already have</label>
          <label class="check"><input type="checkbox" data-opt="trimOlder" ${d.trimOlder ? 'checked' : ''}> Leave out bullets from older jobs that relate to nothing in this ad (keeps at least 2 per job)</label>
          ${t.headlineOption ? `<label class="check"><input type="checkbox" data-opt="headline" ${d.headline ? 'checked' : ''}> Use "${esc(t.headlineOption)}" as my headline <small>(only if it truly describes you)</small></label>` : ''}
        </div>
        <p class="lbl">Changes in this version (${t.changes.length})</p>
        ${t.changes.length ? `<ul class="changes">${t.changes.map((c) => `<li data-kind="${c.kind}">${esc(c.text)}</li>`).join('')}</ul>` : '<p class="hint">Nothing to change: your resume already leads with what this job asks for.</p>'}
        ${t.missing.length ? `<p class="hint">Not added, because they're not on your resume: ${esc(t.missing.slice(0, 8).join(', '))}. If you really have any of these, add them to your main resume first.</p>` : ''}
        <div class="mini-preview"><iframe title="Tailored resume preview" data-apply-preview></iframe></div>
        <p class="hint">Quality ${sc.quality} · ATS readability ${sc.ats}</p>
        <div class="step-nav"><span></span><button type="button" class="btn" data-apply-step="letter">Use this version →</button></div>`;
    } else if (st.applyStep === 'letter') {
      body = `
        <div class="letter-head"><h3>Cover letter</h3>
          <span>${ctx.isHosted() ? '' : `<button class="btn ghost small" type="button" id="ai-letter">${st.ai.provider ? 'Improve with AI' : 'Set up AI…'}</button>`}
          <button class="btn ghost small" type="button" id="letter-reset">Start over</button></span></div>
        <textarea id="letter-text" rows="15">${esc(d.letter)}</textarea>
        <p class="hint" id="letter-note">Written only from your resume's facts. Make it yours: add why this company and this role.${ctx.isHosted() ? ' AI rewriting works in the downloadable app.' : ''}</p>
        <div class="step-nav"><button type="button" class="btn ghost" data-apply-step="tailor">← Tailor resume</button><button type="button" class="btn" data-apply-step="send">Next: apply →</button></div>`;
    } else {
      const name = slug(resume().basics?.name || 'Resume');
      const answers = answerList();
      body = `
        <h3>Ready to apply</h3>
        <ol class="send-list">
          <li><b>Download your documents</b>
            <div class="row-btns"><button type="button" class="btn" data-dl="resume">Resume (PDF)</button><button type="button" class="btn ghost" data-dl="letter">Cover letter (PDF)</button><button type="button" class="btn ghost small" data-copy-letter>Copy letter text</button></div>
            <small>Saved as "${esc(name)} – ${esc(slug(job.company))} – ${esc(slug(job.title))}". In the print window, choose "Save as PDF".</small></li>
          <li><b>Open the employer's application</b>
            <div class="row-btns">${job.applyUrl ? `<a class="btn" href="${esc(job.applyUrl)}" target="_blank" rel="noopener" data-opened>Open application ↗</a>` : '<span class="hint">No application link for this job. Use the link in the job ad.</span>'}</div>
            <small>Upload the resume and letter, and paste answers below. Check everything before you submit.</small></li>
          <li><b>Copy your answers</b>
            ${answers.length ? `<ul class="answers">${answers.map(([label, val], i) => `<li><span>${esc(label)}</span><b>${esc(val)}</b><button type="button" class="btn ghost small" data-copy-answer="${i}">Copy</button></li>`).join('')}</ul>` : ''}
            <button type="button" class="linkish" data-goto-settings>${answers.length > 4 ? 'Edit' : 'Add'} your saved answers</button> <small>(work authorization, notice period, salary…)</small></li>
          <li><b>Mark it as applied</b>
            <div class="row-btns"><button type="button" class="btn ${appFor(job.id)?.stage === 'applied' ? 'ghost' : ''}" data-applied>${appFor(job.id)?.stage === 'applied' ? '✓ Applied. Update the saved version' : "I've applied"}</button></div>
            <small>The tracker keeps the exact resume and letter you sent, so you can see later what worked.</small></li>
        </ol>
        <div class="step-nav"><button type="button" class="btn ghost" data-apply-step="letter">← Cover letter</button><span></span></div>`;
    }
    el.innerHTML = head + `<div class="apply-body">${body}</div>`;
    const frame = el.querySelector('[data-apply-preview]');
    if (frame) frame.srcdoc = ctx.renderHTML(t.tailoredResume);
  }

  function answerList() {
    const a = st.answers || {};
    const b = resume().basics || {};
    const loc = [b.location?.city, b.location?.region].filter(Boolean).join(', ');
    const links = [b.url, ...(b.profiles || []).map((p) => p.url)].filter(Boolean);
    return [
      ['Full name', b.name], ['Email', b.email], ['Phone', b.phone], ['Location', loc],
      ...links.map((u) => [/linkedin/i.test(u) ? 'LinkedIn' : 'Website', u]),
      ['Authorized to work', a.workAuth], ['Needs visa sponsorship', a.sponsorship], ['Earliest start / notice', a.notice],
      ['Salary expectation', a.salary], ['Willing to relocate', a.relocate], ['Pronouns', a.pronouns],
    ].filter(([, v]) => v);
  }

  function snapshot(job, d, t) {
    const sc = ctx.scoreOf(t.tailoredResume);
    const base = ctx.scoreOf(resume());
    return { appliedAt: new Date().toISOString(), template: ctx.getTemplate(), atsLevel: ctx.atsLevel(), quality: sc.quality, ats: sc.ats, baseQuality: base.quality,
      tailored: t.changes.length > 0, changes: t.changes.map((c) => c.text), match: t.coverage, resume: t.tailoredResume, letter: d.letter };
  }

  async function aiLetter() {
    if (!st.ai.provider) { ctx.showTab('settings'); return; }
    const job = currentJob();
    const { d, t } = draftFor(job);
    const note = $('#letter-note'), btn = $('#ai-letter');
    btn.disabled = true; note.textContent = `Asking ${PROVIDERS[st.ai.provider].label}…`;
    try {
      const out = await generate(st.ai, letterPrompt(t.tailoredResume, job, $('#letter-text').value, { locale: ctx.getLocale() }));
      d.letter = out; $('#letter-text').value = out; save();
      note.textContent = 'AI draft. Check every sentence against your real experience before sending.';
    } catch (e) {
      note.textContent = `AI request failed: ${e.message}${st.ai.provider === 'ollama' ? ' (Is Ollama running? Start it with OLLAMA_ORIGINS=* so this page may call it.)' : ''}`;
    } finally { btn.disabled = false; }
  }

  function onDetailClick(e) {
    const job = currentJob();
    if (!job) return;
    const t0 = e.target;
    if (t0.closest('[data-apply-start]')) { st.applyStep = 'tailor'; return renderDetail(); }
    if (t0.closest('[data-apply-close]')) { st.applyStep = null; return renderDetail(); }
    const stepBtn = t0.closest('[data-apply-step]');
    if (stepBtn) { st.applyStep = stepBtn.dataset.applyStep; save(); renderDetail(); $('#job-detail').scrollTop = 0; return; }
    if (t0.closest('[data-goto-settings]')) return ctx.showTab('settings');
    const b = t0.closest('button, a');
    if (!b) return;
    const { d, t } = hasResume() ? draftFor(job) : {};
    if (b.id === 'track-btn') { st.apps = trackJob(st.apps, job, 'saved'); save(); renderList(); renderDetail(); renderTracker(); }
    if (b.id === 'letter-reset') { d.letter = templateLetter(t.tailoredResume, job); $('#letter-text').value = d.letter; save(); }
    if (b.id === 'ai-letter') aiLetter();
    const base = `${slug(resume().basics?.name || 'Resume')} – ${slug(job.company)} – ${slug(job.title)}`;
    if (b.dataset.dl === 'resume') ctx.printHTML(ctx.renderHTML(t.tailoredResume, base), `${base}.html`);
    if (b.dataset.dl === 'letter') ctx.printHTML(ctx.renderLetter(t.tailoredResume, d.letter, job, `${base} – Cover letter`), `${base} – Cover letter.html`);
    if ('copyLetter' in b.dataset) copy(d.letter, b);
    if (b.dataset.copyAnswer) copy(answerList()[Number(b.dataset.copyAnswer)][1], b);
    if ('opened' in b.dataset) {
      if (!appFor(job.id)) st.apps = trackJob(st.apps, job, 'preparing');
      else if (appFor(job.id).stage === 'saved') st.apps = moveApplication(st.apps, job.id, 'preparing');
      save(); renderTracker(); renderList();
    }
    if ('applied' in b.dataset) {
      if (!appFor(job.id)) st.apps = trackJob(st.apps, job, 'saved');
      st.apps = moveApplication(st.apps, job.id, 'applied');
      st.apps = updateApplication(st.apps, job.id, { letter: d.letter, sent: snapshot(job, d, t) });
      save(); renderTracker(); renderList(); renderDetail();
    }
  }

  function copy(text, btn) {
    const done = () => { const old = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = old), 1500); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => (btn.textContent = 'Copy blocked'));
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
          ${a.sent ? `<div class="card-sent">Sent ${new Date(a.sent.appliedAt).toLocaleDateString()} · ${a.sent.tailored ? 'tailored' : 'main'} resume · quality ${a.sent.quality} · ATS ${a.sent.ats}</div>` : ''}
          <div class="card-date">Updated ${new Date(a.updatedAt).toLocaleDateString()}</div>
        </div>`).join('') || '<div class="col-empty">—</div>'}</div>`;
    }).join('');
    $('#tracker-empty').hidden = st.apps.length > 0;
    renderResults();
  }

  // ---------- your results (on this device only) ----------
  // A reply = the application reached Interview or Offer. Small numbers are labelled as such.
  function renderResults() {
    const sent = st.apps.filter((a) => a.sent || ['applied', 'interview', 'offer', 'closed'].includes(a.stage));
    const replied = (a) => a.history?.some((h) => h.stage === 'interview' || h.stage === 'offer');
    const rate = (list) => (list.length ? `${list.filter(replied).length} of ${list.length} (${Math.round(100 * list.filter(replied).length / list.length)}%)` : '—');
    const groups = [
      ['Tailored resume', sent.filter((a) => a.sent?.tailored)], ['Main resume', sent.filter((a) => a.sent && !a.sent.tailored)],
      ['"Best for ATS" design', sent.filter((a) => a.sent?.atsLevel === 'best')], ['Other designs', sent.filter((a) => a.sent && a.sent.atsLevel !== 'best')],
      ['Quality 90+', sent.filter((a) => a.sent?.quality >= 90)], ['Quality under 90', sent.filter((a) => a.sent && a.sent.quality < 90)],
    ].filter(([, l]) => l.length);
    $('#results').hidden = sent.length === 0;
    $('#results').innerHTML = `<h3>Your results</h3>
      <p class="results-main"><b>${rate(sent)}</b> applications led to an interview or offer.</p>
      ${groups.length ? `<table class="results-table"><tbody>${groups.map(([label, l]) => `<tr><td>${esc(label)}</td><td>${rate(l)}</td></tr>`).join('')}</tbody></table>` : ''}
      <p class="hint">${sent.length < 10 ? 'Fewer than 10 applications so far, so these numbers can swing a lot. ' : ''}Move a card to Interview or Offer when you hear back. These numbers stay on this device.</p>`;
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
  const ANSWER_FIELDS = [['workAuth', 'Authorized to work in', 'e.g. United States (citizen)'], ['sponsorship', 'Need visa sponsorship?', 'e.g. No'],
    ['notice', 'Earliest start / notice period', 'e.g. 2 weeks'], ['salary', 'Salary expectation', 'e.g. $95,000–110,000'],
    ['relocate', 'Willing to relocate?', 'e.g. Within Southern California'], ['pronouns', 'Pronouns (optional)', '']];
  function renderAnswers() {
    $('#answers').innerHTML = ANSWER_FIELDS.map(([k, label, ph]) => `<label class="field"><span>${esc(label)}</span><input data-answer="${k}" value="${esc(st.answers?.[k] || '')}" placeholder="${esc(ph)}"></label>`).join('');
  }
  function renderSettings() {
    renderAnswers();
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
  $('#job-detail').addEventListener('input', (e) => {
    const job = currentJob(); if (!job) return;
    if (e.target.id === 'letter-text') { draftFor(job).d.letter = e.target.value; save(); }
  });
  $('#job-detail').addEventListener('change', (e) => {
    const opt = e.target.dataset?.opt; const job = currentJob();
    if (opt && job) { draftFor(job).d[opt] = e.target.checked; save(); renderDetail(); }
  });
  ['change', 'input', 'click'].forEach((ev) => $('#board').addEventListener(ev, onBoard));
  $('#settings').addEventListener('input', onSettings);
  $('#settings').addEventListener('change', onSettings);
  $('#ai-test').addEventListener('click', testAI);
  $('#answers').addEventListener('input', (e) => { const k = e.target.dataset.answer; if (k) { st.answers = { ...(st.answers || {}), [k]: e.target.value.trim() }; save(); } });
  $('#ai-clear').addEventListener('click', () => { st.ai = { provider: '', model: '', baseUrl: '', apiKey: '' }; save(); renderSettings(); });
  $('#hosted-note').hidden = !ctx.isHosted();

  renderList(); renderDetail(); renderTracker(); renderSettings();
  // Auto-load the published feed when served next to one and nothing is loaded yet.
  if (!st.jobs.length && defaultFeed()) loadFeed(defaultFeed());

  return {
    onResumeChange() { renderList(); if (st.selected && !st.applyStep) renderDetail(); },
    onShow(tab) { if (tab === 'jobs') renderList(); if (tab === 'tracker') renderTracker(); },
    hostedChanged() { renderDetail(); syncSettings(); $('#hosted-note').hidden = !ctx.isHosted(); $('#feed-url').value = defaultFeed(); },
  };
}
