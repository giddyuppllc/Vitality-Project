/**
 * Text rendering for member- and admin-authored clubhouse content.
 *
 * Everything is HTML-escaped FIRST, then a small allow-list of formatting is
 * re-introduced. No raw HTML from any author ever reaches the page. Links are
 * http(s) only and carry rel="nofollow noopener noreferrer ugc". There are no
 * link previews (nothing is fetched from a member's URL).
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi
const MENTION_RE = /(^|[^a-z0-9._@-])@([a-z0-9._-]{2,32})/gi

function linkAttrs(): string {
  return 'target="_blank" rel="nofollow noopener noreferrer ugc" class="vip-link"'
}

/** Unique, lower-cased @usernames in a body (max 10 — no mass-mention spam). */
export function extractMentions(body: string): string[] {
  const out = new Set<string>()
  for (const m of body.matchAll(MENTION_RE)) {
    out.add(m[2].toLowerCase().replace(/[._-]+$/, ''))
    if (out.size >= 10) break
  }
  return [...out]
}

export function countLinks(body: string): number {
  return (body.match(URL_RE) || []).length
}

function formatPlain(raw: string): string {
  return escapeHtml(raw)
    .replace(
      MENTION_RE,
      (_m, pre: string, name: string) =>
        `${pre}<a href="/members/@${name.toLowerCase()}" class="vip-mention">@${name}</a>`,
    )
    .replace(/\r?\n/g, '<br />')
}

/**
 * Post / comment body → safe HTML. Single pass: URL spans become links, every
 * other span is escaped and gets @mention links + line breaks. (Doing mentions
 * after linkifying would inject markup inside an href like https://x/@name.)
 */
export function renderPostBody(body: string): string {
  const text = body.trim()
  let out = ''
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    const idx = m.index ?? 0
    out += formatPlain(text.slice(last, idx))
    const url = escapeHtml(m[0])
    out += `<a href="${url}" ${linkAttrs()}>${url}</a>`
    last = idx + m[0].length
  }
  out += formatPlain(text.slice(last))
  return out
}

function inline(escapedLine: string): string {
  let s = escapedLine
  // [text](https://url)
  s = s.replace(
    /\[([^\]]{1,200})\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, text: string, url: string) => `<a href="${url}" ${linkAttrs()}>${text}</a>`,
  )
  // bare URLs not already inside an href
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g, (_m, pre: string, url: string) =>
    `${pre}<a href="${url}" ${linkAttrs()}>${url}</a>`,
  )
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  return s
}

/**
 * Lesson body (admin-entered) → safe HTML. Supports: #/##/### headings,
 * "- " / "* " bullet lists, "1. " numbered lists, blank-line paragraphs,
 * **bold**, *italic*, [text](https://…) and bare links.
 */
export function renderLessonMarkdown(md: string): string {
  const lines = escapeHtml(md.replace(/\r\n/g, '\n')).split('\n')
  const out: string[] = []
  let para: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br />')}</p>`)
    para = []
  }
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? 'ol' : 'ul'
      out.push(`<${tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${tag}>`)
    }
    list = null
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    const ul = /^\s*[-*]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (!line.trim()) {
      flushPara()
      flushList()
    } else if (h) {
      flushPara()
      flushList()
      const level = h[1].length + 1 // # → h2 (the page owns h1)
      out.push(`<h${level}>${inline(h[2])}</h${level}>`)
    } else if (ul || ol) {
      flushPara()
      const ordered = !!ol
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      list.items.push((ul ?? ol)![1])
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return out.join('\n')
}

export type VideoEmbed =
  | { kind: 'iframe'; src: string; provider: 'youtube' | 'vimeo' }
  | { kind: 'link'; href: string }

/** Admin-entered lesson video URL → privacy-friendly embed, or a plain link. */
export function videoEmbed(url: string | null | undefined): VideoEmbed | null {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.replace(/^www\./, '')
  let yt: string | null = null
  if (host === 'youtu.be') yt = u.pathname.slice(1)
  else if (host === 'youtube.com' || host === 'm.youtube.com') {
    yt = u.searchParams.get('v') || (/^\/(embed|shorts)\/([\w-]+)/.exec(u.pathname)?.[2] ?? null)
  }
  if (yt && /^[\w-]{6,20}$/.test(yt)) {
    return { kind: 'iframe', provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${yt}` }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = /(\d{6,12})/.exec(u.pathname)?.[1]
    if (id) return { kind: 'iframe', provider: 'vimeo', src: `https://player.vimeo.com/video/${id}?dnt=1` }
  }
  return { kind: 'link', href: u.toString() }
}
