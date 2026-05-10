import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Maximize2,
  Minimize2,
  MonitorPlay,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import AuthGate from '../components/AuthGate'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/presentation/$presentationId/view')({
  component: ReadonlyPresentationRoute,
})

type SlideKind = 'title' | 'concept' | 'discussion' | 'activity' | 'summary'

type PreviewSlide = {
  type: SlideKind
  title: string
  bullets: Array<string>
  speakerNotes: string
  imageFileName?: string
}

type PreviewSlideSpec = {
  title: string
  slides: Array<PreviewSlide>
}

const fallbackSlideSpec: PreviewSlideSpec = {
  title: 'Presentation unavailable',
  slides: [
    {
      type: 'title',
      title: 'Presentation unavailable',
      bullets: ['This deck does not have a readable slide preview yet.'],
      speakerNotes: '',
    },
  ],
}

function ReadonlyPresentationRoute() {
  return (
    <AuthGate title="Sign in to view slides">
      <ReadonlyPresentation />
    </AuthGate>
  )
}

function ReadonlyPresentation() {
  const { presentationId } = Route.useParams()
  const typedPresentationId = presentationId as Id<'presentations'>
  const presentation = useQuery(api.prep.getReadonlyPresentation, {
    presentationId: typedPresentationId,
  })
  const presenterRef = useRef<HTMLDivElement | null>(null)
  const [slideIndex, setSlideIndex] = useState(() => getInitialSlideIndex())
  const [showNotes, setShowNotes] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const slideSpec = useMemo(
    () => normalizeSlideSpec(presentation?.slideSpec),
    [presentation?.slideSpec],
  )
  const imageUrlByFileName = useMemo(
    () =>
      new Map(
        presentation?.imageUrls.map((image) => [image.fileName, image.url]) ||
          [],
      ),
    [presentation?.imageUrls],
  )
  const currentSlideIndex = clamp(slideIndex, 0, slideSpec.slides.length - 1)
  const currentSlide = slideSpec.slides[currentSlideIndex]

  const goToSlide = useCallback(
    (nextIndex: number) => {
      setSlideIndex(clamp(nextIndex, 0, slideSpec.slides.length - 1))
    },
    [slideSpec.slides.length],
  )

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await presenterRef.current?.requestFullscreen()
  }, [])

  useEffect(() => {
    setSlideIndex((current) => clamp(current, 0, slideSpec.slides.length - 1))
  }, [slideSpec.slides.length])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('slide', String(currentSlideIndex + 1))
    window.history.replaceState(null, '', url)
  }, [currentSlideIndex])

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === presenterRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return
      if (
        event.key === 'ArrowRight' ||
        event.key === 'PageDown' ||
        event.key === ' '
      ) {
        event.preventDefault()
        goToSlide(currentSlideIndex + 1)
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        goToSlide(currentSlideIndex - 1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        goToSlide(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        goToSlide(slideSpec.slides.length - 1)
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setShowNotes((current) => !current)
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        void toggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSlideIndex, goToSlide, slideSpec.slides.length, toggleFullscreen])

  if (presentation === undefined) {
    return (
      <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[var(--warm-paper)] px-4 text-sm text-[var(--charcoal-muted)]">
        Loading slides...
      </main>
    )
  }

  if (presentation.status !== 'ready') {
    return (
      <main className="min-h-[calc(100vh-8rem)] bg-[var(--warm-paper)] px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <Alert className="border-[var(--line)] bg-[var(--surface)]">
            <MonitorPlay className="h-4 w-4" />
            <AlertTitle>Slides unavailable</AlertTitle>
            <AlertDescription>
              This presentation is not ready to view.
            </AlertDescription>
          </Alert>
        </div>
      </main>
    )
  }

  return (
    <main className="overflow-x-hidden bg-[var(--warm-paper)] px-3 py-4 sm:px-5">
      <div
        ref={presenterRef}
        className="flex min-h-[calc(100vh-9rem)] w-full flex-col gap-3 bg-[var(--warm-paper)] text-[var(--charcoal)] fullscreen:h-screen fullscreen:max-w-none fullscreen:bg-[#141414] fullscreen:p-4"
      >
        <header className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 shadow-[0_10px_30px_rgba(28,28,28,0.06)] fullscreen:border-[#303030] fullscreen:bg-[#202020] fullscreen:text-[#faf9f6]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold">
                {presentation.sessionTitle || slideSpec.title}
              </p>
              {presentation.isPublished ? (
                <Badge variant="secondary" className="shrink-0">
                  Final
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-xs text-[var(--charcoal-muted)] fullscreen:text-[#c9c2b5]">
              {presentation.fileName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              aria-label="Previous slide"
              disabled={currentSlideIndex === 0}
              onClick={() => goToSlide(currentSlideIndex - 1)}
              size="icon"
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-16 text-center text-sm font-semibold tabular-nums">
              {currentSlideIndex + 1} / {slideSpec.slides.length}
            </span>
            <Button
              aria-label="Next slide"
              disabled={currentSlideIndex === slideSpec.slides.length - 1}
              onClick={() => goToSlide(currentSlideIndex + 1)}
              size="icon"
              variant="outline"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              aria-label={
                showNotes ? 'Hide speaker notes' : 'Show speaker notes'
              }
              onClick={() => setShowNotes((current) => !current)}
              size="icon"
              variant="outline"
            >
              {showNotes ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>
            {presentation.downloadUrl ? (
              <Button asChild aria-label="Download slides" size="icon" variant="outline">
                <a href={presentation.downloadUrl} download={presentation.fileName}>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
            <Button
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              onClick={() => void toggleFullscreen()}
              size="icon"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </header>

        <div className="relative flex flex-1 items-center justify-center">
          <SlideFrame
            imageUrl={
              currentSlide.imageFileName
                ? imageUrlByFileName.get(currentSlide.imageFileName)
                : undefined
            }
            slide={currentSlide}
            slideIndex={currentSlideIndex}
          />
          {showNotes ? (
            <aside className="absolute right-0 top-0 z-20 max-h-[45vh] w-full max-w-sm overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm leading-6 text-[var(--charcoal)] shadow-[0_14px_40px_rgba(28,28,28,0.12)] fullscreen:border-[#303030] fullscreen:bg-[#202020] fullscreen:text-[#faf9f6]">
              <h2 className="text-xs font-bold uppercase text-[var(--amber-deep)] fullscreen:text-[#f2dfad]">
                Speaker Notes
              </h2>
              <p className="mt-3 whitespace-pre-wrap">
                {currentSlide.speakerNotes || 'No notes for this slide.'}
              </p>
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  )
}

function SlideFrame({
  imageUrl,
  slide,
  slideIndex,
}: {
  imageUrl?: string
  slide: PreviewSlide
  slideIndex: number
}) {
  const isTitle = slideIndex === 0 || slide.type === 'title'
  const bullets = slide.bullets.slice(0, 5)

  return (
    <section className="flex min-h-0 w-full items-center justify-center">
      <div
        className={[
          'relative aspect-video w-full max-w-6xl overflow-hidden rounded-lg shadow-[0_20px_60px_rgba(28,28,28,0.18)]',
          isTitle
            ? 'bg-[#1c1c1c] text-[#faf9f6]'
            : 'bg-[#faf9f6] text-[#1c1c1c]',
        ].join(' ')}
      >
        <div className="absolute inset-x-0 top-0 px-[4.2%] pt-[2.8%]">
          <div className="flex items-center justify-between">
            <p
              className={[
                'text-xs font-bold uppercase sm:text-sm',
                isTitle ? 'text-[#f2dfad]' : 'text-[#93660e]',
              ].join(' ')}
            >
              TARKUS
            </p>
            {!isTitle ? (
              <p className="text-xs font-bold text-[#93660e] tabular-nums sm:text-sm">
                {String(slideIndex + 1).padStart(2, '0')}
              </p>
            ) : null}
          </div>
          <div
            className={[
              'mt-[2%] h-px w-full',
              isTitle ? 'bg-[#c9921a]' : 'bg-[#d8cbb3]',
            ].join(' ')}
          />
        </div>

        <div
          className={[
            'absolute inset-x-[5.6%]',
            isTitle ? 'top-[20%]' : 'top-[15%]',
          ].join(' ')}
        >
          <div
            className={
              imageUrl && !isTitle
                ? 'grid items-start gap-[5%] md:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)]'
                : ''
            }
          >
            <div className="min-w-0">
              <h1
                className={[
                  'max-w-full text-balance font-serif font-bold leading-[1.05]',
                  isTitle
                    ? 'text-4xl sm:text-5xl lg:text-6xl'
                    : 'text-3xl sm:text-4xl lg:text-5xl',
                ].join(' ')}
              >
                {slide.title}
              </h1>
              <ul
                className={[
                  'mt-[7%] space-y-[2.4%] leading-snug',
                  isTitle
                    ? 'text-lg text-[#f8ebcd] sm:text-xl lg:text-2xl'
                    : 'text-base text-[#3d382f] sm:text-lg lg:text-xl',
                ].join(' ')}
              >
                {(bullets.length
                  ? bullets
                  : [
                      'Use this moment to connect the source material to the room.',
                    ]
                ).map((bullet) => (
                  <li className="flex gap-[0.7em]" key={bullet}>
                    <span aria-hidden="true">-</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            {imageUrl && !isTitle ? (
              <figure className="hidden min-w-0 md:block">
                <img
                  alt=""
                  className="aspect-[5/4] w-full rounded-md object-cover"
                  src={imageUrl}
                />
                <figcaption className="mt-2 truncate text-xs text-[#756d60]">
                  {slide.imageFileName}
                </figcaption>
              </figure>
            ) : null}
          </div>
        </div>

        <div
          className={[
            'absolute inset-x-0 bottom-0 h-[6.6%]',
            isTitle ? 'bg-[#c9921a]' : 'bg-[#f2dfad]',
          ].join(' ')}
        />
      </div>
    </section>
  )
}

function normalizeSlideSpec(value: unknown): PreviewSlideSpec {
  const candidate = value as Partial<PreviewSlideSpec> | null
  if (!candidate || typeof candidate !== 'object') return fallbackSlideSpec
  const slides = Array.isArray(candidate.slides)
    ? candidate.slides
        .map((slide) => {
          const item = slide as Partial<PreviewSlide>
          const title = typeof item.title === 'string' ? item.title.trim() : ''
          if (!title) return null
          return {
            type: normalizeSlideType(item.type),
            title,
            bullets: Array.isArray(item.bullets)
              ? item.bullets.filter(
                  (bullet): bullet is string => typeof bullet === 'string',
                )
              : [],
            speakerNotes:
              typeof item.speakerNotes === 'string' ? item.speakerNotes : '',
            imageFileName:
              typeof item.imageFileName === 'string'
                ? item.imageFileName
                : undefined,
          }
        })
        .filter((slide): slide is PreviewSlide => slide !== null)
    : []

  return {
    title:
      typeof candidate.title === 'string' && candidate.title.trim()
        ? candidate.title.trim()
        : fallbackSlideSpec.title,
    slides: slides.length ? slides : fallbackSlideSpec.slides,
  }
}

function normalizeSlideType(value: unknown): SlideKind {
  if (
    value === 'title' ||
    value === 'concept' ||
    value === 'discussion' ||
    value === 'activity' ||
    value === 'summary'
  ) {
    return value
  }
  return 'concept'
}

function getInitialSlideIndex() {
  if (typeof window === 'undefined') return 0
  const slideParam = Number(
    new URLSearchParams(window.location.search).get('slide'),
  )
  return Number.isFinite(slideParam)
    ? Math.max(0, Math.floor(slideParam) - 1)
    : 0
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}
