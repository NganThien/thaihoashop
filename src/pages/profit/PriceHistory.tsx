// THEO DÕI GIÁ: chọn một mặt hàng để xem giá mua qua các lần (tăng / giảm bao nhiêu)
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Ingredient } from '../../types'
import { listPriceHistory, type PriceHistoryRow } from '../../lib/api'
import { errorMessage, formatDate, formatMoney, isoToVNDate, normalizeText } from '../../lib/format'
import { formatPercent, formatQuantity, GROUP_META } from '../../lib/costing'
import { useToast } from '../../components/Toast'
import { CHART, compactMoney } from './chart'

export default function PriceHistory({ ingredients }: { ingredients: Ingredient[] }) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Ingredient | null>(null)
  const [rows, setRows] = useState<PriceHistoryRow[]>([])
  const [loading, setLoading] = useState(false)

  const matches = useMemo(() => {
    const q = normalizeText(search)
    if (!q) return []
    return ingredients.filter((i) => normalizeText(i.name).includes(q)).slice(0, 8)
  }, [ingredients, search])

  useEffect(() => {
    if (!picked) return
    setLoading(true)
    listPriceHistory(picked.id)
      .then(setRows)
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [picked, toast])

  // Chỉ so sánh giá giữa các lần mua cùng đơn vị (đơn vị dùng nhiều nhất)
  const unit = useMemo(() => {
    const count = new Map<string, number>()
    rows.forEach((r) => count.set(r.unit, (count.get(r.unit) ?? 0) + 1))
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  }, [rows])
  const sameUnit = rows.filter((r) => r.unit === unit)
  const prices = sameUnit.map((r) => r.unit_price)
  const first = sameUnit[0]
  const last = sameUnit[sameUnit.length - 1]

  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-lg font-bold">Theo dõi giá mua</h2>

      {picked ? (
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
          <span className="text-xl">{GROUP_META[picked.item_group].icon}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{picked.name}</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setPicked(null)
              setRows([])
              setSearch('')
            }}
          >
            Đổi mặt hàng
          </button>
        </div>
      ) : (
        <div>
          <input
            type="search"
            className="input"
            placeholder="🔍 Gõ tên hàng, vd: thịt heo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {matches.length > 0 && (
            <ul className="mt-1 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {matches.map((i) => (
                <li key={i.id}>
                  <button className="flex min-h-12 w-full items-center gap-2 px-3 text-left hover:bg-teal-50" onClick={() => setPicked(i)}>
                    <span>{GROUP_META[i.item_group].icon}</span>
                    <span className="flex-1 font-semibold">{i.name}</span>
                    {i.last_price !== null && (
                      <span className="text-sm text-slate-500">
                        {formatMoney(i.last_price)}
                        {i.unit && `/${i.unit}`}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {search && matches.length === 0 && <p className="mt-2 text-sm text-slate-500">Không tìm thấy mặt hàng.</p>}
          {!search && ingredients.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">Chưa có mặt hàng nào. Hãy nhập vài lần mua hàng trước.</p>
          )}
        </div>
      )}

      {picked && loading && <p className="py-4 text-center text-slate-500">Đang tải...</p>}
      {picked && !loading && rows.length === 0 && <p className="py-4 text-center text-slate-500">Chưa có lần mua nào.</p>}

      {picked && !loading && sameUnit.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Gần nhất" value={formatMoney(last.unit_price)} sub={formatDate(isoToVNDate(last.purchases.purchased_at))} />
            <Stat
              label="So với lần đầu"
              value={change(first.unit_price, last.unit_price).amount}
              sub={[change(first.unit_price, last.unit_price).pct, `lần đầu ${formatMoney(first.unit_price)}`]
                .filter(Boolean)
                .join(' · ')}
            />
            <Stat label="Thấp nhất" value={formatMoney(Math.min(...prices))} />
            <Stat label="Cao nhất" value={formatMoney(Math.max(...prices))} />
          </div>
          <p className="text-sm text-slate-500">
            Giá tính theo đơn vị <b>{unit || '(không có)'}</b> · {sameUnit.length} lần mua
            {rows.length > sameUnit.length && ` (bỏ qua ${rows.length - sameUnit.length} lần mua theo đơn vị khác)`}
          </p>
          {sameUnit.length >= 2 && <PriceLine rows={sameUnit} />}
        </>
      )}

      {picked && !loading && rows.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[19rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 font-semibold">Ngày</th>
                <th className="py-2 font-semibold">Số lượng</th>
                <th className="py-2 text-right font-semibold">Đơn giá</th>
                <th className="py-2 text-right font-semibold">Thay đổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...rows].reverse().map((r) => {
                // So với lần mua liền trước cùng đơn vị
                const idx = rows.indexOf(r)
                const prev = rows.slice(0, idx).reverse().find((x) => x.unit === r.unit)
                return (
                  <tr key={r.id}>
                    <td className="py-2">
                      {formatDate(isoToVNDate(r.purchases.purchased_at))}
                      {r.purchases.place && <div className="text-xs text-slate-500">{r.purchases.place}</div>}
                    </td>
                    <td className="py-2 tabular-nums">
                      {formatQuantity(Number(r.quantity))} {r.unit}
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums">{formatMoney(r.unit_price)}</td>
                    <td className="py-2 text-right whitespace-nowrap tabular-nums">
                      {prev ? (
                        <>
                          {change(prev.unit_price, r.unit_price).amount}
                          <div className="text-xs text-slate-500">{change(prev.unit_price, r.unit_price).pct}</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** Chênh lệch giá: { amount: "▲ 10.000 ₫", pct: "+8,3%" } / { amount: "= không đổi" } */
function change(from: number, to: number): { amount: string; pct: string } {
  const d = to - from
  if (d === 0) return { amount: '= không đổi', pct: '' }
  return {
    amount: `${d > 0 ? '▲' : '▼'} ${formatMoney(Math.abs(d))}`,
    pct: from ? `${d > 0 ? '+' : '−'}${formatPercent(Math.abs(d) / from)}` : '',
  }
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-bold text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

/** Đường giá qua các lần mua (mỗi điểm là một lần mua) */
function PriceLine({ rows }: { rows: PriceHistoryRow[] }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const H = 150
  const PAD = { top: 16, right: 16, bottom: 22, left: 44 }
  const prices = rows.map((r) => r.unit_price)
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const span = hi - lo || hi * 0.1 || 1
  const min = Math.max(0, lo - span * 0.15)
  const max = hi + span * 0.15
  const x = (i: number) => PAD.left + (i / (rows.length - 1)) * (width - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * (H - PAD.top - PAD.bottom)
  const d = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.unit_price)}`).join('')
  const tip = hover === null ? null : rows[hover]

  return (
    <div ref={wrap} className="relative">
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="Biểu đồ giá mua qua các lần" onMouseLeave={() => setHover(null)}>
          {[lo, hi].map((v, k) => (
            <g key={k}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={CHART.grid} />
              <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.ink2}>
                {compactMoney(v)}
              </text>
            </g>
          ))}
          <path d={d} fill="none" stroke={CHART.revenue} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {rows.map((r, i) => (
            <g key={r.id}>
              <circle cx={x(i)} cy={y(r.unit_price)} r={hover === i ? 6 : 4} fill={CHART.revenue} stroke="#fff" strokeWidth={2} />
              <circle
                cx={x(i)}
                cy={y(r.unit_price)}
                r={14}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onClick={() => setHover(hover === i ? null : i)}
              />
            </g>
          ))}
          <text x={PAD.left} y={H - 4} fontSize={11} fill={CHART.ink2}>
            {formatDate(isoToVNDate(rows[0].purchases.purchased_at))}
          </text>
          <text x={width - PAD.right} y={H - 4} fontSize={11} fill={CHART.ink2} textAnchor="end">
            {formatDate(isoToVNDate(rows[rows.length - 1].purchases.purchased_at))}
          </text>
        </svg>
      )}
      {tip && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs shadow"
          style={{ left: Math.min(Math.max(0, x(hover) - 60), width - 120) }}
        >
          <div className="font-semibold text-slate-800 tabular-nums">{formatMoney(tip.unit_price)}</div>
          <div className="text-slate-500">{formatDate(isoToVNDate(tip.purchases.purchased_at))}</div>
        </div>
      )}
    </div>
  )
}
