<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# TARKUS Agent Notes

TARKUS is a hackathon MVP for live, in-person strategic nonviolence training.
The current product focus is Live Mode: teachers create one active class session,
students join with a short code, students chat and complete a structured Pillars
of Support exercise, and the teacher dashboard shows real-time class signals plus
AI synthesis.

## Tech Stack

- React 19 with Vite, TanStack Router, and TanStack Start.
- Tailwind CSS v4 for styling.
- Convex for the backend, real-time queries, mutations, actions, and data schema.
- Clerk for authentication. Students and teachers must authenticate before using
  live sessions.
- OpenRouter for teacher-only AI synthesis.
- Vitest for unit tests.

## Important Files

- `src/routes/index.tsx`: app entry screen.
- `src/routes/teacher.tsx`: teacher dashboard, session controls, live class view,
  AI panels, chat stream, roster, and Pillars results.
- `src/routes/join.tsx`: authenticated student join flow with short class codes.
- `src/routes/student/$sessionId.tsx`: student live class view with chat and the
  Pillars exercise.
- `src/components/AuthGate.tsx`: Clerk and Convex auth readiness gate.
  Also owns the required post-signup onboarding UI and route-level role gate.
- `src/integrations/convex/provider.tsx`: Convex client and Clerk token bridge.
- `src/lib/tarkus.ts`: shared Pillars and AI-output normalization helpers.
- `convex/schema.ts`: source of truth for Convex tables and indexes.
- `convex/users.ts`: Convex-backed user profile, display name, and immutable
  student/teacher account role.
- `convex/sessions.ts`: session, participant, chat, assessment, and AI backend
  functions.
- `tests/convex/sessions.test.ts`: Convex auth/session behavior tests using
  `convex-test`.
- `tests/convex/test.setup.ts`: Convex module glob for `convex-test`.
- `tests/unit/auth.test.ts`: unit tests for auth-adjacent frontend helpers.
- `convex/auth.config.ts`: Convex auth provider configuration for Clerk JWTs.
- `vitest.config.ts`: Vitest projects for Convex edge-runtime tests and pure
  frontend/unit tests.
- `.env.local`: local Convex, Clerk, and OpenRouter configuration.

## Engineering Rules

- For any Convex change, read `convex/_generated/ai/guidelines.md` first.
- Do not bypass authentication or trust client-provided user identifiers.
  Derive identity with `ctx.auth.getUserIdentity()` and use
  `identity.tokenIdentifier` for ownership and access checks.
- Student-visible names should come from the session participant record once the
  student has joined a class. Do not re-derive names from token claims in chat or
  assessment writes.
- Account type is not a client-side preference. Use the Convex `users` profile
  role for server-side authorization, and keep student-only and teacher-only
  functions separated by backend checks.
- Keep AI teacher-only for now. AI should synthesize, cluster, and summarize
  class signals; it should not give direct advice to students.
- Prefer small, testable helpers over one-off logic buried inside route
  components.
- No demo-only shortcuts in production paths. If something is seeded or mocked,
  make that explicit in the function and UI.
- Code that touches auth, session access, class joining, deletion, or participant
  visibility needs unit tests or a clear reason why it cannot be unit-tested.

## Commands

- `bun --bun run dev`: start the local app on port 3000.
- `npx convex dev`: run Convex locally against the configured deployment.
- `npx convex codegen`: generate Convex bindings and typecheck Convex functions.
- `bun --bun run test`: run unit tests.
- `bun --bun run lint`: run ESLint.
- `bun --bun run build`: run the production build.
