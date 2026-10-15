#!/usr/bin/env bash
#
#  ┌────────────────────────────────────────────────────────────┐
#  │   Карта студенческих коворкингов — запуск в один клик      │
#  └────────────────────────────────────────────────────────────┘
#
#  Что делает:
#    1. Проверяет Node.js
#    2. Устанавливает зависимости (если нужно)
#    3. Создаёт/обновляет базу данных
#    4. Собирает фронтенд
#    5. Запускает сервер и открывает браузер
#
#  Использование:
#    ./start.sh                 — обычный запуск (пароль админа: admin)
#    ./start.sh --reset         — пересоздать базу из data.js
#    PORT=8080 ./start.sh       — другой порт
#    ADMIN_PASSWORD=секрет ./start.sh — свой пароль админки

set -euo pipefail

cd "$(dirname "$0")"

# ── цвета ──
if [ -t 1 ]; then
  G="\033[38;5;114m"; D="\033[2m"; B="\033[1m"; Y="\033[38;5;179m"; R="\033[38;5;203m"; N="\033[0m"
else
  G=""; D=""; B=""; Y=""; R=""; N=""
fi

step() { printf "${G}▸${N} %s\n" "$1"; }
warn() { printf "${Y}!${N} %s\n" "$1"; }
fail() { printf "${R}✗${N} %s\n" "$1"; exit 1; }

PORT="${PORT:-3000}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
RESET=0
for arg in "$@"; do
  [ "$arg" = "--reset" ] && RESET=1
done

clear 2>/dev/null || true
printf "\n"
printf "${B}  Карта студенческих коворкингов${N}\n"
printf "${D}  прототип · Минск · 2026${N}\n\n"

# ── 1. Node ──
step "Проверяю Node.js"
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js не найден. Установите с https://nodejs.org (нужна версия 22+)"
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  fail "Нужен Node.js 22 или новее. Сейчас: $(node -v)"
fi
printf "  ${D}Node.js %s${N}\n" "$(node -v)"

# ── 2. зависимости ──
step "Проверяю зависимости"
if [ ! -d node_modules ] || [ ! -f node_modules/.package-lock.json ]; then
  printf "  ${D}Устанавливаю пакеты (это займёт ~30 секунд)…${N}\n"
  npm install --silent --no-audit --no-fund
else
  printf "  ${D}Уже установлены${N}\n"
fi

# ── 3. база ──
if [ "$RESET" -eq 1 ] || [ ! -f data/kovorking.db ]; then
  step "Создаю базу данных"
  node seed.js
else
  step "База данных на месте"
  printf "  ${D}Чтобы пересоздать: ./start.sh --reset${N}\n"
fi

# ── 4. сборка ──
step "Собираю интерфейс"
npx vite build --logLevel warn

# ── 5. сервер ──
printf "\n"
printf "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}\n"
printf "  ${B}Сервер запускается…${N}\n\n"
printf "  Карта:   ${G}http://localhost:%s${N}\n" "$PORT"
printf "  Админка: ${G}http://localhost:%s/#/admin${N}\n" "$PORT"
printf "  Пароль:  ${Y}%s${N}\n" "$ADMIN_PASSWORD"
printf "\n  ${D}Остановить: Ctrl+C${N}\n"
printf "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}\n\n"

# открыть браузер через секунду после старта (не блокируя)
( sleep 1.2; command -v open >/dev/null 2>&1 && open "http://localhost:$PORT" || \
  (command -v xdg-open >/dev/null 2>&1 && xdg-open "http://localhost:$PORT") ) >/dev/null 2>&1 &

PORT="$PORT" ADMIN_PASSWORD="$ADMIN_PASSWORD" exec node server.js
