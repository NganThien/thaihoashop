// Kiểu dữ liệu khớp với các bảng trong supabase/migrations

export interface Category {
  id: number
  name: string
  sort_order: number
  created_at: string
}

export interface Product {
  id: number
  name: string
  price: number // VND, số nguyên
  unit: string
  category_id: number | null
  image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type OrderStatus = 'paid' | 'cancelled'

export interface Order {
  id: number
  code: string
  created_at: string
  subtotal: number
  discount: number
  total: number
  amount_paid: number
  change_amount: number
  note: string | null
  status: OrderStatus
}

export interface OrderItem {
  id: number
  order_id: number
  product_id: number | null
  product_name: string
  unit_price: number
  quantity: number
  line_total: number
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[]
}

export interface PeriodStats {
  revenue: number
  orders: number
  top: { name: string; quantity: number; revenue: number }[]
}

export interface Stats {
  today: PeriodStats
  week: PeriodStats
  month: PeriodStats
}

// ------------- Mua hàng & tính giá mâm (supabase/migrations/..._mua_hang.sql) -------------

export const ITEM_GROUPS = ['thịt', 'cá/hải sản', 'rau củ', 'gạo/đồ khô', 'gia vị', 'chi phí khác'] as const
export type ItemGroup = (typeof ITEM_GROUPS)[number]

/** Danh mục hàng hay mua */
export interface Ingredient {
  id: number
  name: string
  unit: string
  item_group: ItemGroup
  last_price: number | null // đơn giá lần mua gần nhất
  created_at: string
}

export type BatchStatus = 'đang mua' | 'đã chốt'

/** Đợt nấu / đơn tiệc */
export interface Batch {
  id: number
  name: string
  date: string // "YYYY-MM-DD"
  tray_count: number // số mâm
  profit_percent: number // % lãi mong muốn
  final_price: number | null // giá bán chốt mỗi mâm
  note: string | null
  status: BatchStatus
  product_id: number | null // món "Mâm ..." đã lưu vào danh sách món
  copied_from_id: number | null // đợt gốc (khi sao chép)
  created_at: string
}

/** Lần mua hàng; batch_id = null là mua chung */
export interface Purchase {
  id: number
  batch_id: number | null
  purchased_at: string
  place: string | null
  note: string | null
  total: number
  created_at: string
}

export interface PurchaseItem {
  id: number
  purchase_id: number
  ingredient_id: number | null
  item_name: string
  item_group: ItemGroup
  quantity: number // có thể có số lẻ (1,5 kg)
  unit: string
  unit_price: number
  line_total: number
}

export interface PurchaseWithItems extends Purchase {
  purchase_items: PurchaseItem[]
}

/** Một tháng trong báo cáo lãi lỗ */
export interface MonthReport {
  month: number // 1..12
  revenue: number
  cost: number
  groups: Partial<Record<ItemGroup, number>>
}
