interface FetchResponseError {
  response?: {
    status?: number
    _data?: unknown
  }
}

type UnknownRecord = Record<string, unknown>

const isFetchResponseError = (error: unknown): error is FetchResponseError =>
  typeof error === 'object' && error !== null && 'response' in error

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const isRejectedResponse = (value: unknown): value is ProposalApiRejectedResponse => {
  if (typeof value !== 'object' || value === null || !('status' in value)) {
    return false
  }

  return value.status === 'rejected' && 'reasons' in value && Array.isArray(value.reasons)
}

/** 確認 HTTP error payload 是否包含受支援的 API 錯誤代碼。 */
const isErrorResponse = (value: unknown): value is ProposalApiErrorResponse => {
  if (typeof value !== 'object' || value === null || !('status' in value)) {
    return false
  }

  return value.status === 'error' && 'code' in value
}

/**
 * 取出 API 自己定義的錯誤資料。
 *
 * Nitro 會把 `createError({ data })` 包在 HTTP error envelope 的 `data` 欄位；
 * 同時保留直接回傳 API payload 的分支，讓 composable 不依賴測試或 runtime 的單一包裝層。
 */
const getApiErrorData = (error: unknown): unknown => {
  if (!isFetchResponseError(error)) {
    return null
  }

  const payload = error.response?._data

  if (isRejectedResponse(payload) || isErrorResponse(payload)) {
    return payload
  }

  if (isRecord(payload) && 'data' in payload) {
    return payload.data
  }

  return null
}

const getRejectedResponse = (error: unknown): ProposalApiRejectedResponse | null => {
  const payload = getApiErrorData(error)

  return isRejectedResponse(payload) ? payload : null
}

/** 從 $fetch 例外取出 API 層的錯誤資料，不讀取 Provider 原始內容。 */
const getErrorResponse = (error: unknown): ProposalApiErrorResponse | null => {
  const payload = getApiErrorData(error)

  return isErrorResponse(payload) ? payload : null
}

const createIdempotencyKey = () => crypto.randomUUID()

/** 管理提案 API 的請求生命週期、結果、拒絕原因與正規化錯誤碼。 */
export function useProposal() {
  const proposals = ref<Proposal[]>([])
  const status = ref<ProposalStatus>('idle')
  const error = ref<string | null>(null)
  /** Server 回傳的穩定錯誤碼，供 UI 文案或後續觀測使用。 */
  const errorCode = ref<ProposalApiErrorResponse['code'] | null>(null)
  const rejectionReasons = ref<ProposalApiRejectedResponse['reasons']>([])

  const loading = computed(() => status.value === 'pending')

  const generate = async (file: File) => {
    if (loading.value) {
      return
    }

    status.value = 'pending'
    error.value = null
    errorCode.value = null
    rejectionReasons.value = []
    proposals.value = []

    const idempotencyKey = createIdempotencyKey()
    const body = new FormData()
    body.append('file', file)

    try {
      const response = await $fetch<ProposalApiResponse>('/api/proposal', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey
          // 'X-Proposal-Debug': '1' // debug 用
        },
        body
      })

      if (response.status === 'success') {
        proposals.value = response.proposals
        status.value = 'success'
        return
      }

      if (response.status === 'rejected') {
        rejectionReasons.value = response.reasons
        status.value = 'rejected'
        return
      }

      status.value = 'error'
      errorCode.value = response.code
      error.value = '目前無法產生提案，請稍後再試。'
    } catch (requestError: unknown) {
      const rejectedResponse = getRejectedResponse(requestError)

      if (rejectedResponse) {
        rejectionReasons.value = rejectedResponse.reasons
        status.value = 'rejected'
        return
      }

      const errorResponse = getErrorResponse(requestError)

      status.value = 'error'
      errorCode.value = errorResponse?.code ?? null
      error.value = '目前無法產生提案，請稍後再試。'
    }
  }

  const retry = async (file: File) => {
    if (status.value !== 'error' || loading.value) {
      return
    }

    await generate(file)
  }

  const reset = () => {
    proposals.value = []
    status.value = 'idle'
    error.value = null
    errorCode.value = null
    rejectionReasons.value = []
  }

  return {
    proposals: readonly(proposals),
    status: readonly(status),
    loading: readonly(loading),
    error: readonly(error),
    errorCode: readonly(errorCode),
    rejectionReasons: readonly(rejectionReasons),
    generate,
    retry,
    reset
  }
}
