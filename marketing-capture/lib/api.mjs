// Authenticated JSON client for a scene's un-recorded setup step. Shares the
// browser context's cookie jar, so it acts as the same logged-in, tenant-scoped
// user the recording does. Used to stage the records a scene acts on (a fresh
// draft change order, a submitted pay app, ...) so every recording performs the
// real action end to end and re-runs never depend on what a previous run left.
import { BASE_URL } from '../config.mjs';

export function makeApi(context) {
  const http = context.request;
  let csrf = null;

  async function token() {
    const res = await http.get(`${BASE_URL}/api/auth/csrf-token?_=${Date.now()}`);
    if (!res.ok()) throw new Error(`csrf-token fetch failed (${res.status()})`);
    const json = await res.json();
    csrf = (json.data ?? json).csrfToken;
    return csrf;
  }

  async function call(method, path, data) {
    const headers = { 'Content-Type': 'application/json' };
    if (method !== 'GET') headers['x-csrf-token'] = csrf ?? (await token());
    const res = await http.fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      ...(data === undefined ? {} : { data }),
    });
    const text = await res.text();
    if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()}: ${text.slice(0, 300)}`);
    if (!text) return null;
    const json = JSON.parse(text);
    return json && typeof json === 'object' && 'data' in json ? json.data : json;
  }

  return {
    get: (path) => call('GET', path),
    post: (path, data = {}) => call('POST', path, data),
    put: (path, data = {}) => call('PUT', path, data),
    patch: (path, data = {}) => call('PATCH', path, data),
    del: (path) => call('DELETE', path),
  };
}
