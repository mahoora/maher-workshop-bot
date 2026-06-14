#!/bin/bash
echo "فك ضغط الجلسة..."
node decode-session.js

echo "تشغيل السيرفر..."
node server.js
