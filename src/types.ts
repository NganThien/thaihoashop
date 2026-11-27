// Kiểu dữ liệu khớp với các bảng trong schema.sql

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
