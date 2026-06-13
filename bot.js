const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const gTTS = require('gtts');

const { addOrder, blockNumber, unblockNumber, isBlocked } = require('./database');

const ADMIN_NUMBER = '201093122475';
const whatsappGroupLink = 'https://chat.whatsapp.com/DL3qCnpSs6fHU5VYZgDgNL';
const WORKSHOP_ADDRESS = '📍 شارع الحج، مكة المكرمة، الصنايعية الجديدة، بجوار مركز تقدير للسيارات';
const MAINTENANCE_REPLY = 'موجود كل حاجة إن شاء الله، جيبها الورشة';
const WORKSHOP_NAME = 'ماهر البدري للصيانة والإيجار';
const WELCOME_MSG = '👋 أهلاً بيك في ' + WORKSHOP_NAME + '\nكيف أقدر أخدمك؟';

const PRODUCTS = {
  'ماكينة سن 2 بوصة': { price: '💵 100 ريال / اليوم', keywords: ['سن 2', 'سن 2 بوصة', 'ماكينة سن', 'ماكينه سن', 'مكنة سن', 'مكنه سن', 'سعر السن', 'السن', 'السن 2', 'سن 2 بوصه', 'ماكينة سن 2', 'مكنه سن 2', 'سعر سن 2', 'مكنه السن', 'مكنة السن', 'ماكينه السن', 'ماكينة السن', 'سعر المكنه', 'سعر الماكينه'] },
  'ماكينة سن 3 بوصة': { price: '💵 120 ريال / اليوم', keywords: ['سن 3', 'سن 3 بوصة', 'ماكينة سن 3', 'ماكينه سن 3', 'مكنة سن 3', 'مكنه سن 3', 'السن', 'السن 3', 'سن 3 بوصه', 'سعر سن 3', 'مكنه السن 3', 'مكنة السن 3'] },
  'مكنة جروف': { price: '💵 80 ريال / اليوم', keywords: ['جروف', 'مكنة جروف', 'ماكينة جروف', 'مكنه جروف', 'ماكينه جروف', 'سعر الجروف', 'الجروف', 'الگروف'] },
  'خواشة مواسير': { price: '💵 50 ريال / اليوم', keywords: ['خواشة', 'خواشة مواسير', 'خواشه', 'خواشه مواسير', 'سعر الخواشة', 'الخواشة', 'تخويش', 'مواسير'] },
  'مكنة باركود HDP': { price: '💵 200 ريال / اليوم', keywords: ['باركود', 'HDP', 'باركود hdp', 'مكنة باركود', 'مكنه باركود', 'باركد', 'الباركود', 'سعر الباركود', 'ماكينة باركود', 'ماكينه باركود'] },
  'مكنة ضغط مياه (كهرباء)': { price: '💵 50 ريال / اليوم', keywords: ['ضغط كهرباء', 'ضغط كهربا', 'ضغط مياه كهرباء', 'ضغط مياه كهربا', 'ضغط ميه كهربا', 'ضغط ميه كهرباء', 'مكنة ضغط كهربا', 'مكنه ضغط كهربا', 'مكنة ضغط كهرباء', 'مكنه ضغط كهرباء', 'ماكينة ضغط كهربا', 'سعر ضغط كهربا'] },
  'مكنة ضغط مياه (ديزل)': { price: '💵 70 ريال / اليوم', keywords: ['ضغط ديزل', 'ضغط مياه ديزل', 'ضغط ميه ديزل', 'مكنة ضغط ديزل', 'مكنه ضغط ديزل', 'ماكينة ضغط ديزل', 'سعر ضغط ديزل', 'ضغط الديزل'] },
  'مكنة HDP راس في راس': { price: '💵 200 ريال / اليوم', keywords: ['hdp راس', 'راس في راس', 'hdp راس براس', 'راس براس', 'hdp راس براس', 'رأس برأس', 'رأس في رأس', 'hdp'] },
  'مولد كهرباء 3 كيلو': { price: '💵 100 ريال / اليوم', keywords: ['مولد', 'مولد كهرباء', 'مولد كهربا', '3 كيلو', 'مولد 3', 'المو', 'مولد 3 كيلو', 'مولد ثلاث', 'المولد', 'سعر المولد'] },
  'مقص 8 بوصة': { price: '💵 100 ريال / اليوم', keywords: ['مقص', 'مقص 8', 'مقص 8 بوصة', 'مقص 8 بوصه', 'مقص بوصة', 'سعر المقص', 'المقص'] }
};

const FAMILY = {
  'سعاد': { mode: 'wife', greeting: 'حياتي يا سعاد، نورتي الدنيا!', style: 'romantic' },
  'نورا': { mode: 'wife', greeting: 'يا هلا وسهلا يا نورا يا أجمل اسم في الدنيا!', style: 'romantic' },
  'إيه': { mode: 'wife', greeting: 'أهلاً يا إيه، نورتي يا جميلة!', style: 'romantic' },
  'ام السعيد': { mode: 'sister', greeting: 'أهلاً أم السعيد، وحشتينا بجد!', style: 'warm' },
  'بطه': { mode: 'sister', greeting: 'أهلاً يا بطه، عاملة إيه؟', style: 'warm' },
  'هيومه': { mode: 'sister', greeting: 'أهلاً يا هيومه، إزيك ياحبيبتي؟', style: 'warm' },
  'حوده': { mode: 'brother', greeting: 'أهلاً حوده، إزيك يا معلم؟', style: 'manly' },
  'بوبس': { mode: 'brother', greeting: 'أهلاً بوبس، عامل إيه يا جدع؟', style: 'manly' },
  'ابو عماد': { mode: 'brother', greeting: 'أهلاً بأبو عماد، إزيك يارجالة؟', style: 'manly' }
};

function getProductListText() {
  let list = '📋 *قائمة المنتجات والأسعار*\n';
  list += '━━━━━━━━━━━━━━\n';
  let i = 1;
  for (const [name, data] of Object.entries(PRODUCTS)) {
    list += `${i}. ${name} ← ${data.price}\n`;
    i++;
  }
  return list;
}

const GENERAL_RESPONSES = [
  { keywords: ['السلام عليكم', 'سلام عليكم', 'سلام'], response: 'وعليكم السلام ورحمة الله وبركاته\n' + WELCOME_MSG },
  { keywords: ['هلا', 'مرحبا', 'مرحب', 'اهلين', 'هلابك'], response: 'هلا والله\n' + WELCOME_MSG },
  { keywords: ['صباح الخير', 'صباح النور'], response: 'صباح النور والسرور\n' + WELCOME_MSG },
  { keywords: ['مساء الخير', 'مساء النور'], response: 'مساء النور\n' + WELCOME_MSG },
  { keywords: ['إزيك', 'عاملة إيه', 'عامل إيه', 'اخبارك'], response: 'الحمد للله، تمام.\n' + WELCOME_MSG },
  { keywords: ['شكرا', 'متشكر', 'جزاك الله'], response: 'الشكر لله، دايماً تحت أمرك في ' + WORKSHOP_NAME },
  { keywords: ['مع السلامة', 'باى', 'باي'], response: 'مع السلامة، ربنا يحفظك. تحت أمرك في أي وقت.' },
  { keywords: ['العنوان', 'عنوانكم', 'عنوان', 'موقع الورشة', 'الورشة فين', 'العنوان إيه', 'فين ورشتكم', 'فين الورشة', 'مقركم', 'مكانكم', 'مكان الورشة', 'موقعكم'], response: WORKSHOP_ADDRESS },
  { keywords: ['الجروب', 'رابط الجروب', 'جروب السباكين', 'جروب'], response: 'GROUP_ASK' },
  { keywords: ['قائمة الاسعار', 'قائمة الأسعار', 'الاسعار', 'الأسعار', 'عندك إيه', 'الكتالوج', 'المنتجات', 'عندك ايه', 'القائمة'], response: () => getProductListText() },
  { keywords: ['تصليح', 'عطل', 'تصلح', 'قطع غيار', 'صيانة', 'كسران', 'باين', 'تلفان', 'مكسور'], response: MAINTENANCE_REPLY },
  { keywords: ['المعذرة', 'عفوا', 'آسف'], response: 'معلهش، ولا يهمك.' },
  { keywords: ['عايز أأجر', 'عايز أطلب'], response: 'ORDER_REQUEST' },
  { keywords: ['عايز أشتري', 'عايز اشتري'], response: 'ORDER_REQUEST' }
];

async function getAIResponse(text) {
  try {
    const res = await axios.post('https://api-inference.huggingface.co/models/google/gemma-2-2b-it', {
      inputs: `<start_of_turn>user\nأنت مساعد مصري اسمك "بوت ماهر". تتكلم باللهجة المصرية العامية 100% وبس. استخدم الكلمات دي: إيه, عايز, كده, دلوقتي, إزيك, خلاص, طيب, أيوة, لأ, يبقى, كمان, برضه, بقى. ردك يكون قصير ومختصر ومفيد جداً على قد السؤال. ممنوع تستخدم أي كلمة إنجليزية.\n\nالزبون: ${text}\n\nassistant:</start_of_turn>`,
      parameters: { max_new_tokens: 100, temperature: 0.7, return_full_text: false }
    }, { timeout: 5000 });
    let reply = '';
    if (Array.isArray(res.data) && res.data[0] && res.data[0].generated_text) {
      reply = res.data[0].generated_text.trim();
    } else if (res.data && res.data.generated_text) {
      reply = res.data.generated_text.trim();
    }
    if (reply.length > 5) {
      reply = reply.replace(/user|assistant|<start_of_turn>|<end_of_turn>/gi, '').trim();
      return reply;
    }
  } catch {}
  return null;
}

async function getWhisperTranscription(audioBuffer) {
  try {
    const res = await axios.post('https://api-inference.huggingface.co/models/openai/whisper-large-v3', audioBuffer, {
      headers: { 'Content-Type': 'audio/wav' },
      timeout: 30000
    });
    if (res.data && res.data.text) return res.data.text.trim();
  } catch {}
  try {
    const res = await axios.post('https://api-inference.huggingface.co/models/openai/whisper-large-v3', audioBuffer, {
      headers: { 'Content-Type': 'audio/ogg' },
      timeout: 30000
    });
    if (res.data && res.data.text) return res.data.text.trim();
  } catch {}
  return null;
}

function normalizeText(text) {
  let t = text.trim().toLowerCase();
  t = t.replace(/[ًٌٍَُِّْ]/g, '');
  t = t.replace(/[إأآا]/g, 'ا');
  t = t.replace(/[ى]/g, 'ي');
  t = t.replace(/[ة]/g, 'ه');
  return t;
}

function getGeneralResponse(text) {
  const lower = normalizeText(text);
  for (const entry of GENERAL_RESPONSES) {
    for (const kw of entry.keywords) {
      if (lower.includes(normalizeText(kw))) {
        const resp = entry.response;
        if (resp === 'ORDER_REQUEST') return 'ORDER_REQUEST';
        if (resp === 'GROUP_ASK') return 'GROUP_ASK';
        if (typeof resp === 'function') return resp();
        return resp;
      }
    }
  }
  return null;
}

function directPriceMatch(text) {
  const t = normalizeText(text);
  // ─── طقم الأسنان (بيع مباشر) ───
  if (t.includes('اسنان') || t.includes('طقم اسنان') || t.includes('طقم الأسنان') || t.includes('سن ماكينه'))
    return 'طقم الأسنان موجود ومتوفر للبيع ومتاح في الورشة علطول يا فندم، تنورنا في أي وقت!';
  // ─── تكلفة الصيانة والكشف ───
  if (t.includes('التكلفه') || t.includes('التكلفة') || t.includes('تكلف') || t.includes('حسابها') || t.includes('كام كشف'))
    return 'يا فندم التكلفة دي بتكون حسب ما المهندس ماهر يشوف المكنة ويعاين العطل بنفسه، أو أنا بجيب لك الأسعار والتكلفة من المهندس علطول أول ما يفحصها. تشرفنا في الورشة وتنورنا!';
  // ─── الصيانة وقطع الغيار ───
  if (t.includes('موتور') || t.includes('طرمبه') || t.includes('طرمبة') || t.includes('طرمبه زيت') || t.includes('طرمبة زيت') || t.includes('لقمه') || t.includes('لقمة') || t.includes('لوقم') || t.includes('تصليح') || t.includes('عطلانه') || t.includes('صيانه') || t.includes('صيانة') || t.includes('طريقه تصليح') || t.includes('طريقة تصليح'))
    return 'أه قطع الغيار موجودة والصيانة متوفرة إن شاء الله، جيبها هنا الورشة للمهندس ماهر عشان يعملها لك وينظر فيها بنفسه.';
  // ─── معدات الإيجار (الأسعار) ───
  if (t.includes('راس في راس') || t.includes('راس براس') || t.includes('hdp')) return 'مكنة HDP راس في راس بـ 200 ريال في اليوم يا فندم.';
  if (t.includes('2 بوصه') || t.includes('٢ بوصه') || t.includes('2 بوصة') || t.includes('٢ بوصة') || t.includes('مكنه سن') || t.includes('مكنه السن') || t.includes('ماكينه سن') || t.includes('سن 2')) return 'ماكينة سن 2 بوصة بـ 100 ريال في اليوم يا فندم. وماكينة سن 3 بوصة بـ 120 ريال في اليوم.';
  if (t.includes('3 بوصه') || t.includes('٣ بوصه') || t.includes('3 بوصة') || t.includes('٣ بوصة') || t.includes('سن 3')) return 'ماكينة سن 3 بوصة بـ 120 ريال في اليوم يا فندم.';
  if (t.includes('باركود') || t.includes('باركد')) return 'مكنة باركود HDP بـ 200 ريال في اليوم يا فندم.';
  if (t.includes('خواشه') || t.includes('خواشة')) return 'خواشة مواسير بـ 50 ريال في اليوم يا فندم.';
  if (t.includes('جروف') || t.includes('قروش') || t.includes('الگروف')) return 'مكنة جروف بـ 80 ريال في اليوم يا فندم.';
  if (t.includes('ضغط') || t.includes('مواصير')) return 'مكنة ضغط مياه (كهرباء) بـ 50 ريال، وديزل بـ 70 ريال في اليوم يا فندم.';
  if (t.includes('مولد') || t.includes('موّلد') || t.includes('3 كيلو')) return 'مولد كهرباء 3 كيلو بـ 100 ريال في اليوم يا فندم.';
  if (t.includes('مقص')) return 'مقص 8 بوصة بـ 100 ريال في اليوم يا فندم.';
  return null;
}

function getFamilyGreeting(familyMember) {
  if (!familyMember) return null;
  if (familyMember.style === 'romantic') {
    const msgs = [
      `${familyMember.greeting} عاملة إيه يا أجمل حاجة في الدنيا؟`,
      `${familyMember.greeting} إزيك يا حياتي، مشتاقلك بجد!`,
      `${familyMember.greeting} وحشتيني أوي، عامل إيه؟`
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }
  if (familyMember.style === 'warm') {
    const msgs = [
      `${familyMember.greeting} أخبارك إيه؟ وصحتك عاملة إيه؟ ربنا يخليك ليا.`,
      `${familyMember.greeting} إزيك يا حبيبتي، وحشتيني. أيوة عاملة إيه؟`
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }
  if (familyMember.style === 'manly') {
    const msgs = [
      `${familyMember.greeting} أخبارك إيه يا جدع؟ عامل إيه في الدنيا؟`,
      `${familyMember.greeting} إزيك يارجالة، كلو تمام؟`
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }
  return familyMember.greeting;
}

async function createOrderFlow(client, from) {
  await client.sendMessage(from, `من ${WORKSHOP_NAME}\nتمام يا معلم، عايز تسجل طلب جديد.\nأكتب اسمك الأول إيه؟`);
  return { step: 'awaiting_name', data: {} };
}

async function handleOrderStep(client, message, session) {
  const msgText = message.body.trim();
  if (session.step === 'awaiting_name') {
    session.data.name = msgText;
    session.step = 'awaiting_item';
    await client.sendMessage(message.from, `طيب يا ${msgText}، عايز تطلب إيه بالظبط؟`);
    return session;
  }
  if (session.step === 'awaiting_item') {
    session.data.item = msgText;
    session.step = 'awaiting_details';
    await client.sendMessage(message.from, 'فيه تفاصيل زيادة عايز تضيفها؟');
    return session;
  }
  if (session.step === 'awaiting_details') {
    session.data.details = msgText === 'لا' || msgText === 'لأ' ? '' : msgText;
    const phone = message.from.replace('@c.us', '').replace('@g.us', '');
    try {
      addOrder(session.data.name, phone, session.data.item, session.data.details);
    } catch {}
    await client.sendMessage(message.from, `تم تسجيل طلبك يا ${session.data.name} ✅\nالطلب: ${session.data.item}\nمن ${WORKSHOP_NAME}\nهنتواصل معاك إن شاء الله قريب.`);
    return null;
  }
  return null;
}

const userStates = {};
let botClient = null;
let botStateCallback = null;
let currentQRDataURL = '';
let botMode = 'auto';
let io = null;

function setStateCallback(cb) {
  botStateCallback = cb;
}

function updateState(partial) {
  if (botStateCallback) botStateCallback(partial);
}

function startBot(ioInstance) {
  io = ioInstance;
  const tempDir = path.join(process.env.DATA_DIR || __dirname, 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const chromePaths = [
    process.env.CHROME_PATH || '/usr/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  let chromePath = '';
  for (const p of chromePaths) {
    if (fs.existsSync(p)) { chromePath = p; break; }
  }
  const puppeteerOpts = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--single-process',
      '--disable-software-rasterizer',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio'
    ],
    timeout: 120000
  };
  if (chromePath) puppeteerOpts.executablePath = chromePath;

  const authPath = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, '.wwebjs_auth') : undefined;
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: authPath }),
    puppeteer: puppeteerOpts
  });

  botClient = client;
  botMode = 'auto';
  const orderSessions = {};


  client.on('qr', async (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('📱 امسح رمز QR ده باستخدام WhatsApp');
    try {
      currentQRDataURL = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
    } catch {}
    updateState({ status: 'qr', qrCode: qr, qrDataURL: currentQRDataURL });
    if (io) io.emit('qr', currentQRDataURL);
  });

  client.on('ready', () => {
    console.log('✅ البوت شغال وجاهز!');
    updateState({ status: 'connected' });
    if (io) io.emit('status', 'connected');
  });

  client.on('disconnected', (reason) => {
    console.log('❌ تم قطع الاتصال:', reason);
    updateState({ status: 'disconnected' });
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ فشل المصادقة:', msg);
    updateState({ status: 'initializing' });
  });

  client.on('message', async (message) => {
    try {
    if (message.from.endsWith('@g.us')) return;
    const msgText = message.body.trim();
    const senderNumber = message.from.replace('@c.us', '').replace('@g.us', '');
    if (!msgText) return;
    if (isBlocked(senderNumber)) return;

    // ════════════════════════════════════════════
    // 1️⃣ أول حاجة: فحص الأسعار — يسبق أي شيء
    // ════════════════════════════════════════════
    const priceReply = directPriceMatch(msgText);
    if (priceReply === 'GROUP_ASK') {
      await client.sendMessage(message.from, 'هل أنت سباك؟');
      userStates[message.from] = 'waiting_for_plumber_check';
      return;
    }
    if (priceReply) { await client.sendMessage(message.from, priceReply); return; }

    // ════════════════════════════════════════════
    // 2️⃣ معالجة الرسائل الصوتية (فويس)
    // ════════════════════════════════════════════
    if (message.hasMedia) {
      try {
        const media = await message.downloadMedia();
        if (media && media.mimetype && media.mimetype.startsWith('audio/')) {
          const audioBuffer = Buffer.from(media.data, 'base64');
          await client.sendMessage(message.from, '⏳ جاري تفريغ الصوت... ثواني');
          const transcription = await getWhisperTranscription(audioBuffer);
          if (transcription && transcription.length > 2) {
            console.log('🎤 تفريغ صوتي:', transcription);
            let voiceReply = directPriceMatch(transcription);
            if (voiceReply === 'GROUP_ASK') {
              await client.sendMessage(message.from, 'هل أنت سباك؟');
              userStates[message.from] = 'waiting_for_plumber_check';
              try { const tts = new gTTS('هل أنت سباك؟', 'ar'); const a = path.join(tempDir, `grp_${Date.now()}.mp3`); await new Promise((r,j)=>{tts.save(a,(e)=>{if(e)j(e);else r();});}); if (fs.existsSync(a)) { await client.sendMessage(message.from, MessageMedia.fromFilePath(a), { sendAudio: true }); try { fs.unlinkSync(a); } catch {} } } catch {}
              return;
            }
            if (!voiceReply) voiceReply = await generateBotReply(transcription);
            if (voiceReply) {
              await client.sendMessage(message.from, voiceReply);
              try {
                const tts = new gTTS(voiceReply, 'ar');
                const audioFile = path.join(tempDir, `reply_${Date.now()}.mp3`);
                await new Promise((resolve, reject) => {
                  tts.save(audioFile, (err) => { if (err) reject(err); else resolve(); });
                });
                if (fs.existsSync(audioFile)) {
                  const audioMedia = MessageMedia.fromFilePath(audioFile);
                  await client.sendMessage(message.from, audioMedia, { sendAudio: true });
                  try { fs.unlinkSync(audioFile); } catch {}
                }
              } catch (ttsErr) {
                console.error('❌ gTTS فشل:', ttsErr.message);
              }
            }
          } else {
            await client.sendMessage(message.from, '💬 معذرة ما فهمت الفويس، ممكن تكتب رسالة؟');
          }
          return;
        }
      } catch (mediaErr) {
        console.error('❌ خطأ في معالجة الصوت:', mediaErr.message);
        try { await client.sendMessage(message.from, '❌ حصل خطأ في معالجة الفويس، جرب تاني'); } catch {}
        return;
      }
    }

    console.log('📩 رسالة واردة:', msgText.substring(0, 100));

    // ════════════════════════════════════════════
    // 3️⃣ التحقق من حالة المستخدم (جروب السباكين)
    // ════════════════════════════════════════════
    if (userStates[message.from] === 'waiting_for_plumber_check') {
      const answer = normalizeText(msgText);
      if (answer.includes('نعم') || answer.includes('ايوه') || answer.includes('أيوه') || answer.includes('أه') || answer.includes('اه') || answer.includes('تمام') || answer.includes('طيب') || answer.includes('يب') || answer.includes('انا سباك') || answer.includes('تاجر') || answer.includes('فني')) {
        await client.sendMessage(message.from, `تنورنا يا هندسة في جروب الصيانة! ده رابط الجروب المباشر:\n${whatsappGroupLink}`);
        delete userStates[message.from];
        return;
      } else {
        await client.sendMessage(message.from, 'عفواً، الجروب مخصص لأهل المهنة والسباكين فقط.');
        delete userStates[message.from];
        return;
      }
    }

    const contact = await message.getContact();
    const pushName = message._data?.notifyName || contact.pushname || message.author || '';
    const shortName = pushName.split(' ').slice(0, 3).join(' ');

    let familyMember = null;
    for (const [fName, fData] of Object.entries(FAMILY)) {
      if (shortName.toLowerCase().includes(fName.toLowerCase())) {
        familyMember = fData;
        familyMember.name = fName;
        break;
      }
    }
    if (!familyMember && senderNumber.includes(ADMIN_NUMBER)) {
      familyMember = { mode: 'admin', style: 'admin', name: 'ماهر' };
    }

    // Check for order session continuation
    if (orderSessions[message.from]) {
      const session = await handleOrderStep(client, message, orderSessions[message.from]);
      if (session) {
        orderSessions[message.from] = session;
      } else {
        delete orderSessions[message.from];
      }
      return;
    }

    // Admin commands
    if (senderNumber.includes(ADMIN_NUMBER)) {
      if (msgText === 'يدوي' || msgText === 'يدوى') {
        setBotMode('manual');
        await client.sendMessage(message.from, `✅ تم التحويل للوضع اليدوي يا أستاذ ماهر.\nالبوت مش هياخد أي ردود دلوقتي.`);
        return;
      }
      if (msgText === 'تلقائي' || msgText === 'تلقائى') {
        setBotMode('auto');
        await client.sendMessage(message.from, `✅ تم التحويل للوضع التلقائي يا أستاذ ماهر.\nالبوت رجع يرد تاني.`);
        return;
      }
      if (msgText === 'قائمة' || msgText === 'اعدادات' || msgText === 'إعدادات') {
        const menu = `📋 *${WORKSHOP_NAME}* - قائمة التحكم\n\n1️⃣ يدوي - إيقاف الرد التلقائي\n2️⃣ تلقائي - تشغيل الرد التلقائي\n3️⃣ الغاء رقم - حظر رقم\n4️⃣ تفعيل رقم - إلغاء حظر رقم\n\nالحالة: ${botMode === 'auto' ? 'تلقائي 🟢' : 'يدوي 🔴'}`;
        await client.sendMessage(message.from, menu);
        return;
      }
      if (msgText.startsWith('الغاء')) {
        const num = msgText.replace('الغاء', '').trim();
        if (num) {
          try { blockNumber(num); } catch {}
          await client.sendMessage(message.from, `✅ تم حظر الرقم ${num}`);
          if (io) io.emit('blocked_update');
        }
        return;
      }
      if (msgText.startsWith('تفعيل')) {
        const num = msgText.replace('تفعيل', '').trim();
        if (num) {
          try { unblockNumber(num); } catch {}
          await client.sendMessage(message.from, `✅ تم إلغاء حظر الرقم ${num}`);
          if (io) io.emit('blocked_update');
        }
        return;
      }
    }

    if (botMode === 'manual') return;

    // Handle family mode
    if (familyMember) {
      if (familyMember.style === 'romantic') {
        const greeting = getFamilyGreeting(familyMember);
        await client.sendMessage(message.from, greeting);
        await new Promise(r => setTimeout(r, 500));
        if (msgText.length > 3) {
          const ai = await getAIResponse(msgText);
          if (ai) {
            await client.sendMessage(message.from, ai);
          }
        }
        return;
      }
      if (familyMember.style === 'warm') {
        const greeting = getFamilyGreeting(familyMember);
        await client.sendMessage(message.from, greeting);
        await new Promise(r => setTimeout(r, 500));
        if (msgText.length > 3) {
          await client.sendMessage(message.from, `ربنا يخليكي يا ${familyMember.name}، كل حاجة تمام؟`);
        }
        return;
      }
      if (familyMember.style === 'manly') {
        const greeting = getFamilyGreeting(familyMember);
        await client.sendMessage(message.from, greeting);
        await new Promise(r => setTimeout(r, 500));
        if (msgText.length > 3) {
          await client.sendMessage(message.from, `فكرة كويسة يا ${familyMember.name}، خلينا نشوف إيه المطلوب.`);
        }
        return;
      }
      return;
    }

    // Normal message handling
    const reply = await generateBotReply(msgText);
    if (reply) {
      if (reply === 'ORDER_REQUEST') {
        const session = await createOrderFlow(client, message.from);
        orderSessions[message.from] = session;
        return;
      }
      if (reply === 'GROUP_ASK') {
        await client.sendMessage(message.from, 'هل أنت سباك؟');
        userStates[message.from] = 'waiting_for_plumber_check';
        return;
      }
      await client.sendMessage(message.from, reply);
      console.log('✅ رد البوت:', reply.substring(0, 100));
    }
    } catch (e) {
      console.error('❌ خطأ في معالجة الرسالة:', e.message);
    }
  });

  async function generateBotReply(text) {
    text = text.trim();
    if (!text || text.length < 2) return null;

    const lower = normalizeText(text);

    // Check if asking about all products generally
    const askWords = ['عندك', 'في مكن', 'في ماكين', 'في معد', 'الإيجار', 'ايه عندك', 'عندك ايه', 'تأجير'];
    for (const w of askWords) {
      if (lower.includes(normalizeText(w))) return getProductListText();
    }

    // Check general responses
    const general = getGeneralResponse(text);
    if (general) {
      if (general === 'ORDER_REQUEST') return 'ORDER_REQUEST';
      return general;
    }

    // Maintenance check
    const maintKeywords = ['تصليح', 'عطل', 'تصلح', 'قطع غيار', 'صيانة', 'كسران', 'باين', 'خلل', 'تلفان', 'مكسور', 'خراب', 'تغير', 'عايز اصلح', 'عايزه اصلح', 'صلح', 'كشف'];
    for (const kw of maintKeywords) {
      if (lower.includes(normalizeText(kw))) return `من ${WORKSHOP_NAME}:\n` + MAINTENANCE_REPLY;
    }

    // Location check (backup - already handled in GENERAL_RESPONSES)
    const locKeywords = ['العنوان', 'الورشه فين', 'الورشة فين', 'موقع', 'فين ورشتكم', 'مكان', 'فين ورشتكم', 'مقركم'];
    for (const kw of locKeywords) {
      if (lower.includes(normalizeText(kw))) return WORKSHOP_ADDRESS;
    }

    // Ultimate fallback
    const fallbacks = [
      'أي خدمة يا معلم؟',
      'حاضر. عايز إيه بالظبط؟',
      'تحت أمرك، عايز تستفسر عن إيه؟',
      'أنا موجود يا معلم. عايز إيه؟'
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  client.initialize();
  updateState({ status: 'initializing' });
  return client;
}

function getBotMode() {
  return botMode;
}

function setBotMode(mode) {
  if (mode === 'auto' || mode === 'manual') {
    botMode = mode;
    if (io) io.emit('mode', mode);
    if (botStateCallback) botStateCallback({ mode: mode });
    console.log(`🔁 تم تغيير وضع البوت إلى: ${mode}`);
    return true;
  }
  return false;
}

function getQRDataURL() {
  return currentQRDataURL;
}

module.exports = { startBot, setStateCallback, getBotMode, setBotMode, getQRDataURL, botClient };
