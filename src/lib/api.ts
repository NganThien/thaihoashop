// Tất cả các lệnh đọc/ghi dữ liệu Supabase nằm ở file này
import { supabase } from './supabase'
import type {
  Batch,
  Category,
  Ingredient,
  ItemGroup,
  MonthReport,
  Order,
  OrderWithItems,
  Product,
  Purchase,
  PurchaseItem,
  PurchaseWithItems,
  Stats,
} from '../types'

/** Ném lỗi nếu Supabase trả về lỗi, ngược lại trả dữ liệu */
function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

// ----------------------------- Nhóm món -----------------------------

export async function listCategories(): Promise<Category[]> {
  return check(await supabase.from('categories').select('*').order('sort_order').order('id'))
}

export async function createCategory(name: string, sortOrder: number): Promise<void> {
  check(await supabase.from('categories').insert({ name: name.trim(), sort_order: sortOrder }))
}

export async function renameCategory(id: number, name: string): Promise<void> {
  check(await supabase.from('categories').update({ name: name.trim() }).eq('id', id))
}

export async function deleteCategory(id: number): Promise<void> {
  // Các món trong nhóm sẽ thành "Chưa phân nhóm" (on delete set null)
  check(await supabase.from('categories').delete().eq('id', id))
}

/** Lưu thứ tự mới: phần tử đầu tiên có sort_order = 1, ... */
export async function reorderCategories(ids: number[]): Promise<void> {
  const results = await Promise.all(
    ids.map((id, i) => supabase.from('categories').update({ sort_order: i + 1 }).eq('id', id)),
  )
  results.forEach((r) => check(r))
}

// ------------------------------- Món --------------------------------

export async function listProducts(activeOnly = false): Promise<Product[]> {
  let q = supabase.from('products').select('*').order('name')
  if (activeOnly) q = q.eq('is_active', true)
  return check(await q)
}

export type ProductInput = Pick<Product, 'name' | 'price' | 'unit' | 'category_id' | 'image_url'>

export async function saveProduct(input: ProductInput, id?: number): Promise<void> {
  const data = { ...input, name: input.name.trim(), unit: input.unit.trim() }
  if (id) check(await supabase.from('products').update(data).eq('id', id))
  else check(await supabase.from('products').insert(data))
}

export async function setProductActive(id: number, isActive: boolean): Promise<void> {
  check(await supabase.from('products').update({ is_active: isActive }).eq('id', id))
}

/** Món đã từng xuất hiện trong hóa đơn nào chưa? */
export async function isProductUsed(id: number): Promise<boolean> {
  const res = await supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id)
  if (res.error) throw res.error
  return (res.count ?? 0) > 0
}

export async function deleteProduct(id: number): Promise<void> {
  check(await supabase.from('products').delete().eq('id', id))
}

/** Thu nhỏ ảnh về tối đa 500px rồi tải lên kho ảnh, trả về link ảnh */
export async function uploadProductImage(file: File): Promise<string> {
  const blob = await resizeImage(file, 500)
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  check(
    await supabase.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false }),
  )
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

async function resizeImage(file: File, maxSize: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không xử lý được ảnh'))), 'image/jpeg', 0.85),
  )
}

// ----------------------------- Hóa đơn ------------------------------

export interface CreateOrderInput {
  items: { product_id: number; quantity: number }[]
  discountType: 'amount' | 'percent'
  discountValue: number
  amountPaid: number | null // null = khách đưa đủ tiền
  note: string
}

/** Gọi hàm create_order trong database (lưu hóa đơn + chi tiết cùng lúc) */
export async function createOrder(input: CreateOrderInput): Promise<OrderWithItems> {
  const order = check(
    await supabase
      .rpc('create_order', {
        p_items: input.items,
        p_discount_type: input.discountType,
        p_discount_value: input.discountValue,
        p_amount_paid: input.amountPaid,
        p_note: input.note,
      })
      .single(),
  ) as Order
  return getOrder(order.id)
}

export async function getOrder(id: number): Promise<OrderWithItems> {
  return check(
    await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .order('id', { referencedTable: 'order_items' })
      .single(),
  )
}

export const ORDERS_PAGE_SIZE = 50

/** Danh sách hóa đơn trong khoảng thời gian, mới nhất trước, có phân trang */
export async function listOrders(start: string, end: string, page: number): Promise<Order[]> {
  const from = page * ORDERS_PAGE_SIZE
  return check(
    await supabase
      .from('orders')
      .select('*')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false })
      .range(from, from + ORDERS_PAGE_SIZE - 1),
  )
}

export async function cancelOrder(id: number): Promise<void> {
  check(await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id))
}

/** Lấy TẤT CẢ hóa đơn kèm chi tiết trong khoảng (dùng cho xuất Excel) */
export async function listAllOrdersWithItems(start: string, end: string): Promise<OrderWithItems[]> {
  const pageSize = 500 // Supabase trả tối đa 1000 dòng/lần nên lấy từng phần
  const all: OrderWithItems[] = []
  for (let from = 0; ; from += pageSize) {
    const rows: OrderWithItems[] = check(
      await supabase
        .from('orders')
        .select('*, order_items(*)')
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at')
        .order('id', { referencedTable: 'order_items' })
        .range(from, from + pageSize - 1),
    )
    all.push(...rows)
    if (rows.length < pageSize) return all
  }
}

// ----------------------------- Thống kê -----------------------------

export async function getStats(): Promise<Stats> {
  return check(await supabase.rpc('get_stats'))
}

// ------------------------ Danh mục hàng hay mua ------------------------

export async function listIngredients(): Promise<Ingredient[]> {
  return check(await supabase.from('ingredients').select('*').order('name'))
}

export type IngredientInput = Pick<Ingredient, 'name' | 'unit' | 'item_group' | 'last_price'>

export async function updateIngredient(id: number, input: IngredientInput): Promise<void> {
  check(
    await supabase
      .from('ingredients')
      .update({ ...input, name: input.name.trim(), unit: input.unit.trim() })
      .eq('id', id),
  )
}

export async function deleteIngredient(id: number): Promise<void> {
  // Các lần mua cũ vẫn giữ tên hàng (ingredient_id chuyển thành trống)
  check(await supabase.from('ingredients').delete().eq('id', id))
}

/** Một lần mua của một mặt hàng (để xem lịch sử giá) */
export interface PriceHistoryRow extends PurchaseItem {
  purchases: Pick<Purchase, 'purchased_at' | 'place' | 'batch_id'>
}

/** Lịch sử giá mua của một mặt hàng, cũ nhất trước */
export async function listPriceHistory(ingredientId: number): Promise<PriceHistoryRow[]> {
  const rows: PriceHistoryRow[] = check(
    await supabase
      .from('purchase_items')
      .select('*, purchases!inner(purchased_at, place, batch_id)')
      .eq('ingredient_id', ingredientId),
  )
  return rows.sort((a, b) => a.purchases.purchased_at.localeCompare(b.purchases.purchased_at) || a.id - b.id)
}

// ----------------------------- Lần mua hàng -----------------------------

export interface PurchaseListRow extends Purchase {
  batches: Pick<Batch, 'name'> | null
  purchase_items: Pick<PurchaseItem, 'item_name'>[]
}

export const PURCHASES_PAGE_SIZE = 50

/** 'all' = tất cả, 'none' = chỉ mua chung, số = theo đợt nấu */
export type BatchFilter = 'all' | 'none' | number

export async function listPurchases(
  start: string,
  end: string,
  batch: BatchFilter,
  page: number,
): Promise<PurchaseListRow[]> {
  const from = page * PURCHASES_PAGE_SIZE
  let q = supabase
    .from('purchases')
    .select('*, batches(name), purchase_items(item_name)')
    .gte('purchased_at', start)
    .lt('purchased_at', end)
  if (batch === 'none') q = q.is('batch_id', null)
  else if (batch !== 'all') q = q.eq('batch_id', batch)
  return check(
    await q
      .order('purchased_at', { ascending: false })
      .order('id', { ascending: false })
      .order('id', { referencedTable: 'purchase_items' })
      .range(from, from + PURCHASES_PAGE_SIZE - 1),
  )
}

/** Tổng tiền tất cả lần mua khớp bộ lọc (không phân trang) */
export async function sumPurchases(start: string, end: string, batch: BatchFilter): Promise<{ count: number; total: number }> {
  let total = 0
  let count = 0
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    let q = supabase.from('purchases').select('total').gte('purchased_at', start).lt('purchased_at', end)
    if (batch === 'none') q = q.is('batch_id', null)
    else if (batch !== 'all') q = q.eq('batch_id', batch)
    const rows: { total: number }[] = check(await q.order('id').range(from, from + pageSize - 1))
    rows.forEach((r) => (total += r.total))
    count += rows.length
    if (rows.length < pageSize) return { count, total }
  }
}

export async function getPurchase(id: number): Promise<PurchaseWithItems> {
  return check(
    await supabase
      .from('purchases')
      .select('*, purchase_items(*)')
      .eq('id', id)
      .order('id', { referencedTable: 'purchase_items' })
      .single(),
  )
}

export interface PurchaseItemInput {
  item_name: string
  item_group: ItemGroup
  quantity: number
  unit: string
  unit_price: number
  line_total: number
}

export interface PurchaseInput {
  batchId: number | null
  purchasedAt: string | null // null = giữ nguyên (khi sửa) / bây giờ (khi thêm)
  place: string
  note: string
  items: PurchaseItemInput[]
}

/** Lưu lần mua + các dòng hàng trong MỘT giao dịch (id trống = thêm mới) */
export async function savePurchase(input: PurchaseInput, id?: number): Promise<Purchase> {
  return check(
    await supabase
      .rpc('save_purchase', {
        p_id: id ?? null,
        p_batch_id: input.batchId,
        p_purchased_at: input.purchasedAt,
        p_place: input.place,
        p_note: input.note,
        p_items: input.items,
      })
      .single(),
  )
}

export async function deletePurchase(id: number): Promise<void> {
  check(await supabase.rpc('delete_purchase', { p_id: id }))
}

/** Các nơi mua đã từng nhập (để gợi ý) */
export async function listPlaces(): Promise<string[]> {
  const rows: { place: string }[] = check(
    await supabase
      .from('purchases')
      .select('place')
      .not('place', 'is', null)
      .order('purchased_at', { ascending: false })
      .limit(300),
  )
  return [...new Set(rows.map((r) => r.place))]
}

/** Toàn bộ lần mua kèm dòng hàng trong khoảng ngày (dùng cho xuất Excel) */
export async function listAllPurchasesWithItems(start: string, end: string): Promise<PurchaseWithItems[]> {
  const pageSize = 500
  const all: PurchaseWithItems[] = []
  for (let from = 0; ; from += pageSize) {
    const rows: PurchaseWithItems[] = check(
      await supabase
        .from('purchases')
        .select('*, purchase_items(*)')
        .gte('purchased_at', start)
        .lt('purchased_at', end)
        .order('purchased_at')
        .order('id')
        .order('id', { referencedTable: 'purchase_items' })
        .range(from, from + pageSize - 1),
    )
    all.push(...rows)
    if (rows.length < pageSize) return all
  }
}

// ------------------------------ Đợt nấu ------------------------------

export interface BatchListRow extends Batch {
  purchases: Pick<Purchase, 'total'>[]
}

/** Danh sách đợt kèm tiền các lần mua, mới nhất trước */
export async function listBatches(): Promise<BatchListRow[]> {
  return check(
    await supabase
      .from('batches')
      .select('*, purchases(total)')
      .order('date', { ascending: false })
      .order('id', { ascending: false }),
  )
}

export async function getBatch(id: number): Promise<Batch> {
  return check(await supabase.from('batches').select('*').eq('id', id).single())
}

export type BatchInput = Pick<Batch, 'name' | 'date' | 'tray_count' | 'profit_percent' | 'note'> &
  Partial<Pick<Batch, 'final_price' | 'status' | 'copied_from_id'>>

export async function createBatch(input: BatchInput): Promise<Batch> {
  return check(await supabase.from('batches').insert({ ...input, name: input.name.trim() }).select().single())
}

export async function updateBatch(id: number, changes: Partial<BatchInput>): Promise<void> {
  const data = changes.name === undefined ? changes : { ...changes, name: changes.name.trim() }
  check(await supabase.from('batches').update(data).eq('id', id))
}

export async function deleteBatch(id: number): Promise<void> {
  // Các lần mua của đợt chuyển thành "mua chung" (vẫn được tính vào chi phí)
  check(await supabase.from('batches').delete().eq('id', id))
}

/** Các lần mua (kèm dòng hàng) của một đợt, cũ nhất trước */
export async function listBatchPurchases(batchId: number): Promise<PurchaseWithItems[]> {
  return check(
    await supabase
      .from('purchases')
      .select('*, purchase_items(*)')
      .eq('batch_id', batchId)
      .order('purchased_at')
      .order('id')
      .order('id', { referencedTable: 'purchase_items' }),
  )
}

/** Tạo / cập nhật món "Mâm [tên đợt]" với giá chốt trong danh sách món */
export async function saveBatchProduct(batchId: number): Promise<Product> {
  return check(await supabase.rpc('save_batch_product', { p_batch_id: batchId }).single())
}

export async function getProduct(id: number): Promise<Product | null> {
  return check(await supabase.from('products').select('*').eq('id', id).maybeSingle())
}

// --------------------------- Báo cáo lãi lỗ ---------------------------

export async function getProfitReport(year: number): Promise<MonthReport[]> {
  return check(await supabase.rpc('profit_report', { p_year: year }))
}
