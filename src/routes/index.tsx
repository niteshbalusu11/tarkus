import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, KeyRound, Monitor } from 'lucide-react'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy rise-in">
          <p className="home-kicker">Live training room</p>
          <h1>TARKUS</h1>
          <p className="home-deck">
            A teacher-run classroom surface for strategic nonviolence training:
            short-code entry, structured Pillars work, live class signals, and
            teacher-only AI synthesis.
          </p>
          <div className="home-actions">
            <Button asChild size="lg">
              <Link to="/teacher">
                <Monitor className="h-4 w-4" />
                Teacher dashboard
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/join">
                <KeyRound className="h-4 w-4" />
                Join class
              </Link>
            </Button>
          </div>
        </div>

        <div
          className="archive-panel rise-in"
          aria-label="TARKUS live session preview"
        >
          <div className="archive-strip">
            <span>Class room active</span>
            <span>Code expires 6h</span>
          </div>
          <div className="archive-frame">
            <div className="archive-photo">
              <div className="photo-grain" />
              <div className="photo-caption">
                <span>Pillars exercise</span>
                <strong>School uniform policy</strong>
              </div>
            </div>
            <div className="archive-brief">
              <p>Teacher brief</p>
              <strong>
                Students are separating formal authority from daily enforcement.
              </strong>
              <span>Recurring question: what counts as a pillar?</span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-working-surface">
        <div>
          <p className="home-kicker">Working surface</p>
          <h2>Human trainer in front. AI synthesis behind.</h2>
        </div>
        <Button asChild variant="outline">
          <Link to="/teacher">
            Open dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>
    </main>
  )
}
