const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SESSION_DIR = path.join(__dirname, '.wwebjs_auth');
const TARGET_URL = process.argv[2] || 'http://localhost:3001';

async function main() {
  if (!fs.existsSync(SESSION_DIR)) {
    console.error('❌ المجلد .wwebjs_auth غير موجود.'); process.exit(1);
  }
  console.log('📦 ضغط الجلسة...');
  const zip = new AdmZip();
  zip.addLocalFolder(SESSION_DIR);
  const zipBuffer = zip.toBuffer();
  const zipBase64 = zipBuffer.toString('base64');
  console.log(`📏 حجم الجلسة: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📤 رفع إلى ${TARGET_URL}/api/upload-session ...`);
  try {
    const res = await axios.post(`${TARGET_URL}/api/upload-session`, { zipBase64 }, { timeout: 60000 });
    if (res.data.success) {
      console.log(`✅ تم رفع الجلسة بنجاح (${res.data.files} ملف)`);
      return;
    }
    console.error('❌ فشل:', res.data.error);
  } catch (e) {
    console.error('❌ فشل الاتصال:', e.message);
  }
}
main();
