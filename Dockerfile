FROM node:20-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

EXPOSE 7860
ENV PORT=7860
ENV DATA_DIR=/data

RUN chmod +x start.sh
CMD ["bash", "start.sh"]
