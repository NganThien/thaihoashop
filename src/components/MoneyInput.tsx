// Ô nhập số tiền: tự thêm dấu chấm phân cách hàng nghìn khi gõ (25.000)
import { formatNumber, parseNumber } from '../lib/format'

interface Props {
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  className?: string
  suffix?: string
  id?: string
}

export default function MoneyInput({ value, onChange, placeholder, className = '', suffix = '₫', id }: Props) {
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={`input pr-9 text-right ${className}`}
        placeholder={placeholder}
        value={value === null ? '' : formatNumber(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '') === '' ? null : parseNumber(e.target.value))}
        onFocus={(e) => e.target.select()}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">{suffix}</span>
    </div>
  )
}
