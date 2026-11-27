// MUA HÀNG: danh sách các lần mua, lọc theo ngày và theo đợt nấu; bấm vào để sửa / xóa
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Batch } from '../../types'
import {
  listBatches,
  listPurchases,
  PURCHASES_PAGE_SIZE,
  sumPurchases,
  type BatchFilter,
  type PurchaseListRow,
} from '../../lib/api'
import { errorMessage, formatDate, formatDateTime, formatMoney, todayVN, vnDateRange } from '../../lib/format'
import { useToast } from '../../components/Toast'
import DateRangePicker, { type DateRange } from '../../components/DateRangePicker'
import IngredientManager from './IngredientManager'

export default function PurchasesPage() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const today = todayVN()
  const [range, setRange] = useState<DateRange>({ from: `${today.slice(0, 8)}01`, to: today })
  const dotParam = params.get('dot')
  const batch: BatchFilter = dotParam === 'chung' ? 'none' : dotParam ? Number(dotParam) : 'all'

  const [batches, setBatches] = useState<Batch[]>([])
  const [rows, setRows] = useState<PurchaseListRow[]>([])
  const [summary, setSummary] = useState<{ count: number; total: number } | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCatalog, setShowCatalog] = useState(false)
  const requestId = useRef(0) // bỏ qua kết quả cũ khi đổi bộ lọc liên tục

  useEffect(() => {
    listBatches()
      .then(setBatches)
      .catch((e) => toast.error(errorMessage(e)))
  }, [toast])

  const load = useCallback(
    async (p: number) => {
      const id = ++requestId.current
      setLoading(true)
      try {
        const { start, end } = vnDateRange(range.from, range.to)
        const [list, sum] = await Promise.all([
          listPurchases(start, end, batch, p),
          p === 0 ? sumPurchases(start, end, batch) : Promise.resolve(null),
        ])
        if (id !== requestId.current) return
        setRows((old) => (p === 0 ? list : [...old, ...list]))
        if (sum) setSummary(sum)
        setHasMore(list.length === PURCHASES_PAGE_SIZE)
        setPage(p)
      } catch (e) {
        toast.error(errorMessage(e))
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [range, batch, toast],
  )

  useEffect(() => {
    load(0)
  }, [load])

  const setBatch = (v: string) => {
    const next = new URLSearchParams(params)
    if (v === 'all') next.delete('dot')
    else next.set('dot', v)
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="w-full text-xl font-bold sm:mr-auto sm:w-auto">Mua hàng</h1>
        <button className="btn btn-secondary flex-1 sm:flex-none" onClick={() => setShowCatalog(true)}>
          📦 Danh mục hàng
        </button>
        <Link
          to={batch !== 'all' && batch !== 'none' ? `/mua-hang/moi?dot=${batch}` : '/mua-hang/moi'}
          className="btn btn-primary flex-1 sm:flex-none"
        >
          + Lần mua mới
        </Link>
      </div>

      <div className="card space-y-3 p-3">
        <DateRangePicker value={range} onChange={setRange} />
        <label className="block">
          <span className="label">Đợt nấu</span>
          <select
            className="input"
            value={batch === 'all' ? 'all' : batch === 'none' ? 'chung' : String(batch)}
            onChange={(e) => setBatch(e.target.value)}
          >
            <option value="all">Tất cả</option>
            <option value="chung">Mua chung (không thuộc đợt nào)</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {formatDate(b.date)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {summary && (
        <div className="flex items-baseline justify-between px-1">
          <span className="text-slate-500">{summary.count} lần mua</span>
          <span className="text-lg font-bold">
            Tổng chi: <span className="text-teal-700 tabular-nums">{formatMoney(summary.total)}</span>
          </span>
        </div>
      )}

      {rows.length === 0 && !loading ? (
        <p className="py-10 text-center text-slate-500">Không có lần mua nào.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => {
            const names = p.purchase_items.map((i) => i.item_name)
            return (
              <li key={p.id}>
                <Link to={`/mua-hang/${p.id}`} className="card flex items-center gap-3 p-3 hover:border-teal-600">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.batches ? `🍲 ${p.batches.name}` : 'Mua chung'}</div>
                    <div className="truncate text-sm text-slate-500">
                      {formatDateTime(p.purchased_at)}
                      {p.place && ` · ${p.place}`}
                    </div>
                    <div className="truncate text-sm text-slate-600">
                      {names.slice(0, 4).join(', ')}
                      {names.length > 4 ? ` +${names.length - 4} món` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-lg font-bold text-teal-700 tabular-nums">{formatMoney(p.total)}</div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {loading && <p className="py-4 text-center text-slate-500">Đang tải...</p>}
      {hasMore && !loading && (
        <button className="btn btn-secondary w-full" onClick={() => load(page + 1)}>
          Xem thêm
        </button>
      )}

      <IngredientManager open={showCatalog} onClose={() => setShowCatalog(false)} />
    </div>
  )
}
