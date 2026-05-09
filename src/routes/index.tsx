import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  Monitor,
  Users,
} from 'lucide-react'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <main className="min-h-[calc(100vh-8rem)] bg-slate-50 px-4 py-8">
      <section className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
              Live mode
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              TARKUS training room
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Start a class, share the code, collect structured Pillars
              responses, and review the teacher-only synthesis dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/teacher" className="primary-action">
              <Monitor className="h-4 w-4" />
              Teacher dashboard
            </Link>
            <Link to="/join" className="secondary-action">
              <KeyRound className="h-4 w-4" />
              Join class
            </Link>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
                <ClipboardList className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Demo flow
                </h2>
                <p className="text-sm text-slate-500">
                  Use this order during the live presentation.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                'Teacher signs in and creates one live session.',
                'Students sign in, enter the short code, and join.',
                'Students chat and submit the Pillars assessment.',
                'Teacher seeds demo data if the room is light on participants.',
                'Teacher refreshes AI and uses the dashboard to debrief.',
              ].map((item, index) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-xl bg-slate-50 px-3 py-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  What is active in this build
                </h2>
                <p className="text-sm text-slate-500">
                  Focused on the in-person live class, not prep mode.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                'Clerk auth for teachers and students',
                'Short expiring session codes',
                'Convex realtime roster and chat',
                'Structured Pillars assessment',
                'Teacher-only AI synthesis',
                'Demo data seeding for reliability',
              ].map((item) => (
                <div
                  key={item}
                  className="flex min-h-16 items-start gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                  <span className="text-sm leading-6 text-slate-700">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-slate-950 p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">
                Current exercise
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                Pillars of Support using the school uniform scenario. Students
                identify pillars, rate importance and accessibility, order an
                approach, and submit a short reflection.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-4 flex justify-end">
          <Link to="/teacher" className="secondary-action">
            Open working surface
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}
