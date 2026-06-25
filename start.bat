@echo off
title ماهر البدري - بوت واتساب
cd /d "%~dp0"
echo 🔧 تشغيل البوت...
start /min "" node server.js
timeout /t 5 /nobreak >nul
start "" "http://localhost:3001"
exit
