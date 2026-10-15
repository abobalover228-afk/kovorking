// Тонкая обёртка над REST API с хранением токена админа.

const TOKEN_KEY = 'ksk_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = t => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(url, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch { /* пустой ответ */ }

  if (!res.ok) {
    const message = (data && data.error) || `Ошибка ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  places: () => request('/api/places'),
  stats: () => request('/api/stats'),
  create: body => request('/api/places', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request('/api/places/' + id, { method: 'PUT', body: JSON.stringify(body) }),
  remove: id => request('/api/places/' + id, { method: 'DELETE' }),
  login: password => request('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  check: () => request('/api/admin/check'),
  logout: () => request('/api/admin/logout', { method: 'POST' })
};
