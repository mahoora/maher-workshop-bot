const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const authDir = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, '.wwebjs_auth') : null;

if (!authDir) {
  console.error('DATA_DIR not set'); process.exit(1);
}

const metaFile = path.join(__dirname, 'session-data-meta.js');
if (!fs.existsSync(metaFile)) {
  console.log('session-data-meta.js not found, skipping'); process.exit(0);
}

const chunkFiles = require(metaFile);
if (!Array.isArray(chunkFiles) || chunkFiles.length === 0) {
  console.log('Invalid session data meta, skipping'); process.exit(0);
}

let b64 = '';
for (const fn of chunkFiles) {
  const fp = path.join(__dirname, fn);
  if (!fs.existsSync(fp)) {
    console.log(`Missing chunk: ${fn}, skipping`); process.exit(0);
  }
  b64 += require(fp);
}

if (!b64 || b64.length < 100) {
  console.log('Session data too short, skipping'); process.exit(0);
}

if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

const zip = new AdmZip(Buffer.from(b64, 'base64'));
zip.extractAllTo(authDir, true);
const count = zip.getEntries().length;
console.log(`📦 Extracted ${count} files to ${authDir}`);
