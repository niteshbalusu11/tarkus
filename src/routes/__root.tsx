import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { AccountOnboardingGate } from '../components/AuthGate'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { TooltipProvider } from '../components/ui/tooltip'

import ClerkProvider from '../integrations/clerk/provider'

import ConvexProvider from '../integrations/convex/provider'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var root=document.documentElement;root.classList.remove('dark');root.classList.add('light');root.setAttribute('data-theme','light');root.style.colorScheme='light';window.localStorage.setItem('theme','light');}catch(e){}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TARKUS',
      },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'alternate icon',
        href: '/favicon.ico',
      },
      {
        rel: 'apple-touch-icon',
        href: '/logo192.png',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)]">
        <ClerkProvider>
          <ConvexProvider>
            <TooltipProvider delayDuration={200}>
              <Header />
              <AccountOnboardingGate>{children}</AccountOnboardingGate>
              <Footer />
            </TooltipProvider>
          </ConvexProvider>
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  )
}
