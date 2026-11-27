// LỊCH SỬ HÓA ĐƠN: lọc theo khoảng ngày, xem chi tiết, in, hủy hóa đơn
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Order, OrderWithItems } from '../types'
import { cancelOrder, getOrder, listOrders, ORDERS_PAGE_SIZE } from '../lib/api'
import { errorMessage, formatDateTime, formatMoney, vnDateRange } from '../lib/format'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { usePrint } from '../components/Print'
import Modal from '../components/Modal'
import DateRangePicker, { todayRange, type DateRange } from '../components/DateRangePicker'

function StatusBadge({ status }: { status: Order['status'] }) {
  return status === 'paid' ? (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Đã thanh toán</span>
  ) : (
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Đã hủy</span>
  )
}

export default function OrdersPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const print = usePrint()

  const [range, setRange] = useState<DateRange>(todayRange)
  const [orders, setOrders] = useState<Order[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<OrderWithItems | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const requestId = useRef(0) // bỏ qua kết quả cũ nếu người dùng đổi ngày liên tục

  // Tải trang hóa đơn (trang 0 = tải lại từ đầu)
  const load = useCallback(
    async (p: number) => {
      const id = ++requestId.current
      setLoading(true)
      try {
        const { start, end } = vnDateRange(range.from, range.to)
        const rows = await listOrders(start, end, p)
        if (id !== requestId.current) return
        setOrders((old) => (p === 0 ? rows : [...old, ...rows]))
        setHasMore(rows.length === ORDERS_PAGE_SIZE)
        setPage(p)
      } catch (e) {
        toast.error(errorMessage(e))
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [range, toast],
  )

  useEffect(() => {
    load(0)
  }, [load])

  const openDetail = async (id: number) => {
    try {
      setDetail(await getOrder(id))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const doCancel = async () => {
    if (!detail) return
    const ok = await confirm({
      title: 'Hủy hóa đơn',
      message: `Hủy hóa đơn ${detail.code} (${formatMoney(detail.total)})? Hóa đơn đã hủy sẽ không được tính vào doanh thu.`,
      confirmText: 'Hủy hóa đơn',
      danger: true,
    })
    if (!ok) return
    setCancelling(true)
    try {
      await cancelOrder(detail.id)
      toast.success(`Đã hủy hóa đơn ${detail.code}`)
      setDetail({ ...detail, status: 'cancelled' })
      setOrders((list) => list.map((o) => (o.id === detail.id ? { ...o, status: 'cancelled' } : o)))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Lịch sử hóa đơn</h1>
      <div className="card p-3">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {orders.length === 0 && !loading ? (
        <p className="py-10 text-center text-slate-500">Không có hóa đơn nào trong khoảng ngày này.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <button
                onClick={() => openDetail(o.id)}
                className={`card flex w-full items-center gap-3 p-3 text-left hover:border-teal-600 ${
                  o.status === 'cancelled' ? 'opacity-60' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.code}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="text-sm text-slate-500">{formatDateTime(o.created_at)}</div>
                  {o.note && <div className="truncate text-sm text-slate-500">📝 {o.note}</div>}
                </div>
                <div className={`text-lg font-bold ${o.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-teal-700'}`}>
                  {formatMoney(o.total)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {loading && <p className="py-4 text-center text-slate-500">Đang tải...</p>}
      {hasMore && !loading && (
        <button className="btn btn-secondary w-full" onClick={() => load(page + 1)}>
          Xem thêm
        </button>
      )}

      {/* ---------- Chi tiết hóa đơn ---------- */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Hóa đơn ${detail.code}` : ''}
        footer={
          detail && (
            <>
              {detail.status === 'paid' && (
                <button className="btn btn-danger flex-1" onClick={doCancel} disabled={cancelling}>
                  {cancelling ? 'Đang hủy...' : 'Hủy hóa đơn'}
                </button>
              )}
              <button className="btn btn-primary flex-1" onClick={() => print(detail)}>
                🖨 In
              </button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{formatDateTime(detail.created_at)}</span>
              <StatusBadge status={detail.status} />
            </div>
            <ul className="divide-y divide-slate-100 border-y border-slate-200">
              {detail.order_items.map((it) => (
                <li key={it.id} className="flex justify-between gap-2 py-2">
                  <div>
                    <div className="font-semibold">{it.product_name}</div>
                    <div className="text-sm text-slate-500">
                      {it.quantity} × {formatMoney(it.unit_price)}
                    </div>
                  </div>
                  <div className="font-semibold">{formatMoney(it.line_total)}</div>
                </li>
              ))}
            </ul>
            <dl className="space-y-1">
              <div className="flex justify-between">
                <dt>Tạm tính</dt>
                <dd>{formatMoney(detail.subtotal)}</dd>
              </div>
              {detail.discount > 0 && (
                <div className="flex justify-between">
                  <dt>Giảm giá</dt>
                  <dd>−{formatMoney(detail.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <dt>Tổng tiền</dt>
                <dd className="text-teal-700">{formatMoney(detail.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Tiền khách đưa</dt>
                <dd>{formatMoney(detail.amount_paid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Tiền thối</dt>
                <dd>{formatMoney(detail.change_amount)}</dd>
              </div>
            </dl>
            {detail.note && <div className="rounded-xl bg-slate-50 p-3 text-sm">📝 {detail.note}</div>}
          </div>
        )}
      </Modal>
    </div>
  )
}
