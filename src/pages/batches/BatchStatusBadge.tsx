import type { BatchStatus } from '../../types'

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  return status === 'đang mua' ? (
    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">🛒 Đang mua</span>
  ) : (
    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">✓ Đã chốt</span>
  )
}
