#!/usr/bin/env bash
# Deploys DesignHQ's backend (security rules + Cloud Functions) to the NEW
# Firebase project. Made for Google Cloud Shell, where you're already signed in:
#
#   git clone -b claude/designhq-extension-setup-1qw87t https://github.com/adamwilsondesign/designHQ2.git
#   cd designHQ2 && bash scripts/deploy-backend.sh <NEW_PROJECT_ID>
#
# Safe to re-run (e.g. later, to add the Google Calendar settings).
set -euo pipefail

LEGACY_PROJECT_ID="gen-lang-client-0470160406"
PROJECT_ID="${1:-}"
if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: bash scripts/deploy-backend.sh <NEW_PROJECT_ID>"
  exit 1
fi
if [[ "$PROJECT_ID" == "$LEGACY_PROJECT_ID" ]]; then
  echo "Refusing: $PROJECT_ID is the OLD DesignHQ project. Use the new project's ID."
  exit 1
fi

cd "$(dirname "$0")/.."
ENV_FILE="functions/.env.${PROJECT_ID}"
REGION="us-central1"
NOT_SET="not-configured"
fb() { npx --yes firebase-tools@14 "$@"; }

echo "== 1/5 Installing dependencies (a few minutes the first time)"
npm ci --no-audit --no-fund --loglevel=error
npm --prefix functions ci --no-audit --no-fund --loglevel=error

echo "== 2/5 Checking Firebase sign-in"
if ! fb projects:list >/dev/null 2>&1; then
  echo "Sign in to Firebase: open the link it prints, approve, and paste the code back here."
  fb login --no-localhost
fi
gcloud config set project "$PROJECT_ID" >/dev/null 2>&1 || true

echo "== 3/5 Enabling Google APIs"
gcloud services enable \
  cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  run.googleapis.com eventarc.googleapis.com secretmanager.googleapis.com \
  calendar-json.googleapis.com generativelanguage.googleapis.com \
  --project "$PROJECT_ID"

echo "== 4/5 Settings and secrets"
existing() { grep -s "^$1=" "$ENV_FILE" | cut -d= -f2- || true; }
secret_exists() { gcloud secrets describe "$1" --project "$PROJECT_ID" >/dev/null 2>&1; }
set_secret() {
  local tmp; tmp="$(mktemp)"; printf '%s' "$2" > "$tmp"
  fb functions:secrets:set "$1" --project "$PROJECT_ID" --data-file "$tmp" --force >/dev/null
  rm -f "$tmp"
}

APP_URL_DEFAULT="$(existing APP_URL)"; APP_URL_DEFAULT="${APP_URL_DEFAULT:-https://design-hq-2.vercel.app}"
read -r -p "Web app address [$APP_URL_DEFAULT]: " APP_URL; APP_URL="${APP_URL:-$APP_URL_DEFAULT}"

if secret_exists GEMINI_API_KEY; then
  read -r -s -p "Gemini API key (press Enter to keep the saved one): " GEMINI; echo
else
  until [[ -n "${GEMINI:-}" ]]; do read -r -s -p "Gemini API key (from aistudio.google.com/apikey): " GEMINI; echo; done
fi
[[ -n "${GEMINI:-}" ]] && set_secret GEMINI_API_KEY "$GEMINI"

CLIENT_ID_DEFAULT="$(existing GOOGLE_OAUTH_CLIENT_ID)"
echo "Google Calendar sign-in (optional now; press Enter to skip and add it later by re-running this script)."
read -r -p "OAuth client ID [${CLIENT_ID_DEFAULT:-skip}]: " CLIENT_ID; CLIENT_ID="${CLIENT_ID:-${CLIENT_ID_DEFAULT:-$NOT_SET}}"
if [[ "$CLIENT_ID" != "$NOT_SET" ]]; then
  read -r -s -p "OAuth client secret (Enter to keep the saved one): " CLIENT_SECRET; echo
  [[ -n "$CLIENT_SECRET" ]] && set_secret GOOGLE_OAUTH_CLIENT_SECRET "$CLIENT_SECRET"
fi
secret_exists GOOGLE_OAUTH_CLIENT_SECRET || set_secret GOOGLE_OAUTH_CLIENT_SECRET "$NOT_SET"
secret_exists OAUTH_STATE_SECRET || set_secret OAUTH_STATE_SECRET "$(openssl rand -hex 32)"

REDIRECT_URI="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/googleOAuthCallback"
cat > "$ENV_FILE" <<EOF
GEMINI_MODEL=$(existing GEMINI_MODEL | grep . || echo gemini-2.5-pro)
GOOGLE_OAUTH_CLIENT_ID=$CLIENT_ID
GOOGLE_OAUTH_REDIRECT_URI=$REDIRECT_URI
APP_URL=$APP_URL
EOF

echo "== 5/5 Deploying rules and functions to $PROJECT_ID (5-10 minutes)"
fb deploy --project "$PROJECT_ID" --only firestore,storage,functions --non-interactive --force

echo
echo "Done. Backend deployed to $PROJECT_ID."
if [[ "$CLIENT_ID" == "$NOT_SET" ]]; then
  echo "Google Calendar is not set up yet. When you create the OAuth client, use this redirect URI:"
  echo "  $REDIRECT_URI"
  echo "then run this script again and enter the client ID and secret."
fi
