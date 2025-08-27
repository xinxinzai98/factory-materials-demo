#!/usr/bin/env bash
set -euo pipefail

# 一键启动：Postgres(可选)、后端(8080)、前端(5173)，并自动打开浏览器
# 需求：macOS (zsh/bash)，Node.js 18+，已安装依赖

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SERVER_DIR="$ROOT_DIR/server"
WEB_DIR="$ROOT_DIR/web"

# 工具函数：端口检测与清理
kill_port() {
  local port=$1
  if command -v lsof >/dev/null; then
    local pids
    pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN || true)
    if [ -n "$pids" ]; then
      echo "Killing processes on port $port: $pids"
      kill -9 $pids || true
      # 等待端口释放
      for i in {1..10}; do
        sleep 0.3
        lsof -i :"$port" >/dev/null 2>&1 || break
      done
    fi
  fi
}

wait_for_port() {
  local host=${1:-localhost}
  local port=${2:-80}
  local retries=${3:-120}
  local i=0
  if command -v nc >/dev/null; then
    until nc -z "$host" "$port"; do
      i=$((i+1))
      if [ "$i" -ge "$retries" ]; then
        echo "Port $host:$port not ready after $retries checks" >&2
        exit 1
      fi
      sleep 0.5
    done
  else
    until lsof -i :"$port" | grep -q "$host" >/dev/null 2>&1; do
      i=$((i+1))
      if [ "$i" -ge "$retries" ]; then
        echo "Port $host:$port not ready after $retries checks (lsof)" >&2
        exit 1
      fi
      sleep 0.5
    done
  fi
}

# 预清理占用端口，避免 EADDRINUSE
kill_port 8080
kill_port 5173

# 1) 构建并运行数据库迁移
pushd "$SERVER_DIR" >/dev/null
if [ -f .env ]; then
  # 仅导出所需键，忽略注释与空行；若没有匹配项也不报错
  set +u
  export $(grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASS|DB_NAME|PORT|API_KEY|DB_SYNC)=' .env | sed 's/#.*$//' | xargs) 2>/dev/null || true
  set -u
fi

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

ensure_db() {
  echo "Checking Postgres at ${DB_HOST}:${DB_PORT}..."
  # 如果本地端口已开放则直接返回
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "Postgres is up."
    return 0
  fi
  # 尝试用 docker compose 启动 db 服务
  if command -v docker >/dev/null; then
    local compose_cmd=""
    if docker compose version >/dev/null 2>&1; then
      compose_cmd="docker compose"
    elif command -v docker-compose >/dev/null; then
      compose_cmd="docker-compose"
    fi
    if [ -n "$compose_cmd" ] && [ -f "$ROOT_DIR/docker-compose.yml" ]; then
  echo "Starting Postgres via Docker Compose..."
  (cd "$ROOT_DIR" && COMPOSE_PROJECT_NAME=materials $compose_cmd -p materials up -d db)
  # 等待端口开放
  wait_for_port "$DB_HOST" "$DB_PORT" 180
      echo "Postgres (Docker) is up."
      return 0
    fi
  fi
  echo "Postgres is not running and Docker Compose not available. Please start Postgres on ${DB_HOST}:${DB_PORT}." >&2
  exit 1
}

# 安装依赖（若未安装或缺少必要可执行文件）
if [ ! -d node_modules ] || [ ! -x node_modules/.bin/tsc ] || [ ! -x node_modules/.bin/tsx ]; then
  echo "Installing server deps..."
  (npm ci || npm i)
fi

# 确保数据库可用
ensure_db

# 运行迁移（使用 dist/data-source）
npm run build >/dev/null
npm run migration:run
popd >/dev/null

# 2) 启动后端（后台）
(cd "$SERVER_DIR" && npm run dev) &
API_PID=$!

echo "Backend started (pid $API_PID)"

# 等待后端端口 8080 就绪
wait_for_port localhost 8080 120

# 3) 启动前端（后台）
pushd "$WEB_DIR" >/dev/null
if [ ! -d node_modules ] || [ ! -x node_modules/.bin/vite ]; then
  echo "Installing web deps..."
  (npm ci || npm i)
fi

# 设置前端 BASE 为 /api 代理默认（vite.config 已代理到 8080）
(npm run dev) &
WEB_PID=$!

popd >/dev/null

echo "Frontend started (pid $WEB_PID)"

# 4) 等待前端端口就绪，再打开浏览器
wait_for_port localhost 5173 120

OPEN_URL="http://localhost:5173/"
if command -v open >/dev/null; then
  open "$OPEN_URL"
else
  echo "Please open $OPEN_URL manually"
fi

echo "All services are up. Press Ctrl+C to stop here; child processes will continue."

# 父进程退出时清理子进程
cleanup() {
  echo "Shutting down..."
  kill_port 5173
  if [ -n "${WEB_PID:-}" ] && ps -p $WEB_PID >/dev/null 2>&1; then kill $WEB_PID 2>/dev/null || true; fi
  if [ -n "${API_PID:-}" ] && ps -p $API_PID >/dev/null 2>&1; then kill $API_PID 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

wait
