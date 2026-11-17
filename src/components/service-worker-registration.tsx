'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    const register = () => {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then((reg) => {
          // Force an immediate update check so a returning visitor still running
          // an old worker pulls the latest one right away (rather than waiting
          // for the browser's periodic check).
          reg.update().catch(() => {})
        })
        .catch((err) => {
          console.warn('[sw] registration failed', err)
        })
    }

    // When a new worker takes control (it calls skipWaiting + clients.claim on
    // activate), reload once so the visitor immediately sees fresh content
    // instead of whatever the old worker had cached. Guarded so it only fires a
    // single reload per page load.
    //
    // Only when a worker was ALREADY controlling the page. On a first visit
    // there is no controller; the new worker's clients.claim() still fires
    // controllerchange, and this used to reload every first-time visitor's
    // page a few seconds in (Lighthouse: a self-redirect costing ~5 s of LCP;
    // shoppers: the page jumps back to the top mid-scroll).
    const hadController = !!navigator.serviceWorker.controller
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }
  }, [])

  return null
}
