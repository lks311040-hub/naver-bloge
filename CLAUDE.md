# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local-only, semi-automated tool for writing and posting Naver Blog content for a single business (a piano academy). AI drafts the post body, a human reviews it, Playwright types it into Naver's real Smart Editor — but **login and the final publish click are always done by a human**, never by code. This is the project's core design constraint, not a preference; see "Hard invariants" below.

Korean-language product; most identifiers, comments, and commit messages in this repo are Korean.

## Commands

```bash
npm install                    # from repo root; see README.md for allowScripts notes
npm run dev                    # starts shared (tsc -b watch) + server (:4000) + web (:5173) via scripts/dev.mjs
npm run build                  # shared -> server -> web, in that order (shared must build first)
npm run migrate                # apply pending SQL migrations only
npm run verify                 # typecheck all 3 workspaces + depcheck — run before considering work done
npm run depcheck                # dependency-cruiser structural rules only (see below)
npm run typecheck -w <shared|server|web>   # single workspace

# server workspace
cd server
node scripts/inspect-editor.mjs [blogId]      # live-DOM diagnostic against the real logged-in Naver session (see below)
npx tsx scripts/test-generate-draft.ts [runs] [--info]   # AI generation acceptance check, no DB/Express; --info = 정보성 path
npx tsx scripts/test-propose-topic.ts                     # AI auto-topic-selection check (used when a schedule's keyword queue is empty)
npx tsx scripts/dump-informational.ts ["주제 키워드"]      # full-body quality dump for a 정보성 draft
```

There is no automated test suite (no `npm test`). Verification is `npm run verify` (types + structural rules) plus the `test:ai`-style scripts above, plus live browser checks — see "Live verification is mandatory" below.

`npm run dev`'s `predev` hook builds `shared` first; if you edit `shared/src` while `dev` is already running, its own `tsc -b --watch` process picks up the change and server/web recompile against the new `dist` automatically — no restart needed unless you edited `server/src` (which restarts under `tsx watch`) or `web/vite.config.ts`.

## Hard invariants (do not weaken these, ever)

1. **No code anywhere clicks Naver's actual 발행 (publish) button.** Automation fills the editor and stops; a human always clicks publish in the still-open browser window. `server/src/modules/automation/selectors.ts` keeps a `publishButton` selector but a comment there explicitly marks it "never used to click" — grep for that fact if you need to double check nothing regressed.
2. **No code enters Naver login credentials.** `naverLogin.ts` opens a real headful Edge window and waits (polling for the blogId-bearing redirect) for a human to log in manually; it never touches the login form fields.
3. **`server/src/modules/scheduler` can never import `server/src/modules/automation`.** This isn't a convention — `.dependency-cruiser.cjs` enforces it structurally, and `npm run depcheck` (part of `npm run verify`) fails the build if anyone adds that import. This is what makes "scheduled generation" structurally incapable of triggering a publish, regardless of what the code inside scheduler does.
4. **Never set `ANTHROPIC_API_KEY` in the server process env.** `server/src/modules/ai/client.ts` throws on startup if it's present — this app is designed to reuse the operator's already-logged-in Claude Code subscription (via `@anthropic-ai/claude-agent-sdk`'s `query()`), not a billed API key.

## Architecture

### Workspaces

npm workspaces: `shared` (zod schemas, no runtime deps besides zod), `server` (Express + better-sqlite3 + Playwright), `web` (React + Vite). `shared` and `server` use `NodeNext` module resolution (import specifiers need explicit `.js` extensions even though the source is `.ts`); `web` uses `Bundler` resolution (no extension needed) — see `tsconfig.base.json` vs `web/tsconfig.json`. Don't copy import styles across that boundary.

### The Block model is the spine of the whole app

`shared/src/blocks.ts` defines a single discriminated-union `Block` type (paragraph, heading, divider, image/video/emoticon placeholder, link_block, hashtags) that is the *only* representation of a post's body, consumed identically by: the AI output schema, the DB column (`posts.content_blocks`, JSON), the React review UI (one renderer per block type), and the Playwright autofill engine (one handler per block type in `editorAutofill.ts`'s `fillBlock()`). `AiBodyBlock` is the strict subset the model is allowed to produce (no `link_block`/`hashtags` — those are always code-assembled, never AI-authored).

### Post generation pipeline

1. `server/src/modules/ai/client.ts` — thin wrapper around the Claude Agent SDK's `query()`. Takes a prompt + JSON schema, returns structured output (or falls back to parsing `resultText` if the SDK doesn't hand back `structured_output`).
2. `server/src/modules/ai/generateDraft.ts` dispatches on `postType` to `prompt.ts` (홍보성/promotional) or `promptInformational.ts` (정보성/informational) — genuinely different rulesets (promotional: user supplies title verbatim, target-keyword-4x-mentions gate; informational: AI invents its own title from a topic keyword, exactly-3-headings, no keyword-count gate). Both allow `WebSearch` for factual grounding and take an `avoidOverlapWith` list (recent same-type posts) to steer away from repeating angles.
3. Retries: up to 2 JSON-repair attempts if parsing/schema-validation fails, then up to 3 self-correction attempts if `qaCheck.ts`'s char-count/heading-count/keyword-count checks fail. If still out of spec after that, the draft is kept anyway with `qaWarning` set (surfaced in the review UI) rather than looping forever.
4. `server/src/modules/posts/assemble.ts` — a **pure function**, no Playwright/AI imports — wraps the AI-authored body blocks with the fixed template (greeting → talktalk → *body* → prewritten content → reservation link → related-post link → hashtags for promotional; greeting → *body* → prewritten content → hashtags only for informational, deliberately no talktalk/reservation/related-post since those read as sales pressure on discovery-feed content). Any template piece whose source field is empty in the business profile is just omitted, never inserted blank.
5. Result stored as `PostRecord.blocks` via `posts/repo.ts`; `PostStatus` moves `queued → generating → review_pending → ready → filling → filled_awaiting_publish → published`, or `failed` from `generating`/`filling`.

### Automation module (`server/src/modules/automation`)

Playwright launches real Edge (`channel: 'msedge'`, never the bundled Chromium — deliberate, see README for the SxS-crash history) with a `storageState`-persisted session. All browser operations funnel through one `p-queue` (concurrency 1) so nothing races against a login or autofill run in progress. `selectors.ts` is the single place every Naver DOM selector lives — Naver changes its editor's markup periodically with zero notice, so **when autofill starts failing, the fix is almost always "re-run `scripts/inspect-editor.mjs` against a real logged-in session and update selectors.ts"**, not a logic bug. That script is intentionally treated as disposable/overwritable scratch code across the project's history (see git log) — feel free to rewrite it for whatever you're currently diagnosing rather than trying to keep it generic.

`editorAutofill.ts` only ever fills what's in `post.blocks`; it never re-fetches the business profile or re-assembles anything, so a business-profile edit doesn't retroactively affect an already-generated draft — regenerate (`POST /api/posts/:id/regenerate`) or manually edit the block in review if it needs to change.

### Scheduler module (`server/src/modules/scheduler`)

cron-based (`node-cron`), day-of-week + time UI in the frontend builds the cron expression. A schedule's `postTypes` is an array — when it holds both `promotional` and `informational`, `repo.ts`'s `pickNextPostType()` alternates between them deterministically (round-robin off `last_fired_post_type`), not randomly, so a fixed cadence produces an exact split over time. `topicSource` is `fixed` (same title/keyword every firing — only valid with exactly one postType) or `queue` (consumes the next unused same-postType entry from `keyword-ideas`, falling back to `ai/proposeTopic.ts` — a separate small Claude call — when that queue is empty). Firing polls the created post until it leaves `generating`/`queued` so it can send a Kakao notification (`modules/kakao`, fully optional/best-effort — a notification failure never affects the generation result) with the outcome.

### Database

better-sqlite3, WAL mode, no ORM. `server/src/db/migrations/*.sql` are numbered, applied once each (tracked in a `schema_migrations` table) by the runner in `db/migrate.ts`, both at server boot and via `npm run migrate`. Migrations in this repo are **additive-only by convention** — new columns get `DEFAULT`s and old columns are left in place rather than dropped, even when superseded (e.g. `schedules.post_type` was replaced by `schedules.post_types` in migration 0005 but the old column still exists unused). Follow that pattern rather than writing a destructive migration.

## Known sharp edges (worth knowing before you hit them again)

- **zod v4 + `@hookform/resolvers`'s `zodResolver`**: was silently failing to surface `.superRefine()`-based custom validation errors into `react-hook-form`'s `formState.errors` (the submit was correctly blocked, but with zero visible feedback — looked exactly like a dead button). Every form in `web/src` now validates by hand in the submit handler (`Schema.safeParse()` → `setError()` per issue) instead of passing a resolver to `useForm()`. Don't reintroduce `zodResolver` without re-verifying this against the current zod/resolver versions live in a browser, not just via typecheck.
- **zod v4 `.partial()` cannot be called on a schema wrapped in `.superRefine()`.** Where a PATCH-style partial update is needed (see `shared/src/schedule.ts`), keep the plain object schema exported separately (`ScheduleRequestObjectSchema`) from the `.superRefine()`-wrapped one, and build the partial off the former.
- **Custom checkbox/radio controls**: don't wire them as `<input checked={..} onChange={..}>` relying on the browser's native toggle-on-click — a real click on the label text can register as a text-selection drag instead of a click and silently no-op. Put the handler on the wrapping `<label>`'s `onClick` with `e.preventDefault()`, and make the `<input>` `readOnly` (see `web/src/pages/Schedule.tsx`'s weekday/postType checkboxes for the pattern).
- **Naver's "장소" (Place/map) widget vs. just typing a URL**: inserting the Place widget for a reservation link only shows a generic address/map card, unrelated to the actual booking URL. Typing the real `booking.naver.com` URL as plain text lets Naver auto-expand it into a rich preview of the actual booking page — that's what `editorAutofill.ts` does now; there's no Place-widget code left in this repo (removed after live-testing showed it made the actual reservation link disappear from the post entirely).
- **Free/paid image auto-insertion was tried and deliberately reverted.** An earlier version searched Naver's built-in free-image panel and auto-inserted results; it was removed after live use kept hitting failure modes (clicking a mis-filtered paid result opens a full-viewport purchase modal that blocks all further clicks; the search panel itself leaves a transparent overlay that blocks the property toolbar until explicitly closed). `image_placeholder`/`video_placeholder` blocks with no uploaded `filePath` are just skipped with a warning log — that's the intended, final behavior, not a stub to finish.

## Live verification is mandatory for anything touching Naver's UI

There's no way to know Naver's actual editor DOM, click targets, or preview-card behavior from documentation — it isn't documented. Every automation feature in this repo's history was built by: writing/overwriting `server/scripts/inspect-editor.mjs` to poke at a real logged-in session, reading the actual DOM/screenshots it dumps to `tmp-inspect/` (gitignored), implementing against what was actually observed, then re-running live to confirm. Treat a change to `automation/` or `selectors.ts` as unverified until it's been run against a real session — `npm run verify` passing only proves the types line up, not that Naver's UI behaves as assumed.
