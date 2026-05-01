#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${TRIA_GATEWAY_APP_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
STATE_DIR="${TRIA_STATE_DIR:-$HOME/.tria-codex-remote}"
KEY_FILE="${TRIA_GATEWAY_API_KEY_FILE:-$STATE_DIR/secrets/gateway_api_key}"
PAIRING_CODE_FILE="${TRIA_PAIRING_CODE_FILE:-$STATE_DIR/secrets/pairing_code}"
PAIRING_PASSPHRASE_FILE="${TRIA_PAIRING_PASSPHRASE_FILE:-$STATE_DIR/secrets/pairing_passphrase}"

mkdir -p "${TRIA_LOG_DIR:-$HOME/.tria-codex-remote/logs}"
mkdir -p "${TRIA_RUNTIME_TMP:-$HOME/.tria-codex-remote/tmp}"

if [[ -z "${TRIA_GATEWAY_API_KEY:-}" && -f "$KEY_FILE" ]]; then
  export TRIA_GATEWAY_API_KEY="$(cat "$KEY_FILE")"
fi

if [[ -z "${TRIA_PAIRING_CODE:-}" && -f "$PAIRING_CODE_FILE" ]]; then
  export TRIA_PAIRING_CODE="$(cat "$PAIRING_CODE_FILE")"
fi

if [[ -z "${TRIA_PAIRING_PASSPHRASE:-}" && -f "$PAIRING_PASSPHRASE_FILE" ]]; then
  export TRIA_PAIRING_PASSPHRASE="$(cat "$PAIRING_PASSPHRASE_FILE")"
fi

if [[ "${TRIA_GATEWAY_MODE:-live}" == "live" && -z "${TRIA_GATEWAY_API_KEY:-}" ]]; then
  echo "TRIA_GATEWAY_API_KEY ausente (defina a env ou TRIA_GATEWAY_API_KEY_FILE)." >&2
  exit 1
fi

# Allow Codex to complete non-trivial runs before declaring timeout.
export TRIA_CODEX_EXEC_TIMEOUT_MS="${TRIA_CODEX_EXEC_TIMEOUT_MS:-600000}"

cd "$APP_DIR"
exec node dist/server.js
