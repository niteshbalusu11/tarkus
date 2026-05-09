# TARKUS Hackathon Engineering Plan

## Objective

Build the Live Mode MVP for tomorrow's hackathon demo:

Teacher signs in -> creates a live session -> gets a short expiring code -> students sign in and join with the code -> students chat and complete the structured Pillars exercise -> teacher dashboard updates live with roster, chat, exercise results, and teacher-only AI synthesis.

## Current Repo Baseline

- App: Vite + React + TanStack Router.
- Styling: Tailwind CSS.
- Auth dependency: Clerk is installed and root provider is wired.
- Backend: Convex is installed and root provider is wired.
- AI implementation: Convex action calls OpenRouter directly; unused TanStack AI demo packages have been removed.
- Starter/demo routes have been removed from the production app surface.
- Convex schema now contains the Live Mode data model.

## Execution Principles

- Build the full demo loop before polishing individual screens.
- Keep AI behind the teacher only.
- Keep Pillars structured; do not treat the assessment as raw chat.
- Make the dashboard scannable in under 5 seconds.
- Store AI summaries in Convex so the teacher view updates like the rest of the app.
- Prefer simple Convex functions and React views over adding abstraction.
- Use demo simulation as reliability support, not as a fake replacement for live functionality.

## Phase 0: Setup And Guardrails

- [x] Run `npx convex ai-files install` to add/refresh official Convex AI guidance for this repo.
- [x] Confirm `.env.local` has `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CONVEX_URL`, and `CONVEX_DEPLOYMENT`.
- [x] Add an OpenRouter server-side env var, likely `OPENROUTER_API_KEY`.
- [x] Decide the model string for MVP, preferably a cheap frontier-lab model available through OpenRouter.
- [x] Confirm the app boots with `bun --bun run dev`.
- [ ] Confirm Convex dev server works with `bunx --bun convex dev`.
- [x] Remove or hide distracting TanStack starter/demo navigation from the production demo surface.

Acceptance:

- [x] Local app runs.
- [x] Convex functions compile.
- [x] Clerk sign-in works.
- [x] No demo boilerplate is prominent on the main route.

## Phase 1: Routes And App Shell

Create a minimal product shell with three core entry points:

- `/` landing/control entry
- `/teacher` teacher dashboard/session creation
- `/join` student join flow

Todos:

- [x] Update app metadata/title to TARKUS.
- [x] Replace starter home page with a simple TARKUS entry page.
- [x] Add auth-gated teacher route.
- [x] Add auth-gated student join route.
- [x] Add route for joined student session, likely `/session/$sessionCode` or `/student/$sessionId`.
- [x] Keep teacher/student experiences in one app with role-by-route for speed.
- [x] Add post-signup onboarding for display name and account type.
- [x] Add route-level account role gates for teacher and student surfaces.
- [x] Add mobile-first layout for student route.
- [x] Add desktop dashboard layout for teacher route.

Acceptance:

- [x] Signed-out users are prompted to sign in before teacher or student actions.
- [x] Signed-in users without onboarding complete setup before protected routes render.
- [x] Wrong-role users see a blocked page instead of the other account surface.
- [x] Signed-in user can reach teacher flow.
- [x] Signed-in user can reach join flow.

## Phase 2: Convex Schema

Replace demo schema with the live-mode data model.

Tables:

- `sessions`
- `sessionParticipants`
- `chatMessages`
- `activities`
- `activitySubmissions`
- `aiAnalyses`
- `users`

Todos:

- [x] Define `sessions` with `teacherTokenIdentifier`, `code`, `status`, `expiresAt`, `createdAt`, optional `endedAt`, optional `deletedAt`, optional `title`.
- [x] Define `sessionParticipants` with `sessionId`, `studentTokenIdentifier`, optional `displayName`, `joinedAt`, optional `lastSeenAt`.
- [x] Define `chatMessages` with `sessionId`, `authorTokenIdentifier`, `authorRole`, optional `displayName`, `body`, `isAnonymous`, `createdAt`, optional `deletedAt`.
- [x] Define `activities` with `sessionId`, `type`, `title`, `status`, `config`, `createdAt`.
- [x] Define `activitySubmissions` with `sessionId`, `activityId`, `studentTokenIdentifier`, `type`, `payload`, `submittedAt`, `updatedAt`.
- [x] Define `aiAnalyses` with `sessionId`, `kind`, `inputCursor`, `output`, `createdAt`.
- [x] Define `users` with `tokenIdentifier`, `displayName`, immutable `role`, `createdAt`, and `updatedAt`.
- [x] Add indexes for code lookup, teacher sessions, session participants, session messages by time, activity submissions, and latest analyses.

Acceptance:

- [x] Schema compiles.
- [x] Generated Convex API updates cleanly.
- [x] Tables support all required demo queries without client-side scanning across unrelated sessions.

## Phase 3: Backend Functions

Build Convex functions with server-side auth checks.

Session functions:

- [x] `createSession`: authenticated teacher creates active session, random short code, expiration, and predefined Pillars activity.
- [x] `getTeacherSession`: authenticated teacher fetches a session they own.
- [x] `listMyTeacherSessions`: optional, for returning to recent sessions.
- [x] `joinSessionByCode`: authenticated student joins an active, unexpired session by code.
- [x] `getStudentSession`: authenticated participant fetches joined session.
- [x] `endSession`: teacher ends session.
- [x] `deleteSession`: teacher soft-deletes session and associated visible data.

Realtime read functions:

- [x] `listParticipants`.
- [x] `listMessages`.
- [x] `listActivitySubmissions`.
- [x] `getLatestAnalysis`.
- [ ] `getSessionOverview` if useful to reduce frontend wiring.

Mutation functions:

- [x] `sendMessage`.
- [x] `submitPillarsExercise`.
- [x] `updatePillarsExercise` if easy.
- [x] `seedDemoSession`.

Authorization rules:

- [x] All functions use `ctx.auth.getUserIdentity()`.
- [x] Teacher-only functions verify session ownership.
- [x] Student functions verify participant membership.
- [x] Join function verifies code status and expiration.
- [x] Deleted sessions are not joinable.
- [x] Teacher functions require a Convex `teacher` account profile.
- [x] Student join/session/activity functions require a Convex `student` account profile.

Acceptance:

- [x] Teacher cannot read or delete someone else's session.
- [x] Student cannot join expired code.
- [x] Student cannot post to a session they have not joined.
- [x] Student account cannot create teacher sessions.
- [x] Teacher account cannot join sessions as a student.
- [x] Realtime queries update without refresh.

## Phase 4: Student Experience

Build the student live class companion.

Todos:

- [x] Join page with short code input.
- [x] Joined session page with class title/status.
- [x] Shared class chat.
- [x] Message composer with optional anonymous toggle.
- [x] Pillars exercise panel using the fixed school-uniform scenario.
- [x] Decision-maker text input.
- [x] Pillar add/edit/remove UI.
- [x] Importance and accessibility controls for each pillar.
- [x] Ordering/ranking UI; if drag-and-drop is slow, use up/down buttons or rank selectors.
- [x] Reflection input.
- [x] Submit button and submitted state.
- [ ] Mobile viewport check.

Acceptance:

- [ ] Student can join on phone-width viewport.
- [x] Student can post chat message.
- [x] Student can submit Pillars assessment.
- [x] Student never sees AI output.

## Phase 5: Teacher Dashboard

Build the main demo surface.

Todos:

- [x] Teacher dashboard empty state with "New live session."
- [x] Active session header with short code, expiration, participant count, and status.
- [x] Live roster.
- [x] Raw chat side panel.
- [x] Curated/high-signal chat section from latest AI analysis.
- [x] AI synthesis panel with teacher brief, recurring questions, unclear concepts, emotional tone, and chat clusters.
- [x] Pillars results panel.
- [x] Pillar frequency list.
- [x] Importance x Accessibility matrix.
- [x] Sequence summary.
- [x] Reflection themes.
- [x] Manual "Refresh AI" action.
- [x] "Seed demo data" action.
- [x] End/delete session actions.

Acceptance:

- [x] Teacher can understand class state at a glance.
- [x] Live messages and submissions appear without manual refresh.
- [x] Pillars results look materially better than a spreadsheet.
- [x] Dashboard remains usable with 8-12 simulated students.

## Phase 6: AI Analysis

Use a simple server-side Convex action calling OpenRouter.

Todos:

- [x] Add AI prompt/spec file or constants for Live Mode.
- [x] Add OpenRouter action that accepts session id and produces structured JSON.
- [x] Include current chat, current Pillars submissions, and previous analysis if useful.
- [x] Require concise teacher-only output.
- [x] Return fields matching the dashboard:
  - `teacherBrief`
  - `recurringQuestions`
  - `unclearConcepts`
  - `emotionalTone`
  - `chatClusters`
  - `pillarsInsights`
- [x] Store output in `aiAnalyses`.
- [x] Add manual refresh trigger from teacher dashboard.
- [ ] Add lightweight auto-trigger after enough new data arrives, if time allows.
- [x] Handle API failure gracefully with a dashboard error state.

Prompt constraints:

- [x] No student-facing language.
- [x] No grading.
- [x] No tactical advice.
- [x] Class-level clusters by default.
- [x] Brief, scannable bullets.

Acceptance:

- [x] AI output references actual messages/submissions.
- [x] AI does not prescribe what activists should do.
- [x] AI output is short enough to read live.
- [x] Failed AI call does not break the dashboard.

## Phase 7: Demo Simulation

Add a reliable fallback that fills the dashboard with plausible data.

Todos:

- [x] Create 8-12 simulated participants.
- [x] Insert varied chat messages with recurring questions and confusion patterns.
- [x] Insert structured Pillars submissions with varied importance/accessibility ratings.
- [x] Include enough variation to make the matrix and AI clusters interesting.
- [x] Trigger AI analysis after seed.
- [x] Make the control teacher-only.

Acceptance:

- [x] One click can populate a session.
- [x] Seed data looks realistic.
- [x] Demo still works with real student input after seeding.

## Phase 8: Visual Polish

Make the app look credible for judges.

Todos:

- [x] Replace starter branding with TARKUS.
- [x] Use a restrained operational dashboard style.
- [ ] Ensure teacher dashboard fits key panels above the fold on laptop.
- [ ] Ensure student UI works on mobile.
- [x] Add strong visual hierarchy for AI brief and matrix.
- [x] Use lucide icons for actions/status.
- [x] Remove unrelated demo components and links from visible navigation.
- [x] Avoid overbuilt marketing sections.

Acceptance:

- [x] First screen communicates live classroom product, not a starter app.
- [ ] No text overlaps at mobile or laptop widths.
- [x] Dashboard has a polished, judge-ready look.

## Phase 9: Verification

Run through the pitch path end to end.

Todos:

- [x] Run typecheck/build.
- [x] Run lint if time permits.
- [ ] Start app and Convex dev server.
- [x] Verify teacher sign-in.
- [ ] Verify student sign-in in separate browser/session.
- [x] Create session.
- [x] Join by code.
- [x] Send chat.
- [x] Submit Pillars assessment.
- [x] Confirm realtime teacher updates.
- [x] Trigger AI analysis.
- [x] Seed demo session.
- [x] Delete session.
- [ ] Test mobile viewport for student route.
- [ ] Test laptop viewport for teacher dashboard.

Acceptance:

- [ ] The live demo can be completed in under 3 minutes.
- [x] Core flow works without page reloads.
- [x] There is a fallback seeded path if audience participation is thin.

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
