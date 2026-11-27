// Xuất file Excel (.xlsx) để backup. Thư viện chỉ được tải khi bấm nút xuất.
import type { Category, OrderWithItems, Product } from '../types'
import type { Cell, Row } from 'write-excel-file/browser'
import { formatDateTime } from './format'

const header = (titles: string[]): Row => titles.map((t) => ({ value: t, fontWeight: 'bold' as const }))
const money = (n: number): Cell => ({ value: n, type: Number, format: '#,##0' })
const text = (s: string | null | undefined): Cell => ({ value: s ?? '', type: String })
const statusText = (s: string) => (s === 'paid' ? 'Đã thanh toán' : 'Đã hủy')

async function writer() {
  return (await import('write-excel-file/browser')).default
}

export async function exportProducts(products: Product[], categories: Category[], fileName: string) {
  const catName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? 'Chưa phân nhóm'
  const data: Row[] = [
    header(['ID', 'Tên món', 'Giá (₫)', 'Đơn vị', 'Nhóm', 'Trạng thái', 'Link ảnh', 'Ngày tạo']),
    ...products.map((p): Row => [
      p.id,
      text(p.name),
      money(p.price),
      text(p.unit),
      text(catName(p.category_id)),
      text(p.is_active ? 'Đang bán' : 'Đang ẩn'),
      text(p.image_url),
      text(formatDateTime(p.created_at)),
    ]),
  ]
  const write = await writer()
  await write([
    {
      data,
      sheet: 'Danh sách món',
      columns: [{ width: 6 }, { width: 30 }, { width: 12 }, { width: 10 }, { width: 16 }, { width: 12 }, { width: 40 }, { width: 18 }],
      stickyRowsCount: 1,
    },
  ]).toFile(fileName)
}

export async function exportOrders(orders: OrderWithItems[], fileName: string) {
  // Sheet 1: mỗi dòng là một hóa đơn
  const ordersSheet: Row[] = [
    header(['Mã HĐ', 'Thời gian', 'Tạm tính', 'Giảm giá', 'Tổng tiền', 'Khách đưa', 'Tiền thối', 'Trạng thái', 'Ghi chú']),
    ...orders.map((o): Row => [
      text(o.code),
      text(formatDateTime(o.created_at)),
      money(o.subtotal),
      money(o.discount),
      money(o.total),
      money(o.amount_paid),
      money(o.change_amount),
      text(statusText(o.status)),
      text(o.note),
    ]),
  ]

  // Sheet 2: mỗi dòng là một món trong hóa đơn
  const itemsSheet: Row[] = [
    header(['Mã HĐ', 'Thời gian', 'Tên món', 'Đơn giá', 'Số lượng', 'Thành tiền', 'Trạng thái HĐ']),
    ...orders.flatMap((o) =>
      o.order_items.map((it): Row => [
        text(o.code),
        text(formatDateTime(o.created_at)),
        text(it.product_name),
        money(it.unit_price),
        it.quantity,
        money(it.line_total),
        text(statusText(o.status)),
      ]),
    ),
  ]

  const write = await writer()
  await write([
    {
      data: ordersSheet,
      sheet: 'Hóa đơn',
      columns: [{ width: 18 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 30 }],
      stickyRowsCount: 1,
    },
    {
      data: itemsSheet,
      sheet: 'Chi tiết',
      columns: [{ width: 18 }, { width: 18 }, { width: 30 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 14 }],
      stickyRowsCount: 1,
    },
  ]).toFile(fileName)
}
