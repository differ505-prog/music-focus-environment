#!/usr/bin/env bash
# scripts/detect-dev-port.sh
#
# CONSTITUTION Rule #12 自動偵測 — 找出正在跑的 Next.js dev server 的實際 URL。
# 用法:
#   bash scripts/detect-dev-port.sh              # 列出每個候選 port 與最後一條 stdout
#   bash scripts/detect-dev-port.sh --first      # 只輸出第一個偵測到的 URL
#   bash scripts/detect-dev-port.sh --json       # JSON 格式 (適合 CI / AI 解析)
#
# 終結 port 漂移焦慮 — 不再寫死 3000。

set -euo pipefail

PORTS=(3000 3001 3002 3003 3004 3005)
PROJECT_NAME="music-focus-environment"

first_only=false
json_mode=false

for arg in "$@"; do
  case $arg in
    --first) first_only=true ;;
    --json) json_mode=true ;;
    --help|-h)
      echo "Usage: $0 [--first] [--json]"
      echo "  --first  只輸出第一個找到的 URL"
      echo "  --json   輸出 JSON 格式"
      exit 0
      ;;
  esac
done

probe_port() {
  local port=$1
  # 確認 port 有人在 listen
  local pid
  pid=$(lsof -ti :"$port" -P 2>/dev/null | head -1 || true)
  if [ -z "$pid" ]; then
    return 1
  fi
  # 嘗試 curl，3 秒 timeout (Sandbox 可能擋，但 hostname 通常 OK)
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://localhost:${port}" 2>/dev/null || echo "0")
  # 去前導零（避免 JSON 出現 000000 而非 0）
  http_code=$(echo "$http_code" | sed 's/^0*//' | sed 's/^$/0/')
  echo "${port}|${pid}|${http_code}"
}

declare -a results=()

for port in "${PORTS[@]}"; do
  result=$(probe_port "$port" 2>/dev/null || echo "")
  [ -n "$result" ] && results+=("$result")
done

if [ ${#results[@]} -eq 0 ]; then
  if $json_mode; then
    echo '{"found":false,"hint":"請先執行 npm run dev 或 npm run dev:3000"}'
  else
    echo "❌ port ${PORTS[*]} 都沒有 dev server"
    echo "💡 啟動方式 (二選一):"
    echo "   npm run dev        # Next.js 自動選可用 port"
    echo "   npm run dev:fixed  # 強制 port 3000 (推薦, 徹底終結 port 漂移)"
    exit 1
  fi
  exit 1
fi

if $json_mode; then
  # JSON 模式
  echo "{"
  echo '  "found": true,'
  echo '  "urls": ['
  first=1
  for r in "${results[@]}"; do
    IFS='|' read -r port pid code <<< "$r"
    [ $first -eq 0 ] && echo ","
    first=0
    printf '    {"port":%s,"pid":%s,"http_code":%s,"url":"http://localhost:%s"}' "$port" "$pid" "$code" "$port"
  done
  echo ""
  echo "  ]"
  echo "}"
elif $first_only; then
  IFS='|' read -r port pid code <<< "${results[0]}"
  echo "http://localhost:${port}"
else
  # 表格模式
  echo "🟢 偵測到 dev server:"
  printf "  %-8s %-8s %-8s %s\n" "PORT" "PID" "HTTP" "URL"
  echo "  -------- -------- -------- -----------"
  for r in "${results[@]}"; do
    IFS='|' read -r port pid code <<< "$r"
    status_emoji="🟢"
    if [ "$code" != "200" ]; then status_emoji="🟡"; fi
    printf "  $status_emoji %-6s %-8s %s     http://localhost:%s\n" "$port" "$pid" "$code" "$port"
  done
  echo ""
  echo "UAT：http://localhost:${results[0]%%|*}"
fi
