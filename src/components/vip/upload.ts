/** Upload one image through the members-only pipeline (/api/vip/uploads). */
export async function uploadVipImage(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const fd = new FormData()
  fd.append('file', file)
  try {
    const res = await fetch('/api/vip/uploads', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.error || 'Upload failed.' }
    return { ok: true, url: data.url }
  } catch {
    return { ok: false, error: 'Upload failed. Check your connection and try again.' }
  }
}
