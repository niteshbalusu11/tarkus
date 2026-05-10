import { Link } from '@tanstack/react-router'
import { LogIn, Monitor, Users } from 'lucide-react'
import ClerkHeader from '../integrations/clerk/header-user'
import { Button } from './ui/button'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--charcoal)] no-underline"
        >
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            className="h-9 w-9 rounded-lg"
          />
          <span className="text-base tracking-[0.14em] text-[var(--charcoal)]">
            TARKUS
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <Link
            to="/teacher"
            className="nav-pill"
            activeProps={{ className: 'nav-pill nav-pill-active' }}
          >
            <Monitor className="h-4 w-4" />
            Teacher
          </Link>
          <Link
            to="/join"
            className="nav-pill"
            activeProps={{ className: 'nav-pill nav-pill-active' }}
          >
            <Users className="h-4 w-4" />
            Join
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild className="md:hidden" size="sm" variant="outline">
            <Link to="/join">
              <LogIn className="h-4 w-4" />
              Join
            </Link>
          </Button>
          <ClerkHeader />
        </div>
      </nav>
    </header>
  )
}
