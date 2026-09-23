import { createStore, del, get, keys, set } from 'idb-keyval'
import {
  savedProposalRecordSchema,
  type LocalSavedProposalEntry
} from '#shared/schemas/saved-proposal'
import { proposalSchema } from '#shared/schemas/proposal'
import type { Proposal } from '#shared/types/proposal'

const savedProposalStore = createStore('essence-lens', 'saved-proposals')
const STORAGE_KEY_PREFIX = 'proposal:'
const SCHEMA_VERSION = 1 as const
const MAX_COVER_BYTES = 1_000_000
const COVER_ENCODINGS = [
  { maxEdge: 1280, quality: 0.8 },
  { maxEdge: 1280, quality: 0.65 },
  { maxEdge: 1024, quality: 0.65 },
  { maxEdge: 768, quality: 0.6 }
] as const

export interface SavedProposalListResult {
  entries: LocalSavedProposalEntry[]
  invalidRecordCount: number
  unsupportedVersionCount: number
}

type ParsedEntry =
  | { entry: LocalSavedProposalEntry; issue: null }
  | { entry: null; issue: 'missing' | 'invalid' | 'unsupported-version' }

const getStorageKey = (proposalId: string) => `${STORAGE_KEY_PREFIX}${proposalId}`

const ensureClientStorageAvailable = () => {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is unavailable in this browser.')
  }
}

const fetchCoverBlob = async (source: string | null) => {
  if (!source || typeof fetch === 'undefined') return undefined

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4000)

  try {
    const response = await fetch(source, { signal: controller.signal })
    if (!response.ok) return undefined
    return await response.blob()
  } catch {
    return undefined
  } finally {
    clearTimeout(timeoutId)
  }
}

const createWebpBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))

const optimizeCoverBlob = async (source: Blob): Promise<Blob> => {
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') {
    throw new Error('Image optimization is unavailable in this browser.')
  }

  const bitmap = await createImageBitmap(source)
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable in this browser.')

    for (const encoding of COVER_ENCODINGS) {
      const scale = Math.min(1, encoding.maxEdge / Math.max(bitmap.width, bitmap.height))
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

      const result = await createWebpBlob(canvas, encoding.quality)
      if (result?.type === 'image/webp' && result.size <= MAX_COVER_BYTES) return result
    }
  } finally {
    bitmap.close()
  }

  throw new Error('The cover image could not be optimized within the storage limit.')
}

const parseEntry = (value: unknown): ParsedEntry => {
  if (value === undefined) return { entry: null, issue: 'missing' }
  if (!value || typeof value !== 'object' || !('record' in value)) {
    return { entry: null, issue: 'invalid' }
  }

  const candidate = value as { record: unknown; coverBlob?: unknown }
  if (
    candidate.record &&
    typeof candidate.record === 'object' &&
    'schemaVersion' in candidate.record &&
    candidate.record.schemaVersion !== SCHEMA_VERSION
  ) {
    return { entry: null, issue: 'unsupported-version' }
  }

  const result = savedProposalRecordSchema.safeParse(candidate.record)
  if (!result.success) return { entry: null, issue: 'invalid' }

  return {
    entry: {
      record: result.data,
      ...(typeof Blob !== 'undefined' && candidate.coverBlob instanceof Blob
        ? { coverBlob: candidate.coverBlob }
        : {})
    },
    issue: null
  }
}

const readEntry = async (key: string) => parseEntry(await get<unknown>(key, savedProposalStore))

export const listSavedProposals = async (): Promise<SavedProposalListResult> => {
  ensureClientStorageAvailable()

  const storageKeys = await keys(savedProposalStore)
  const parsedEntries = await Promise.all(
    storageKeys
      .filter((key): key is string => typeof key === 'string' && key.startsWith(STORAGE_KEY_PREFIX))
      .map(readEntry)
  )
  const entries = parsedEntries.flatMap((result) => (result.entry ? [result.entry] : []))

  return {
    entries: entries.sort((left, right) => right.record.savedAt.localeCompare(left.record.savedAt)),
    invalidRecordCount: parsedEntries.filter((result) => result.issue === 'invalid').length,
    unsupportedVersionCount: parsedEntries.filter(
      (result) => result.issue === 'unsupported-version'
    ).length
  }
}

export const getSavedProposal = async (proposalId: string) => {
  ensureClientStorageAvailable()
  const result = await readEntry(getStorageKey(proposalId))
  return result.entry
}

export const saveProposal = async (
  proposal: Proposal,
  fallbackImageUrl?: string | null
): Promise<{
  entry: LocalSavedProposalEntry
  coverStatus: 'saved' | 'unavailable' | 'not-requested'
}> => {
  ensureClientStorageAvailable()
  const now = new Date().toISOString()
  const storageKey = getStorageKey(proposal.id)
  const previousResult = await readEntry(storageKey)
  if (
    !previousResult.entry &&
    (previousResult.issue === 'invalid' || previousResult.issue === 'unsupported-version')
  ) {
    throw new Error('An existing saved proposal cannot be safely overwritten.')
  }
  const previous = previousResult.entry
  const record = savedProposalRecordSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    proposal: proposalSchema.parse(JSON.parse(JSON.stringify(proposal))),
    savedAt: previous?.record.savedAt ?? now,
    updatedAt: now,
    customCategoryIds: previous?.record.customCategoryIds ?? []
  })

  const coverSource = proposal.cover.imageUrl ?? fallbackImageUrl ?? null
  let coverBlob = previous?.coverBlob
  let coverStatus: 'saved' | 'unavailable' | 'not-requested' = 'not-requested'

  if (coverBlob) {
    coverStatus = 'saved'
  } else if (coverSource) {
    const sourceBlob = await fetchCoverBlob(coverSource)
    if (sourceBlob) {
      try {
        coverBlob = await optimizeCoverBlob(sourceBlob)
        coverStatus = 'saved'
      } catch {
        coverStatus = 'unavailable'
      }
    } else {
      coverStatus = 'unavailable'
    }
  }

  const entry: LocalSavedProposalEntry = {
    record,
    ...(coverBlob ? { coverBlob } : {})
  }

  await set(storageKey, entry, savedProposalStore)
  return { entry, coverStatus }
}

export const removeSavedProposal = async (proposalId: string) => {
  ensureClientStorageAvailable()
  await del(getStorageKey(proposalId), savedProposalStore)
}
