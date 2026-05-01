#!/usr/bin/env bash
set -euo pipefail

LABEL="com.tria.mac-gateway"
UID_VALUE="$(id -u)"
LAUNCH_DOMAIN="gui/${UID_VALUE}"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_DIR/${LABEL}.plist"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd -- "$APP_DIR/../.." && pwd)"

STATE_DIR="${TRIA_STATE_DIR:-$HOME/.tria-codex-remote}"
SECRETS_DIR="$STATE_DIR/secrets"
LOG_DIR="$STATE_DIR/logs"
TMP_DIR="$STATE_DIR/tmp"
BIN_DIR="$STATE_DIR/bin"
RUNNER_PATH="$BIN_DIR/run-gateway.sh"

mkdir -p "$LAUNCH_DIR" "$SECRETS_DIR" "$LOG_DIR" "$TMP_DIR" "$BIN_DIR"

KEY_FILE="$SECRETS_DIR/gateway_api_key"
if [[ -n "${TRIA_GATEWAY_API_KEY:-}" ]]; then
  printf '%s' "$TRIA_GATEWAY_API_KEY" > "$KEY_FILE"
elif [[ ! -f "$KEY_FILE" ]]; then
  openssl rand -hex 32 > "$KEY_FILE"
fi
chmod 600 "$KEY_FILE"

PAIRING_CODE_FILE="$SECRETS_DIR/pairing_code"
if [[ -n "${TRIA_PAIRING_CODE:-}" ]]; then
  printf '%s' "$TRIA_PAIRING_CODE" > "$PAIRING_CODE_FILE"
elif [[ ! -f "$PAIRING_CODE_FILE" ]]; then
  CODE_NUM=$((0x$(openssl rand -hex 3) % 900000 + 100000))
  printf '%06d' "$CODE_NUM" > "$PAIRING_CODE_FILE"
fi
chmod 600 "$PAIRING_CODE_FILE"

PAIRING_PASSPHRASE_FILE="$SECRETS_DIR/pairing_passphrase"
if [[ -n "${TRIA_PAIRING_PASSPHRASE:-}" ]]; then
  printf '%s' "$TRIA_PAIRING_PASSPHRASE" > "$PAIRING_PASSPHRASE_FILE"
elif [[ ! -f "$PAIRING_PASSPHRASE_FILE" ]]; then
  PASSPHRASE="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 20)"
  printf '%s' "$PASSPHRASE" > "$PAIRING_PASSPHRASE_FILE"
fi
chmod 600 "$PAIRING_PASSPHRASE_FILE"

cd "$ROOT_DIR"
pnpm --filter mac-gateway build >/dev/null
cp "$APP_DIR/scripts/run-gateway.sh" "$RUNNER_PATH"
chmod 755 "$RUNNER_PATH"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
      <string>${RUNNER_PATH}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${STATE_DIR}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/gateway.out.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/gateway.err.log</string>

    <key>EnvironmentVariables</key>
    <dict>
      <key>NODE_ENV</key>
      <string>production</string>
      <key>PATH</key>
      <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Applications/Codex.app/Contents/Resources</string>
      <key>HOST</key>
      <string>127.0.0.1</string>
      <key>PORT</key>
      <string>8787</string>
      <key>TRIA_GATEWAY_MODE</key>
      <string>live</string>
      <key>TRIA_GATEWAY_API_KEY_FILE</key>
      <string>${KEY_FILE}</string>
      <key>TRIA_PAIRING_CODE_FILE</key>
      <string>${PAIRING_CODE_FILE}</string>
      <key>TRIA_PAIRING_PASSPHRASE_FILE</key>
      <string>${PAIRING_PASSPHRASE_FILE}</string>
      <key>TRIA_GATEWAY_APP_DIR</key>
      <string>${APP_DIR}</string>
      <key>TRIA_LOG_DIR</key>
      <string>${LOG_DIR}</string>
      <key>TRIA_RUNTIME_TMP</key>
      <string>${TMP_DIR}</string>
      <key>TRIA_STATE_DIR</key>
      <string>${STATE_DIR}</string>
      <key>TRIA_NODE_NAME</key>
      <string>${TRIA_NODE_NAME:-Mac Mini M4 Pro}</string>
      <key>TRIA_TUNNEL_MODE</key>
      <string>${TRIA_TUNNEL_MODE:-tailscale}</string>
      <key>TRIA_PROJECT_PATHS</key>
      <string>${TRIA_PROJECT_PATHS:-}</string>
    </dict>
  </dict>
</plist>
PLIST

chmod 644 "$PLIST_PATH"

launchctl bootout "$LAUNCH_DOMAIN" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "$LAUNCH_DOMAIN" "$PLIST_PATH"
launchctl enable "$LAUNCH_DOMAIN/$LABEL"
launchctl kickstart -k "$LAUNCH_DOMAIN/$LABEL"

cat <<DONE
LaunchAgent instalado: $PLIST_PATH
Gateway API key file: $KEY_FILE
Pairing code file: $PAIRING_CODE_FILE
Pairing passphrase file: $PAIRING_PASSPHRASE_FILE
Healthcheck:
  TRIA_GATEWAY_API_KEY="\$(cat $KEY_FILE)" "$APP_DIR/scripts/healthcheck.sh"
DONE
