// Biểu đồ cột theo tháng: Doanh thu và Chi phí đặt cạnh nhau.
// Rê chuột / chạm vào một tháng để xem số liệu; bấm để chọn tháng đó.
import { useEffect, useRef, useState } from 'react'
import type { MonthReport } from '../../types'
import { formatMoney } from '../../lib/format'
import { CHART, compactMoney, niceTicks, topRoundedBar } from './chart'

interface Props {
  months: MonthReport[]
  selected: number | null
  onSelect: (month: number | null) => void
}

const H = 220
const PAD = { top: 12, right: 4, bottom: 24, left: 44 }

export default function MonthlyBarChart({ months, selected, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  // Vẽ theo đúng bề rộng thật để chữ không bị co giãn
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const max = Math.max(0, ...months.flatMap((m) => [m.revenue, m.cost]))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = H - PAD.top - PAD.bottom
  const band = months.length ? plotW / months.length : 0
  const barW = Math.max(3, Math.min(24, (band - 8) / 2 - 1))
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH
  const shown = hover ?? selected
  const tip = months.find((m) => m.month === hover)

  return (
    <div ref={wrap} className="relative select-none">
      {width > 0 && (
        <svg
          width={width}
          height={H}
          role="img"
          aria-label="Biểu đồ doanh thu và chi phí theo tháng. Số liệu chi tiết ở bảng bên dưới."
          onMouseLeave={() => setHover(null)}
        >
          {/* Lưới ngang + nhãn trục */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHART.axis : CHART.grid} />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.ink2} className="tabular-nums">
                {compactMoney(t)}
              </text>
            </g>
          ))}

          {months.map((m, i) => {
            const x0 = PAD.left + i * band
            const cx = x0 + band / 2
            return (
              <g key={m.month}>
                {shown === m.month && (
                  <rect x={x0 + 1} y={PAD.top} width={band - 2} height={plotH} rx={4} fill={CHART.highlight} />
                )}
                <path d={topRoundedBar(cx - barW - 1, y(m.revenue), barW, y(0) - y(m.revenue))} fill={CHART.revenue} />
                <path d={topRoundedBar(cx + 1, y(m.cost), barW, y(0) - y(m.cost))} fill={CHART.cost} />
                <text
                  x={cx}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill={selected === m.month ? CHART.ink : CHART.ink2}
                  fontWeight={selected === m.month ? 700 : 400}
                >
                  T{m.month}
                </text>
                {/* Vùng bấm / rê chuột rộng hơn cột */}
                <rect
                  x={x0}
                  y={0}
                  width={band}
                  height={H}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(m.month)}
                  onClick={() => onSelect(selected === m.month ? null : m.month)}
                >
                  <title>{`Tháng ${m.month}: doanh thu ${formatMoney(m.revenue)}, chi phí ${formatMoney(m.cost)}`}</title>
                </rect>
              </g>
            )
          })}
        </svg>
      )}

      {/* Hộp số liệu khi rê chuột */}
      {tip && width > 0 && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-44 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-lg"
          style={{
            left: Math.min(Math.max(0, PAD.left + (tip.month - months[0].month + 0.5) * band - 88), width - 176),
          }}
        >
          <div className="mb-1 font-bold text-slate-800">Tháng {tip.month}</div>
          <TipRow color={CHART.revenue} label="Doanh thu" value={formatMoney(tip.revenue)} />
          <TipRow color={CHART.cost} label="Chi phí" value={formatMoney(tip.cost)} />
          <div className="mt-1 flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-800">
            <span>{tip.revenue - tip.cost < 0 ? 'Lỗ' : 'Lãi'}</span>
            <span className="tabular-nums">{formatMoney(Math.abs(tip.revenue - tip.cost))}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-slate-600">
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
        {label}
      </span>
      <span className="text-slate-800 tabular-nums">{value}</span>
    </div>
  )
}
