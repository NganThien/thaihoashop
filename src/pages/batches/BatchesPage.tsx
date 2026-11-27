// ĐỢT NẤU: danh sách các đợt / đơn tiệc kèm chi phí và giá mâm
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { BatchStatus } from '../../types'
import { listBatches, type BatchListRow } from '../../lib/api'
import { errorMessage, formatDate, formatMoney } from '../../lib/format'
import { calcPricing } from '../../lib/costing'
import { useToast } from '../../components/Toast'
import BatchForm from './BatchForm'
import { BatchStatusBadge } from './BatchStatusBadge'

type Filter = 'all' | BatchStatus

export default function BatchesPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [rows, setRows] = useState<BatchListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      setRows(await listBatches())
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const visible = rows.filter((b) => filter === 'all' || b.status === filter)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">Đợt nấu & giá mâm</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Tạo đợt
        </button>
      </div>

      <div className="flex gap-2">
        {(['all', 'đang mua', 'đã chốt'] as Filter[]).map((f) => (
          <button key={f} className={`chip ${filter === f ? 'chip-on' : 'chip-off'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Tất cả' : f === 'đang mua' ? 'Đang mua' : 'Đã chốt'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-500">Đang tải...</p>
      ) : visible.length === 0 ? (
        <div className="card p-6 text-center text-slate-500">
          <p>Chưa có đợt nấu nào.</p>
          <p className="mt-1 text-sm">Tạo một đợt (vd "Tiệc nhà anh Nam 30/11") để gom chi phí đi chợ và tính giá mỗi mâm.</p>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {visible.map((b) => {
            const cost = b.purchases.reduce((s, p) => s + p.total, 0)
            const pr = calcPricing(cost, b.tray_count, b.profit_percent, b.final_price)
            return (
              <li key={b.id}>
                <Link to={`/dot-nau/${b.id}`} className="card block space-y-1 p-3 hover:border-teal-600">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{b.name}</div>
                      <div className="text-sm text-slate-500">
                        {formatDate(b.date)} · {b.tray_count} mâm · {b.purchases.length} lần mua
                      </div>
                    </div>
                    <BatchStatusBadge status={b.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-sm">
                    <div>
                      <div className="text-slate-500">Chi phí</div>
                      <div className="font-semibold tabular-nums">{formatMoney(cost)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Vốn / mâm</div>
                      <div className="font-semibold tabular-nums">{formatMoney(pr.costPerTray)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">{b.final_price !== null ? 'Giá chốt' : 'Giá gợi ý'}</div>
                      <div className="font-bold text-teal-700 tabular-nums">{formatMoney(b.final_price ?? pr.suggested)}</div>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <BatchForm
        open={creating}
        mode="new"
        onClose={() => setCreating(false)}
        onSaved={(b) => {
          setCreating(false)
          navigate(`/dot-nau/${b.id}`)
        }}
      />
    </div>
  )
}
