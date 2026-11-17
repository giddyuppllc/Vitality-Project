'use client'

import { useEffect } from 'react'

/**
 * Registers the clubhouse's own service worker (/clubhouse-sw.js — never the
 * store's /service-worker.js). Production only, so local development never
 * serves stale chunks.
 */
export function ClubhouseServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    const register = () => navigator.serviceWorker.register('/clubhouse-sw.js', { scope: '/' }).catch(() => {})
    if (document.readyState === 'complete') register()
    else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])
  return null
}
