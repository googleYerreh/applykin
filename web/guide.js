// Step-by-step guide: one section at a time, a clear next action, the live preview always beside it.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const STEPS = [
  { id: 'contact', title: 'Contact details', why: 'Recruiters and tracking systems look for your name, email, phone and city at the very top. Missing contact details are the most common reason a resume gets skipped.',
    sections: ['contact'], issues: ['name', 'email', 'phone', 'location', 'profile-link', 'contact-in-body'] },
  { id: 'summary', title: 'Summary', why: 'Two or three sentences that say who you are, your strongest skills, and the role you want. It is the first thing a recruiter reads.',
    sections: ['summary'], issues: ['summary', 'cliches'] },
  { id: 'work', title: 'Experience', why: 'Your strongest section. Each bullet should start with a verb and show a result with a number. The hints under each job point to the exact bullets to improve.',
    sections: ['work'], issues: ['work', 'dates', 'order', 'titles', 'bullets-per-role', 'action-verbs', 'weak-openers', 'numbers', 'bullet-length', 'first-person', 'verb-variety', 'length'] },
  { id: 'more', title: 'Education & skills', why: 'Tracking systems match job ads against your skills list, so list the tools and skills you really use. Add your education, even if it is one line.',
    sections: ['education', 'skills', 'languages'], issues: ['education', 'skills', 'sections-found', 'headings'] },
  { id: 'design', title: 'Design', why: 'Pick how your resume looks. Designs marked "Best for ATS" are safest for online applications; sidebar designs are for email and networking.',
    sections: [], issues: ['layout'] },
  { id: 'finish', title: 'Download', why: 'Your resume is ready. Download it, then find jobs that match it.', sections: [], issues: [] },
];

/**
 * @param {{ getState:()=>object, setStep:(s:string)=>void, goFix:(id:string)=>void, fixLabel:(id:string)=>string,
 *           exportPDF:()=>void, exportHTML:()=>void, exportJSON:()=>void, showTab:(t:string)=>void }} ctx
 */
export function initGuide(ctx) {
  const el = document.getElementById('guide');
  const nav = document.getElementById('guide-nav');

  function stepStatus(step, score) {
    const open = score.fixes.filter((f) => step.issues.includes(f.id));
    return { open, done: open.length === 0 };
  }

  function render(score) {
    const st = ctx.getState();
    const ws = document.getElementById('workspace');
    ws.classList.toggle('guided', st.mode === 'guided');
    ws.classList.toggle('full', st.mode !== 'guided');
    ws.dataset.step = st.mode === 'guided' ? st.step : '';
    document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === st.mode)));
    if (st.mode !== 'guided') { el.innerHTML = ''; nav.innerHTML = ''; applyFilter(); return; }

    if (st.step === 'overview' || !STEPS.some((s) => s.id === st.step)) {
      nav.innerHTML = '';
      const statuses = STEPS.map((s) => ({ s, ...stepStatus(s, score) }));
      const next = statuses.find((x) => !x.done && x.s.id !== 'finish') || statuses.at(-1);
      el.innerHTML = `
        <h2 class="guide-title">Six short steps to a stronger resume</h2>
        <p class="guide-sub">Work through them in order, or jump to any step. Your changes show in the preview as you type.</p>
        <ol class="steps">${statuses.map(({ s, open, done }, i) => `
          <li class="step ${s === next.s ? 'current' : ''} ${done && s.id !== 'finish' ? 'done' : ''}">
            <button type="button" class="step-row" data-go="${s.id}">
              <span class="step-dot">${done && s.id !== 'finish' ? '✓' : i + 1}</span>
              <span class="step-text"><b>${esc(s.title)}</b><small>${s.id === 'finish' ? 'Download and find matching jobs' : done ? 'Looks good' : `${open.length} thing${open.length > 1 ? 's' : ''} to improve`}</small></span>
            </button>
            ${s === next.s ? `<button type="button" class="btn step-go" data-go="${s.id}">${statuses.every((x) => x.done || x.s.id === 'finish') ? 'Download my resume' : i === 0 ? 'Start' : 'Continue'}</button>` : ''}
          </li>`).join('')}</ol>`;
      applyFilter();
      return;
    }

    const i = STEPS.findIndex((s) => s.id === st.step);
    const step = STEPS[i];
    let { open } = stepStatus(step, score);
    if (open.some((f) => f.id === 'email' || f.id === 'phone')) open = open.filter((f) => f.id !== 'contact-in-body');
    const prev = STEPS[i - 1], next = STEPS[i + 1];
    const issues = open.length
      ? `<ul class="step-issues">${open.map((f) => `<li><b>${esc(f.title)}</b> <span class="gain">+${f.gain} pts</span><br><span>${esc(f.fix)}</span>${ctx.fixLabel(f.id) ? ` <button type="button" class="fix-btn" data-fix="${esc(f.id)}">${esc(ctx.fixLabel(f.id))}</button>` : ''}</li>`).join('')}</ul>`
      : step.id === 'finish' ? '' : '<p class="step-ok">✓ Nothing to fix here. Check the details, then go to the next step.</p>';
    const finish = step.id === 'finish' ? `
      <div class="finish">
        <div class="finish-score"><span>${score.overall}</span><small>of 100</small></div>
        <div class="finish-actions">
          <button type="button" class="btn big" data-act="pdf">Download PDF</button>
          <div class="finish-more"><button type="button" class="btn ghost small" data-act="html">HTML file</button><button type="button" class="btn ghost small" data-act="json">JSON Resume</button></div>
        </div>
      </div>
      <button type="button" class="btn next-big" data-act="jobs">Find jobs that match my resume →</button>` : '';
    el.innerHTML = `
      <div class="progress"><span style="width:${Math.round(((i + 1) / STEPS.length) * 100)}%"></span></div>
      <p class="step-count"><button type="button" class="linkish" data-go="overview">All steps</button> · Step ${i + 1} of ${STEPS.length}</p>
      <h2 class="guide-title">${esc(step.title)}</h2>
      <p class="guide-sub">${esc(step.why)}</p>
      ${issues}${finish}
      ${step.id === 'design' ? '<p class="guide-sub">Choose a design on the right. Fine-tune colours and spacing under "Design" if you like.</p>' : ''}
`;
    nav.innerHTML = `
      <div class="step-nav">
        ${prev ? `<button type="button" class="btn ghost" data-go="${prev.id}">← ${esc(prev.title)}</button>` : '<span></span>'}
        ${next ? `<button type="button" class="btn" data-go="${next.id}">Next: ${esc(next.title)} →</button>` : ''}
      </div>`;
    applyFilter();
  }

  // Show only the editor sections that belong to the current step.
  function applyFilter() {
    const st = ctx.getState();
    const step = STEPS.find((s) => s.id === st.step);
    const guided = st.mode === 'guided';
    document.querySelectorAll('#editor details[data-section]').forEach((d) => {
      const show = !guided || (step && step.sections.includes(d.dataset.section));
      d.hidden = !show;
      if (guided && show) d.open = true;
    });
    const editorPanel = document.getElementById('editor-panel');
    if (editorPanel) editorPanel.hidden = guided && !(step && step.sections.length);
  }

  const onClick = (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { ctx.setStep(go.dataset.go); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const fix = e.target.closest('[data-fix]');
    if (fix) { ctx.goFix(fix.dataset.fix); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'pdf') ctx.exportPDF();
    if (act === 'html') ctx.exportHTML();
    if (act === 'json') ctx.exportJSON();
    if (act === 'jobs') ctx.showTab('jobs');
  };
  el.addEventListener('click', onClick);
  nav.addEventListener('click', onClick);

  return { render, applyFilter, stepFor: (fixId) => STEPS.find((s) => s.issues.includes(fixId))?.id };
}
