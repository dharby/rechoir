# Choir Connect Pro

# RECHOIR - Complete App Description for Recreation

## Overview
RECHOIR is a professional CRM-style platform for African church choir management. It replaces chaotic spreadsheets, WhatsApp groups, and memory-based tracking with a unified command center.

**Vision:** "Salesforce meets ChurchStack" — data-driven, organized, purposeful, reliable like enterprise software but accessible to church communities.

---

## Tech Stack
- **Frontend:** React 19 + Vite 8 (JavaScript/JSX)
- **Backend:** Supabase (PostgreSQL + Edge Functions in TypeScript/Deno)
- **State:** Zustand (auth/theme) + TanStack React Query (server state)
- **Auth:** Supabase Auth (JWT)
- **Charts:** Recharts
- **Icons:** Lucide React
- **Real-time:** Supabase Realtime + Socket.io Client
- **Routing:** React Router DOM 7

---

## Color Palette
| Role | Hex |
|------|-----|
| Primary | `#1e40af` (Royal Blue) |
| Secondary | `#d97706` (Rich Gold) |
| Accent | `#059669` (Emerald) |
| Warning | `#f59e0b` (Amber) |
| Danger | `#dc2626` (Rose Red) |
| Background | `#0f172a` (Dark slate) |
| Surface | `#1e293b` (Cool gray) |
| Text Primary | `#f8fafc` (Near white) |
| Text Secondary | `#94a3b8` (Muted) |
| Button Gradient | `linear-gradient(135deg, #1e40af, #7c3aed)` |

---

## User Roles & Authentication

**Super Admin (Platform-level)**
- Full system access, manages all choirs globally
- Email + password (8+ chars, uppercase, number, special char)

**Team Lead (Choir-level admin)**
- Manages single choir, generates 6-digit member access codes
- Add/edit/remove members

**Team Member**
- Login via email + 6-digit team code (no password initially)
- First login: set personal password
- Access assigned tasks, schedules, songs, chats

---

## Feature Modules

### 1. Prayer Chains
- Name, description, start/end dates
- Types: **Continuous** (24/7) or **Scheduled**
- Assigned members with scheduled times
- States: Active (green pulse), Completed (gold badge), At Risk (amber)
- "Mark prayer answered" celebration UI

### 2. Due Payment Tracker
- Payment title, amount, due date
- Assign to individual or group
- Members mark "Paid" with optional proof upload
- Auto-reminders: 7 days, 3 days, day-of, overdue
- Team lead: collection progress (% bar)

### 3. Rehearsal Schedules
- Title, date, start/end time, location, agenda
- Auto-notify all members
- Attendance: Present/Absent/Excused per member
- Late tracking (arrival time logged)
- Post-rehearsal notes attachment

### 4. Attendance Tracking
- Tracks rehearsal, service/Sunday, custom events
- Per member: rate, excused vs unexcused, trend line
- Team lead: heatmap, at-risk (<80%), exportable reports

### 5. Weekly Checklists (Productivity)
- Customizable checklist items per member
- Mark complete/incomplete with notes
- Aggregate progress bars, leaderboard
- Weekly digest email to team lead

### 6. Uniform Calendar
- Event name, date, description, image upload
- Checklist per event: Who has uniform ready?
- Per member: Ready (green), Pending (amber), Not Ready (red), N/A (gray)

### 7. Weekly Song List & Readiness
- Team lead creates: title, key, YouTube link, notes, target date
- Member readiness: Not Started | Learning | Ready | Perfect
- Self-assessment with optional note
- Team lead override capability
- Dashboard: progress bars, songs needing attention (<60% ready)
- D-6, D-3, D-1 countdowns

### 8. Team Chat
- Team-wide chat, group chats (by specialization), direct messages
- Real-time messaging
- Types: Text, file attachment, voice note
- Read receipts, @mentions, reactions

### 9. Team Management
- Add member (manual or Google Sheet import)
- Edit member details, change specialization
- Enable/disable access (soft lockout)
- Remove member (archive)
- Google Sheet Import: .xlsx, .csv (name*, email*, phone, specialization)

### 10. Notifications
- In-app bell with unread count
- Dropdown list of recent notifications
- Triggers: new rehearsal, payment due, prayer shift, chat mentions, attendance, song assigned

---

## Pages & Routes

### Public
- `/` — Landing page
- `/login` — Email/password login
- `/register` — Super admin registration
- `/register-team` — Team lead registration
- `/member-code-login` — Member login with access code
- `/member-register` — First-time member password setup
- `/reset-password` — Password reset

### Protected (Team Lead/Admin)
- `/dashboard` — Overview stats
- `/members` — Team member management
- `/prayer-chains` — Prayer chain management
- `/prayer-calendar` — Prayer calendar view
- `/attendance` — Attendance tracking
- `/payments` — Due payments
- `/rehearsals` — Rehearsal schedules
- `/checklists` — Weekly productivity
- `/uniforms` — Uniform calendar
- `/songs` — Song list & readiness
- `/chat` — Team chat
- `/broadcast` — Broadcast messages
- `/invite` — Invite members
- `/settings` — User settings

### Protected (Member)
- `/member/dashboard` — Personal dashboard
- `/member/songs` — Song view
- `/member/chat` — Chat access

---

## Database Schema Summary

**profiles** — id, email, full_name, phone, role, specialization, team_id, is_active, has_set_password

**teams** — id, name, code (unique 8-char), super_admin_id

**prayer_chains** — id, name, description, type, start_date, end_date, team_id

**prayer_chain_assignments** — id, chain_id, member_id, scheduled_time, status

**due_payments** — id, title, amount, due_date, team_id

**payment_records** — id, payment_id, member_id, is_paid, paid_at, proof_url

**rehearsals** — id, title, date, start_time, end_time, location, agenda, team_id

**attendance** — id, rehearsal_id, member_id, status, arrival_time

**weekly_checklists** — id, title, week_start_date, team_id

**checklist_items** — id, checklist_id, member_id, description, is_completed, completed_at

**uniform_events** — id, name, date, description, image_url, team_id

**uniform_readiness** — id, event_id, member_id, is_ready

**songs** — id, title, song_key, youtube_url, practice_notes, target_readiness_date, team_id

**song_assignments** — id, song_id, member_id, status, note

**chat_rooms** — id, name, type, team_id

**chat_messages** — id, room_id, sender_id, sender_type, content, type, file_url, read_at

**notifications** — id, user_id, title, body, is_read

**member_access_codes** — id, member_id (unique), access_code (6-digit)

---

## UI/UX Notes

- **Font:** Inter (headings: Bold, body: Regular)
- **Mobile-first:** Sidebar collapses < 768px, touch targets 44px min
- **Loading:** Skeleton screens (not spinners)
- **Motion:** Subtle 200-300ms ease-out transitions
- **Avatars:** Initials-based with gradient backgrounds
- **Theme:** Dark mode default (toggle available)

---

## Key Patterns

1. **Edge Functions** for all CRUD operations (auth, teams, members, prayer-chains, payments, rehearsals, checklists, uniforms, songs, chat, notifications)
2. **React Query** for data fetching with 1-minute staleTime
3. **Zustand stores** for auth state + theme persistence
4. **Supabase Realtime** for chat subscriptions
5. **Role-based navigation** — Members see limited menu

---

## Design Aesthetic
Professional, trustworthy, modern African church aesthetic. Royal blue primary conveys trust/professionalism; rich gold conveys African warmth/excellence. Dark theme feels premium and enterprise-grade while remaining accessible.

---

## File Structure to Build

```
frontend/
├── src/
│   ├── App.jsx (Routes configuration)
│   ├── index.css (Global styles, theme)
│   ├── main.jsx (Entry point)
│   ├── stores/
│   │   ├── authStore.js (Authentication state)
│   │   └── themeStore.js (Theme state + colors)
│   ├── services/
│   │   ├── supabase.js (Supabase client)
│   │   ├── api.js (Auth + API functions)
│   │   └── [modules].js (payments, songs, etc.)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── MainLayout.jsx
│   │   │   └── Sidebar.jsx
│   │   └── ui/
│   │       ├── Button.jsx
│   │       ├── Input.jsx
│   │       ├── Card.jsx
│   │       ├── Modal.jsx
│   │       ├── Avatar.jsx
│   │       ├── Badge.jsx
│   │       └── ProgressBar.jsx
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── auth/ (Login, Register, ResetPassword, etc.)
│   │   ├── dashboard/Dashboard.jsx
│   │   ├── members/Members.jsx
│   │   ├── prayer-chains/PrayerChains.jsx, PrayerCalendar.jsx
│   │   ├── payments/Payments.jsx
│   │   ├── rehearsals/Rehearsals.jsx
│   │   ├── songs/Songs.jsx
│   │   ├── chat/Chat.jsx
│   │   ├── checklists/Checklists.jsx
│   │   ├── uniforms/Uniforms.jsx
│   │   ├── attendance/Attendance.jsx
│   │   ├── broadcast/Broadcast.jsx
│   │   ├── invite/InviteMembers.jsx
│   │   ├── settings/Settings.jsx
│   │   └── member/MemberDashboard.jsx, MemberRegister.jsx
│   └── utils/
│       └── theme.js
├── package.json
└── vite.config.js

backend/
└── supabase/
    ├── functions/ (Edge Functions in TypeScript/Deno)
    │   ├── auth-super-admin/
    │   ├── auth-team-lead/
    │   ├── auth-member/
    │   ├── teams/
    │   ├── members/
    │   ├── prayer-chains/
    │   ├── payments/
    │   ├── rehearsals/
    │   ├── checklists/
    │   ├── uniforms/
    │   ├── songs/
    │   ├── chat/
    │   └── notifications/
    ├── schemas/
    └── supabase-schema.sql
```

---

## Important Implementation Notes

1. **Supabase Edge Functions** handle all server-side logic — write in TypeScript/Deno
2. **Auth Flow**: Super admin/Team lead use email+password; Members use 6-digit access code then set password on first login
3. **Role-based routing**: Members only see Dashboard, Songs, Chat; Admins see full menu
4. **Real-time chat**: Subscribe to Supabase Realtime channels for chat messages
5. **Theme**: Dark mode is default; use Zustand with persist middleware for theme toggle
6. **Data fetching**: Use TanStack React Query with 1-minute staleTime for all API calls
7. **Notifications**: Trigger on new rehearsal, payment due, prayer shift, chat mentions, attendance, song assigned
8. **Google Sheet import**: Parse .xlsx/.csv files for bulk member creation (name*, email*, phone, specialization)
9. **Charts**: Use Recharts for analytics dashboards (attendance trends, payment collection, song readiness)
10. **Mobile-first**: Ensure sidebar collapses below 768px, touch targets are 44px minimum

remove super admin from the onboarding page. only team lead and choir members can sign in. the team lead creates and registers the choir, the system gives each choir their unique accesscode which every member uses to sign into their choirs dashboard alongside their email. also the team lead can send special invite link to their team members to onboard into the choirs server before choir members can sign in with their email. once the system recognises the email and password (access code) of a member, then they can login

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://rechoir.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/15d772a1-a905-4316-b034-0e4195d346dc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
