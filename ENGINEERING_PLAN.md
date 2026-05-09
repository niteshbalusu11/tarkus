# TARKUS Hackathon Engineering Plan

## Objective

Build the Live Mode MVP for tomorrow's hackathon demo:

Teacher signs in -> creates a live session -> gets a short expiring code -> students sign in and join with the code -> students chat and complete the structured Pillars exercise -> teacher dashboard updates live with roster, chat, exercise results, and teacher-only AI synthesis.

## Current Repo Baseline

- App: Vite + React + TanStack Router.
- Styling: Tailwind CSS.
- Auth dependency: Clerk is installed and root provider is wired.
- Backend: Convex is installed and root provider is wired.
- AI packages: TanStack AI packages are installed, but we should keep the AI implementation simple unless those packages save time.
- Existing app is mostly boilerplate/demo routes.
- Current Convex schema only contains demo `products` and `todos` tables.

## Execution Principles

- Build the full demo loop before polishing individual screens.
- Keep AI behind the teacher only.
- Keep Pillars structured; do not treat the assessment as raw chat.
- Make the dashboard scannable in under 5 seconds.
- Store AI summaries in Convex so the teacher view updates like the rest of the app.
- Prefer simple Convex functions and React views over adding abstraction.
- Use demo simulation as reliability support, not as a fake replacement for live functionality.

## Phase 0: Setup And Guardrails

- [ ] Run `npx convex ai-files install` to add/refresh official Convex AI guidance for this repo.
- [ ] Confirm `.env.local` has `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CONVEX_URL`, and `CONVEX_DEPLOYMENT`.
- [ ] Add an OpenRouter server-side env var, likely `OPENROUTER_API_KEY`.
- [ ] Decide the model string for MVP, preferably a cheap frontier-lab model available through OpenRouter.
- [ ] Confirm the app boots with `bun --bun run dev`.
- [ ] Confirm Convex dev server works with `bunx --bun convex dev`.
- [ ] Remove or hide distracting TanStack starter/demo navigation from the production demo surface.

Acceptance:

- [ ] Local app runs.
- [ ] Convex functions compile.
- [ ] Clerk sign-in works.
- [ ] No demo boilerplate is prominent on the main route.

## Phase 1: Routes And App Shell

Create a minimal product shell with three core entry points:

- `/` landing/control entry
- `/teacher` teacher dashboard/session creation
- `/join` student join flow

Todos:

- [ ] Update app metadata/title to TARKUS.
- [ ] Replace starter home page with a simple TARKUS entry page.
- [ ] Add auth-gated teacher route.
- [ ] Add auth-gated student join route.
- [ ] Add route for joined student session, likely `/session/$sessionCode` or `/student/$sessionId`.
- [ ] Keep teacher/student experiences in one app with role-by-route for speed.
- [ ] Add mobile-first layout for student route.
- [ ] Add desktop dashboard layout for teacher route.

Acceptance:

- [ ] Signed-out users are prompted to sign in before teacher or student actions.
- [ ] Signed-in user can reach teacher flow.
- [ ] Signed-in user can reach join flow.

## Phase 2: Convex Schema

Replace demo schema with the live-mode data model.

Tables:

- `sessions`
- `sessionParticipants`
- `chatMessages`
- `activities`
- `activitySubmissions`
- `aiAnalyses`

Optional if needed:

- `users`

Todos:

- [ ] Define `sessions` with `teacherTokenIdentifier`, `code`, `status`, `expiresAt`, `createdAt`, optional `endedAt`, optional `deletedAt`, optional `title`.
- [ ] Define `sessionParticipants` with `sessionId`, `studentTokenIdentifier`, optional `displayName`, `joinedAt`, optional `lastSeenAt`.
- [ ] Define `chatMessages` with `sessionId`, `authorTokenIdentifier`, `authorRole`, optional `displayName`, `body`, `isAnonymous`, `createdAt`, optional `deletedAt`.
- [ ] Define `activities` with `sessionId`, `type`, `title`, `status`, `config`, `createdAt`.
- [ ] Define `activitySubmissions` with `sessionId`, `activityId`, `studentTokenIdentifier`, `type`, `payload`, `submittedAt`, `updatedAt`.
- [ ] Define `aiAnalyses` with `sessionId`, `kind`, `inputCursor`, `output`, `createdAt`.
- [ ] Add indexes for code lookup, teacher sessions, session participants, session messages by time, activity submissions, and latest analyses.

Acceptance:

- [ ] Schema compiles.
- [ ] Generated Convex API updates cleanly.
- [ ] Tables support all required demo queries without client-side scanning across unrelated sessions.

## Phase 3: Backend Functions

Build Convex functions with server-side auth checks.

Session functions:

- [ ] `createSession`: authenticated teacher creates active session, random short code, expiration, and predefined Pillars activity.
- [ ] `getTeacherSession`: authenticated teacher fetches a session they own.
- [ ] `listMyTeacherSessions`: optional, for returning to recent sessions.
- [ ] `joinSessionByCode`: authenticated student joins an active, unexpired session by code.
- [ ] `getStudentSession`: authenticated participant fetches joined session.
- [ ] `endSession`: teacher ends session.
- [ ] `deleteSession`: teacher soft-deletes session and associated visible data.

Realtime read functions:

- [ ] `listParticipants`.
- [ ] `listMessages`.
- [ ] `listActivitySubmissions`.
- [ ] `getLatestAnalysis`.
- [ ] `getSessionOverview` if useful to reduce frontend wiring.

Mutation functions:

- [ ] `sendMessage`.
- [ ] `submitPillarsExercise`.
- [ ] `updatePillarsExercise` if easy.
- [ ] `seedDemoSession`.

Authorization rules:

- [ ] All functions use `ctx.auth.getUserIdentity()`.
- [ ] Teacher-only functions verify session ownership.
- [ ] Student functions verify participant membership.
- [ ] Join function verifies code status and expiration.
- [ ] Deleted sessions are not joinable.

Acceptance:

- [ ] Teacher cannot read or delete someone else's session.
- [ ] Student cannot join expired code.
- [ ] Student cannot post to a session they have not joined.
- [ ] Realtime queries update without refresh.

## Phase 4: Student Experience

Build the student live class companion.

Todos:

- [ ] Join page with short code input.
- [ ] Joined session page with class title/status.
- [ ] Shared class chat.
- [ ] Message composer with optional anonymous toggle.
- [ ] Pillars exercise panel using the fixed school-uniform scenario.
- [ ] Decision-maker text input.
- [ ] Pillar add/edit/remove UI.
- [ ] Importance and accessibility controls for each pillar.
- [ ] Ordering/ranking UI; if drag-and-drop is slow, use up/down buttons or rank selectors.
- [ ] Reflection input.
- [ ] Submit button and submitted state.
- [ ] Mobile viewport check.

Acceptance:

- [ ] Student can join on phone-width viewport.
- [ ] Student can post chat message.
- [ ] Student can submit Pillars assessment.
- [ ] Student never sees AI output.

## Phase 5: Teacher Dashboard

Build the main demo surface.

Todos:

- [ ] Teacher dashboard empty state with "New live session."
- [ ] Active session header with short code, expiration, participant count, and status.
- [ ] Live roster.
- [ ] Raw chat side panel.
- [ ] Curated/high-signal chat section from latest AI analysis.
- [ ] AI synthesis panel with teacher brief, recurring questions, unclear concepts, emotional tone, and chat clusters.
- [ ] Pillars results panel.
- [ ] Pillar frequency list.
- [ ] Importance x Accessibility matrix.
- [ ] Sequence summary.
- [ ] Reflection themes.
- [ ] Manual "Refresh AI" action.
- [ ] "Seed demo data" action.
- [ ] End/delete session actions.

Acceptance:

- [ ] Teacher can understand class state at a glance.
- [ ] Live messages and submissions appear without manual refresh.
- [ ] Pillars results look materially better than a spreadsheet.
- [ ] Dashboard remains usable with 8-12 simulated students.

## Phase 6: AI Analysis

Use a simple server-side Convex action calling OpenRouter.

Todos:

- [ ] Add AI prompt/spec file or constants for Live Mode.
- [ ] Add OpenRouter action that accepts session id and produces structured JSON.
- [ ] Include current chat, current Pillars submissions, and previous analysis if useful.
- [ ] Require concise teacher-only output.
- [ ] Return fields matching the dashboard:
  - `teacherBrief`
  - `recurringQuestions`
  - `unclearConcepts`
  - `emotionalTone`
  - `chatClusters`
  - `pillarsInsights`
- [ ] Store output in `aiAnalyses`.
- [ ] Add manual refresh trigger from teacher dashboard.
- [ ] Add lightweight auto-trigger after enough new data arrives, if time allows.
- [ ] Handle API failure gracefully with a dashboard error state.

Prompt constraints:

- [ ] No student-facing language.
- [ ] No grading.
- [ ] No tactical advice.
- [ ] Class-level clusters by default.
- [ ] Brief, scannable bullets.

Acceptance:

- [ ] AI output references actual messages/submissions.
- [ ] AI does not prescribe what activists should do.
- [ ] AI output is short enough to read live.
- [ ] Failed AI call does not break the dashboard.

## Phase 7: Demo Simulation

Add a reliable fallback that fills the dashboard with plausible data.

Todos:

- [ ] Create 8-12 simulated participants.
- [ ] Insert varied chat messages with recurring questions and confusion patterns.
- [ ] Insert structured Pillars submissions with varied importance/accessibility ratings.
- [ ] Include enough variation to make the matrix and AI clusters interesting.
- [ ] Trigger AI analysis after seed.
- [ ] Make the control teacher-only.

Acceptance:

- [ ] One click can populate a session.
- [ ] Seed data looks realistic.
- [ ] Demo still works with real student input after seeding.

## Phase 8: Visual Polish

Make the app look credible for judges.

Todos:

- [ ] Replace starter branding with TARKUS.
- [ ] Use a restrained operational dashboard style.
- [ ] Ensure teacher dashboard fits key panels above the fold on laptop.
- [ ] Ensure student UI works on mobile.
- [ ] Add strong visual hierarchy for AI brief and matrix.
- [ ] Use lucide icons for actions/status.
- [ ] Remove unrelated demo components and links from visible navigation.
- [ ] Avoid overbuilt marketing sections.

Acceptance:

- [ ] First screen communicates live classroom product, not a starter app.
- [ ] No text overlaps at mobile or laptop widths.
- [ ] Dashboard has a polished, judge-ready look.

## Phase 9: Verification

Run through the pitch path end to end.

Todos:

- [ ] Run typecheck/build.
- [ ] Run lint if time permits.
- [ ] Start app and Convex dev server.
- [ ] Verify teacher sign-in.
- [ ] Verify student sign-in in separate browser/session.
- [ ] Create session.
- [ ] Join by code.
- [ ] Send chat.
- [ ] Submit Pillars assessment.
- [ ] Confirm realtime teacher updates.
- [ ] Trigger AI analysis.
- [ ] Seed demo session.
- [ ] Delete session.
- [ ] Test mobile viewport for student route.
- [ ] Test laptop viewport for teacher dashboard.

Acceptance:

- [ ] The live demo can be completed in under 3 minutes.
- [ ] Core flow works without page reloads.
- [ ] There is a fallback seeded path if audience participation is thin.

## Critical Path

Do these first, in order:

1. Convex schema and session create/join.
2. Auth-gated teacher/student routes.
3. Realtime chat.
4. Pillars structured submission.
5. Teacher dashboard with non-AI aggregate results.
6. OpenRouter AI analysis.
7. Demo seed.
8. Visual polish.

## Cut If Time Is Tight

- Student edit-after-submit.
- Teacher chat replies.
- End session separate from delete session.
- Auto-triggered AI analysis.
- Recent session list.
- Individual drill-down on Pillars submissions.
- Complex drag-and-drop ordering.

## Do Not Cut

- Auth before joining.
- Short session code.
- Realtime roster/chat/submissions.
- Structured Pillars assessment.
- Teacher-only AI synthesis.
- Pillars visual results.
- Demo seed fallback.
