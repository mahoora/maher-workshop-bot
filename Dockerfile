FROM node:18-bullseye-slim

RUN apt-get update && apt-get install -y \
    chromium \
    chromium-common \
    chromium-sandbox \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

EXPOSE 7860
ENV PORT=7860

ENV DATA_DIR=/data
ENV WWebJSAuthPath=/data/.wwebjs_auth

CMD ["node", "server.js"]
