'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Check, Download, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const noop = () => () => {}

/**
 * "Install the Clubhouse app" — the PWA install prompt where the browser
 * offers one (Chrome, Edge, Android), and the Add-to-Home-Screen steps on
 * iPhone/iPad (Safari has no prompt). Already installed → says so.
 */
export function InstallApp() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const standalone = useSyncExternalStore(
    noop,
    () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  )
  const ios = useSyncExternalStore(noop, () => /iphone|ipad|ipod/i.test(navigator.userAgent), () => false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (standalone || installed) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-emerald-200">
        <Check className="h-4 w-4" aria-hidden="true" /> The Clubhouse app is installed on this device.
      </p>
    )
  }
  if (prompt) {
    return (
      <button
        type="button"
        onClick={async () => {
          await prompt.prompt()
          const choice = await prompt.userChoice
          if (choice.outcome === 'accepted') setInstalled(true)
          setPrompt(null)
        }}
        className="vip-focus inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600"
      >
        <Download className="h-4 w-4" aria-hidden="true" /> Install the app
      </button>
    )
  }
  if (ios) {
    return (
      <p className="text-sm text-white/75">
        In Safari, tap <Share className="inline h-4 w-4 align-[-2px]" aria-label="Share" /> then <strong>Add to Home Screen</strong>.
      </p>
    )
  }
  return (
    <p className="text-sm text-white/70">
      Use your browser’s menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.
    </p>
  )
}
