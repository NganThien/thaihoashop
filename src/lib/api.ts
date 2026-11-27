// Tất cả các lệnh đọc/ghi dữ liệu Supabase nằm ở file này
import { supabase } from './supabase'
import type { Category, Order, OrderWithItems, Product, Stats } from '../types'

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
