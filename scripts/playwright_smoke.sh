#!/usr/bin/env bash
set -euo pipefail

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx no está disponible en PATH." >&2
  exit 1
fi

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="${CODEX_HOME}/skills/playwright/scripts/playwright_cli.sh"
APP_URL="${1:-http://localhost:5173/}"
SESSION_NAME="${PLAYWRIGHT_CLI_SESSION:-mdped-smoke}"
ARTIFACT_DIR="output/playwright"
LOG_FILE="${ARTIFACT_DIR}/smoke.log"
SNAPSHOT_COPY="${ARTIFACT_DIR}/latest-snapshot.yml"

if [[ ! -x "${PWCLI}" ]]; then
  echo "Error: no se encontró el wrapper de Playwright en ${PWCLI}." >&2
  exit 1
fi

mkdir -p "${ARTIFACT_DIR}"

echo "Smoke test Playwright contra ${APP_URL}" | tee "${LOG_FILE}"

OUTPUT="$(
  PLAYWRIGHT_CLI_SESSION="${SESSION_NAME}" "${PWCLI}" open "${APP_URL}" 2>&1 | tee -a "${LOG_FILE}"
)"

SNAPSHOT_PATH="$(
  printf '%s\n' "${OUTPUT}" | sed -n 's/.*(\(.*\.yml\)).*/\1/p' | tail -n 1
)"

if [[ -n "${SNAPSHOT_PATH}" && -f "${SNAPSHOT_PATH}" ]]; then
  cp "${SNAPSHOT_PATH}" "${SNAPSHOT_COPY}"
  echo "Snapshot copiado en ${SNAPSHOT_COPY}" | tee -a "${LOG_FILE}"
else
  echo "No se encontró snapshot reutilizable; revisa ${LOG_FILE}." | tee -a "${LOG_FILE}"
fi

echo "Smoke Playwright completado." | tee -a "${LOG_FILE}"
