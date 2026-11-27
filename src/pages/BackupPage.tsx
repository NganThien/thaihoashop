// BACKUP: xuất Excel danh sách món và hóa đơn theo khoảng ngày
import { useState } from 'react'
import { listAllOrdersWithItems, listCategories, listProducts } from '../lib/api'
import { errorMessage, todayVN, vnDateRange } from '../lib/format'
import { exportOrders, exportProducts } from '../lib/excel'
import { useToast } from '../components/Toast'
import DateRangePicker, { type DateRange } from '../components/DateRangePicker'

export default function BackupPage() {
  const toast = useToast()
  const today = todayVN()
  const [range, setRange] = useState<DateRange>({ from: `${today.slice(0, 8)}01`, to: today })
  const [busy, setBusy] = useState<'products' | 'orders' | null>(null)

  const doProducts = async () => {
    setBusy('products')
    try {
      const [products, categories] = await Promise.all([listProducts(), listCategories()])
      await exportProducts(products, categories, `ThaiHoaShop_DanhSachMon_${todayVN()}.xlsx`)
      toast.success(`Đã xuất ${products.length} món`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const doOrders = async () => {
    setBusy('orders')
    try {
      const { start, end } = vnDateRange(range.from, range.to)
      const orders = await listAllOrdersWithItems(start, end)
      if (orders.length === 0) {
        toast.error('Không có hóa đơn nào trong khoảng ngày này')
        return
      }
      await exportOrders(orders, `ThaiHoaShop_HoaDon_${range.from}_den_${range.to}.xlsx`)
      toast.success(`Đã xuất ${orders.length} hóa đơn`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Backup dữ liệu</h1>
      <p className="text-slate-600">
        Xuất dữ liệu ra file Excel (.xlsx) để lưu trữ. Nên xuất định kỳ (ví dụ cuối mỗi tháng) và cất file vào Google
        Drive hoặc máy tính.
      </p>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-bold">Danh sách món</h2>
        <p className="text-sm text-slate-500">Toàn bộ món, kể cả món đang ẩn.</p>
        <button className="btn btn-primary w-full sm:w-auto" onClick={doProducts} disabled={busy !== null}>
          {busy === 'products' ? 'Đang xuất...' : '⬇ Xuất Excel danh sách món'}
        </button>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-bold">Hóa đơn</h2>
        <p className="text-sm text-slate-500">
          File gồm 2 trang: "Hóa đơn" (mỗi dòng một hóa đơn) và "Chi tiết" (từng món trong hóa đơn).
        </p>
        <DateRangePicker value={range} onChange={setRange} />
        <button className="btn btn-primary w-full sm:w-auto" onClick={doOrders} disabled={busy !== null}>
          {busy === 'orders' ? 'Đang xuất...' : '⬇ Xuất Excel hóa đơn'}
        </button>
      </section>
    </div>
  )
}
