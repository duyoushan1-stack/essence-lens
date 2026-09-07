import { createHash } from 'node:crypto'
import type { ProviderImageInput } from '../providers/provider.types'

/**
 * 建立圖片 payload 的 SHA-256 fingerprint。
 *
 * 輸出固定為 64 個小寫十六進位字元，只在 Server 內部用來比對同一
 * `idempotencyKey` 是否搭配相同 payload，不直接回傳給 Client。
 */
export const createImageFingerprint = ({
  bytes,
  mimeType,
  filename
}: ProviderImageInput): string =>
  createHash('sha256')
    .update(bytes)
    .update('\0')
    .update(mimeType)
    .update('\0')
    .update(filename)
    .digest('hex')
