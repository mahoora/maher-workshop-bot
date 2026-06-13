const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(process.env.DATA_DIR || __dirname, 'workshop.db');

let db = null;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA journal_mode=WAL');
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    item TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'جديد',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS blocked_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  saveDB();
  return db;
}

function saveDB() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function addOrder(customerName, phone, item, details) {
  const stmt = db.prepare('INSERT INTO orders (customer_name, phone, item, details) VALUES (?, ?, ?, ?)');
  stmt.run([customerName, phone, item, details || '']);
  stmt.free();
  saveDB();
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result.length > 0 ? result[0].values[0][0] : null;
  return { lastInsertRowid: id };
}

function getOrders() {
  const stmt = db.prepare('SELECT * FROM orders ORDER BY created_at DESC');
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function blockNumber(phone) {
  const stmt = db.prepare('INSERT OR IGNORE INTO blocked_numbers (phone) VALUES (?)');
  stmt.run([phone]);
  stmt.free();
  saveDB();
}

function unblockNumber(phone) {
  const stmt = db.prepare('DELETE FROM blocked_numbers WHERE phone = ?');
  stmt.run([phone]);
  stmt.free();
  saveDB();
}

function getBlockedNumbers() {
  const stmt = db.prepare('SELECT * FROM blocked_numbers');
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function isBlocked(phone) {
  const stmt = db.prepare('SELECT id FROM blocked_numbers WHERE phone = ?');
  const has = stmt.getAsObject([phone]);
  stmt.free();
  return !!has && !!has.id;
}

module.exports = { initDB, addOrder, getOrders, blockNumber, unblockNumber, getBlockedNumbers, isBlocked };
