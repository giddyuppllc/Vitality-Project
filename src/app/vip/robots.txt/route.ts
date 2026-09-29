// robots.txt for vitalityproject.vip (src/proxy.ts rewrites /robots.txt here on
// the clubhouse host). The clubhouse is private: nothing may be crawled.
export const dynamic = 'force-static'

export function GET() {
  return new Response('User-agent: *\nDisallow: /\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}
