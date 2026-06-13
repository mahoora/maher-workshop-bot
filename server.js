const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { initDB, getOrders, addOrder, getBlockedNumbers } = require('./database');
const { startBot, setStateCallback, setBotMode, getQRDataURL } = require('./bot');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let botMode = 'auto';
let botStatus = 'stopped';

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

app.get('/api/orders', (req, res) => {
  try {
    res.json(getOrders());
  } catch { res.status(500).json({ error: 'خطأ' }); }
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

async function main() {
  try {
    await initDB();
    console.log('✅ قاعدة البيانات جاهزة');
  } catch (e) {
    console.error('❌ قاعدة البيانات:', e.message);
  }

  server.listen(PORT, () => {
    console.log('🌐 الخادم شغال على http://localhost:' + PORT);
    console.log('🚀 تشغيل بوت واتساب...');
    try {
      startBot(io);
    } catch (e) {
      console.error('❌ البوت:', e.message);
    }
  });
}

process.on('uncaughtException', (e) => {
  console.error('❌ خطأ غير متوقع:', e.message);
});

process.on('unhandledRejection', (e) => {
  console.error('❌ وعد مرفوض:', e?.message || e);
});

main();
