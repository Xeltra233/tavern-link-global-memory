@echo off
chcp 65001 >nul 2>nul
title Tavern-Link

echo ========================================
echo    Tavern-Link 启动器
echo ========================================
echo.

:: 检查 Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] 未检测到 Node.js
    echo.
    echo 请安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo [√] Node.js 已安装
echo.

:: 检查依赖
if not exist "node_modules\" (
    echo [!] 正在安装依赖...
    echo.
    call npm install
    echo.
)

:: 检查配置
if not exist "config.json" (
    if exist "config.example.json" (
        echo [!] 正在创建配置文件...
        copy "config.example.json" "config.json" >nul
        echo [√] 已创建 config.json，请修改后重启
        echo.
        pause
        exit /b 0
    )
)

:: 创建目录
if not exist "data\characters\" mkdir "data\characters" 2>nul
if not exist "data\chats\" mkdir "data\chats" 2>nul

echo ========================================
echo    启动 Tavern-Link
echo ========================================
echo.

:: 直接启动
node src/index.js

echo.
echo ========================================
echo    程序已退出
echo ========================================
pause
