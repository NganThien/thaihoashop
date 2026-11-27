// Chọn khoảng ngày (theo giờ Việt Nam) + các nút chọn nhanh
import { addDays, todayVN } from '../lib/format'

export interface DateRange {
  from: string // "YYYY-MM-DD"
  to: string
}

export function todayRange(): DateRange {
  const t = todayVN()
  return { from: t, to: t }
}

function presets(): { label: string; range: DateRange }[] {
  const t = todayVN()
  return [
    { label: 'Hôm nay', range: { from: t, to: t } },
    { label: 'Hôm qua', range: { from: addDays(t, -1), to: addDays(t, -1) } },
    { label: '7 ngày', range: { from: addDays(t, -6), to: t } },
    { label: 'Tháng này', range: { from: `${t.slice(0, 8)}01`, to: t } },
  ]
}

export default function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="label">Từ ngày</span>
          <input
            type="date"
            className="input"
            value={value.from}
            max={value.to}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
          />
        </label>
        <label>
          <span className="label">Đến ngày</span>
          <input
            type="date"
            className="input"
            value={value.to}
            min={value.from}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets().map((p) => {
          const active = p.range.from === value.from && p.range.to === value.to
          return (
            <button
              key={p.label}
              type="button"
              className={`chip ${active ? 'chip-on' : 'chip-off'}`}
              onClick={() => onChange(p.range)}
            >
              {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
