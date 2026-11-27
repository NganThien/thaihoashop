// Các hàm định dạng tiền, ngày giờ (múi giờ Việt Nam) và tìm kiếm

const TZ = 'Asia/Ho_Chi_Minh'
const moneyFmt = new Intl.NumberFormat('vi-VN')

/** 25000 -> "25.000 ₫" */
export function formatMoney(n: number): string {
  return `${moneyFmt.format(Math.round(n || 0))} ₫`
}

/** 25000 -> "25.000" (không có ký hiệu ₫, dùng trong ô nhập) */
export function formatNumber(n: number): string {
  return moneyFmt.format(Math.round(n || 0))
}

/** Lấy số nguyên từ chuỗi người dùng gõ: "25.000đ" -> 25000 */
export function parseNumber(s: string): number {
  const digits = s.replace(/\D/g, '')
  return digits ? Math.min(Number(digits), 2_000_000_000) : 0
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** "27/11/2026 14:05" theo giờ Việt Nam (dù điện thoại đặt múi giờ nào) */
export function formatDateTime(iso: string): string {
  const p = Object.fromEntries(dateTimeFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

/** Ngày hôm nay theo giờ VN dạng "YYYY-MM-DD" (dùng cho ô chọn ngày) */
export function todayVN(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

/** Cộng/trừ số ngày cho chuỗi "YYYY-MM-DD" */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Đổi khoảng ngày (theo giờ VN, UTC+7) thành mốc thời gian để lọc:
 * từ 00:00 ngày bắt đầu đến trước 00:00 của ngày sau ngày kết thúc.
 */
export function vnDateRange(from: string, to: string): { start: string; end: string } {
  return {
    start: new Date(`${from}T00:00:00+07:00`).toISOString(),
    end: new Date(`${addDays(to, 1)}T00:00:00+07:00`).toISOString(),
  }
}

/** Bỏ dấu tiếng Việt để tìm "ca phe" vẫn ra "Cà phê" */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

/** Lấy thông báo lỗi dễ hiểu từ lỗi Supabase / mạng */
export function errorMessage(err: unknown): string {
  const msg =
    typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err)
  if (/failed to fetch|network/i.test(msg)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  if (/invalid login credentials/i.test(msg)) return 'Sai email hoặc mật khẩu.'
  if (/jwt|not authenticated/i.test(msg)) return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'
  return msg
}
