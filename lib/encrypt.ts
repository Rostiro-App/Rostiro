// T-03: AES-256-GCM encryption for ESPN credentials and Yahoo tokens at rest.
// Uses Node.js built-in crypto — no external dependency.

import crypto from 'crypto'
import { EncryptionError } from '@/types'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96-bit IV, standard for GCM
const TAG_LENGTH = 16  // 128-bit auth tag

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new EncryptionError('ENCRYPTION_KEY environment variable is not set')
  const buf = Buffer.from(key, 'hex')
  if (buf.length !== 32) throw new EncryptionError('ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return buf
}

// Returns base64-encoded string: iv:tag:ciphertext
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(':')

  if (parts.length !== 3) throw new EncryptionError('Invalid ciphertext format')

  const [ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  try {
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    throw new EncryptionError('Decryption failed — data may be tampered or key may be wrong')
  }
}
