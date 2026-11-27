// In hóa đơn khổ 80mm bằng window.print().
// Mẫu hóa đơn được vẽ vào #print-area (ngoài #root); CSS @media print
// trong index.css sẽ ẩn giao diện app và chỉ in phần này.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { OrderWithItems } from '../types'
import { formatDateTime, formatMoney } from '../lib/format'
import { RECEIPT_FOOTER, SHOP_NAME } from '../config'

const PrintContext = createContext<((order: OrderWithItems) => void) | null>(null)

export function PrintProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<{ order: OrderWithItems; n: number } | null>(null)

  const print = useCallback((order: OrderWithItems) => setJob((j) => ({ order, n: (j?.n ?? 0) + 1 })), [])

  // Đợi mẫu hóa đơn hiện ra rồi mới mở hộp thoại in
  useEffect(() => {
    if (!job) return
    const t = setTimeout(() => window.print(), 50)
    return () => clearTimeout(t)
  }, [job])

  return (
    <PrintContext.Provider value={print}>
      {children}
      {job && createPortal(<Receipt order={job.order} />, document.getElementById('print-area')!)}
    </PrintContext.Provider>
  )
}

export function usePrint() {
  const ctx = useContext(PrintContext)
  if (!ctx) throw new Error('usePrint phải nằm trong PrintProvider')
  return ctx
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-[15px] font-bold' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Receipt({ order }: { order: OrderWithItems }) {
  return (
    <div className="receipt">
      <div className="text-center">
        <div className="text-lg font-bold uppercase">{SHOP_NAME}</div>
        <div className="mt-1 font-bold">HÓA ĐƠN BÁN HÀNG</div>
        {order.status === 'cancelled' && <div className="font-bold">*** ĐÃ HỦY ***</div>}
      </div>
      <div className="mt-2">
        <div>Mã HĐ: {order.code}</div>
        <div>Thời gian: {formatDateTime(order.created_at)}</div>
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      {order.order_items.map((it) => (
        <div key={it.id} className="mb-1">
          <div className="font-semibold">{it.product_name}</div>
          <div className="flex justify-between">
            <span>
              {it.quantity} x {formatMoney(it.unit_price)}
            </span>
            <span>{formatMoney(it.line_total)}</span>
          </div>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-black" />
      <Row label="Tạm tính" value={formatMoney(order.subtotal)} />
      {order.discount > 0 && <Row label="Giảm giá" value={`-${formatMoney(order.discount)}`} />}
      <Row label="TỔNG TIỀN" value={formatMoney(order.total)} bold />
      <Row label="Tiền khách đưa" value={formatMoney(order.amount_paid)} />
      <Row label="Tiền thối" value={formatMoney(order.change_amount)} />
      {order.note && <div className="mt-2">Ghi chú: {order.note}</div>}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="text-center">{RECEIPT_FOOTER}</div>
    </div>
  )
}
