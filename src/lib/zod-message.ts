import type { z } from 'zod'

/**
 * One readable line from a zod error. Admin forms render `error` as text; a
 * raw `error.issues` array showed up as "[object Object]" or raw JSON.
 */
export function zodMessage(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`).join('; ')
}
