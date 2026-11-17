import { NextRequest, NextResponse } from 'next/server'
import { SERVICE_WORKER, clubhouseManifest, iconPng } from '@/lib/vip/pwa'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ file: string }> }

/**
 * The clubhouse's installable-app files. Reached on the .vip host as
 * /manifest.webmanifest, /clubhouse-sw.js and the /app-icon-* PNGs
 * (lib/vip/host.ts rewrites them here); /vip/* is 404 on .global.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { file } = await params
  if (file === 'manifest.webmanifest') {
    return new NextResponse(JSON.stringify(clubhouseManifest()), {
      headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    })
  }
  if (file === 'clubhouse-sw.js') {
    return new NextResponse(SERVICE_WORKER, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        // Always re-check the worker so updates roll out promptly.
        'Cache-Control': 'no-cache',
        'Service-Worker-Allowed': '/',
      },
    })
  }
  const png = await iconPng(file)
  if (png) {
    return new NextResponse(new Uint8Array(png), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800' },
    })
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
