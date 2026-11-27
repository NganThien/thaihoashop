// BACKUP: xuất Excel danh sách món, hóa đơn, mua hàng (theo khoảng ngày) và bảng tính giá các đợt nấu
import { useState } from 'react'
import {
  listAllOrdersWithItems,
  listAllPurchasesWithItems,
  listBatches,
  listCategories,
  listProducts,
} from '../lib/api'
import { errorMessage, todayVN, vnDateRange } from '../lib/format'
import { exportBatches, exportOrders, exportProducts, exportPurchases } from '../lib/excel'
import { useToast } from '../components/Toast'
import DateRangePicker, { type DateRange } from '../components/DateRangePicker'

type Job = 'products' | 'orders' | 'purchases' | 'batches'

export default function BackupPage() {
  const toast = useToast()
  const today = todayVN()
  const monthRange = { from: `${today.slice(0, 8)}01`, to: today }
  const [range, setRange] = useState<DateRange>(monthRange)
  const [purchaseRange, setPurchaseRange] = useState<DateRange>(monthRange)
  const [busy, setBusy] = useState<Job | null>(null)

  const run = async (job: Job, fn: () => Promise<void>) => {
    setBusy(job)
    try {
      await fn()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const doProducts = () =>
    run('products', async () => {
      const [products, categories] = await Promise.all([listProducts(), listCategories()])
      await exportProducts(products, categories, `ThaiHoaShop_DanhSachMon_${todayVN()}.xlsx`)
      toast.success(`Đã xuất ${products.length} món`)
    })

  const doOrders = () =>
    run('orders', async () => {
      const { start, end } = vnDateRange(range.from, range.to)
      const orders = await listAllOrdersWithItems(start, end)
      if (orders.length === 0) return toast.error('Không có hóa đơn nào trong khoảng ngày này')
      await exportOrders(orders, `ThaiHoaShop_HoaDon_${range.from}_den_${range.to}.xlsx`)
      toast.success(`Đã xuất ${orders.length} hóa đơn`)
    })

  const doPurchases = () =>
    run('purchases', async () => {
      const { start, end } = vnDateRange(purchaseRange.from, purchaseRange.to)
      const [purchases, batches] = await Promise.all([listAllPurchasesWithItems(start, end), listBatches()])
      if (purchases.length === 0) return toast.error('Không có lần mua nào trong khoảng ngày này')
      await exportPurchases(purchases, batches, `ThaiHoaShop_MuaHang_${purchaseRange.from}_den_${purchaseRange.to}.xlsx`)
      toast.success(`Đã xuất ${purchases.length} lần mua`)
    })

  const doBatches = () =>
    run('batches', async () => {
      const batches = await listBatches()
      if (batches.length === 0) return toast.error('Chưa có đợt nấu nào')
      await exportBatches(batches, `ThaiHoaShop_CacDotNau_${todayVN()}.xlsx`)
      toast.success(`Đã xuất ${batches.length} đợt nấu`)
    })

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

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-bold">Mua hàng</h2>
        <p className="text-sm text-slate-500">
          File gồm 2 trang: "Lần mua" (mỗi dòng một lần mua) và "Chi tiết mua" (từng mặt hàng, đơn giá, thành tiền).
        </p>
        <DateRangePicker value={purchaseRange} onChange={setPurchaseRange} />
        <button className="btn btn-primary w-full sm:w-auto" onClick={doPurchases} disabled={busy !== null}>
          {busy === 'purchases' ? 'Đang xuất...' : '⬇ Xuất Excel mua hàng'}
        </button>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-bold">Bảng tính giá các đợt nấu</h2>
        <p className="text-sm text-slate-500">
          Mỗi dòng một đợt: số mâm, tổng chi phí, giá vốn, giá gợi ý, giá chốt, lãi. Bảng tính giá chi tiết của từng đợt
          (chia theo nhóm hàng) xuất ở nút <b>⬇ Excel</b> trong trang đợt đó.
        </p>
        <button className="btn btn-primary w-full sm:w-auto" onClick={doBatches} disabled={busy !== null}>
          {busy === 'batches' ? 'Đang xuất...' : '⬇ Xuất Excel các đợt nấu'}
        </button>
      </section>
    </div>
  )
}
