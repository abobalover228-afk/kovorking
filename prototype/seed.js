// Создаёт базу данных SQLite и наполняет её местами из data.js
// Запуск: node seed.js

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const places = require('./data.js');

const DB_PATH = path.join(__dirname, 'data', 'kovorking.db');

// Удаляем старую базу, чтобы сид был идемпотентным
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE places (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT    NOT NULL,
    address  TEXT    NOT NULL,
    lat      REAL    NOT NULL,
    lng      REAL    NOT NULL,
    kind     TEXT    NOT NULL CHECK (kind IN ('free','paid')),
    hours    TEXT    NOT NULL DEFAULT '',
    entry    TEXT    NOT NULL DEFAULT '',
    seats    INTEGER NOT NULL DEFAULT 0,
    wifi     INTEGER NOT NULL DEFAULT 0,
    sockets  INTEGER NOT NULL DEFAULT 0,
    quiet    INTEGER NOT NULL DEFAULT 0,
    open24   INTEGER NOT NULL DEFAULT 0,
    note     TEXT    NOT NULL DEFAULT '',
    source   TEXT    NOT NULL DEFAULT ''
  );
`);

const insert = db.prepare(`
  INSERT INTO places
    (name, address, lat, lng, kind, hours, entry, seats, wifi, sockets, quiet, open24, note, source)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const p of places) {
  insert.run(
    p.name, p.address, p.lat, p.lng, p.kind,
    p.hours, p.entry, p.seats,
    p.wifi, p.sockets, p.quiet, p.open24,
    p.note, p.source
  );
}

const count = db.prepare('SELECT COUNT(*) AS n FROM places').get().n;
console.log(`База создана: ${DB_PATH}`);
console.log(`Добавлено мест: ${count}`);
db.close();
