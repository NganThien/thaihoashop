// Xuất file Excel (.xlsx) để backup. Thư viện chỉ được tải khi bấm nút xuất.
import { ITEM_GROUPS, type Batch, type Category, type OrderWithItems, type Product, type PurchaseWithItems } from '../types'
import type { Cell, Row } from 'write-excel-file/browser'
import { formatDate, formatDateTime } from './format'
import { calcPricing, groupLabel, sumByGroup } from './costing'

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

// ----------------------------- Mua hàng -----------------------------

const qty = (n: number): Cell => ({ value: Number(n), type: Number })
const percent = (part: number, whole: number): Cell => ({ value: whole ? part / whole : 0, type: Number, format: '0.0%' })

function purchaseItemsSheet(purchases: PurchaseWithItems[], batchName: (id: number | null) => string): Row[] {
  return [
    header(['Ngày mua', 'Đợt nấu', 'Nơi mua', 'Tên hàng', 'Nhóm', 'Số lượng', 'Đơn vị', 'Đơn giá', 'Thành tiền']),
    ...purchases.flatMap((p) =>
      p.purchase_items.map((it): Row => [
        text(formatDateTime(p.purchased_at)),
        text(batchName(p.batch_id)),
        text(p.place),
        text(it.item_name),
        text(groupLabel(it.item_group)),
        qty(it.quantity),
        text(it.unit),
        money(it.unit_price),
        money(it.line_total),
      ]),
    ),
  ]
}
const ITEM_COLUMNS = [{ width: 18 }, { width: 26 }, { width: 18 }, { width: 26 }, { width: 14 }, { width: 10 }, { width: 8 }, { width: 12 }, { width: 13 }]

/** Danh sách mua hàng: trang "Lần mua" (mỗi dòng một lần mua) + "Chi tiết mua" (từng dòng hàng) */
export async function exportPurchases(purchases: PurchaseWithItems[], batches: Batch[], fileName: string) {
  const batchName = (id: number | null) => (id === null ? 'Mua chung' : (batches.find((b) => b.id === id)?.name ?? ''))
  const purchasesSheet: Row[] = [
    header(['Ngày mua', 'Đợt nấu', 'Nơi mua', 'Số dòng hàng', 'Tổng tiền', 'Ghi chú']),
    ...purchases.map((p): Row => [
      text(formatDateTime(p.purchased_at)),
      text(batchName(p.batch_id)),
      text(p.place),
      p.purchase_items.length,
      money(p.total),
      text(p.note),
    ]),
  ]
  const write = await writer()
  await write([
    {
      data: purchasesSheet,
      sheet: 'Lần mua',
      columns: [{ width: 18 }, { width: 26 }, { width: 18 }, { width: 12 }, { width: 13 }, { width: 30 }],
      stickyRowsCount: 1,
    },
    { data: purchaseItemsSheet(purchases, batchName), sheet: 'Chi tiết mua', columns: ITEM_COLUMNS, stickyRowsCount: 1 },
  ]).toFile(fileName)
}

/** Bảng tính giá của MỘT đợt: trang "Tính giá" (tổng hợp + chi phí theo nhóm) + "Chi tiết mua" */
export async function exportBatchPricing(batch: Batch, purchases: PurchaseWithItems[], fileName: string) {
  const items = purchases.flatMap((p) => p.purchase_items)
  const total = purchases.reduce((s, p) => s + p.total, 0)
  const groups = sumByGroup(items)
  const pr = calcPricing(total, batch.tray_count, batch.profit_percent, batch.final_price)
  const bold = (s: string): Cell => ({ value: s, fontWeight: 'bold' })
  const moneyOrBlank = (n: number | null): Cell | null => (n === null ? null : money(Math.round(n)))

  const sheet: Row[] = [
    [bold('BẢNG TÍNH GIÁ MÂM')],
    [text('Tên đợt'), text(batch.name)],
    [text('Ngày nấu'), text(formatDate(batch.date))],
    [text('Trạng thái'), text(batch.status === 'đã chốt' ? 'Đã chốt' : 'Đang mua')],
    [text('Số mâm'), batch.tray_count],
    [text('% lãi mong muốn'), { value: batch.profit_percent / 100, type: Number, format: '0%' }],
    [],
    [bold('Tổng chi phí'), money(total)],
    [text('Giá vốn / mâm'), money(Math.round(pr.costPerTray))],
    [text('Giá bán gợi ý / mâm (làm tròn lên 5.000đ)'), money(pr.suggested)],
    [bold('Giá bán chốt / mâm'), moneyOrBlank(batch.final_price)],
    [text('Lãi mỗi mâm (theo giá chốt)'), moneyOrBlank(pr.profitPerTray)],
    [text('Doanh thu dự kiến'), moneyOrBlank(pr.revenue)],
    [bold('Tổng lãi cả đợt'), moneyOrBlank(pr.totalProfit)],
    [],
    header(['Nhóm hàng', 'Chi phí', 'Tỉ lệ']),
    ...ITEM_GROUPS.map((g): Row => [text(groupLabel(g)), money(groups[g]), percent(groups[g], total)]),
    [bold('Tổng'), money(total), percent(total, total)],
  ]
  if (batch.note) sheet.splice(6, 0, [text('Ghi chú'), text(batch.note)])

  const write = await writer()
  await write([
    { data: sheet, sheet: 'Tính giá', columns: [{ width: 42 }, { width: 28 }, { width: 10 }] },
    {
      data: purchaseItemsSheet(purchases, () => batch.name),
      sheet: 'Chi tiết mua',
      columns: ITEM_COLUMNS,
      stickyRowsCount: 1,
    },
  ]).toFile(fileName)
}

/** Tổng hợp các đợt nấu: mỗi dòng một đợt với chi phí, giá vốn, giá bán, lãi */
export async function exportBatches(batches: (Batch & { purchases: { total: number }[] })[], fileName: string) {
  const data: Row[] = [
    header([
      'Tên đợt', 'Ngày nấu', 'Trạng thái', 'Số mâm', '% lãi', 'Tổng chi phí', 'Vốn / mâm',
      'Giá gợi ý / mâm', 'Giá chốt / mâm', 'Lãi / mâm', 'Tổng lãi', 'Ghi chú',
    ]),
    ...batches.map((b): Row => {
      const cost = b.purchases.reduce((s, p) => s + p.total, 0)
      const pr = calcPricing(cost, b.tray_count, b.profit_percent, b.final_price)
      return [
        text(b.name),
        text(formatDate(b.date)),
        text(b.status === 'đã chốt' ? 'Đã chốt' : 'Đang mua'),
        b.tray_count,
        { value: b.profit_percent / 100, type: Number, format: '0%' },
        money(cost),
        money(Math.round(pr.costPerTray)),
        money(pr.suggested),
        b.final_price === null ? null : money(b.final_price),
        pr.profitPerTray === null ? null : money(Math.round(pr.profitPerTray)),
        pr.totalProfit === null ? null : money(Math.round(pr.totalProfit)),
        text(b.note),
      ]
    }),
  ]
  const write = await writer()
  await write([
    {
      data,
      sheet: 'Các đợt nấu',
      columns: [
        { width: 30 }, { width: 12 }, { width: 11 }, { width: 8 }, { width: 7 }, { width: 13 }, { width: 12 },
        { width: 14 }, { width: 14 }, { width: 12 }, { width: 13 }, { width: 30 },
      ],
      stickyRowsCount: 1,
    },
  ]).toFile(fileName)
}
