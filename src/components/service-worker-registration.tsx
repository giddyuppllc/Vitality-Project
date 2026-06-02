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
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
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
