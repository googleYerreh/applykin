// Optional AI layer. Three ways to run it, none of which cost the project anything:
//  - ollama:    a free model on the user's own computer (http://localhost:11434)
//  - openai:    any OpenAI-compatible endpoint with the user's own key (OpenAI, Groq, OpenRouter, LM Studio, vLLM…)
//  - anthropic: the user's own Anthropic API key
// Keys stay on the user's device and go only to the provider they picked.

export const PROVIDERS = {
  ollama: { label: 'Ollama (free, on your computer)', baseUrl: 'http://localhost:11434', model: 'llama3.1:8b', needsKey: false },
  openai: { label: 'OpenAI-compatible (your key)', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true },
  anthropic: { label: 'Anthropic (your key)', baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-5-5', needsKey: true },
};

/**
 * @param {{provider:'ollama'|'openai'|'anthropic', model?:string, apiKey?:string, baseUrl?:string}} cfg
 * @param {{system:string, prompt:string}} msg
 * @param {typeof fetch} fetchFn
 * @returns {Promise<string>}
 */
export async function generate(cfg, msg, fetchFn = fetch) {
  try {
    return await callProvider(cfg, msg, fetchFn);
  } catch (e) {
    if (/fetch failed|Failed to fetch|NetworkError|ECONNREFUSED/i.test(e.message)) {
      const p = PROVIDERS[cfg.provider];
      throw new Error(`Couldn't reach ${p?.label || cfg.provider} at ${(cfg.baseUrl || p?.baseUrl || '').replace(/\/$/, '')}. Check that it's running and the address is right.`);
    }
    throw e;
  }
}

async function callProvider(cfg, { system, prompt }, fetchFn) {
  const p = PROVIDERS[cfg.provider];
  if (!p) throw new Error('Choose an AI provider in Settings first.');
  if (p.needsKey && !cfg.apiKey) throw new Error(`${p.label} needs an API key.`);
  const base = (cfg.baseUrl || p.baseUrl).replace(/\/$/, '');
  const model = cfg.model || p.model;
  let res, data;
  if (cfg.provider === 'ollama') {
    res = await fetchFn(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, stream: false, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], options: { temperature: 0.4 } }) });
    data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Ollama HTTP ${res.status}`);
    return (data.message?.content || '').trim();
  }
  if (cfg.provider === 'openai') {
    res = await fetchFn(`${base}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model, temperature: 0.4, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }) });
    data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
    return (data.choices?.[0]?.message?.content || '').trim();
  }
  res = await fetchFn(`${base}/v1/messages`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model, max_tokens: 1200, system, messages: [{ role: 'user', content: prompt }] }) });
  data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return (data.content || []).map((c) => c.text || '').join('').trim();
}
