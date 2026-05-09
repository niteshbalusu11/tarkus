# TARKUS Live Mode Product Document

## Context

TARKUS is an AI-assisted training platform for strategic nonviolence trainers. For this hackathon, the product is focused on one thing: helping an in-person trainer understand what is happening across a live class without putting AI in front of students.

The product is not trying to replace the trainer. The trainer remains the human teacher in the room. Students interact with class tools, chat, and structured assessments. AI reads that activity in the background and gives the trainer a concise, useful view of the class.

The hackathon demo is tomorrow, so this document scopes the build to Live Mode only. Prep mode, content library management, post-session knowledge capture, exports, multilingual support, and advanced security are out of scope for now.

## Product Goal

Enable one authenticated teacher to run one live class session where authenticated students join by a short expiring code, participate through chat and a structured Pillars of Support exercise, and generate enough live class data for the teacher dashboard to surface AI-supported synthesis.

The core proof point:

Teacher creates session -> students authenticate -> students enter code -> students chat and complete Pillars exercise -> teacher sees live participation, curated class themes, emotional tone, unclear concepts, recurring questions, and Pillars results.

## Hackathon Success Criteria

The demo succeeds if:

1. A teacher signs in, creates a live session, and receives a short code.
2. Students sign in, enter the code, and join the same session.
3. The teacher sees a live roster of joined students.
4. Students can post chat messages that appear in the shared class chat.
5. Students can complete the structured Pillars exercise.
6. The teacher dashboard updates live with chat and exercise submissions.
7. AI analysis produces useful teacher-only synthesis from actual student activity.
8. The Pillars results are visual and legible enough to impress judges.
9. A demo seeding/simulation path can populate realistic student activity if needed.
10. The product communicates the core advantage over Google Docs plus ChatGPT: structured assessment data, realtime classroom visibility, reusable exercise architecture, and teacher-only AI synthesis.

## Users

### Teacher

The teacher is the primary user. For the hackathon, any signed-in user can act as a teacher. The teacher runs one live in-person class at a time.

Teacher capabilities:

- Sign in.
- Create a live session.
- Receive a short session code.
- See a live roster of students who joined.
- See the class chat stream in a side panel.
- See AI-curated chat synthesis as the primary view.
- See structured Pillars exercise results.
- Delete a session, including associated chat history and submissions.
- Optionally run a demo simulation that inserts realistic students, messages, and Pillars submissions.

Teacher non-goals:

- No slide control.
- No export.
- No grading.
- No multi-class management.
- No student approval flow.
- No direct AI advice to activists.

### Student

The student is a signed-in participant who joins with a short session code. Student identity can be lightweight. A display name may be optional, and the product should avoid forcing unnecessary personal information.

Student capabilities:

- Sign in.
- Enter a short code to join a live session.
- See the live class chat.
- Post text messages or questions.
- Optionally mark a message as anonymous.
- Complete the structured Pillars exercise.
- See their own submitted exercise state.

Student non-goals:

- No AI interaction.
- No AI feedback.
- No teacher dashboard access.
- No file/image uploads.
- No post-session history for now.

## Product Principles

### Human-First, AI-Behind

Students never talk to AI. The AI is a backstage assistant for the teacher. It summarizes, clusters, and highlights what the class is saying so the teacher can make better live facilitation decisions.

### Structured Assessments, Flexible Future

The MVP assessment is Pillars of Support. The product should be modeled so future assessments can include quizzes, rankings, reflections, and other structured activities. Chat is useful, but assessment data should remain structured whenever possible.

### One Session, One Code

For the hackathon, one live session maps to one short code. Codes expire. Students can join directly if they have the code.

### Scannable Teacher View

The teacher is in front of a room and cannot read a wall of text. The dashboard should prioritize concise synthesis, visual results, and class-level patterns over raw chat.

## Live Session Flow

### Teacher Flow

1. Teacher signs in.
2. Teacher clicks "New live session."
3. System creates a session with:
   - short join code
   - expiration timestamp
   - status of active
   - predefined Pillars exercise
4. Teacher shares the code verbally or on screen.
5. Students join.
6. Teacher monitors:
   - live roster
   - AI synthesis
   - recurring questions
   - unclear concepts
   - emotional tone
   - Pillars exercise results
   - curated chat highlights
7. Teacher may respond in chat, though the main expectation is that they speak in person.
8. Teacher can end or delete the session.

### Student Flow

1. Student signs in.
2. Student enters a short session code.
3. If code is valid and not expired, student joins.
4. Student sees:
   - class chat
   - current predefined Pillars exercise
5. Student can post text chat messages.
6. Student can submit structured Pillars responses.
7. Student sees basic confirmation after submission.

## Student Experience

The student interface should feel like a simple live class companion, not a full learning platform.

Primary areas:

- Class chat
- Pillars exercise
- Joined session state

The chat should support:

- Text messages
- Optional anonymity
- Shared visibility to other students
- Clear timestamp/order

The Pillars exercise should support:

- Fixed school-uniform scenario
- Structured input for pillars
- Interactive ordering or ranking of pillars
- Importance and accessibility ratings where needed for the matrix
- Submission and optional editing if easy

Recommended MVP exercise structure:

1. Who has power to change the uniform policy?
2. Add pillars that keep the policy in place.
3. For each pillar, rate:
   - Importance: 1-5
   - Accessibility: 1-5
4. Order which pillars you would approach first.
5. Add a short reflection.

## Teacher Dashboard

The teacher dashboard is the demo centerpiece.

Primary layout:

- Main area: AI synthesis and exercise results.
- Side area: roster and raw chat stream.

Priority order:

1. AI class synthesis
2. Pillars exercise results
3. Participation/roster status
4. Curated chat highlights
5. Raw chat stream

### AI Synthesis Panel

Teacher-only. Stored in Convex for session history during the demo.

Outputs:

- Recurring questions
- Unclear concepts
- Emotional tone / class vibe
- Chat clusters
- Pillars exercise interpretation
- Suggested areas for the teacher to clarify

The AI should not provide tactical advice. Its job is to help the teacher understand the class, not tell students what to do.

### Pillars Results Panel

The Pillars panel should show:

- Number of submitted students
- Commonly identified pillars
- Missing or underrepresented pillar categories, framed as observations
- Importance x Accessibility matrix from structured student ratings
- Aggregate view by pillar
- Common first/second/third approach order
- Reflection themes

For the hackathon, if individual placements are too much, the default should be aggregate clusters. The dashboard can still allow drill-in later.

### Chat Side Panel

The raw chat is secondary. It should be visible, but the teacher should not need to read it line by line.

Useful chat affordances:

- Latest messages
- Anonymous marker if applicable
- AI-highlighted messages or clusters
- Basic teacher reply box

## AI Requirements

### Triggering

AI summaries should run after every N new messages or N new assessment submissions, not continuously against the same unchanged data.

Recommended hackathon behavior:

- Maintain a session-level analysis cursor.
- Trigger AI when at least 3 new chat messages or 1 new Pillars submission has arrived since the last analysis.
- Also allow manual refresh from the teacher dashboard.

### Inputs

AI analysis receives:

- Session metadata
- Current chat messages since last analysis plus recent context
- Current Pillars submissions
- Existing latest summary, if useful
- Pillars exercise framework

### Outputs

Store a structured analysis object:

- `recurringQuestions`: short list
- `unclearConcepts`: short list
- `emotionalTone`: one concise label plus explanation
- `chatClusters`: grouped themes with counts
- `pillarsInsights`: consensus, gaps, matrix interpretation, sequencing patterns
- `teacherBrief`: 3-5 bullets the teacher can scan quickly
- `generatedAt`
- `inputCursor` or equivalent tracking field

### Tone and Safety

The AI should:

- Be concise.
- Speak only to the teacher.
- Avoid grading language.
- Avoid saying students are wrong.
- Avoid prescribing tactics or strategy.
- Use class-level clusters by default, not individual callouts.
- Frame issues as "students may be unclear on..." or "the class seems to be clustering around..."

## Pillars Exercise MVP

Scenario:

You are a high school student. You and your classmates want to change the mandatory uniform policy. You are not going to riot or just complain. You are going to think strategically.

Structured fields:

- `decisionMaker`: free text
- `pillars`: array of:
  - `name`
  - `importance` from 1-5
  - `accessibility` from 1-5
  - `orderRank`, optional
  - `rationale`, optional
- `sequence`: ordered list of pillar names or ids
- `reflection`: free text

Teacher visualizations:

- Pillar frequency list
- Importance x Accessibility matrix
- Aggregate pillar placement
- Sequence summary
- Reflection theme summary

## Demo Simulation

Because the demo depends on live participant input, the product should include a simple simulation path if time allows.

Simulation should:

- Create 8-12 fake student participants.
- Insert realistic chat messages.
- Insert realistic Pillars submissions.
- Trigger AI analysis.

This should not fake the core product. It is a fallback for demo reliability and for showing the dashboard in a full state.

## Data Model Outline

This is a product-level schema outline, not a final backend implementation.

### users

- `clerkUserId`
- `displayName`, optional
- `role`: `teacher` or `student`
- `createdAt`

For hackathon simplicity, role can be inferred from route/action rather than enforced with complex permissions.

### sessions

- `teacherId`
- `code`
- `status`: `active`, `ended`, `deleted`
- `expiresAt`
- `createdAt`
- `endedAt`, optional
- `deletedAt`, optional
- `title`, optional

Indexes:

- by `code`
- by `teacherId`
- by `status`

### sessionParticipants

- `sessionId`
- `userId`
- `displayName`, optional
- `joinedAt`
- `lastSeenAt`, optional

Indexes:

- by `sessionId`
- by `userId`
- by `sessionId + userId`

### chatMessages

- `sessionId`
- `userId`
- `body`
- `isAnonymous`
- `createdAt`
- `deletedAt`, optional

Indexes:

- by `sessionId + createdAt`

### activities

- `sessionId`
- `type`: `pillars`
- `title`
- `status`: `open`, `closed`
- `config`
- `createdAt`

For hackathon, each session can create one predefined Pillars activity automatically.

### activitySubmissions

- `sessionId`
- `activityId`
- `userId`
- `type`: `pillars`
- `payload`
- `submittedAt`
- `updatedAt`

For Pillars, `payload` contains `decisionMaker`, `pillars`, `sequence`, and `reflection`.

Indexes:

- by `sessionId`
- by `activityId`
- by `activityId + userId`

### aiAnalyses

- `sessionId`
- `kind`: `live_summary`, `pillars_summary`
- `inputCursor`
- `output`
- `createdAt`

Indexes:

- by `sessionId + createdAt`
- by `sessionId + kind`

## Out of Scope

- Prep Mode
- Slide control
- Full knowledge library
- Post-session export
- Multi-session programs
- Student grading
- Student-facing AI
- File/image upload
- Audio/video capture
- Translation
- Teacher invite-only access
- Admin moderation
- Advanced encryption work
- Long-term retention settings

## Open Decisions

1. Whether "role" should be explicitly selected during onboarding or inferred from the route used first.
2. Whether students can edit Pillars submissions after submitting.
3. Whether the matrix should show individual dots, aggregate dots, or both for the demo.
4. Whether demo simulation should be visible only to teachers or hidden behind a development flag.
5. Which OpenRouter model to use for the hackathon.

## Recommended Build Order

1. Auth-gated teacher and student routes.
2. Session create/join with short expiring code.
3. Realtime roster and chat.
4. Structured Pillars exercise submission.
5. Teacher dashboard layout.
6. Pillars matrix and aggregate result widgets.
7. AI analysis action and stored summaries.
8. Demo simulation.
9. Visual polish and pitch-flow cleanup.
