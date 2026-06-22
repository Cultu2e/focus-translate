@echo off
chcp 65001 > nul
echo ============================================
echo 网页翻译API服务启动中...
echo ============================================
echo.

REM 检查Python是否安装
python --version > nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到Python，请先安装Python
    pause
    exit /b 1
)

REM 检查依赖
echo 检查依赖...
pip show flask > nul 2>&1
if errorlevel 1 (
    echo 安装依赖...
    pip install flask flask-cors requests -q
)

echo.
echo 启动服务...
echo 按 Ctrl+C 停止服务
echo.

python server.py

pause
