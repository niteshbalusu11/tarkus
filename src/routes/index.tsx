import { Link, createFileRoute } from '@tanstack/react-router'
import { KeyRound, Monitor } from 'lucide-react'
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

function App() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy rise-in">
          <p className="home-kicker">Strategic nonviolence training</p>
          <h1>
            TARKUS
            <span>Learn the science of nonviolence.</span>
          </h1>
          <p className="home-deck">
            A live classroom space for students to join, think together, and
            practice how organized people create change.
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
    </main>
  )
}
