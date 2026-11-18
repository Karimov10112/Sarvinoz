@echo off
chcp 65001 > nul
title Tug'ilgan kun sayti

echo ========================================================
echo  🎉 Tug'ilgan kun tabrigi sayti ishga tushirilmoqda...
echo ========================================================
echo.

node -v > nul 2>&1
if %errorlevel% neq 0 (
    echo [XATO] Kompyuteringizda Node.js topilmadi!
    echo Iltimos, https://nodejs.org saytidan Node.js ni o'rnating.
    echo.
    pause
    exit /b 1
)

echo Brauzerda ochilmoqda: http://localhost:3000
echo Saytni to'xtatish uchun: ushbu oynani yoping yoki Ctrl+C bosing.
echo.

start "" "http://localhost:3000"
node server.js

if %errorlevel% neq 0 (
    echo.
    echo [XATO] Server to'xtadi yoki xatolik yuz berdi.
    pause
)
