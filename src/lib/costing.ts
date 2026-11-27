// Nhóm hàng, số lượng và các công thức tính giá mâm (dùng chung cho màn hình và Excel)
import { ITEM_GROUPS, type ItemGroup, type PurchaseItem } from '../types'
import { normalizeText } from './format'

export const GROUP_META: Record<ItemGroup, { label: string; icon: string }> = {
  'thịt': { label: 'Thịt', icon: '🥩' },
  'cá/hải sản': { label: 'Cá/Hải sản', icon: '🐟' },
  'rau củ': { label: 'Rau củ', icon: '🥬' },
  'gạo/đồ khô': { label: 'Gạo/Đồ khô', icon: '🍚' },
  'gia vị': { label: 'Gia vị', icon: '🧂' },
  'chi phí khác': { label: 'Chi phí khác', icon: '🧾' },
}

export const groupLabel = (g: ItemGroup) => GROUP_META[g]?.label ?? g

/** Đơn vị hay dùng (gợi ý khi nhập, vẫn gõ được đơn vị khác) */
export const COMMON_UNITS = ['kg', 'lạng', 'con', 'bó', 'mớ', 'quả', 'trái', 'bao', 'bình', 'gói', 'chai', 'lít', 'hộp', 'thùng', 'cái', 'lần']

const qtyFmt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })

/** 1.5 -> "1,5" */
export function formatQuantity(n: number): string {
  return qtyFmt.format(n)
}

const pctFmt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

/** Tỉ lệ 0.2125 -> "21,3%" */
export function formatPercent(ratio: number): string {
  return `${pctFmt.format(Math.round(ratio * 1000) / 10)}%`
}

/** Đọc số lượng người dùng gõ: "1,5" hoặc "1.5" -> 1.5; không hợp lệ -> null */
export function parseQuantity(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : null
}

/** Tổng tiền theo từng nhóm hàng (đủ 6 nhóm, nhóm không mua = 0) */
export function sumByGroup(items: Pick<PurchaseItem, 'item_group' | 'line_total'>[]): Record<ItemGroup, number> {
  const out = Object.fromEntries(ITEM_GROUPS.map((g) => [g, 0])) as Record<ItemGroup, number>
  for (const it of items) out[it.item_group] = (out[it.item_group] ?? 0) + it.line_total
  return out
}

export interface Pricing {
  costPerTray: number // giá vốn mỗi mâm (có thể lẻ)
  suggested: number // giá bán gợi ý, đã làm tròn lên 5.000đ
  profitPerTray: number | null // theo giá chốt
  totalProfit: number | null // theo giá chốt
  revenue: number | null // giá chốt × số mâm
}

/**
 * Giá vốn mỗi mâm = tổng chi phí ÷ số mâm
 * Giá bán gợi ý   = giá vốn × (1 + % lãi), làm tròn LÊN đến 5.000đ
 * Lãi theo giá chốt = giá chốt − giá vốn (mỗi mâm), × số mâm (cả đợt)
 */
export function calcPricing(totalCost: number, trays: number, profitPercent: number, finalPrice: number | null): Pricing {
  const costPerTray = totalCost / trays
  // Tính bằng số nguyên để không bị sai số làm tròn: ceil(cost × (100 + %) / (100 × mâm × 5000)) × 5000
  const num = totalCost * (100 + profitPercent)
  const den = 100 * trays * 5000
  const suggested = Math.ceil(num / den - 1e-9) * 5000
  const revenue = finalPrice === null ? null : finalPrice * trays
  return {
    costPerTray,
    suggested: Math.max(0, suggested),
    profitPerTray: finalPrice === null ? null : finalPrice - costPerTray,
    totalProfit: revenue === null ? null : revenue - totalCost,
    revenue,
  }
}

// Đoán nhóm cho hàng mới theo chữ đầu của tên (người dùng vẫn đổi lại được)
const GROUP_KEYWORDS: Record<ItemGroup, string[]> = {
  'thịt': ['thit', 'heo', 'lon', 'bo', 'ga', 'vit', 'ngan', 'de', 'suon', 'ba chi', 'nac', 'gio', 'cha', 'long', 'xuong', 'trung'],
  'cá/hải sản': ['ca', 'tom', 'muc', 'cua', 'ghe', 'ngheu', 'so', 'oc', 'hen', 'bach tuoc', 'hai san', 'luon', 'ech'],
  'rau củ': ['rau', 'cai', 'cu', 'ca rot', 'ca chua', 'ca tim', 'khoai', 'bap', 'dua', 'dau que', 'dau bap', 'nam', 'gia', 'bi', 'muop', 'xa lach', 'hanh la', 'ngo', 'thi la', 'chanh', 'trai cay', 'qua'],
  'gạo/đồ khô': ['gao', 'nep', 'bun', 'pho', 'mien', 'mi', 'banh trang', 'banh pho', 'bot', 'dau phong', 'moc nhi', 'nam meo', 'hat', 'kho'],
  'gia vị': ['muoi', 'duong', 'nuoc mam', 'mam', 'dau an', 'dau hao', 'tieu', 'bot ngot', 'bot canh', 'hat nem', 'toi', 'hanh tim', 'hanh kho', 'ot', 'sa', 'gung', 'nghe', 'xi dau', 'tuong', 'giam', 'me', 'ngu vi'],
  'chi phí khác': ['gas', 'binh ga', 'binh gas', 'da', 'nuoc da', 'than', 'cui', 'xe', 'van chuyen', 'cho hang', 'thue', 'ban ghe', 'khan', 'hop xop', 'tui', 'ly', 'chen', 'dien', 'nuoc'],
}

// Từ dài xét trước để "cà rốt" không bị hiểu là "cá", "bình ga" không bị hiểu là "gà"
const KEYWORDS = (Object.entries(GROUP_KEYWORDS) as [ItemGroup, string[]][])
  .flatMap(([group, words]) => words.map((w) => ({ group, w })))
  .sort((a, b) => b.w.length - a.w.length)

export function guessGroup(name: string): ItemGroup | null {
  const n = ` ${normalizeText(name).replace(/\s+/g, ' ')} `
  return KEYWORDS.find(({ w }) => n.startsWith(` ${w} `))?.group ?? null
}
