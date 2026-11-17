/**
 * A refusal the rewards / partner APIs return to the caller as-is:
 * `code` is stable for clients and tests, `message` is shown to people.
 */
export class RewardsError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'RewardsError'
  }
}

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002'
}
