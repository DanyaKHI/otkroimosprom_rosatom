#!/usr/bin/env bash
# 1) любая ошибка → выход; 2) обращение к не-объявленной переменной → выход;
# 3) код ошибки из пайпов не «теряется»
set -euo pipefail

# Определяем операционную систему
detect_os() {
    case "$(uname -s)" in
        Darwin*)    echo "macos" ;;
        Linux*)     echo "linux" ;;
        CYGWIN*|MINGW*|MSYS*) echo "windows" ;;
        *)          echo "unknown" ;;
    esac
}

OS=$(detect_os)

# Абсолютный путь к каталогу, где лежит сам скрипт
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ───── 1. Подхватываем .env ───────────────────────────────────────────────────
ENV_FILE="${ROOT_DIR}/.env.development.local"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

: "${VITE_BACKEND_URL:?VITE_BACKEND_URL is not set in .env}"
API_DOCS_URL="${VITE_BACKEND_URL}/api/openapi.json"

# ───── 2. Каталоги ────────────────────────────────────────────────────────────
API_BASE_DIR="${ROOT_DIR}/src/shared/api"
GEN_DIR="${API_BASE_DIR}/generated"

echo "[gen-srv] Clean ${GEN_DIR}"
rm -rf "$GEN_DIR"
mkdir -p "$GEN_DIR"

# ───── 3. Генерация клиента ──────────────────────────────────────────────────
echo "[gen-srv] Generate → ${GEN_DIR}"

# Используем npx для кроссплатформенности (работает везде, где есть Node.js)
if command -v pnpm >/dev/null 2>&1; then
    PACKAGE_MANAGER="pnpm exec"
elif command -v yarn >/dev/null 2>&1; then
    PACKAGE_MANAGER="yarn"
elif command -v npm >/dev/null 2>&1; then
    PACKAGE_MANAGER="npx"
else
    echo "Error: No package manager found (pnpm, yarn, or npm required)"
    exit 1
fi

$PACKAGE_MANAGER openapi-generator-cli generate \
  -g typescript-fetch \
  -i "$API_DOCS_URL" \
  -o "$GEN_DIR" \
  --additional-properties=supportsES6=true,modelFileSuffix=.ts,fileNaming=PascalCase,modelPropertyNaming=original,enumPropertyNaming=UPPERCASE,stringEnums=true

# ───── 4. Добавляем // @ts-nocheck ────────────────────────────────────────────
echo "[gen-srv] Prepend // @ts-nocheck"

# Кроссплатформенное добавление @ts-nocheck
add_ts_nocheck() {
    local file="$1"
    local temp_file="${file}.tmp"
    
    # Создаем временный файл с @ts-nocheck в начале
    echo "// @ts-nocheck" > "$temp_file"
    cat "$file" >> "$temp_file"
    
    # Заменяем оригинальный файл
    mv "$temp_file" "$file"
}

# Находим все .ts файлы и добавляем @ts-nocheck
find "$GEN_DIR" -type f -name "*.ts" | while IFS= read -r file; do
    add_ts_nocheck "$file"
done

echo "[gen-srv] Done ✔"
