// Màu và hàm vẽ dùng chung cho các biểu đồ (bảng màu đã kiểm tra dễ phân biệt, kể cả người mù màu)
export const CHART = {
  revenue: '#257de0', // xanh dương - doanh thu
  cost: '#f47230', // cam - chi phí
  ink: '#191919',
  ink2: '#666666', // chữ trục, chú thích
  grid: '#e7e7e7',
  axis: '#c2c2c2',
  highlight: '#f1f5f9', // nền tháng đang chọn
}

/** 1.500.000 -> "1,5tr"; 250.000 -> "250k"; 2.000.000.000 -> "2 tỷ" */
export function compactMoney(n: number): string {
  const f = (x: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(x)
  if (n >= 1e9) return `${f(n / 1e9)} tỷ`
  if (n >= 1e6) return `${f(n / 1e6)}tr`
  if (n >= 1e3) return `${f(n / 1e3)}k`
  return String(n)
}

/** Các mốc chia trục tròn số (0, 2tr, 4tr, ...) phủ được giá trị lớn nhất */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1000]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 2.5, 5, 10].find((s) => s * mag >= raw) ?? 10) * mag
  const ticks: number[] = []
  for (let v = 0; v < max + step; v += step) {
    ticks.push(Math.round(v))
    if (v >= max) break
  }
  return ticks
}

/** Cột bo tròn 4px ở đầu trên, vuông ở chân */
export function topRoundedBar(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}
