const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '.wwebjs_auth');
const MAX_CHUNK = 3500000; // ~3.5M chars per file → ~3.5MB text

if (!fs.existsSync(SRC)) {
  console.error('.wwebjs_auth not found'); process.exit(1);
}

const zip = new AdmZip();
function addDir(dirPath, zipPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    const zipEntry = zipPath ? `${zipPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDir(full, zipEntry);
    } else {
      const exclude = ['Cache', 'Code Cache', 'Service Worker', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'blob_storage', 'GrShaderCache', 'ShaderCache', 'GPUPersistentCache', 'Crashpad', 'CrashpadMetrics-active.pma', 'BrowserMetrics-spare.pma', 'README'];
      let excluded = false;
      for (const e of exclude) { if (full.includes(e)) { excluded = true; break; } }
      if (!excluded) zip.addLocalFile(full, zipPath);
    }
  }
}
addDir(SRC, '');

const buf = zip.toBuffer();
const b64 = buf.toString('base64');
const numChunks = Math.ceil(b64.length / MAX_CHUNK);
const meta = { chunks: [], total: b64.length };

for (let i = 0; i < numChunks; i++) {
  const fn = `session-data-${i+1}.js`;
  const chunk = b64.slice(i * MAX_CHUNK, (i+1) * MAX_CHUNK);
  fs.writeFileSync(path.join(__dirname, fn), `module.exports=${JSON.stringify(chunk)};`, 'utf8');
  meta.chunks.push(fn);
  const fsize = (Buffer.byteLength(chunk, 'utf8') / 1024 / 1024).toFixed(2);
  console.log(`  ${fn}: ${fsize}MB`);
}

// Write meta file with file list
const metaContent = `module.exports=${JSON.stringify(meta.chunks)};`;
fs.writeFileSync(path.join(__dirname, 'session-data-meta.js'), metaContent, 'utf8');

const totalSize = (buf.length / 1024 / 1024).toFixed(2);
console.log(`✅ Done: ${totalSize}MB compressed → ${numChunks} files (<10MB each)`);
