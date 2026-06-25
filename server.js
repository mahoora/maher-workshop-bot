const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { initDB, getOrders, addOrder, getBlockedNumbers } = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let botMode = 'auto';
let botStatus = 'stopped';

async function main() {
  try {
    await initDB();
    console.log('✅ قاعدة البيانات جاهزة');
  } catch (e) {
    console.error('❌ قاعدة البيانات:', e.message);
  }

  try {
    const bot = await import('./bot.mjs');
    const { startBot, setStateCallback, setBotMode, getQRDataURL } = bot;

    setStateCallback((state) => {
      if (state.mode) botMode = state.mode;
      if (state.status) botStatus = state.status;
      io.emit('status', botStatus);
      io.emit('mode', botMode);
    });

    app.get('/api/status', (req, res) => {
      res.json({ mode: botMode, status: botStatus, qr: botStatus === 'qr' ? getQRDataURL() : null });
    });

    app.get('/api/qr', (req, res) => {
      const qr = getQRDataURL();
      if (qr) {
        res.json({ qr: true, dataURL: qr });
      } else {
        res.json({ qr: false });
      }
    });

    app.post('/api/mode', (req, res) => {
      const mode = req.body.mode;
      if (!mode) return res.status(400).json({ error: 'mode required' });
      const ok = setBotMode(mode);
      if (ok) {
        botMode = mode;
        io.emit('mode', mode);
        res.json({ success: true, mode });
      } else {
        res.status(400).json({ error: 'mode must be auto or manual' });
      }
    });

    io.on('connection', (socket) => {
      console.log('🟢 متصفح متصل بلوحة التحكم');
      socket.emit('status', botStatus);
      socket.emit('mode', botMode);
      const qr = getQRDataURL();
      if (qr) socket.emit('qr', qr);
      socket.on('set_mode', (mode) => {
        const ok = setBotMode(mode);
        if (ok) {
          botMode = mode;
          console.log('🔄 وضع البوت:', mode === 'auto' ? 'تلقائي' : 'يدوي');
        }
        socket.emit('mode_changed', { success: ok, mode: mode });
      });
      socket.on('get_orders', () => { try { socket.emit('orders_list', getOrders()); } catch {} });
      socket.on('get_blocked', () => { try { socket.emit('blocked_list', getBlockedNumbers()); } catch {} });
    });

    server.listen(PORT, () => {
      console.log('🌐 الخادم شغال على http://localhost:' + PORT);
      console.log('🚀 تشغيل بوت واتساب...');
      try {
        startBot(io);
        console.log('✅ البوت شغال وجاهز!');
      } catch (e) {
        console.error('❌ البوت:', e.message);
      }
    });
  } catch (e) {
    console.error('❌ فشل تحميل البوت:', e.message);
    process.exit(1);
  }
}

app.get('/api/orders', (req, res) => {
  try { res.json(getOrders()); } catch { res.status(500).json({ error: 'خطأ' }); }
});

app.post('/api/order', (req, res) => {
  try {
    const { customer_name, phone, item, details } = req.body;
    if (!customer_name || !item) return res.status(400).json({ error: 'الاسم والمنتج مطلوبان' });
    const result = addOrder(customer_name, phone || '', item, details || '');
    io.emit('new_order');
    res.json({ success: true, id: result.lastInsertRowid });
  } catch { res.status(500).json({ error: 'خطأ في حفظ الطلب' }); }
});

app.post('/api/order-web', (req, res) => {
  try {
    const { customer_name, phone, item, details } = req.body;
    if (!customer_name || !item) return res.redirect('/?error=1');
    addOrder(customer_name, phone || '', item, details || '');
    io.emit('new_order');
    res.redirect('/?success=1');
  } catch { res.redirect('/?error=1'); }
});

app.post('/api/upload-session', (req, res) => {
  try {
    const { zipBase64 } = req.body;
    if (!zipBase64) return res.status(400).json({ error: 'zipBase64 required' });
    const authPath = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, '.wwebjs_auth') : null;
    if (!authPath) return res.status(400).json({ error: 'DATA_DIR not set' });
    if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });
    const zip = new AdmZip(Buffer.from(zipBase64, 'base64'));
    zip.extractAllTo(authPath, true);
    console.log('📦 تم استلام وفك الجلسة إلى', authPath);
    res.json({ success: true, path: authPath, files: zip.getEntries().length });
  } catch (e) {
    console.error('❌ فشل رفع الجلسة:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/restart', (req, res) => {
  console.log('🔄 إعادة تشغيل ...');
  res.json({ success: true });
  setTimeout(() => process.exit(0), 500);
});

app.get('/api/blocked', (req, res) => {
  try { res.json(getBlockedNumbers()); } catch { res.status(500).json({ error: 'خطأ' }); }
});

app.get('/api/products', (req, res) => {
  res.json([
    { name: 'ماكينة سن 2 بوصة', price: '100 ريال/اليوم' },
    { name: 'ماكينة سن 3 بوصة', price: '120 ريال/اليوم' },
    { name: 'مكنة جروف', price: '80 ريال/اليوم' },
    { name: 'خواشة مواسير', price: '50 ريال/اليوم' },
    { name: 'مكنة باركود HDP', price: '200 ريال/اليوم' },
    { name: 'مكنة ضغط مياه (كهرباء)', price: '50 ريال/اليوم' },
    { name: 'مكنة ضغط مياه (ديزل)', price: '70 ريال/اليوم' },
    { name: 'مكنة HDP راس في راس', price: '200 ريال/اليوم' },
    { name: 'مولد كهرباء 3 كيلو', price: '100 ريال/اليوم' },
    { name: 'مقص 8 بوصة', price: '100 ريال/اليوم' }
  ]);
});

process.on('uncaughtException', (e) => {
  console.error('❌ خطأ غير متوقع:', e.message);
});

process.on('unhandledRejection', (e) => {
  console.error('❌ وعد مرفوض:', e?.message || e);
});

main();
