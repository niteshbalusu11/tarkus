import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/teacher/prep')({
  component: TeacherPrepRedirect,
})

function TeacherPrepRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    void navigate({ to: '/teacher', replace: true })
  }, [navigate])

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[var(--background)] px-4 text-sm text-muted-foreground">
      Opening the teacher dashboard...
    </main>
  )
}
