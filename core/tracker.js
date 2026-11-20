// Application tracker: plain data, stored by the caller (browser storage, a JSON file, etc.).
export const STAGES = ['saved', 'preparing', 'applied', 'interview', 'offer', 'closed'];
export const STAGE_LABELS = { saved: 'Saved', preparing: 'Preparing', applied: 'Applied', interview: 'Interview', offer: 'Offer', closed: 'Closed' };

/** Add a job (or update it if already tracked). Returns a new array. */
export function trackJob(list, job, stage = 'saved') {
  const now = new Date().toISOString();
  const existing = list.find((a) => a.job.id === job.id);
  if (existing) return list;
  return [{ id: job.id, job: { id: job.id, title: job.title, company: job.company, location: job.location, url: job.url, applyUrl: job.applyUrl, source: job.source, description: (job.description || '').slice(0, 20000) },
    stage, notes: '', letter: '', createdAt: now, updatedAt: now, history: [{ stage, at: now }] }, ...list];
}

export function moveApplication(list, id, stage) {
  if (!STAGES.includes(stage)) throw new Error(`Unknown stage ${stage}`);
  const now = new Date().toISOString();
  return list.map((a) => (a.id === id && a.stage !== stage ? { ...a, stage, updatedAt: now, history: [...a.history, { stage, at: now }] } : a));
}

export function updateApplication(list, id, patch) {
  return list.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a));
}

export function removeApplication(list, id) {
  return list.filter((a) => a.id !== id);
}
