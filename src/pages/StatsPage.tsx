// THỐNG KÊ: doanh thu hôm nay / 7 ngày / tháng này + top món bán chạy.
// Số liệu tính trong database theo giờ Việt Nam, không tính hóa đơn đã hủy.
import { useCallback, useEffect, useState } from 'react'
import type { Stats } from '../types'
import { getStats } from '../lib/api'
import { errorMessage, formatMoney, formatNumber } from '../lib/format'
import { useToast } from '../components/Toast'

type Period = keyof Stats

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week', label: '7 ngày qua' },
  { key: 'month', label: 'Tháng này' },
]

export default function StatsPage() {
  const toast = useToast()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [topPeriod, setTopPeriod] = useState<Period>('today')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStats(await getStats())
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const top = stats?.[topPeriod].top ?? []
  const maxQty = Math.max(1, ...top.map((t) => t.quantity))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Thống kê</h1>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Đang tải...' : '↻ Làm mới'}
        </button>
      </div>

      {/* Ô số liệu */}
      <div className="grid gap-3 sm:grid-cols-3">
        {PERIODS.map((p) => (
          <div key={p.key} className="card p-4">
            <div className="text-sm font-semibold text-slate-500">{p.label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
              {stats ? formatMoney(stats[p.key].revenue) : '—'}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {stats ? `${formatNumber(stats[p.key].orders)} hóa đơn` : ' '}
            </div>
          </div>
        ))}
      </div>

      {/* Top món bán chạy */}
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Top món bán chạy</h2>
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                className={`chip ${topPeriod === p.key ? 'chip-on' : 'chip-off'}`}
                onClick={() => setTopPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {top.length === 0 ? (
          <p className="py-6 text-center text-slate-400">{loading ? 'Đang tải...' : 'Chưa có món nào được bán.'}</p>
        ) : (
          <ol className="space-y-3">
            {top.map((t, i) => (
              <li key={t.name + i}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold">
                    <span className="mr-2 text-slate-400">{i + 1}.</span>
                    {t.name}
                  </span>
                  <span className="shrink-0 text-sm text-slate-600 tabular-nums">
                    SL <b className="text-slate-900">{formatNumber(t.quantity)}</b> · {formatMoney(t.revenue)}
                  </span>
                </div>
                {/* Thanh tỉ lệ theo số lượng bán */}
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-teal-600" style={{ width: `${(t.quantity / maxQty) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
