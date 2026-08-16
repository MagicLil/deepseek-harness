/** Content fingerprint for conflict checks. */

import { createHash } from 'node:crypto'

/**
 * SHA-256 hex digest of UTF-8 text (or the empty string).
 * @param text - file contents.
 */
export function contentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}
