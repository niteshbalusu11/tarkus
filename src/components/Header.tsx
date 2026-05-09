import { Link } from '@tanstack/react-router'
import { Activity, LogIn, Monitor, Users } from 'lucide-react'
import ClerkHeader from '../integrations/clerk/header-user'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/88 px-4 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-950 no-underline"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white">
            <Activity className="h-4 w-4" />
          </span>
          <span className="text-base tracking-[0.14em]">TARKUS</span>
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
          <Link to="/join" className="mobile-join">
            <LogIn className="h-4 w-4" />
            Join
          </Link>
          <ClerkHeader />
        </div>
      </nav>
    </header>
  )
}
