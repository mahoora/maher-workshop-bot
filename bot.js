import fs from "node:fs/promises";
import http from "node:http";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import axios from "axios";
import dotenv from "dotenv";
import pino from "pino";
import QRCode from "qrcode";
import qrcodeTerminal from "qrcode-terminal";

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

const PORT = Number(process.env.PORT || 3000);
const OLLAMA_API = process.env.OLLAMA_API || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";
const USE_OLLAMA = process.env.USE_OLLAMA !== "false";
const SETTINGS_FILE = process.env.SETTINGS_FILE || "bot-settings.json";

let latestQr = "";
let latestQrDataUrl = "";
let isWhatsAppConnected = false;
let autoReplyEnabled = true;
let welcomeMessage = "أهلا يا أستاذ {name}. تحت أمرك في إيجار وصيانة معدات الحريق والسباكة. ابعت اسم المعدة أو المشكلة وأنا أقولك التفاصيل.";

// Integration with server.js (Express + Socket.IO)
let ioInstance = null;
let _stateCallback = null;

export function setStateCallback(cb) { _stateCallback = cb; }

export function setBotMode(mode) {
  if (mode !== "auto" && mode !== "manual") return false;
  autoReplyEnabled = mode === "auto";
  saveSettings();
  if (_stateCallback) _stateCallback({ mode, status: isWhatsAppConnected ? "connected" : "disconnected" });
  return true;
}

export function getQRDataURL() { return latestQrDataUrl; }

const products = [
  { names: ["ماكينة سن 2", "مكنة سن 2", "ماكينه سن 2", "سن 2", "سن اتنين", "2 بوصة", "2 بوصه"], label: "ماكينة سن 2 بوصة", price: "100 ريال/اليوم" },
  { names: ["ماكينة سن 3", "مكنة سن 3", "ماكينه سن 3", "سن 3", "سن تلاتة", "سن ثلاثة", "3 بوصة", "3 بوصه"], label: "ماكينة سن 3 بوصة", price: "120 ريال/اليوم" },
  { names: ["جروف", "groove"], label: "مكنة جروف", price: "80 ريال/اليوم" },
  { names: ["خواشة", "خواشه", "خواشة مواسير", "خواشه مواسير"], label: "خواشة مواسير", price: "50 ريال/اليوم" },
  { names: ["باركود", "hpd", "hdp"], label: "مكنة باركود HDP", price: "200 ريال/اليوم" },
  { names: ["ضغط مياه كهرباء", "ضغط كهرباء", "مكنة ضغط كهرباء", "ماكينة ضغط كهرباء"], label: "مكنة ضغط مياه كهرباء", price: "50 ريال/اليوم" },
  { names: ["ضغط مياه ديزل", "ضغط ديزل", "مكنة ضغط ديزل", "ماكينة ضغط ديزل"], label: "مكنة ضغط مياه ديزل", price: "70 ريال/اليوم" },
  { names: ["راس في راس", "رأس في رأس", "hdp راس", "hpd راس"], label: "مكنة HDP راس في راس", price: "200 ريال/اليوم" },
  { names: ["مولد", "مولد كهرباء", "3 كيلو", "3kw", "٣ كيلو"], label: "مولد كهرباء 3 كيلو", price: "100 ريال/اليوم" },
  { names: ["مقص", "مقص 8", "8 بوصة", "8 بوصه"], label: "مقص 8 بوصة", price: "100 ريال/اليوم" }
];

logger.info(`Ollama ${USE_OLLAMA ? "enabled" : "disabled"} at ${OLLAMA_API} with model: ${OLLAMA_MODEL}`);

function json(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(data));
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    const settings = JSON.parse(raw);
    if (typeof settings.autoReplyEnabled === "boolean") autoReplyEnabled = settings.autoReplyEnabled;
    if (typeof settings.welcomeMessage === "string" && settings.welcomeMessage.trim()) {
      welcomeMessage = settings.welcomeMessage.trim();
    }
  } catch {
    // First run has no settings file yet.
  }
}

async function saveSettings() {
  await fs.writeFile(
    SETTINGS_FILE,
    JSON.stringify({ autoReplyEnabled, welcomeMessage }, null, 2),
    "utf8"
  );
}

function renderControlPage() {
  const status = isWhatsAppConnected
    ? "البوت متصل بواتساب"
    : latestQrDataUrl
      ? "امسح الكود من واتساب"
      : "لسه مستني QR جديد، اعمل تحديث بعد ثواني";

  const qrHtml = latestQrDataUrl
    ? `<img class="qr" src="${latestQrDataUrl}" alt="WhatsApp QR Code" />`
    : `<div class="empty">لا يوجد QR حاليًا</div>`;

  const modeText = autoReplyEnabled ? "الرد التلقائي شغال" : "الرد اليدوي شغال";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="25" />
  <title>لوحة تحكم بوت واتساب</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #f4f6f8;
      color: #101828;
      font-family: Arial, Tahoma, sans-serif;
    }
    main {
      width: min(94vw, 560px);
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 22px;
      text-align: center;
      box-shadow: 0 12px 28px rgba(15, 23, 42, .10);
    }
    h1 { margin: 0 0 8px; font-size: 24px; }
    p { margin: 0 0 14px; color: #475467; line-height: 1.6; }
    .qr {
      width: min(82vw, 360px);
      height: auto;
      padding: 8px;
      border: 1px solid #d0d5dd;
      border-radius: 6px;
      background: #fff;
      image-rendering: pixelated;
    }
    .empty {
      padding: 42px 16px;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      color: #667085;
    }
    .mode {
      margin: 16px 0 12px;
      padding: 10px;
      border-radius: 6px;
      background: #f1f5f9;
      font-weight: 700;
    }
    .controls {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    textarea {
      width: 100%;
      min-height: 92px;
      margin: 8px 0 10px;
      padding: 10px;
      border: 1px solid #d0d5dd;
      border-radius: 6px;
      resize: vertical;
      font: inherit;
      line-height: 1.5;
    }
    button {
      min-height: 46px;
      border: 0;
      border-radius: 6px;
      padding: 10px;
      color: #fff;
      background: #0f766e;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
    }
    button.secondary { background: #334155; }
    button.warn { grid-column: 1 / -1; background: #b45309; }
    button:disabled { opacity: .65; cursor: wait; }
    .note { margin-top: 14px; font-size: 13px; color: #667085; }
  </style>
</head>
<body>
  <main>
    <h1>${status}</h1>
    <p>افتح واتساب: Linked devices ثم Link a device</p>
    ${qrHtml}
    <div class="mode" id="mode">${modeText}</div>
    <div class="controls">
      <button type="button" onclick="setMode(true)">رد تلقائي</button>
      <button type="button" class="secondary" onclick="setMode(false)">رد يدوي</button>
      <button type="button" class="warn" onclick="refreshQr(this)">تجديد الباركود</button>
    </div>
    <p class="note">رسالة الترحيب والرد العام</p>
    <textarea id="welcome">${welcomeMessage}</textarea>
    <button type="button" class="secondary" onclick="saveWelcome(this)" style="width:100%">حفظ رسالة الترحيب</button>
    <p class="note">الرابط ثابت. افتحه في أي وقت وهيعرض أحدث باركود موجود.</p>
  </main>
  <script>
    async function setMode(autoReply) {
      const result = await fetch('/api/mode', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ autoReply })
      }).then(r => r.json());
      document.getElementById('mode').textContent = result.autoReplyEnabled ? 'الرد التلقائي شغال' : 'الرد اليدوي شغال';
    }

    async function refreshQr(button) {
      if (!confirm('تجديد الباركود هيفصل تسجيل واتساب الحالي ويطلع كود جديد. نكمل؟')) return;
      button.disabled = true;
      button.textContent = 'جاري تجديد الباركود...';
      await fetch('/api/refresh-qr', { method: 'POST' });
      setTimeout(() => location.reload(), 9000);
    }
    async function saveWelcome(button) {
      button.disabled = true;
      const welcomeMessage = document.getElementById('welcome').value;
      await fetch('/api/welcome', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ welcomeMessage })
      });
      button.textContent = 'اتحفظت';
      setTimeout(() => {
        button.disabled = false;
        button.textContent = 'حفظ رسالة الترحيب';
      }, 1200);
    }
  </script>
</body>
</html>`;
}

function startWebServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/qr")) {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "pragma": "no-cache",
        "expires": "0"
      });
      res.end(renderControlPage());
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, {
        ok: true,
        service: "maher-workshop-bot",
        whatsappConnected: isWhatsAppConnected,
        qrReady: Boolean(latestQr),
        autoReplyEnabled,
        welcomeMessage,
        qrUrl: "/",
        ollamaEnabled: USE_OLLAMA,
        model: OLLAMA_MODEL
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/status") {
      json(res, 200, {
        ok: true,
        whatsappConnected: isWhatsAppConnected,
        qrReady: Boolean(latestQr),
        autoReplyEnabled,
        welcomeMessage
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/test-reply") {
      const text = url.searchParams.get("text") || "";
      json(res, 200, {
        ok: true,
        text,
        reply: getFallbackResponse(text, "الزميل")
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/mode") {
      let rawBody = "";
      for await (const chunk of req) rawBody += chunk;
      const payload = rawBody ? JSON.parse(rawBody) : {};
      autoReplyEnabled = Boolean(payload.autoReply);
      await saveSettings();
      json(res, 200, { ok: true, autoReplyEnabled });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/welcome") {
      let rawBody = "";
      for await (const chunk of req) rawBody += chunk;
      const payload = rawBody ? JSON.parse(rawBody) : {};
      if (typeof payload.welcomeMessage === "string" && payload.welcomeMessage.trim()) {
        welcomeMessage = payload.welcomeMessage.trim();
        await saveSettings();
      }
      json(res, 200, { ok: true, welcomeMessage });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/refresh-qr") {
      json(res, 200, { ok: true, restarting: true });
      setTimeout(async () => {
        try {
          await fs.rm("auth_info_baileys", { recursive: true, force: true });
        } catch (error) {
          logger.error(`Failed to remove auth folder: ${error.message}`);
        }
        process.exit(0);
      }, 500);
      return;
    }

    json(res, 404, { ok: false, error: "not found" });
  });

  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`Control page listening on port ${PORT}`);
  });
}

function getMessageText(message) {
  const content = message.message;
  if (!content) return "";

  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    ""
  );
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠۰]/g, "0")
    .replace(/[١۱]/g, "1")
    .replace(/[٢۲]/g, "2")
    .replace(/[٣۳]/g, "3")
    .replace(/[٤۴]/g, "4")
    .replace(/[٥۵]/g, "5")
    .replace(/[٦۶]/g, "6")
    .replace(/[٧۷]/g, "7")
    .replace(/[٨۸]/g, "8")
    .replace(/[٩۹]/g, "9")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findProduct(text) {
  const normalized = normalizeText(text);
  return products.find((product) =>
    product.names.some((name) => normalized.includes(normalizeText(name)))
  );
}

function listProducts() {
  return products.map((product) => `- ${product.label}: ${product.price}`).join("\n");
}

function getFallbackResponse(text, clientName) {
  const product = findProduct(text);
  const normalized = normalizeText(text);

  if (product) {
    return `أهلا يا أستاذ ${clientName}. ${product.label} إيجارها ${product.price}. تحب تحجزها كام يوم؟`;
  }

  if (normalized.includes("سن")) {
    return `أهلا يا أستاذ ${clientName}. عندنا ماكينة سن 2 بوصة بـ 100 ريال/اليوم، وماكينة سن 3 بوصة بـ 120 ريال/اليوم. محتاج أنهي واحدة؟`;
  }

  if (normalized.includes("ضغط")) {
    return `أهلا يا أستاذ ${clientName}. مكنة ضغط مياه كهرباء بـ 50 ريال/اليوم، ومكنة ضغط مياه ديزل بـ 70 ريال/اليوم. تحب أنهي نوع؟`;
  }

  if (/(كل الاسعار|قائمه الاسعار|القائمه|الاسعار كلها|كل الموجود|ايه الموجود|عندك ايه)/i.test(normalized)) {
    return `أهلا يا أستاذ ${clientName}. دي قائمة الإيجار المتاحة:\n${listProducts()}\n\nقولّي محتاج أنهي معدة ومدة الإيجار كام يوم.`;
  }

  if (/(السعر|اسعار|بكام|كام|الموجود|متاح|ايجار|عاوز|عايز|ابغى|ابغي|احتاج|محتاج)/i.test(normalized)) {
    return `أهلا يا أستاذ ${clientName}. اكتب اسم المعدة اللي محتاج سعرها، مثلا: ماكينة سن 2، جروف، باركود، ضغط كهرباء، مولد، أو مقص.`;
  }

  if (/(تصليح|صيانه|اصلح|خربان|عطلان|بايظ)/i.test(normalized)) {
    return `أهلا يا أستاذ ${clientName}. موجود صيانة إن شاء الله، ابعتلي نوع المعدة والمشكلة أو هاتها الورشة ونشوفها.`;
  }

  if (/(السلام|سلام|اهلا|ازيك|مرحبا|صباح|مساء)/i.test(normalized)) {
    return welcomeMessage.replaceAll("{name}", clientName);
  }

  return `أهلا يا أستاذ ${clientName}. اكتب اسم المعدة اللي عايزها وأنا أقولك سعرها. مثلا: السن بكام، الباركود بكام، أو الجروف بكام.`;
}

async function getAIResponse(prompt, text, clientName) {
  if (!USE_OLLAMA) {
    return getFallbackResponse(text, clientName);
  }

  try {
    const response = await axios.post(
      `${OLLAMA_API}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt,
        stream: false
      },
      { timeout: 60000 }
    );

    return (response.data.response || "").trim() || getFallbackResponse(text, clientName);
  } catch (error) {
    logger.error(`Ollama unavailable: ${error.message}`);
    return getFallbackResponse(text, clientName);
  }
}

function buildPrompt(text, clientName) {
  return `أنت ماهر البدري، صاحب ورشة صيانة وإيجار معدات الحريق والسباكة في مكة.
اتكلم مع العميل بالعامية المصرية فقط، وخليك مختصر وواضح ومهذب.
لو العميل بيسأل عن سعر أو توفر منتج، جاوبه من القائمة. لو محتاج تفاصيل ناقصة، اسأله سؤال واحد واضح.

قائمة المنتجات للإيجار:
${listProducts()}

العميل ${clientName}: ${text}
ماهر البدري:`;
}

async function updateQr(qr) {
  latestQr = qr;
  latestQrDataUrl = await QRCode.toDataURL(qr, {
    margin: 2,
    scale: 7,
    errorCorrectionLevel: "M"
  });
  if (ioInstance) ioInstance.emit("qr", latestQrDataUrl);
  if (_stateCallback) _stateCallback({ status: "qr", mode: autoReplyEnabled ? "auto" : "manual" });
}

export async function startBot(io) {
  ioInstance = io;
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" })
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      await updateQr(qr);
      logger.info("QR جاهز على صفحة التحكم: https://maher-workshop-bot.onrender.com");
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === "open") {
      isWhatsAppConnected = true;
      latestQr = "";
      latestQrDataUrl = "";
      logger.info("البوت متصل بواتساب!");
      if (ioInstance) ioInstance.emit("qr", null);
      if (_stateCallback) _stateCallback({ status: "connected", mode: autoReplyEnabled ? "auto" : "manual" });
    } else if (connection === "close") {
      isWhatsAppConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (ioInstance) ioInstance.emit("qr", null);
      if (_stateCallback) _stateCallback({ status: "disconnected", mode: autoReplyEnabled ? "auto" : "manual" });

      if (shouldReconnect) {
        logger.info("إعادة الاتصال...");
        setTimeout(() => {
          startBot(ioInstance || io).catch((error) => logger.error(`فشل إعادة الاتصال: ${error.message}`));
        }, 3000);
      } else {
        logger.warn("تم تسجيل الخروج. افتح صفحة التحكم لتجديد QR.");
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (m) => {
    const message = m.messages[0];

    if (!message?.message || message.key.fromMe) return;

    const sender = message.key.remoteJid;
    const text = getMessageText(message);

    if (!sender || !text.trim()) return;

    if (!autoReplyEnabled) {
      logger.info(`Manual mode: ignored message from ${sender}`);
      return;
    }

    const senderName = message.pushName || "الزميل";

    try {
      const prompt = buildPrompt(text, senderName);
      const aiResponse = await getAIResponse(prompt, text, senderName);

      await sock.sendMessage(sender, { text: aiResponse });
      logger.info(`تم الرد على العميل: ${aiResponse.substring(0, 50)}...`);
    } catch (error) {
      logger.error(`خطأ: ${error.message}`);
    }
  });
}

// When run directly as `node bot.js`, start standalone server
const isMainModule = process.argv[1]?.replace(/\\/g, "/").endsWith("/bot.js");
if (isMainModule) {
  loadSettings()
    .then(() => {
      startWebServer();
      return startBot();
    })
    .catch((err) => {
      logger.error(`خطأ في بدء البوت: ${err.message}`);
      process.exit(1);
    });
}
