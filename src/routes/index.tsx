import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpen,
  KeyRound,
  MessageSquareText,
  Monitor,
  Radio,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/')({ component: App })

const leaders = [
  {
    name: 'Mahatma Gandhi',
    role: 'Mass civil resistance',
    quote: 'Nonviolence is a weapon of the strong.',
    image: '/home/gandhi-spinning-wheel.jpg',
    className: 'leader-tile leader-tile-large',
  },
  {
    name: 'Martin Luther King Jr.',
    role: 'Beloved community',
    quote: 'Nonviolence is a powerful and just weapon.',
    image: '/home/martin-luther-king-jr.jpg',
    className: 'leader-tile',
  },
  {
    name: 'Bayard Rustin',
    role: 'Movement strategy',
    quote: 'We need a group of angelic troublemakers.',
    image: '/home/bayard-rustin.jpg',
    className: 'leader-tile',
  },
]

const classroomSignals = [
  'Who holds formal authority?',
  'Which groups enforce the rule daily?',
  'Where can support shift without escalation?',
]

const trainingSteps = [
  {
    icon: Radio,
    label: 'Start a live room',
    text: 'Teachers open one active session and students enter with a short code.',
  },
  {
    icon: UsersRound,
    label: 'Map the pillars',
    text: 'Students name institutions, norms, incentives, and pressure points together.',
  },
  {
    icon: ShieldCheck,
    label: 'Keep AI teacher-side',
    text: 'TARKUS clusters the class signal into a brief the trainer can use in the room.',
  },
]

function App() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy rise-in">
          <p className="home-kicker">Strategic nonviolence training</p>
          <h1>
            TARKUS
            <span>Practice power before the room gets loud.</span>
          </h1>
          <p className="home-deck">
            A live classroom surface for teachers running Pillars of Support
            exercises: short-code entry, student chat, real-time class signals,
            and teacher-only AI synthesis.
          </p>
          <div className="home-actions" aria-label="Primary actions">
            <Button asChild size="lg" className="home-primary-action">
              <Link to="/teacher">
                <Monitor className="h-4 w-4" />
                Open teacher room
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="home-secondary-action"
            >
              <Link to="/join">
                <KeyRound className="h-4 w-4" />
                Join with code
              </Link>
            </Button>
          </div>
        </div>

        <div className="movement-wall rise-in" aria-label="Nonviolence leaders">
          {leaders.map((leader) => (
            <figure className={leader.className} key={leader.name}>
              <img src={leader.image} alt={`${leader.name} portrait`} />
              <figcaption>
                <span>{leader.role}</span>
                <strong>{leader.name}</strong>
                <q>{leader.quote}</q>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="home-method" aria-labelledby="home-method-title">
        <div className="home-section-copy">
          <p className="home-kicker">Live room method</p>
          <h2 id="home-method-title">
            Built for practice, not a lecture deck.
          </h2>
        </div>
        <div className="training-steps">
          {trainingSteps.map((step) => {
            const Icon = step.icon
            return (
              <article className="training-step" key={step.label}>
                <Icon className="h-5 w-5" />
                <h3>{step.label}</h3>
                <p>{step.text}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="home-signal-room" aria-label="Class signal preview">
        <div className="signal-board">
          <div className="signal-board-header">
            <span>Classroom active</span>
            <strong>School uniform policy</strong>
          </div>
          <div className="signal-chat">
            <p>
              <MessageSquareText className="h-4 w-4" />
              Students are separating formal authority from daily enforcement.
            </p>
            <p>
              <BookOpen className="h-4 w-4" />
              Recurring question: what counts as a pillar?
            </p>
          </div>
          <ul>
            {classroomSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </div>

        <div className="signal-copy">
          <p className="home-kicker">Teacher synthesis</p>
          <h2>Classroom energy becomes a usable read of the room.</h2>
          <p>
            The teacher stays in front. TARKUS quietly organizes what students
            are seeing into patterns, gaps, and next prompts.
          </p>
          <Button asChild variant="outline" className="home-link-action">
            <Link to="/teacher">
              See the dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="home-closing">
        <div>
          <p className="home-kicker">Ready for class</p>
          <h2>Open a room, invite students, and train strategy live.</h2>
        </div>
        <div className="home-actions">
          <Button asChild size="lg" className="home-primary-action">
            <Link to="/teacher">
              <Monitor className="h-4 w-4" />
              Teacher dashboard
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="home-secondary-action"
          >
            <Link to="/join">
              <KeyRound className="h-4 w-4" />
              Student join
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
