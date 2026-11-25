#!/bin/bash
# start_daemon.sh - 启动磁盘实时监控后台守护进程
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$HOME/.newmax-clean/app-data/app-d417779e-c5dd-4967-9d9c-ca66382be274"
mkdir -p "$LOG_DIR"

# 检查是否已在运行
if pgrep -f "scripts/disk_daemon.py" >/dev/null 2>&1; then
    echo "磁盘实时监控守护进程已在运行中。"
    exit 0
fi

nohup /usr/local/bin/python3 "$DIR/disk_daemon.py" > "$LOG_DIR/daemon.log" 2> "$LOG_DIR/daemon.error.log" &
sleep 1
if pgrep -f "scripts/disk_daemon.py" >/dev/null 2>&1; then
    echo "磁盘实时监控守护进程已成功在后台启动 (PID: $(pgrep -f "scripts/disk_daemon.py"))"
else
    echo "启动失败，请检查 $LOG_DIR/daemon.error.log"
    exit 1
fi
