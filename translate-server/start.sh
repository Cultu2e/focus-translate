#!/bin/bash
# 翻译服务启动脚本（低资源模式）

cd "$(dirname "$0")"

echo "============================================"
echo "网页翻译API服务启动中..."
echo "============================================"

# 设置Python内存优化
export PYTHONDONTWRITEBYTECODE=1
export PYTHONUNBUFFERED=1

# 检查依赖
echo "检查依赖..."
pip show flask > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "安装依赖..."
    pip install flask flask-cors requests -q
fi

echo ""
echo "启动服务..."
echo "按 Ctrl+C 停止服务"
echo ""

# 使用低资源模式运行
exec python -O server.py
