// BÁO CÁO LÃI LỖ THEO THÁNG (giờ Việt Nam)
//   Lãi / lỗ = Doanh thu (hóa đơn bán, không tính hóa đơn đã hủy) − Chi phí mua hàng
import { useEffect, useState } from 'react'
import { ITEM_GROUPS, type Ingredient, type MonthReport } from '../../types'
import { getProfitReport, listIngredients } from '../../lib/api'
import { errorMessage, formatMoney, todayVN } from '../../lib/format'
import { formatPercent, GROUP_META } from '../../lib/costing'
import { useToast } from '../../components/Toast'
import MonthlyBarChart from './MonthlyBarChart'
import PriceHistory from './PriceHistory'
import { CHART } from './chart'

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatMoney(Math.abs(n))}`
const profitClass = (n: number) => (n < 0 ? 'text-red-600' : n > 0 ? 'text-emerald-700' : 'text-slate-700')

export default function ProfitPage() {
  const toast = useToast()
  const today = todayVN()
  const thisYear = Number(today.slice(0, 4))
  const thisMonth = Number(today.slice(5, 7))

  const [year, setYear] = useState(thisYear)
  const [report, setReport] = useState<MonthReport[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState<number | null>(null) // null = cả năm
  const [ingredients, setIngredients] = useState<Ingredient[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getProfitReport(year)
      .then((r) => !cancelled && setReport(r))
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [year, toast])

  useEffect(() => {
    listIngredients()
      .then(setIngredients)
      .catch(() => {})
  }, [])

  // Năm nay: chỉ hiện đến tháng hiện tại
  const months = (report ?? []).filter((m) => year < thisYear || m.month <= thisMonth)
  const scope = month === null ? months : months.filter((m) => m.month === month)
  const revenue = scope.reduce((s, m) => s + m.revenue, 0)
  const cost = scope.reduce((s, m) => s + m.cost, 0)
  const profit = revenue - cost
  const groups = ITEM_GROUPS.map((g) => ({ g, amount: scope.reduce((s, m) => s + (m.groups[g] ?? 0), 0) }))
  const scopeLabel = month === null ? `Cả năm ${year}` : `Tháng ${month}/${year}`

  const changeYear = (y: number) => {
    setYear(y)
    setMonth(null)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Lãi lỗ</h1>
        <div className="flex items-center gap-1">
          <button className="btn-icon" onClick={() => changeYear(year - 1)} aria-label="Năm trước">
            ‹
          </button>
          <span className="w-14 text-center text-lg font-bold tabular-nums">{year}</span>
          <button className="btn-icon" onClick={() => changeYear(year + 1)} disabled={year >= thisYear} aria-label="Năm sau">
            ›
          </button>
        </div>
      </div>

      {/* Chọn phạm vi xem */}
      <label className="block">
        <span className="label">Xem số liệu</span>
        <select
          className="input"
          value={month ?? ''}
          onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Cả năm {year}</option>
          {months.map((m) => (
            <option key={m.month} value={m.month}>
              Tháng {m.month}/{year}
            </option>
          ))}
        </select>
      </label>

      {/* Ô số liệu */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="card p-3">
          <div className="text-sm font-semibold text-slate-500">Doanh thu</div>
          <div className="text-lg font-bold whitespace-nowrap sm:text-2xl">{loading ? '—' : formatMoney(revenue)}</div>
        </div>
        <div className="card p-3">
          <div className="text-sm font-semibold text-slate-500">Chi phí</div>
          <div className="text-lg font-bold whitespace-nowrap sm:text-2xl">{loading ? '—' : formatMoney(cost)}</div>
        </div>
        <div className="card col-span-2 p-3 sm:col-span-1">
          <div className="text-sm font-semibold text-slate-500">{profit < 0 ? '⚠ Lỗ' : 'Lãi'}</div>
          <div className={`text-2xl font-bold whitespace-nowrap ${profitClass(profit)}`}>{loading ? '—' : signed(profit)}</div>
        </div>
      </div>
      <p className="-mt-2 text-sm text-slate-500">{scopeLabel} · doanh thu không tính hóa đơn đã hủy</p>

      {/* Biểu đồ cột theo tháng */}
      <section className="card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Theo tháng</h2>
          <div className="flex gap-3 text-sm text-slate-600">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: CHART.revenue }} /> Doanh thu
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: CHART.cost }} /> Chi phí
            </span>
          </div>
        </div>
        {loading ? (
          <p className="py-16 text-center text-slate-400">Đang tải...</p>
        ) : (
          <MonthlyBarChart months={months} selected={month} onSelect={setMonth} />
        )}

        {/* Bảng số liệu (đọc được không cần nhìn biểu đồ) */}
        {!loading && (
          <div className="-mx-4 mt-3 overflow-x-auto px-4">
            <table className="w-full min-w-[20rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-semibold">Tháng</th>
                  <th className="py-2 text-right font-semibold">Doanh thu</th>
                  <th className="py-2 text-right font-semibold">Chi phí</th>
                  <th className="py-2 text-right font-semibold">Lãi / lỗ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {months.map((m) => (
                  <tr
                    key={m.month}
                    className={`cursor-pointer ${month === m.month ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
                    onClick={() => setMonth(month === m.month ? null : m.month)}
                  >
                    <td className="py-2 font-semibold">T{m.month}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(m.revenue)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(m.cost)}</td>
                    <td className={`py-2 text-right font-semibold tabular-nums ${profitClass(m.revenue - m.cost)}`}>
                      {signed(m.revenue - m.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-bold">
                  <td className="py-2">Cả năm</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(months.reduce((s, m) => s + m.revenue, 0))}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(months.reduce((s, m) => s + m.cost, 0))}</td>
                  <td className={`py-2 text-right tabular-nums ${profitClass(months.reduce((s, m) => s + m.revenue - m.cost, 0))}`}>
                    {signed(months.reduce((s, m) => s + m.revenue - m.cost, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Chi phí theo nhóm hàng */}
      <section className="card p-4">
        <h2 className="text-lg font-bold">Chi phí theo nhóm hàng</h2>
        <p className="mb-2 text-sm text-slate-500">{scopeLabel}</p>
        {cost === 0 ? (
          <p className="py-4 text-center text-slate-400">{loading ? 'Đang tải...' : 'Chưa có chi phí mua hàng.'}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 text-left font-semibold">Nhóm</th>
                <th className="py-2 text-right font-semibold">Chi phí</th>
                <th className="w-16 py-2 text-right font-semibold">Tỉ lệ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map(({ g, amount }) => (
                <tr key={g} className={amount === 0 ? 'text-slate-400' : ''}>
                  <td className="py-2">
                    <div className="font-semibold">
                      {GROUP_META[g].icon} {GROUP_META[g].label}
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      {amount > 0 && (
                        <div className="h-1.5 rounded-full bg-teal-600" style={{ width: `${(amount / cost) * 100}%` }} />
                      )}
                    </div>
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(amount)}</td>
                  <td className="py-2 text-right tabular-nums">{formatPercent(amount / cost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-bold">
                <td className="py-2">Tổng</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(cost)}</td>
                <td className="py-2 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <PriceHistory ingredients={ingredients} />
    </div>
  )
}
