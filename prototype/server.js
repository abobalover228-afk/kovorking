// Бэкенд прототипа «Карта студенческих коворкингов».
//
// Возможности:
//   • REST API для чтения мест
//   • Полный CRUD для админки (создание, правка, удаление)
//   • Простая авторизация администратора по паролю
//   • Отдача собранного фронтенда (SPA)
//
// Запуск: node server.js
// Пароль админа: переменная окружения ADMIN_PASSWORD (по умолчанию "admin")

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const DB_PATH = path.join(__dirname, 'data', 'kovorking.db');
const DIST = path.join(__dirname, 'dist');

if (!fs.existsSync(DB_PATH)) {
  console.error('База не найдена. Сначала выполните:  node seed.js');
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);

// Активные сессии админа (токен -> время выдачи)
const sessions = new Map();
const SESSION_TTL = 1000 * 60 * 60 * 8; // 8 часов

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/* ------------------------------ helpers ------------------------------ */

function sendJson(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 1e6) { reject(new Error('payload too large')); req.destroy(); return; }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

function auth(req) {
  const header = req.headers['authorization'] || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const issued = sessions.get(token);
  if (!issued) return false;
  if (Date.now() - issued > SESSION_TTL) { sessions.delete(token); return false; }
  return true;
}

function cleanPlace(input) {
  const s = v => (v == null ? '' : String(v).trim());
  const b = v => (v ? 1 : 0);
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Некорректные координаты');
  }
  const kind = input.kind === 'paid' ? 'paid' : 'free';
  const name = s(input.name);
  const address = s(input.address);
  if (!name) throw new Error('Не указано название');
  if (!address) throw new Error('Не указан адрес');
  return {
    name, address, lat, lng, kind,
    hours: s(input.hours),
    entry: s(input.entry),
    seats: Number.isFinite(Number(input.seats)) ? Math.max(0, Math.trunc(Number(input.seats))) : 0,
    wifi: b(input.wifi),
    sockets: b(input.sockets),
    quiet: b(input.quiet),
    open24: b(input.open24),
    note: s(input.note),
    source: s(input.source)
  };
}

/* ------------------------------ static ------------------------------ */

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const filePath = path.normalize(path.join(DIST, rel));

  if (!filePath.startsWith(DIST)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(filePath, (err, buf) => {
    if (err) {
      fs.readFile(path.join(DIST, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
}

/* ------------------------------ server ------------------------------ */

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });
    res.end();
    return;
  }

  try {
    /* ---- публичные ---- */

    if (url === '/api/places' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM places ORDER BY kind, name').all();
      return sendJson(res, 200, rows);
    }

    if (url === '/api/stats' && method === 'GET') {
      const total = db.prepare('SELECT COUNT(*) AS n FROM places').get().n;
      const free = db.prepare("SELECT COUNT(*) AS n FROM places WHERE kind='free'").get().n;
      const open24 = db.prepare('SELECT COUNT(*) AS n FROM places WHERE open24=1').get().n;
      return sendJson(res, 200, { total, free, paid: total - free, open24 });
    }

    const one = url.match(/^\/api\/places\/(\d+)$/);
    if (one && method === 'GET') {
      const row = db.prepare('SELECT * FROM places WHERE id = ?').get(Number(one[1]));
      if (!row) return sendJson(res, 404, { error: 'not found' });
      return sendJson(res, 200, row);
    }

    /* ---- авторизация ---- */

    if (url === '/api/admin/login' && method === 'POST') {
      const body = await readBody(req);
      if (String(body.password || '') !== ADMIN_PASSWORD) {
        return sendJson(res, 401, { error: 'Неверный пароль' });
      }
      const token = crypto.randomBytes(24).toString('hex');
      sessions.set(token, Date.now());
      return sendJson(res, 200, { token });
    }

    if (url === '/api/admin/check' && method === 'GET') {
      return sendJson(res, auth(req) ? 200 : 401, { ok: auth(req) });
    }

    if (url === '/api/admin/logout' && method === 'POST') {
      const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
      sessions.delete(token);
      return sendJson(res, 200, { ok: true });
    }

    /* ---- защищённые ---- */

    const isAdminRoute = url.startsWith('/api/places') && method !== 'GET';
    if (isAdminRoute && !auth(req)) {
      return sendJson(res, 401, { error: 'Требуется вход администратора' });
    }

    if (url === '/api/places' && method === 'POST') {
      const data = cleanPlace(await readBody(req));
      const info = db.prepare(`
        INSERT INTO places
          (name,address,lat,lng,kind,hours,entry,seats,wifi,sockets,quiet,open24,note,source)
        VALUES
          (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        data.name, data.address, data.lat, data.lng, data.kind,
        data.hours, data.entry, data.seats,
        data.wifi, data.sockets, data.quiet, data.open24,
        data.note, data.source
      );
      const row = db.prepare('SELECT * FROM places WHERE id = ?').get(info.lastInsertRowid);
      return sendJson(res, 201, row);
    }

    if (one && method === 'PUT') {
      const id = Number(one[1]);
      const exists = db.prepare('SELECT id FROM places WHERE id = ?').get(id);
      if (!exists) return sendJson(res, 404, { error: 'not found' });
      const data = cleanPlace(await readBody(req));
      db.prepare(`
        UPDATE places SET
          name=?, address=?, lat=?, lng=?, kind=?, hours=?, entry=?, seats=?,
          wifi=?, sockets=?, quiet=?, open24=?, note=?, source=?
        WHERE id=?
      `).run(
        data.name, data.address, data.lat, data.lng, data.kind,
        data.hours, data.entry, data.seats,
        data.wifi, data.sockets, data.quiet, data.open24,
        data.note, data.source, id
      );
      const row = db.prepare('SELECT * FROM places WHERE id = ?').get(id);
      return sendJson(res, 200, row);
    }

    if (one && method === 'DELETE') {
      const id = Number(one[1]);
      const info = db.prepare('DELETE FROM places WHERE id = ?').run(id);
      if (!info.changes) return sendJson(res, 404, { error: 'not found' });
      return sendJson(res, 200, { ok: true, id });
    }

    if (url.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'unknown endpoint' });
    }

    return serveStatic(req, res);
  } catch (err) {
    return sendJson(res, 400, { error: err.message || 'Ошибка запроса' });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ┌──────────────────────────────────────────────┐');
  console.log('  │   Карта студенческих коворкингов · прототип  │');
  console.log('  └──────────────────────────────────────────────┘');
  console.log('');
  console.log(`   Карта:   http://localhost:${PORT}`);
  console.log(`   Админка: http://localhost:${PORT}/#/admin`);
  console.log(`   API:     http://localhost:${PORT}/api/places`);
  console.log('');
  console.log(`   Пароль администратора: ${ADMIN_PASSWORD}`);
  console.log('');
});
