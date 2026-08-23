import type { Proposal } from '~~/shared/types/proposal'

export default defineEventHandler((): Proposal => ({
  title: '午後散步與咖啡',
  description: '到附近街區散步，再找一間安靜的咖啡店休息。'
}))
