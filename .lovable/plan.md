
# Implementation plan

This is a large batch. I'll ship it in **4 migrations + UI passes** so each piece is reviewable. Nothing here touches the notification pipeline or existing sign-in logic beyond additive fields.

---

## 1. Member lifecycle: delete → trash, suspension, probation, admin roles

**Schema (migration 1)**
- `profiles`: add `deleted_at timestamptz`, `deleted_by uuid`, `suspended_until timestamptz`, `suspension_reason text`, `is_admin boolean default false`, `admin_pages text[] default '{}'`, `probation_started_at timestamptz`, `probation_targets jsonb` (array of `{key,label,weight}`).
- New `probation_scores` table: `member_id`, `target_key`, `score int (0-100)`, `note`, `recorded_by`, timestamps. RLS: lead of same team can insert/update/delete; member can read own.
- `has_admin_page(_user, _page)` SECURITY DEFINER helper.
- Existing "remove" flow keeps `is_active=false` but also stamps `deleted_at`. Members with `deleted_at` are hidden from active lists but shown on a **Trash** tab (lead-only) with a "Restore" button.

**UI**
- `src/pages/Members.tsx`:
  - Tabs: **Active · Suspended · Probation · Trash**.
  - Active card gains a dropdown: *Suspend…*, *Move to probation…*, *Make admin…*, *Delete* (destructive confirm).
  - Suspension chip (`Suspended · until Jul 5`) visible only to the member themselves and to leads (RLS-driven query).
  - Restore button in Trash tab.
- New `src/pages/MemberDetail.tsx` (lead-only): profile header + summary insights (attendance %, tasks %, songs, dues, prayer leads, last sign-in). Route `/members/:id`.
- New `src/pages/Probation.tsx`: list of probation members, per-target score sliders, invite-to-probation button that reuses existing invite flow with a `probation=true` flag.
- New `src/pages/AdminAccess.tsx` (lead-only): toggle `is_admin` and page checkboxes (Chat, Broadcasts, Attendance, Songs, Rehearsals, Payments, Checklists, Prayer). `ProtectedRoute` gains an `adminPage` prop that also allows access when `has_admin_page` returns true.

**Suspension semantics**: purely a display tag. No feature is blocked. Auto-expires when `suspended_until < now()` (computed client-side; a cron isn't needed).

---

## 2. Event priorities + analytics expansion

**Schema (migration 2)**
- Add `priority smallint default 2` (1=low, 2=normal, 3=high, 4=critical) to `rehearsals`, `service_events`, `weekly_checklists`, `prayer_chains`, `broadcasts`.
- Optional `priority_color` derived in UI.

**UI**
- Priority selector on each event create/edit form (segmented control).
- Priority badge on list rows + sort-by-priority option.
- `MyAnalytics.tsx` gains:
  - Rehearsal vs Service attendance split (two bars).
  - Checklist completion per week (line).
  - Sign-in punctuality (avg minutes vs `late_after`).
  - Songs led count, prayer leads count over range.
  - Filter chip: *All events · Rehearsals · Services · Checklists*.

---

## 3. Cross-browser auth + password reset

- `signUp` / `resetPasswordForEmail` already accept `emailRedirectTo`. Audit **every** call and set `emailRedirectTo: \`${window.location.origin}/…\`` (currently one or two hardcode a domain). Reset link opens `/reset-password` on whatever origin the user clicks from — Supabase handles the session hydration regardless of browser.
- Add explicit `flowType: 'pkce'` note in `client.ts`? Not needed — default already works across browsers because tokens are in the URL hash/query, not cookies. Main fix is removing any hardcoded origins.
- Confirm `/reset-password` route is public (it already is per earlier work) and handles `type=recovery` + `access_token` from hash.

---

## 4. DM parity with group chat

`direct_messages` currently has reactions + stars tables. Missing vs `chat_messages`: **pin** and **highlight**.
- Migration 3: add `is_pinned boolean default false`, `highlight_color text` to `direct_messages`. Reuse existing `dm_message_reactions` and `dm_message_stars`.
- `src/pages/DirectMessages.tsx`: port the message action menu from `Chat.tsx` (pin toggle, highlight color picker, emoji reactions via existing `EmojiPicker`, star). Pinned DM banner at top of thread.

---

## 5. Payment schedule management

- `src/pages/Payments.tsx`: leads gain **Edit / Delete** on each schedule row (already have create). Delete confirms and cascades via existing FK. "New schedule" button already present — verify it clears the form.

---

## 6. Songs improvements

- **Assigned lead visible to all**: `LeadSingerPicker` write stays lead-only, but the *chip* rendering on song cards renders for everyone (currently gated). Adjust conditional in `src/pages/Songs.tsx`.
- **Song list formatting**: bulk-upload textarea splits on newlines; each non-empty line becomes one song. Preview list before insert. Fix the current single-line concat bug by trimming per line and skipping blanks.

---

## Files

**Migrations (3 total)**
- `…_member_lifecycle.sql` — profile fields, probation_scores, has_admin_page, RLS updates.
- `…_event_priorities.sql` — priority columns.
- `…_dm_pin_highlight.sql` — DM columns.

**New pages/components**
- `src/pages/MemberDetail.tsx`
- `src/pages/Probation.tsx`
- `src/pages/AdminAccess.tsx`
- `src/pages/Trash.tsx` (or Trash tab inside Members)
- `src/components/PrioritySelect.tsx`, `PriorityBadge.tsx`

**Edited**
- `src/pages/Members.tsx`, `Payments.tsx`, `Songs.tsx`, `DirectMessages.tsx`, `MyAnalytics.tsx`
- `src/App.tsx`, `src/components/layout/MainLayout.tsx` (routes + nav)
- `src/components/ProtectedRoute.tsx` (adminPage prop)
- Event create/edit forms in `Rehearsals.tsx`, `ServiceAttendance.tsx`, `Checklists.tsx`, `PrayerChains.tsx`, `Broadcast.tsx`

**Untouched**: notification pipeline, sign-in logic, existing RLS on attendance/checklists.

---

## Order of execution

1. Migration 1 (member lifecycle) → UI for Members/Trash/Probation/AdminAccess/MemberDetail.
2. Migration 2 (priorities) → event form updates + analytics expansion.
3. Migration 3 (DM pin/highlight) → DirectMessages parity.
4. Payments edit/delete + Songs fixes + auth origin audit (no schema).

Approve and I'll start with migration 1.
