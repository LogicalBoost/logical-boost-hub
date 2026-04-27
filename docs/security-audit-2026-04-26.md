# Security & Permissions Audit — 2026-04-26

Read-only audit of the Hub's auth, roles, RLS, and edge-function surface. **No code was changed.** All findings reference live source paths and the deployed Supabase project (`nkeswemyzzkpsciwhlqc`).

> **TL;DR.** The platform is **not safe to expose to client logins right now.** The most severe issues:
>
> 1. Public sign-up auto-grants `team_editor` (and the very first signup gets `admin`).
> 2. RLS policy `users_self_update` lets any logged-in user `UPDATE users SET role='admin' WHERE id = auth.uid()` — instant privilege escalation.
> 3. Six tables (`brand_kits`, `media_assets`, `page_templates`, `prompt_templates`, `client_content`, `published_pages`) have `USING (true)` policies that grant full CRUD to anyone with the public anon key — including unauthenticated visitors.
> 4. Storage bucket `client-assets` allows any authenticated user to upload, update, or delete any file in any client's path.
> 5. ~25 of 26 edge functions use the service role key without verifying the caller's identity or scope. A logged-in client user can call them with another client's IDs.
>
> All four findings are independently exploitable with nothing more than a sign-up form and the public anon key.

---

## 1. Auth flow

**Provider:** Supabase Auth (email + password). No OAuth, no magic links. Password reset via Supabase email.

**Routing:**
- `src/middleware.ts` only redirects `/` → `/login`. It **does not gate any other route by auth state**. ([src/middleware.ts:24-26](src/middleware.ts:24))
- Auth gating is purely client-side via `AuthProvider` ([src/components/AuthProvider.tsx](src/components/AuthProvider.tsx)). It loads the user's profile, then runs a `useEffect` to redirect unauth'd users to `/login/` and to redirect role-mismatched users between `/` (hub) and `/client/*`. The redirect fires *after* the page has already rendered.
- Public routes per middleware: `/login`, `/p/` (landing pages), plus `/_next /api /images /favicon` static prefixes ([src/middleware.ts:5-7](src/middleware.ts:5)).

**Sign-up path:**
- Public sign-up form on the same `/login/` page ([src/app/(hub)/login/page.tsx:510-517](src/app/(hub)/login/page.tsx)). No invite required.
- After Supabase auth creates the user, `AuthProvider.loadProfile()` checks `users` row. If missing, it auto-INSERTs one with role assignment:
  - `userCount === 0` → `admin`
  - else → `team_editor`
  - ([src/components/AuthProvider.tsx:60-78](src/components/AuthProvider.tsx))
- There is also an `invite-user` edge function that creates users with explicit role + client_id ([supabase/functions/invite-user/index.ts](supabase/functions/invite-user/index.ts)) — properly verified, only callable by an admin caller. **But the public sign-up form bypasses this entirely.**

**Net effect:** anyone on the open internet can:
1. Visit https://hub.logicalboost.com/login/, click "Sign up".
2. Verify email (or call `confirm-user` edge function which auto-confirms).
3. Land in the app as `team_editor` with permission to insert `clients` rows, view many tables (see §4), and call most edge functions.

---

## 2. Roles defined

**Source of truth:** the `role` column on the `public.users` table. The column type is `TEXT` with a CHECK constraint:

```
role TEXT NOT NULL CHECK (role IN ('admin', 'team_editor', 'team_viewer', 'client'))
```
([supabase/migrations/001_initial_schema.sql:35](supabase/migrations/001_initial_schema.sql))

**TypeScript mirror:** `UserRole = 'admin' | 'team_editor' | 'team_viewer' | 'client'` ([src/types/database.ts:1](src/types/database.ts)).

Everywhere in app code, `useAppStore().userRole` and `useAuth().profile.role` read this value.

There is **no separate `agencies`, `agency_members`, or `team_members` table**. The agency vs client boundary is whatever `client_assignments` (many-to-many users↔clients) represents. ([supabase/migrations/001_initial_schema.sql:47-53](supabase/migrations/001_initial_schema.sql))

---

## 3. Per-page access control

**Layout-level gates: none.** Both `(hub)/layout.tsx` and `(client)/layout.tsx` wrap children in `AuthProvider`, which runs a client-side `useEffect` redirect ([src/components/AuthProvider.tsx:117-150](src/components/AuthProvider.tsx)). There is **no server component or middleware-level role check** on any route.

**The redirect logic:**
- `role === 'client'` and not on a `/client/*` path → push to `/client/dashboard/`
- `role !== 'client'` and on a `/client/*` path → push to `/dashboard/`

This redirect happens in `useEffect`, **after** the React tree mounts. If a client-role user types `/copy/` directly, the page renders briefly with their `useAppStore()` data before the redirect fires. Whether they see another client's data during that window depends entirely on RLS — which is broken (§4).

**Pages and their role gates:**

| Route | `clientVisible` (sidebar) | Page-level role check | What happens if a `client`-role user types the URL |
|---|---|---|---|
| `(hub)/dashboard` | true | Branches on `isClientRole` — but this is the agency dashboard wrapped by AuthProvider; client-role gets redirected to `/client/dashboard/` first | Redirect (briefly renders agency dashboard during the gap). [page.tsx:140](src/app/(hub)/dashboard/page.tsx) checks `isClientRole` to alter content but doesn't gate. |
| `(hub)/stats` | false | None | Page renders briefly. AuthProvider then redirects. Mock data, but real data later. |
| `(hub)/copy` | false | None | Same. Their copy_components data exposes via the brief render + RLS. |
| `(hub)/ads`, `(hub)/ads/bulk`, `(hub)/ads/new`, `(hub)/ads/[adId]` | false | None | Same. |
| `(hub)/avatars` | false | None | Same. |
| `(hub)/offers` | false | None | Same. |
| `(hub)/landing-pages` | true | None | Same; only "Landing Pages" is intentionally client-visible per the sidebar. |
| `(hub)/competitor-intel`, `competitive-intel`, `competitor-ads` | false | None | Same. |
| `(hub)/funnel` | not in sidebar | None | Renders + redirects. |
| `(hub)/intake` | not in sidebar | Branches on `isClientRole` for view mode | Renders + redirects. |
| `(hub)/settings` | true | Branches on `isClientRole` for content (subset of admin features) | Same. |
| `(client)/client/*` | n/a | None at the page level — agency users redirected away by AuthProvider | An agency user types `/client/dashboard/` → redirected. |

**Conclusion on `clientVisible: false` ([src/components/Sidebar.tsx:11-20](src/components/Sidebar.tsx)):** purely cosmetic. The flag only controls which links render in the sidebar. **It is not enforced server-side and not enforced at the page-render level — only via a useEffect redirect after mount.** A client-role user typing `/copy/` in the URL would see the page DOM briefly before the redirect fires; whether they see *data* depends on RLS.

---

## 4. Row-level security

### 4.1. Helpers

`get_user_role()` and `has_client_access(uuid)` ([supabase/migrations/002_rls_policies.sql:17-57](supabase/migrations/002_rls_policies.sql)) — both `SECURITY DEFINER STABLE`. Logic is correct: admins bypass, team_editor/viewer require a `client_assignments` row, client role checks `users.client_id`. Helpers themselves are sound.

### 4.2. Policy classes (live, verified against prod via `pg_policy`)

**Class A — properly scoped, role-based.** Tables: `users` (with bootstrap), `clients`, `client_assignments`, `avatars`, `offers`, `copy_components`, `funnel_instances`, `creatives`, `landing_pages`, `intake_questions`, `competitor_intel`, `client_templates`, `qa_reviews`, `forms`, `form_webhooks`, `form_submissions`, `client_phone_numbers`, `ad_components`/`banner_headlines` (now `copy_components`-gated), `ads`, `banner_assets`, `segments`, `segment_assets`, `proof_items`.

**Class B — `auth.uid() IS NULL` "anon" overlay still in place.** Tables: `clients`, `avatars`, `offers`, `intake_questions`, `funnel_instances`, `copy_components`, `competitor_intel`, `creatives`, `landing_pages`, `users`, `client_assignments` (from [005_anon_access_policies.sql](supabase/migrations/005_anon_access_policies.sql), still active in prod). Plus `segments`, `segment_assets` from the untracked 028/029 migrations. **Mostly low-risk** — they only fire for unauth'd requests, and an unauth'd request shouldn't have a JWT. The policy header even says "TEMPORARY... REMOVE these policies once auth is wired up." Auth is wired up; these were never removed. Anyone with the `NEXT_PUBLIC_SUPABASE_ANON_KEY` (which is shipped in the page HTML) can hit `https://nkeswemyzzkpsciwhlqc.supabase.co/rest/v1/clients` with no Authorization header and see/edit/delete every row.

**Class C — `USING (true)` fully open to everyone, including authenticated client users and anon.** Tables (verified live):
- `brand_kits` — full CRUD ([016_landing_page_template_system.sql:31-34](supabase/migrations/016_landing_page_template_system.sql))
- `media_assets` — full CRUD ([016_landing_page_template_system.sql:65-68](supabase/migrations/016_landing_page_template_system.sql))
- `page_templates` — read + insert ([016_landing_page_template_system.sql:106-107](supabase/migrations/016_landing_page_template_system.sql))
- `published_pages` — full CRUD ([016_landing_page_template_system.sql:169-172](supabase/migrations/016_landing_page_template_system.sql))
- `client_content` — full CRUD ([020_client_content.sql:40-52](supabase/migrations/020_client_content.sql))
- `prompt_templates` — full CRUD ([022_prompt_templates.sql:25-28](supabase/migrations/022_prompt_templates.sql))

Any logged-in client (or any unauth'd visitor with the anon key) can read every other client's brand colors, logos, uploaded media URLs, published-page configs, prompt templates, and client_content. Same audience can write or delete those rows.

### 4.3. Privilege escalation in `users` table

Policy `users_self_update` ([008_fix_users_rls_bootstrap.sql:31-34](supabase/migrations/008_fix_users_rls_bootstrap.sql)):

```sql
CREATE POLICY users_self_update ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

The `WITH CHECK` clause only validates that `id` still equals the caller's auth uid — it does **not** restrict which columns may change. The `authenticated` Postgres role has `UPDATE` privilege on the table (verified via `information_schema.role_table_grants`). **A logged-in user can issue:**

```http
PATCH /rest/v1/users?id=eq.{their_uid}
Content-Type: application/json
{ "role": "admin" }
```

…and the row will be updated. Once promoted, `has_client_access()` returns true for every client (admin bypass at line 33-35 of 002), giving the user read/write on every table covered by Class A policies.

This is **independently exploitable from any account that can sign up** — no other infrastructure needed.

### 4.4. Storage bucket `client-assets`

Policies ([006_storage_bucket.sql:18-36](supabase/migrations/006_storage_bucket.sql), verified live):
- `storage_client_assets_public_read` — anyone can read any file (acceptable; logos and hero images are publicly linked)
- `storage_client_assets_auth_upload` — `bucket_id = 'client-assets'`, no path restriction
- `storage_client_assets_auth_update` — same, no path restriction
- `storage_client_assets_auth_delete` — same, no path restriction

A logged-in user from client A can:
- DELETE any file in client B's `banners/{B}/` or `{B}/logo-*.png` path
- UPLOAD/OVERWRITE files at any path, including replacing client B's logo with arbitrary content (potential XSS vector if HTML is uploaded; the bucket allows `text/html` per [012_storage_html_support.sql](supabase/migrations/012_storage_html_support.sql))

### 4.5. form_submissions

Mostly correct: Admin/team_editor/team_viewer policies are scoped via `has_client_access`. **But:** `Anon insert submissions` is `WITH CHECK (true)` ([025_form_system.sql:92](supabase/migrations/025_form_system.sql)). Anyone can submit a row with any `client_id` — data-integrity / spam risk, not direct exposure (no anon SELECT).

---

## 5. Edge functions

**Configured to skip JWT verification.** Per CLAUDE.md the deploy command is `--no-verify-jwt`. Confirmed by deploy logs in this session. So the platform handles auth "at the application level" — except most functions do nothing of the sort.

**26 functions inspected** (`supabase/functions/*/index.ts`). 25 use `SUPABASE_SERVICE_ROLE_KEY` to create a Supabase client that bypasses RLS. **Only 1 (`invite-user`) verifies the caller's role before mutating data.**

Concrete findings:

| Function | Service role | Caller verified? | Risk if a logged-in client (or anon) calls it with arbitrary IDs |
|---|---|---|---|
| `invite-user` | yes | ✅ asserts `callerProfile.role === 'admin'` ([invite-user/index.ts:38-52](supabase/functions/invite-user/index.ts)) | Safe |
| `admin-fix-client-assignment` | yes | ❌ none | Anyone can reassign any user's `client_id` and create `client_assignments` rows. ([admin-fix-client-assignment/index.ts:13-46](supabase/functions/admin-fix-client-assignment/index.ts)) |
| `confirm-user` | yes | ❌ none | Anyone can auto-confirm any unconfirmed Supabase auth user by knowing their email + password. (Not catastrophic — they'd already have the password — but allows skipping email confirmation.) |
| `generate-funnel` | yes | ❌ none — takes `avatar_id`, `offer_id`; looks up the client transitively via `avatar.client_id` and writes 100+ rows ([generate-funnel/index.ts:126-130, 256-278](supabase/functions/generate-funnel/index.ts)) | Logged-in client (or anon) can pass any other client's `avatar_id`/`offer_id` and burn that client's Anthropic budget generating copy under their account. |
| `generate-banner-headlines`, `generate-more`, `generate-avatars`, `generate-intake`, `refine-system`, `analyze-business`, `analyze-brand-kit`, `analyze-competitor-pages`, `discover-competitors`, `recommend-angles`, `suggest-offers`, `qa-copywriter-review`, `qa-compliance-review`, `generate-playbook`, `generate-landing-page`, `generate-landing-page-copy`, `edit-landing-page-section`, `generate-hero-image` | yes | ❌ none | Same pattern. AI calls billed to Anthropic on the agency's account. Most also write to client-scoped tables (`copy_components`, `landing_pages`, `media_assets`) with the service role, bypassing RLS. |
| `deploy-landing-page` | yes | ❌ none | Pulls a GitHub PAT from env and creates/updates GitHub repos for clients. Caller could trigger deploy of any client's landing page or write a poisoned page to their repo. |
| `submit-form` | yes | n/a (intentionally public — receives anon form posts from landing pages) | OK pattern. Validates that `form.status='active'` before accepting, stores `client_id` from the form record. |
| `github-webhook` | yes | verifies via inbound GitHub signature flow (see `Authorization: token ${GITHUB_TOKEN}` outbound calls only) | Inbound signature verification not audited in depth — flag for review. |

**Net effect:** the entire AI-generation backend is callable by any authenticated user (or anon) against any client's IDs. Combined with §4's data exposure, this is a one-two punch: an attacker can read another client's `avatars` / `offers` (via the `auth.uid() IS NULL` policies on `avatars`/`offers`), then call `generate-funnel` with those IDs to spam their account with junk copy or simply drain Anthropic spend.

---

## 6. Client vs. agency boundary

**Can a logged-in client see another client's data?** Mostly the role-gated tables (Class A) are correct: `has_client_access()` requires either admin role, a `client_assignments` row, or `users.client_id` match. So `copy_components`, `ads`, `avatars`, `offers`, `clients` are correctly partitioned for `role='client'` users.

**But** they can:
- Read every client's `brand_kits`, `media_assets`, `page_templates`, `published_pages`, `prompt_templates`, `client_content` (Class C).
- Read every client's `clients`/`avatars`/`offers`/etc. via the anon-key bypass (Class B) by stripping their own JWT from the request.
- Trigger the privilege escalation (§4.3) and become admin.

**Header client switcher:** [src/components/Header.tsx:9, 65-74, 100-115](src/components/Header.tsx). For agency roles (`team_editor`/`team_viewer`/`admin`), the switcher lists `allClients` populated via `loadAllClients()` → plain `supabase.from('clients').select('*')`. RLS filters server-side. So a `team_editor` only sees clients they have a `client_assignments` row for; an admin sees all. **Correct shape.**

For `role='client'`, the switcher is hidden ([Header.tsx:95-99](src/components/Header.tsx)) and the system auto-selects the user's assigned client based on `profile.client_id` ([Header.tsx:33-47](src/components/Header.tsx)).

**What stops a client user from setting their selected client to a different one?** The `selectClient()` and `switchClient()` calls in `lib/store.tsx` go through Supabase's RLS-filtered queries; if the user doesn't have access to client Y, the `clients` SELECT for Y returns no row and the switch effectively fails. **However:** the `localStorage.setItem('lbh_selected_client_id', Y)` value is freely settable from the browser console. On reload, [Header.tsx:53](src/components/Header.tsx) reads it, finds it's in `clients` (which it isn't because RLS hides it for that user), and falls back to `clients[0]`. So the localStorage attack doesn't escalate — RLS catches it. The backstop is RLS, not application logic.

---

## 7. Path to making selected pages client-visible

The user's stated goal is that clients log in and see their own Stats, business info, and offers. Today `/stats/`, `/copy/`, `/ads/`, `/avatars/`, `/offers/`, `/competitor-intel/` are flagged `clientVisible: false`. Two interpretations of what's needed:

**Option 1 — keep the dual-route structure (`(hub)` for agency, `(client)` for client).** Add the missing pages under `(client)/client/stats/`, `(client)/client/offers/`, etc. Each is a new file but reuses the same data-fetching shape. The redirect logic in AuthProvider already handles role partitioning. Drawback: code duplication for every page that should be visible to both audiences.

**Option 2 — collapse to one route group.** Drop the `(client)/` group and gate by role at the page level. Each agency-only page does an early return when `isClientRole`. Less duplication, but requires real role-checks on every page (today they're cosmetic) and a server-side enforcement layer to prevent the brief-render data leak.

The user's statement — "clients should see their own Stats, business info, offers" — fits Option 1 better, since clients want a smaller, simpler portal. The existing `(client)/client/` already has dashboard + avatars + offers + landing-pages + copy + intake + competitive-intel + settings. Stats just needs to be added there too.

**But** — the prerequisites for either option are:
1. Fix the privilege escalation (§4.3) so a client can't promote themselves out of the constraint.
2. Fix the Class C tables so a client can't read other clients' brand kits / media / templates / content / prompts.
3. Fix the storage bucket so a client can't delete or overwrite other clients' files.
4. Fix or remove the Class B anon-overlay policies so unauth'd requests with the public anon key don't bypass everything.
5. Fix edge functions so the service-role bypass is fenced behind a caller check.

Until those land, neither Option 1 nor Option 2 is safe to expose to clients.

---

## 8. Most-critical issues, ranked

### P0 — exploitable by anyone, no special access needed

1. **`users_self_update` allows role escalation to admin.** An attacker signs up via the public form, becomes `team_editor`, then PATCHes their own `users.role` to `'admin'`. After that, `has_client_access` returns true everywhere. [008_fix_users_rls_bootstrap.sql:31-34](supabase/migrations/008_fix_users_rls_bootstrap.sql).
2. **Class C tables are world-writable.** Anyone with the public anon key (which is in every page's HTML) can read, modify, or delete `brand_kits`, `media_assets`, `published_pages`, `prompt_templates`, `client_content`. [016_landing_page_template_system.sql:31-34, 65-68, 169-172](supabase/migrations/016_landing_page_template_system.sql); [020_client_content.sql:40-52](supabase/migrations/020_client_content.sql); [022_prompt_templates.sql:25-28](supabase/migrations/022_prompt_templates.sql).
3. **Storage bucket `client-assets` allows any auth'd user to upload/update/delete any file.** The bucket also allows `text/html` per [012_storage_html_support.sql](supabase/migrations/012_storage_html_support.sql), turning a delete-overwrite into a stored-XSS vector against landing pages. [006_storage_bucket.sql:23-36](supabase/migrations/006_storage_bucket.sql).
4. **Public sign-up is enabled on `/login/` and grants `team_editor` automatically.** [src/app/(hub)/login/page.tsx:510-517](src/app/(hub)/login/page.tsx); [src/components/AuthProvider.tsx:60-78](src/components/AuthProvider.tsx). Any signup gives the attacker step 1 of issue #1.

### P1 — exploitable by any authenticated user

5. **Class B anon overlay policies (`USING (auth.uid() IS NULL)`) are still present** on `clients`, `avatars`, `offers`, `copy_components`, `funnel_instances`, `intake_questions`, `competitor_intel`, `creatives`, `landing_pages`, `users`, `client_assignments`, `segments`, `segment_assets`. Any actor can hit Supabase REST without a JWT and see/edit/delete every row in those tables. [005_anon_access_policies.sql](supabase/migrations/005_anon_access_policies.sql) — header literally says "TEMPORARY... REMOVE these policies once auth is wired up." Auth is wired up; not removed.
6. **`admin-fix-client-assignment` edge function is unauthenticated.** Any caller can reassign any user's `client_id` to any client. [supabase/functions/admin-fix-client-assignment/index.ts](supabase/functions/admin-fix-client-assignment/index.ts).
7. **`generate-funnel` and ~17 other AI edge functions accept caller-supplied `avatar_id` / `offer_id` / `client_id` without verifying the caller has access.** Any authenticated user (or anon, since `--no-verify-jwt`) can rack up Anthropic spend on the agency's budget against any client's data. [supabase/functions/generate-funnel/index.ts:126-130, 256-278](supabase/functions/generate-funnel/index.ts) and similar in every other generator. Combined with #5 above (anon read of `avatars` / `offers`), the attack is trivial.
8. **`deploy-landing-page` is unauthenticated** and pulls a GitHub PAT from env to mutate per-client repos. Any caller can trigger deploys, write poisoned content to a client's GitHub repo, and surface that repo via the published-pages flow. [supabase/functions/deploy-landing-page/index.ts](supabase/functions/deploy-landing-page/index.ts).

### P2 — narrower or lower-impact

9. **Pages under `(hub)/` have no real role gate.** The redirect in AuthProvider runs after mount — a client-role user typing `/stats/` sees the page DOM during the brief gap. RLS prevents cross-client data leaks for Class A tables, but the brief render is still a UX/info leak (revealed page structure, sidebar items they shouldn't know exist). The `clientVisible: false` flag in Sidebar is purely cosmetic. [src/components/Sidebar.tsx:11-20](src/components/Sidebar.tsx); [src/components/AuthProvider.tsx:117-150](src/components/AuthProvider.tsx).
10. **`form_submissions` accepts any anon insert with arbitrary `client_id`.** Spam / data-integrity, not exfiltration. [025_form_system.sql:92](supabase/migrations/025_form_system.sql).
11. **`page_templates` allows any authenticated user to insert template definitions.** Could be used to poison template seeds. [016_landing_page_template_system.sql:107](supabase/migrations/016_landing_page_template_system.sql).
12. **Schema drift between repo and prod.** Migrations 028 (`segments`), 029 (`segments_rls`), 030 (`form_patterns`), 031 (`service_areas`) exist in prod but not in this git repo. Any new RLS holes in those migrations are invisible to git review. (The agent saw the segment policies at runtime when adding `segment_id` references; segment policies look correct.)

---

## 9. Recommendations, ranked

### (a) Must-fix before any client login goes live

1. **Disable public sign-up.** The `/login/` page should remove the "Sign up" toggle and rely exclusively on the `invite-user` edge function (which already enforces admin-only). Keep the form for `mode === 'login' | 'forgot' | 'reset'` only. [src/app/(hub)/login/page.tsx:510-517](src/app/(hub)/login/page.tsx).
2. **Lock the `users.role` and `users.client_id` columns from self-update.** Either:
   - Drop the `authenticated` UPDATE grant on those columns (column-level revoke), or
   - Replace `users_self_update` with a trigger that raises if `NEW.role <> OLD.role OR NEW.client_id <> OLD.client_id` and the caller is not admin, or
   - Tighten the RLS `WITH CHECK` to compare against `OLD.role` (Postgres 17+) — easiest is a trigger.
3. **Replace every Class C `USING (true)` policy** (`brand_kits`, `media_assets`, `page_templates`, `published_pages`, `prompt_templates`, `client_content`) with the same per-role / `has_client_access(client_id)` pattern used by Class A tables. `page_templates` is system-level (not per-client) and only needs admin-write + everyone-read.
4. **Remove the Class B anon-overlay policies** from migration 005 (and the equivalent in segments/segment_assets). They are no longer needed; auth is wired up. Drop policies `clients_anon_*`, `avatars_anon_*`, `offers_anon_*`, etc.
5. **Tighten storage bucket `client-assets` policies** so writes are scoped to the caller's client paths. The convention is `{client_id}/...` (logos) and `banners/{client_id}/...` (banners). A policy of the form `(storage.foldername(name))[1] = client_id_from_jwt` (or check via `client_assignments`) is sufficient. Disable HTML uploads if no flow needs them.
6. **Add a caller check to `admin-fix-client-assignment`, `deploy-landing-page`, and every `generate-*` / `analyze-*` / `qa-*` edge function.** The pattern from `invite-user` (build a `callerClient` with the request's Authorization header, fetch the user's role, verify access to the target `client_id`) is the model. Either standardize this in `_shared/auth.ts` and call it at the top of every function.

### (b) Should-fix soon (post-launch is OK if monitored)

7. **Move the role gate to a middleware-level check (or server component layout).** `src/middleware.ts` could read the auth cookie, fetch the role from Supabase, and reject requests to `(hub)/*` paths from `client`-role users (and vice-versa). Eliminates the brief-render leak.
8. **Real `clientVisible` enforcement.** The sidebar flag is fine for navigation; combine it with a per-page `if (isClientRole) return notFound()` early return so a typed-URL render returns 404 instead of the page DOM.
9. **Land migrations 028/029/030/031 (`segments`, etc.) into git** so the repo is the source of truth. Without this any future audit is incomplete.
10. **Verify the GitHub-webhook signature verification** in `github-webhook/index.ts` — flagged but not audited in depth here.

### (c) Nice-to-have

11. **Audit logging.** `users.role` changes, `client_assignments` inserts, edge function calls — log to a write-only `audit_log` table so suspicious activity has a paper trail.
12. **`form_submissions` anon-insert hardening.** Verify the submitted `form_id` belongs to the claimed `client_id` server-side (an edge function does this correctly today; if any direct REST inserts exist, lock them down).
13. **Drop dead RLS policies.** After (a)5 and (a)6 land, remove the now-unused `*_anon_*` policy names so future readers don't think they're load-bearing.
14. **Public-anon-key rotation.** It's been in the wild long enough that any rotation needs to happen in lockstep with all the above; useful hygiene but not a fix on its own (since the anon key is *meant* to be public — its safety depends on RLS).

---

## Appendix — verification commands used

- Live RLS state: `SELECT relname, relrowsecurity FROM pg_class … WHERE nspname='public'` on the linked Supabase project.
- Per-table policies: `SELECT polname, polcmd, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid) FROM pg_policy …`.
- Column grants: `information_schema.column_privileges` and `role_table_grants` for `users`.
- Storage policies: `pg_policy` on `storage.objects` filtered by bucket.
- Migration files surveyed: `supabase/migrations/001…037_*.sql` (in repo) plus migrations 028/029/030/031 observed in `supabase_migrations.schema_migrations` but absent from git.
- Edge functions surveyed: `supabase/functions/*/index.ts` (26 functions).

End of report.
