# EdTech Test Platform — MVP Plan

A clean, minimal, responsive test platform with student + admin flows, MCQ tests, rankings, and course videos. Built on the project's existing TanStack Start + Tailwind + shadcn stack with Lovable Cloud (Supabase) for auth and data.

> Note: the project template is TanStack Start (not Next.js). Routing, SSR, and deployment all work the same way for this MVP and Lovable handles hosting — no functionality is lost.

## Scope

In: student auth, admin login, test catalog with filters, MCQ attempts, answer review, score-based rankings, course/video listing, comments, simple admin CRUD, profile, settings.

Out (per your spec): AI, XP, gamification, achievements, live/multiplayer, notifications, email flows, subscriptions, payment processing UI, advanced analytics.

## Architecture

- Frontend: TanStack Start, Tailwind, shadcn/ui
- Backend: Lovable Cloud (Supabase Postgres + Auth + RLS)
- Roles: separate `user_roles` table with `app_role` enum (`admin`, `student`) and `has_role()` security-definer function
- Admin: no signup route; admin row inserted manually in `user_roles`
- Payments: out of scope for MVP — "Purchase" button marks a row in `purchases` (admin can also grant access). Real payment gateway can be added later.

## Database (Lovable Cloud)

```
profiles            id (uuid, FK auth.users), full_name, college, created_at
user_roles          id, user_id, role (app_role)
tests               id, title, description, price, tier (free|paid|premium),
                    duration_min, total_marks, instructions, created_at
test_questions      id, test_id, question, option_a..d, correct_option, position
test_attempts      id, user_id, test_id, started_at, submitted_at, score, total
test_answers        id, attempt_id, question_id, selected_option
purchases           id, user_id, test_id, created_at
videos              id, title, description, thumbnail_url, video_url, created_at
comments            id, test_id, user_id, body, created_at
```

RLS:
- profiles: user reads/updates own; admin all
- tests/videos: any authenticated user reads; admin writes
- test_questions: read only when user has access (free OR purchased OR admin); `correct_option` only exposed via review query post-submission
- test_attempts/answers: user reads/writes own; admin reads all
- purchases: user reads own; admin writes
- comments: any authenticated reads; user writes own when has access; admin deletes
- rankings: a SQL view aggregating attempts (rank, name, college, total score, attempts, avg %)

## Routes

Public
- `/` landing (hero, featured tests, featured videos, contact)
- `/login`, `/signup`
- `/admin/login`

Student (under `_authenticated/`)
- `/dashboard`
- `/tests` list with filter (free/paid/premium) + sort
- `/tests/$testId` detail
- `/tests/$testId/attempt` MCQ runner
- `/tests/$testId/review/$attemptId`
- `/purchased`
- `/history`
- `/rankings`
- `/courses`
- `/profile`
- `/settings`

Admin (under `_authenticated/_admin/`)
- `/admin` overview (4 count cards)
- `/admin/users` list, block, role
- `/admin/tests` CRUD
- `/admin/tests/$testId/questions` CRUD
- `/admin/courses` CRUD
- `/admin/comments` list + delete
- `/admin/settings`

Layout: shadcn `Sidebar` for student and admin shells; landing uses a simple top nav.

## Key Flows

- Auth: Supabase email/password. `onAuthStateChange` listener set before `getSession`. Profile row auto-created via `handle_new_user` trigger.
- Admin gate: `_admin` layout `beforeLoad` calls a server fn that checks `has_role(uid,'admin')`; redirects otherwise.
- Test access: client checks `tier='free' OR exists(purchases)`; server RLS enforces it for question fetch.
- Attempt: create attempt row → fetch questions (no `correct_option`) → submit answers → server fn scores by joining correct options → write `test_attempts.score` and `test_answers`.
- Review: server fn returns questions with `correct_option` + user's selections only after `submitted_at` is set.
- Rankings: select from `rankings_view` ordered by total score.
- Purchase: button inserts into `purchases` (placeholder; real gateway later).

## Design

- Minimal, modern, light theme with subtle dark mode tokens. Soft shadows, rounded-2xl cards, generous spacing.
- Typography: Inter-alternative pairing via system + a refined display font (e.g. "General Sans"-style) — chosen at implementation.
- Color tokens (oklch) defined in `src/styles.css`: neutral background, deep ink foreground, single accent (calm indigo-teal), muted surfaces. No purple-on-white gradients.
- All colors via semantic tokens — no ad-hoc `text-white`/`bg-black` in components.

## Build Order

1. Enable Lovable Cloud, create schema + RLS + trigger + view
2. Design tokens in `styles.css`, base layout primitives
3. Auth (signup/login/logout) + profiles + admin role check
4. Landing page
5. Student shell + dashboard + tests list/detail
6. MCQ attempt + scoring + review
7. Rankings, courses, history, purchased, profile, settings, comments
8. Admin shell + CRUD screens + overview

## Notes / Assumptions

- "Purchase" is a stub (writes a `purchases` row). Add Stripe later if needed.
- "Block user" toggles a `blocked` boolean on `profiles`; blocked users get signed out on next request.
- Admin account is created by inserting one row into `user_roles` after the admin signs up once via the normal signup, OR via a one-time SQL insert pointing at a manually created `auth.users` row.

Approve to start implementation.
