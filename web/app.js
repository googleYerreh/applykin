// Applykin web app. Everything runs in the browser: the resume never leaves this device.
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import workerSource from 'pdfjs-dist/build/pdf.worker.min.mjs';
import mammoth from 'mammoth/mammoth.browser.min.js';
import { parseResume, scoreResume, renderResumeHTML, extractPdfText, extractDocxText, detectKind, RUBRIC, CATEGORIES, LOCALES, TEMPLATES, FONTS, ACCENTS, DEFAULT_DESIGN, ATS_LEVELS, PARSER_VERSION } from '../core/index.js';
import { SAMPLES } from './samples.js';
import { initJobs } from './jobs-ui.js';

pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STORE = 'applykin.v1';
const OLD_STORE = 'openstep.v1'; // data saved before the rename

const state = { resume: null, template: 'classic', locale: 'us', fileName: '', design: { ...DEFAULT_DESIGN } };
const renderOpts = () => ({ template: state.template, locale: state.locale, design: state.design });

// ---------- storage (best effort; some contexts block it) ----------
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ resume: state.resume, template: state.template, locale: state.locale, design: state.design })); } catch {}
}
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || localStorage.getItem(OLD_STORE) || 'null');
    if (s?.resume) Object.assign(state, s, { design: { ...DEFAULT_DESIGN, ...(s.design || {}) } });
    const m = state.resume?.meta;
    if (m?.openstep && !m.applykin) { m.applykin = m.openstep; delete m.openstep; }
  } catch {}
}

// ---------- import ----------
async function importFile(file) {
  setStatus(`Reading ${file.name}…`);
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const kind = detectKind(file.name, buf);
    let resume;
    if (kind === 'json') resume = JSON.parse(new TextDecoder().decode(buf));
    else {
      const text = kind === 'pdf' ? await extractPdfText(pdfjs, buf)
        : kind === 'docx' ? await extractDocxText(mammoth, buf.buffer)
        : new TextDecoder().decode(buf);
      resume = parseResume(text);
    }
    state.fileName = file.name;
    load(resume);
    setStatus('');
  } catch (e) {
    console.error(e);
    setStatus(`Couldn't read that file (${e.message}). Try a PDF exported from Word or Google Docs, a .docx, or paste the text.`, true);
  }
}

function load(resume) {
  state.resume = resume;
  if (/[äöüß]|berufserfahrung|ausbildung/i.test(resume.meta?.applykin?.sourceText || '')) state.locale = state.locale === 'us' ? 'de' : state.locale;
  save();
  $('#start').hidden = true;
  $('#workspace').hidden = false;
  $('#new').hidden = false;
  renderEditor();
  refresh();
  window.scrollTo({ top: 0 });
}

function setStatus(msg, isError) {
  const el = $('#status');
  el.textContent = msg;
  el.className = 'status' + (isError ? ' error' : '');
  el.hidden = !msg;
}

// ---------- score + preview ----------
let refreshTimer;
function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { save(); refresh(); }, 250); }

function refresh() {
  const r = state.resume;
  const s = scoreResume(r, { template: state.template });
  $('#overall').textContent = s.overall;
  $('#overall-ring').style.setProperty('--p', s.overall);
  $('#overall-ring').dataset.band = s.overall >= 80 ? 'good' : s.overall >= 60 ? 'ok' : 'low';
  $('#verdict').textContent = s.overall >= 85 ? 'Strong. Polish the last details.' : s.overall >= 70 ? 'Good base. A few fixes will lift it.' : s.overall >= 50 ? 'Needs work. Start with the top fixes.' : 'Big gains available. Start at the top of the list.';
  $('#cats').innerHTML = Object.entries(s.categories).map(([k, c]) => `
    <div class="cat"><div class="cat-row"><span>${esc(c.label)}</span><b>${c.score}</b></div><div class="bar"><i style="width:${c.score}%" data-band="${c.score >= 80 ? 'good' : c.score >= 60 ? 'ok' : 'low'}"></i></div></div>`).join('');
  $('#fixes').innerHTML = s.fixes.length
    ? s.fixes.map((f) => `<li><div class="fix-head"><b>${esc(f.title)}</b><span class="gain">+${f.gain} pts</span></div><div class="fix-detail">${esc(f.detail)}</div><div class="fix-do">${esc(f.fix)}</div>${fixLabel(f.id) ? `<button type="button" class="fix-btn" data-fix="${esc(f.id)}">${fixLabel(f.id)}</button>` : ''}</li>`).join('')
    : '<li class="none">No fixes left. Nice work.</li>';
  $('#rubric').innerHTML = Object.entries(CATEGORIES).map(([k, c]) => `
    <h4>${esc(c.label)} <small>${Math.round(c.weight * 100)}% of total</small></h4>
    <ul>${s.checks.filter((x) => x.category === k).map((x) => `<li data-state="${x.score === null ? 'na' : x.score >= 1 ? 'pass' : x.score > 0 ? 'part' : 'fail'}"><span class="dot"></span><span><b>${esc(x.title)}</b> <small>weight ${x.weight}</small><br>${esc(x.detail)}</span></li>`).join('')}</ul>`).join('');
  const html = renderResumeHTML(r, renderOpts());
  const frame = $('#preview');
  frame.srcdoc = html;
  renderThumbs();
  jobsUI?.onResumeChange();
}

// ---------- editor ----------
const field = (path, label, value, opts = {}) => `
  <label class="field ${opts.wide ? 'wide' : ''}"><span>${esc(label)}</span>${opts.area
    ? `<textarea data-path="${path}" rows="${opts.rows || 3}" ${opts.list ? 'data-list="1"' : ''} placeholder="${esc(opts.ph || '')}">${esc(value)}</textarea>`
    : `<input data-path="${path}" value="${esc(value)}" placeholder="${esc(opts.ph || '')}">`}</label>`;

function renderEditor() {
  const r = state.resume;
  r.basics ||= {}; r.basics.location ||= {}; r.basics.profiles ||= [];
  for (const k of ['work', 'education', 'skills', 'languages']) r[k] ||= [];
  const b = r.basics;
  const links = [b.url, ...b.profiles.map((p) => p.url)].filter(Boolean).join('\n');
  $('#editor').innerHTML = `
    <details open data-section="contact"><summary>Contact</summary><div class="grid">
      ${field('basics.name', 'Full name', b.name)}
      ${field('basics.label', 'Headline', b.label, { ph: 'e.g. Senior Product Designer' })}
      ${field('basics.email', 'Email', b.email)}
      ${field('basics.phone', 'Phone', b.phone)}
      ${field('basics.location.city', 'City', b.location.city)}
      ${field('basics.location.region', 'Region / country', b.location.region)}
      ${field('basics._links', 'Links (one per line)', links, { area: true, rows: 2, wide: true })}
      <div class="field wide photo-field"><span>Photo (optional, stays on this device)</span>
        <div class="photo-row">${b.image ? `<img src="${b.image}" alt="Your photo">` : ''}<label class="btn ghost small">${b.image ? 'Change photo' : 'Add photo'}<input type="file" id="photo-input" accept="image/png,image/jpeg,image/webp" hidden></label>${b.image ? '<button type="button" class="btn ghost small" data-photo-remove>Remove</button>' : ''}</div></div>
    </div></details>
    <details open data-section="summary"><summary>Summary</summary>${field('basics.summary', '2–3 sentences', b.summary, { area: true, rows: 4, wide: true })}</details>
    <details open data-section="work"><summary>Experience <small>${r.work.length}</small></summary>
      ${r.work.map((w, i) => `<div class="entry-card"><div class="entry-tools"><b>${esc(w.position || 'Role')}${w.name ? ' — ' + esc(w.name) : ''}</b><span>
        <button type="button" data-move="work.${i}.-1" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="work.${i}.1" title="Move down" ${i === r.work.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-del="work.${i}" title="Remove">✕</button></span></div>
        <div class="grid">${field(`work.${i}.position`, 'Job title', w.position)}${field(`work.${i}.name`, 'Employer', w.name)}
        ${field(`work.${i}.startDate`, 'Start (YYYY-MM)', w.startDate)}${field(`work.${i}.endDate`, 'End (YYYY-MM, blank = present)', w.endDate)}
        ${field(`work.${i}.location`, 'Location', w.location)}
        ${field(`work.${i}.highlights`, 'Bullet points (one per line)', (w.highlights || []).join('\n'), { area: true, rows: Math.max(3, (w.highlights || []).length + 1), wide: true, list: true })}</div></div>`).join('')}
      <button type="button" class="add" data-add="work">+ Add a role</button>
    </details>
    <details data-section="education"><summary>Education <small>${r.education.length}</small></summary>
      ${r.education.map((e, i) => `<div class="entry-card"><div class="entry-tools"><b>${esc(e.institution || 'School')}</b><span><button type="button" data-del="education.${i}" title="Remove">✕</button></span></div>
        <div class="grid">${field(`education.${i}.institution`, 'School', e.institution)}${field(`education.${i}.studyType`, 'Degree', e.studyType)}
        ${field(`education.${i}.area`, 'Field of study', e.area)}${field(`education.${i}.startDate`, 'Start', e.startDate)}${field(`education.${i}.endDate`, 'End', e.endDate)}</div></div>`).join('')}
      <button type="button" class="add" data-add="education">+ Add education</button>
    </details>
    <details data-section="skills"><summary>Skills <small>${r.skills.reduce((a, s) => a + (s.keywords?.length || 0), 0)}</small></summary>
      ${field('_skills', 'One group per line, e.g. "Design: Figma, Prototyping"', r.skills.map((s) => `${s.name}: ${(s.keywords || []).join(', ')}`).join('\n'), { area: true, rows: Math.max(3, r.skills.length + 1), wide: true })}
    </details>
    <details data-section="languages"><summary>Languages</summary>
      ${field('_languages', 'Comma separated, e.g. "English (native), Spanish (C1)"', r.languages.map((l) => (l.fluency ? `${l.language} (${l.fluency})` : l.language)).join(', '), { area: true, rows: 2, wide: true })}
    </details>`;
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]] ??= {};
  o[keys.at(-1)] = value;
}

function onEdit(e) {
  const el = e.target.closest('[data-path]');
  if (!el) return;
  const r = state.resume, path = el.dataset.path, v = el.value;
  if (path === 'basics._links') {
    const urls = v.split('\n').map((x) => x.trim()).filter(Boolean).map((u) => (u.startsWith('http') ? u : 'https://' + u));
    r.basics.profiles = urls.filter((u) => /linkedin|github|gitlab|behance|dribbble/i.test(u)).map((url) => ({ network: (url.match(/linkedin|github|gitlab|behance|dribbble/i) || [''])[0].replace(/^./, (c) => c.toUpperCase()), url }));
    r.basics.url = urls.find((u) => !/linkedin|github|gitlab|behance|dribbble/i.test(u)) || '';
  } else if (path === '_skills') {
    r.skills = v.split('\n').filter((l) => l.trim()).map((l) => {
      const m = l.match(/^([^:]+):\s*(.*)$/);
      return m ? { name: m[1].trim(), keywords: m[2].split(',').map((x) => x.trim()).filter(Boolean) } : { name: 'Skills', keywords: l.split(',').map((x) => x.trim()).filter(Boolean) };
    });
  } else if (path === '_languages') {
    r.languages = v.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const m = x.match(/^(.+?)\s*\((.+)\)$/); return m ? { language: m[1], fluency: m[2] } : { language: x }; });
  } else if (el.dataset.list) {
    setPath(r, path, v.split('\n').map((x) => x.replace(/^\s*[•*-]\s*/, '').trim()).filter(Boolean));
  } else {
    setPath(r, path, v);
  }
  scheduleRefresh();
}

function onEditorClick(e) {
  const r = state.resume;
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.add === 'work') r.work.unshift({ position: '', name: '', startDate: '', endDate: '', highlights: [] });
  else if (btn.dataset.add === 'education') r.education.push({ institution: '', studyType: '', area: '', startDate: '', endDate: '' });
  else if (btn.dataset.del) { const [k, i] = btn.dataset.del.split('.'); r[k].splice(Number(i), 1); }
  else if ('photoRemove' in btn.dataset) { delete r.basics.image; }
  else if (btn.dataset.move) { const [k, i, d] = btn.dataset.move.split('.'); const a = Number(i), b2 = a + Number(d); [r[k][a], r[k][b2]] = [r[k][b2], r[k][a]]; }
  else return;
  const open = [...document.querySelectorAll('#editor details')].map((d) => d.open);
  renderEditor();
  document.querySelectorAll('#editor details').forEach((d, i) => (d.open = open[i] ?? d.open));
  save(); refresh();
}

// ---------- export ----------
// When hosted inside claude.ai, direct downloads and printing are blocked; the host's
// `downloads` capability saves files instead. Elsewhere, a normal browser download is used.
let hostDownloads = null;
if (window.claude?.use) {
  window.claude.use('downloads').then((d) => {
    hostDownloads = d;
    if (!d) return;
    $('#dl-pdf').textContent = 'Download print-ready file';
    $('#print-note').textContent = 'This hosted page cannot print. Open the downloaded .html file in any browser and choose Print → "Save as PDF". The text stays selectable for ATS software.';
  }).catch(() => {});
}

async function download(name, data, type) {
  if (hostDownloads) {
    try { await hostDownloads.save({ filename: name, data }); }
    catch (e) { if (e?.code !== 'declined') setStatusInline(`Couldn't save the file (${e?.code || e}).`); }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const baseName = () => (state.resume.basics?.name || 'resume').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'resume';

function exportJSON() {
  const { meta, ...rest } = state.resume;
  download(baseName() + '.resume.json', JSON.stringify(rest, null, 2), 'application/json');
}
function exportHTML() {
  download(baseName() + '.html', renderResumeHTML(state.resume, renderOpts()), 'text/html');
}
function setStatusInline(msg) { $('#print-note').textContent = msg; }

function exportPDF() {
  if (hostDownloads) return exportHTML();
  const frame = $('#preview');
  try {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  } catch {
    // Fallback where printing a frame is blocked: open the page for printing.
    const w = window.open(URL.createObjectURL(new Blob([renderResumeHTML(state.resume, renderOpts())], { type: 'text/html' })));
    if (!w) exportHTML();
  }
}

// ---------- wire up ----------
function init() {
  $('#locale').innerHTML = Object.entries(LOCALES).map(([k, l]) => `<option value="${k}">${esc(l.label)} · ${l.page}</option>`).join('');
  $('#rule-count').textContent = RUBRIC.length;

  const input = $('#file');
  input.addEventListener('change', () => input.files[0] && importFile(input.files[0]));
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && importFile(e.dataTransfer.files[0]));
  $('#paste-go').addEventListener('click', () => {
    const t = $('#paste').value.trim();
    if (t.length < 40) return setStatus('Paste the full text of your resume first.', true);
    load(parseResume(t));
  });
  document.querySelectorAll('[data-sample]').forEach((b) => b.addEventListener('click', () => load(parseResume(SAMPLES[b.dataset.sample]))));

  $('#editor').addEventListener('input', onEdit);
  $('#editor').addEventListener('click', onEditorClick);
  $('#gallery').addEventListener('click', (e) => { const b = e.target.closest('[data-template]'); if (b) setTemplate(b.dataset.template); });
  $('#gallery-panel').addEventListener('toggle', () => renderThumbs());
  $('#fixes').addEventListener('click', (e) => { const b = e.target.closest('[data-fix]'); if (b) goFix(b.dataset.fix); });
  $('#reparse').addEventListener('click', (e) => {
    if (!e.target.closest('#reparse-go')) return;
    const src = state.resume?.meta?.applykin?.sourceText;
    if (!src) return;
    const image = state.resume.basics?.image;
    const fresh = parseResume(src);
    if (image) fresh.basics.image = image;
    $('#reparse').hidden = true;
    load(fresh);
  });
  $('#design').addEventListener('input', onDesign);
  $('#design').addEventListener('click', onDesign);
  $('#d-reset').addEventListener('click', () => { state.design = { ...DEFAULT_DESIGN }; save(); renderDesign(); refresh(); });
  $('#editor').addEventListener('change', (e) => { if (e.target.id === 'photo-input') onPhoto(e.target.files[0]); });
  $('#locale').addEventListener('change', (e) => { state.locale = e.target.value; save(); refresh(); });
  $('#dl-pdf').addEventListener('click', exportPDF);
  $('#dl-json').addEventListener('click', exportJSON);
  $('#dl-html').addEventListener('click', exportHTML);
  $('#new').addEventListener('click', () => {
    if (!confirmReset()) return;
    try { localStorage.removeItem(STORE); } catch {}
    state.resume = null;
    $('#workspace').hidden = true; $('#start').hidden = false; $('#new').hidden = true; input.value = '';
  });

  restore();
  if (!TEMPLATES[state.template]) state.template = 'classic';
  renderGallery(false);
  $('#locale').value = state.locale;
  renderDesign();
  const pv = state.resume?.meta?.applykin?.parserVersion || 0;
  $('#reparse').hidden = !(state.resume && pv < PARSER_VERSION && state.resume.meta?.applykin?.sourceText);
  if (state.resume) { $('#start').hidden = true; $('#workspace').hidden = false; $('#new').hidden = false; renderEditor(); refresh(); }
}

// Inline two-click confirm (no browser dialogs).
let armed = 0;
function confirmReset() {
  const b = $('#new');
  if (Date.now() - armed < 3000) { b.textContent = 'Start over'; armed = 0; return true; }
  armed = Date.now(); b.textContent = 'Click again to clear';
  setTimeout(() => { b.textContent = 'Start over'; }, 3000);
  return false;
}

// ---------- guided fixes ----------
// Each fix jumps to the field that resolves it. Nothing is filled in for the user: facts only come from them.
const CONTACT_FIX = { name: 'basics.name', email: 'basics.email', phone: 'basics.phone', location: 'basics.location.city', 'profile-link': 'basics._links', 'contact-in-body': 'basics.email' };
const WORK_FIX = ['dates', 'order', 'titles', 'bullets-per-role', 'action-verbs', 'weak-openers', 'numbers', 'bullet-length', 'first-person', 'verb-variety'];
function fixLabel(id) {
  if (id === 'layout') return 'Switch to Classic';
  if (CONTACT_FIX[id]) return 'Add it';
  if (['summary', 'education', 'skills', 'work', 'sections-found', 'cliches', ...WORK_FIX].includes(id)) return 'Fix it';
  return '';
}
function focusField(section, path) {
  const det = document.querySelector(`#editor details[data-section="${section}"]`);
  if (!det) return;
  det.open = true;
  const el = path ? document.querySelector(`#editor [data-path="${path}"]`) : null;
  (el || det).scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (el) { setTimeout(() => el.focus({ preventScroll: true }), 350); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); }
}
function goFix(id) {
  const r = state.resume;
  const work = r.work || [];
  if (id === 'layout') return setTemplate('classic');
  if (CONTACT_FIX[id]) return focusField('contact', CONTACT_FIX[id]);
  if (id === 'summary' || id === 'cliches') return focusField('summary', 'basics.summary');
  if (id === 'skills') return focusField('skills', '_skills');
  if (id === 'education' || (id === 'sections-found' && work.length && !(r.education || []).length)) {
    if (!(r.education || []).length) { r.education = [{ institution: '', studyType: '', area: '', startDate: '', endDate: '' }]; renderEditor(); }
    return focusField('education', 'education.0.institution');
  }
  if (id === 'sections-found' && !(r.skills || []).length) return focusField('skills', '_skills');
  if (id === 'work' || (id === 'sections-found' && !work.length)) {
    if (!work.length) { r.work = [{ position: '', name: '', startDate: '', endDate: '', highlights: [] }]; renderEditor(); }
    return focusField('work', 'work.0.position');
  }
  if (WORK_FIX.includes(id)) {
    let i = 0, field = 'highlights';
    if (id === 'dates') { i = work.findIndex((w) => !w.startDate); field = 'startDate'; }
    else if (id === 'titles') { i = work.findIndex((w) => !w.position || !w.name); field = work[i]?.position ? 'name' : 'position'; }
    else if (id === 'bullets-per-role') i = work.findIndex((w) => (w.highlights || []).length < 2 || w.highlights.length > 7);
    return focusField('work', `work.${Math.max(0, i)}.${field}`);
  }
}

// ---------- design gallery ----------
function setTemplate(name) {
  if (!TEMPLATES[name]) return;
  state.template = name;
  save(); renderGallery(); renderDesign(); refresh();
}
let galleryTimer;
function renderGallery(thumbsToo = true) {
  const el = $('#gallery');
  const sample = state.resume || {};
  el.innerHTML = Object.entries(TEMPLATES).map(([k, t]) => `
    <button type="button" class="tpl ${k === state.template ? 'sel' : ''}" data-template="${k}" aria-pressed="${k === state.template}">
      <span class="thumb"><iframe tabindex="-1" aria-hidden="true" data-thumb="${k}" loading="lazy"></iframe></span>
      <span class="tpl-name">${esc(t.label)}</span>
      <span class="tpl-blurb">${esc(t.blurb)}</span>
      <span class="ats-badge" data-ats="${t.ats}">${esc(ATS_LEVELS[t.ats].label)}</span>
    </button>`).join('');
  const cur = TEMPLATES[state.template];
  $('#ats-advice').innerHTML = `<b>${esc(cur.label)}:</b> ${esc(ATS_LEVELS[cur.ats].note)}`;
  $('#ats-advice').dataset.ats = cur.ats;
  scaleThumbs();
  if (thumbsToo) renderThumbs();
}
function scaleThumbs() {
  document.querySelectorAll('#gallery .thumb').forEach((t) => t.style.setProperty('--s', (t.clientWidth / 816).toFixed(4)));
}
try { new ResizeObserver(scaleThumbs).observe(document.getElementById('gallery')); } catch {}
function renderThumbs() {
  clearTimeout(galleryTimer);
  galleryTimer = setTimeout(() => {
    if (!state.resume || !$('#gallery-panel').open) return;
    document.querySelectorAll('#gallery iframe[data-thumb]').forEach((f) => {
      f.srcdoc = renderResumeHTML(state.resume, { template: f.dataset.thumb, locale: state.locale, design: { ...state.design, accent: '', font: '' } });
    });
  }, 600);
}

// ---------- design ----------
function renderDesign() {
  const d = state.design;
  const accent = d.accent || TEMPLATES[state.template].accent;
  $('#d-accents').innerHTML = ACCENTS.map((c) => `<button type="button" class="swatch" data-accent="${c}" style="background:${c}" aria-label="Accent ${c}" aria-pressed="${c.toLowerCase() === accent.toLowerCase()}"></button>`).join('') +
    `<label class="swatch custom" title="Pick any colour"><input type="color" id="d-color" value="${/^#[0-9a-f]{6}$/i.test(accent) ? accent : '#2f4ea8'}"></label>`;
  $('#d-font').innerHTML = `<option value="">Template default</option>` + Object.entries(FONTS).map(([k, f]) => `<option value="${k}">${f.label}</option>`).join('');
  $('#d-font').value = d.font || '';
  for (const k of ['textSize', 'lineSpacing', 'sectionSpacing', 'margin']) { $(`#d-${k}`).value = d[k]; $(`#d-${k}-v`).textContent = d[k] + '%'; }
  $('#d-photo').checked = !!d.photo;
  $('#d-photo-row').hidden = !!TEMPLATES[state.template].sidebar;
}
function onDesign(e) {
  const t = e.target;
  const sw = t.closest('[data-accent]');
  if (sw) state.design.accent = sw.dataset.accent;
  else if (t.id === 'd-color') state.design.accent = t.value;
  else if (t.id === 'd-font') state.design.font = t.value;
  else if (t.id === 'd-photo') state.design.photo = t.checked;
  else if (t.dataset.design) { state.design[t.dataset.design] = Number(t.value); $(`#d-${t.dataset.design}-v`).textContent = t.value + '%'; }
  else return;
  if (sw || t.id === 'd-color') renderDesign();
  save(); scheduleRefresh();
}

// Headshot: resized in the browser to 400px so the resume file stays small. Never uploaded anywhere.
async function onPhoto(file) {
  if (!file || !/^image\/(png|jpe?g|webp)$/.test(file.type)) return;
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  const side = Math.min(img.naturalWidth, img.naturalHeight), out = 400;
  const c = document.createElement('canvas'); c.width = c.height = out;
  c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
  state.resume.basics.image = c.toDataURL('image/jpeg', 0.85);
  URL.revokeObjectURL(img.src);
  if (!TEMPLATES[state.template].sidebar) state.design.photo = true;
  save(); renderEditor(); renderDesign(); refresh();
}

// ---------- tabs ----------
const TABS = ['resume', 'jobs', 'tracker', 'settings'];
function showTab(name) {
  if (!TABS.includes(name)) name = 'resume';
  document.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== name));
  document.querySelectorAll('nav.tabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === name ? 'page' : 'false'));
  try { if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name); } catch {}
  jobsUI?.onShow(name);
}

let jobsUI = null;
init();
jobsUI = initJobs({
  getResume: () => state.resume,
  setResume: (r) => { state.resume = r; save(); renderEditor(); refresh(); },
  getLocale: () => state.locale,
  isHosted: () => !!window.claude?.use,
  download,
  showTab,
});
document.querySelectorAll('nav.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));
showTab(location.hash.slice(1) || 'resume');
