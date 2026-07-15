#!/bin/sh
set -e

echo "=== STARTUP SCRIPT ==="
echo "PORT=${PORT:-NOT_SET}"
echo "NODE_ENV=${NODE_ENV:-NOT_SET}"
echo "DATABASE_URL_SET=$([ -n \"$DATABASE_URL\" ] && echo YES || echo NO)"
echo "PWD=$(pwd)"
echo "NODE=$(node --version)"
echo "NPM=$(npm --version)"

echo ""
echo "=== Running migrations ==="
npm run db:migrate

echo ""
echo "=== Starting Next.js on 0.0.0.0:${PORT:-3000} ==="
exec node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"