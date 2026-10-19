# Lazer Design HQ

Internal operations tool for the Lazer design department: staff, allocation, projects, revenue pipeline, proposals, meetings, exec updates, and Adam's personal modules.

Vite + React + TypeScript on Firebase (Auth, Firestore, Storage, Cloud Functions).

## Two deployments, side by side

| | Legacy (production fallback) | Rebuild (this branch) |
| --- | --- | --- |
| Firebase project | `gen-lang-client-0470160406` | a **new** project you create |
| Firestore database | named DB `ai-studio-77429012-…` | `(default)` |
| Web config | `firebase-applet-config.json` | `VITE_FIREBASE_*` in `.env.local` |
| Security rules | open (unchanged, not managed here) | `firestore.rules`, `storage.rules` |

Nothing in this repo writes to or deploys to the legacy project:

- `scripts/guard-deploy.mjs` runs before every Firebase deploy step and aborts if the target is the legacy project.
- `firebase.json` deploys rules to the `(default)` database; legacy data lives in a named database.
- The web app refuses to start unless `VITE_FIREBASE_TARGET` is set, and refuses `rebuild` if it points at the legacy project id.
- `npm run migrate:import` refuses the legacy project id, is a dry run unless `--commit`, and never overwrites an existing document.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the new project's web config
npm run dev
```

## Roles

| Role | Who | Access |
| --- | --- | --- |
| Super Admin | Adam | Everything, including personal modules (`/personal/{uid}`) |
| Admin | Louie | All professional modules. No personal modules, no system settings |
| Regular User | everyone else | Dashboard and their own assignments (needs a linked staff record) |

Enforced in `firestore.rules` and `storage.rules`; `src/lib/roles.ts` mirrors the matrix for navigation. Adam's account is promoted to Super Admin on sign-in. Give Louie Admin by pre-creating the user in Admin → User Management with role Admin before their first sign-in (or changing the role after).

## Data model

`firebase-blueprint.json` documents every collection. Legacy collections (`users`, `staff`, `projects`, `sales`) keep their shape so the original views compute identical numbers. Extended fields go into companion collections keyed by the same id (`staffProfiles`, `projectMeta`) because the existing save handlers in `App.tsx` overwrite whole documents.

Department numbers (revenue, profitability, pipeline, utilisation, pace) come from `src/lib/metrics.ts`. That logic is the Dashboard's original code, moved verbatim; `src/lib/metrics.test.ts` runs the original code side by side and fails on any drift.

## Cloud Functions (`functions/`)

Server-side work: AI drafting (Gemini via `@google/genai`, already a project dependency), docx template parsing and rendering, transcript extraction (PDF/DOCX/TXT), and Google Calendar OAuth. Every callable re-checks the caller's role, because the Admin SDK bypasses security rules.

```bash
cd functions && npm install
cp .env.example .env.<new-project-id>   # GEMINI_MODEL, GOOGLE_OAUTH_CLIENT_ID, redirect URI, APP_URL
npx firebase functions:secrets:set GEMINI_API_KEY --project rebuild
npx firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET --project rebuild
npx firebase functions:secrets:set OAUTH_STATE_SECRET --project rebuild   # any long random string
```

Google Calendar needs an OAuth client (type "Web application") in the new project, with the deployed `googleOAuthCallback` URL as an authorised redirect URI and the Calendar API enabled. Refresh tokens are stored in `integrations/{uid}/googleAccounts/{lazer|polyform|personal}`, which no client can read.

## Migration (one-time)

```bash
# 1. Export everything from legacy (read-only)
GOOGLE_APPLICATION_CREDENTIALS=legacy-sa.json npm run migrate:export
# 2. Dry run into the new project, review the report
GOOGLE_APPLICATION_CREDENTIALS=rebuild-sa.json npm run migrate:import -- --in migration-export/<stamp>/export.json --project <new-project-id>
# 3. Write it
GOOGLE_APPLICATION_CREDENTIALS=rebuild-sa.json npm run migrate:import -- --in migration-export/<stamp>/export.json --project <new-project-id> --commit
```

Exports land in `migration-export/` (git-ignored; they contain staff and client data).

## Tests

```bash
npm test            # metrics parity + migration transform
npm run test:rules  # security rules against the Firestore/Storage emulators (needs Java)
npm run test:functions  # docx parsing/rendering + section classification
npm run lint        # tsc --noEmit
```

## Deploy (rebuild only)

The web app can be hosted on Vercel (current) or Firebase Hosting; Firestore, Storage, Auth and Cloud Functions always live in the new Firebase project.

**Vercel:** `vercel.json` is included. In the Vercel project settings add every `VITE_FIREBASE_*` value from `.env.example` plus `VITE_FIREBASE_TARGET=rebuild` (Production and Preview). Without them the app shows a "Firebase is not configured" screen instead of starting. Add the Vercel domain under Firebase Console → Authentication → Settings → Authorized domains, and use it as `APP_URL` for the functions.

**Firebase (rules, functions, optional hosting):**

```bash
npx firebase login
npx firebase use --add          # pick the NEW project, alias it "rebuild"
npx firebase deploy --project rebuild --only firestore,storage,functions
```
