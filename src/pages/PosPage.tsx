// MÀN HÌNH TÍNH TIỀN: chọn món -> giỏ hàng -> giảm giá -> tiền khách đưa -> thanh toán
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category, OrderWithItems, Product } from '../types'
import { createOrder, listCategories, listProducts } from '../lib/api'
import { errorMessage, formatMoney, normalizeText } from '../lib/format'
import { useToast } from '../components/Toast'
import { usePrint } from '../components/Print'
import CategoryChips, { matchCategory, type CategoryFilter } from '../components/CategoryChips'
import ProductThumb from '../components/ProductThumb'
import MoneyInput from '../components/MoneyInput'
import Modal from '../components/Modal'

interface CartLine {
  product: Product
  quantity: number
}

type DiscountType = 'amount' | 'percent'

const QUICK_CASH = [50_000, 100_000, 200_000, 500_000]

export default function PosPage() {
  const toast = useToast()
  const print = usePrint()

  // Dữ liệu món
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CategoryFilter>('all')

  // Giỏ hàng & thanh toán
  const [cart, setCart] = useState<CartLine[]>([])
  const [discountType, setDiscountType] = useState<DiscountType>('amount')
  const [discountValue, setDiscountValue] = useState<number | null>(null)
  const [amountPaid, setAmountPaid] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [cartOpen, setCartOpen] = useState(false) // giỏ hàng dạng cửa sổ trên điện thoại
  const [doneOrder, setDoneOrder] = useState<OrderWithItems | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      // Chỉ lấy các món đang bán
      const [p, c] = await Promise.all([listProducts(true), listCategories()])
      setProducts(p)
      setCategories(c)
    } catch (e) {
      setLoadError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visibleProducts = useMemo(() => {
    const q = normalizeText(search)
    return products.filter((p) => matchCategory(p.category_id, filter) && (!q || normalizeText(p.name).includes(q)))
  }, [products, search, filter])

  // ---------- Tính tiền ----------
  const subtotal = cart.reduce((s, l) => s + l.product.price * l.quantity, 0)
  const discount =
    discountType === 'percent'
      ? Math.round((subtotal * Math.min(discountValue ?? 0, 100)) / 100)
      : Math.min(discountValue ?? 0, subtotal)
  const total = subtotal - discount
  const notEnough = amountPaid !== null && amountPaid < total
  const change = amountPaid !== null && !notEnough ? amountPaid - total : 0
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0)

  // ---------- Thao tác giỏ hàng ----------
  const addToCart = (product: Product) =>
    setCart((c) => {
      const found = c.find((l) => l.product.id === product.id)
      if (found) return c.map((l) => (l === found ? { ...l, quantity: l.quantity + 1 } : l))
      return [...c, { product, quantity: 1 }]
    })

  const setQuantity = (id: number, quantity: number) =>
    setCart((c) =>
      quantity <= 0 ? c.filter((l) => l.product.id !== id) : c.map((l) => (l.product.id === id ? { ...l, quantity } : l)),
    )

  const resetCart = () => {
    setCart([])
    setDiscountValue(null)
    setAmountPaid(null)
    setNote('')
  }

  const checkout = async () => {
    if (cart.length === 0) return toast.error('Giỏ hàng đang trống')
    if (notEnough) return toast.error('Tiền khách đưa chưa đủ')
    setSaving(true)
    try {
      const order = await createOrder({
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        discountType,
        discountValue: discountValue ?? 0,
        amountPaid, // để trống = khách đưa đủ tiền
        note,
      })
      toast.success(`Đã lưu hóa đơn ${order.code}`)
      resetCart()
      setCartOpen(false)
      setDoneOrder(order)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // ---------- Giỏ hàng (dùng chung cho điện thoại & máy tính) ----------
  const cartPanel = (
    <div className="flex flex-col gap-4">
      {cart.length === 0 ? (
        <p className="py-6 text-center text-slate-400">Chưa có món nào. Bấm vào món để thêm.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {cart.map((l) => (
            <li key={l.product.id} className="py-2">
              {/* Dòng 1: tên món + thành tiền */}
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{l.product.name}</span>
                <span className="shrink-0 font-semibold">{formatMoney(l.product.price * l.quantity)}</span>
              </div>
              {/* Dòng 2: đơn giá + tăng/giảm số lượng + xóa */}
              <div className="mt-1 flex items-center gap-2">
                <span className="flex-1 text-sm text-slate-500">
                  {formatMoney(l.product.price)} / {l.product.unit}
                </span>
              <div className="flex items-center">
                <button
                  className="h-10 w-10 rounded-l-lg border border-slate-300 text-xl font-bold"
                  onClick={() => setQuantity(l.product.id, l.quantity - 1)}
                  aria-label="Giảm"
                >
                  −
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  className="h-10 w-12 border-y border-slate-300 text-center text-base font-semibold outline-none"
                  value={l.quantity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/\D/g, ''))
                    if (n > 0) setQuantity(l.product.id, Math.min(n, 9999))
                  }}
                />
                <button
                  className="h-10 w-10 rounded-r-lg border border-slate-300 text-xl font-bold"
                  onClick={() => setQuantity(l.product.id, l.quantity + 1)}
                  aria-label="Tăng"
                >
                  +
                </button>
              </div>
              <button className="btn-icon text-red-500" onClick={() => setQuantity(l.product.id, 0)} aria-label="Xóa">
                ✕
              </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t border-slate-200 pt-3">
        <div className="flex justify-between text-base">
          <span>Tạm tính</span>
          <span className="font-semibold">{formatMoney(subtotal)}</span>
        </div>

        {/* Giảm giá theo số tiền hoặc % */}
        <div>
          <div className="label">Giảm giá</div>
          <div className="flex gap-2">
            <div className="flex shrink-0 overflow-hidden rounded-xl border border-slate-300">
              {(['amount', 'percent'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setDiscountType(t)
                    setDiscountValue(null)
                  }}
                  className={`min-h-12 w-12 font-bold ${discountType === t ? 'bg-teal-700 text-white' : 'bg-white text-slate-600'}`}
                >
                  {t === 'amount' ? '₫' : '%'}
                </button>
              ))}
            </div>
            <div className="flex-1">
              <MoneyInput
                value={discountValue}
                onChange={(v) => setDiscountValue(discountType === 'percent' && v !== null ? Math.min(v, 100) : v)}
                placeholder="0"
                suffix={discountType === 'amount' ? '₫' : '%'}
              />
            </div>
          </div>
          {discount > 0 && <div className="mt-1 text-right text-sm text-slate-500">− {formatMoney(discount)}</div>}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-teal-50 px-3 py-2">
          <span className="text-lg font-bold">TỔNG TIỀN</span>
          <span className="text-2xl font-bold text-teal-700">{formatMoney(total)}</span>
        </div>

        {/* Tiền khách đưa */}
        <div>
          <div className="label">Tiền khách đưa</div>
          <MoneyInput value={amountPaid} onChange={setAmountPaid} placeholder="Để trống nếu khách đưa đủ" />
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {QUICK_CASH.map((v) => (
              <button key={v} type="button" className="btn btn-secondary btn-sm px-1" onClick={() => setAmountPaid(v)}>
                {v / 1000}k
              </button>
            ))}
            <button type="button" className="btn btn-secondary btn-sm px-1" onClick={() => setAmountPaid(total)}>
              Đủ tiền
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-lg">
          <span>Tiền thối</span>
          {notEnough ? (
            <span className="font-bold text-red-600">Thiếu {formatMoney(total - (amountPaid ?? 0))}</span>
          ) : (
            <span className="font-bold text-amber-600">{formatMoney(change)}</span>
          )}
        </div>

        <div>
          <div className="label">Ghi chú</div>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: bàn 3, ít đá..."
          />
        </div>

        <div className="flex gap-2">
          {cart.length > 0 && (
            <button className="btn btn-secondary" onClick={resetCart} disabled={saving}>
              Xóa giỏ
            </button>
          )}
          <button className="btn btn-primary flex-1 text-lg" onClick={checkout} disabled={saving || cart.length === 0 || notEnough}>
            {saving ? 'Đang lưu...' : `Thanh toán ${formatMoney(total)}`}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="lg:grid lg:grid-cols-[1fr_400px] lg:items-start lg:gap-4">
      {/* ---------- Cột trái: danh sách món ---------- */}
      {/* Chừa chỗ cho thanh giỏ hàng nổi trên điện thoại */}
      <section className={`space-y-3 ${cart.length > 0 ? 'pb-20 lg:pb-0' : ''}`}>
        <input
          type="search"
          className="input"
          placeholder="🔍 Tìm món..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <CategoryChips
          categories={categories}
          value={filter}
          onChange={setFilter}
          showUncategorized={products.some((p) => p.category_id === null)}
        />

        {loading ? (
          <p className="py-10 text-center text-slate-500">Đang tải món...</p>
        ) : loadError ? (
          <div className="card p-6 text-center">
            <p className="mb-3 text-red-600">{loadError}</p>
            <button className="btn btn-primary" onClick={load}>
              Thử lại
            </button>
          </div>
        ) : visibleProducts.length === 0 ? (
          <p className="py-10 text-center text-slate-500">
            {products.length === 0 ? 'Chưa có món nào đang bán. Vào mục "Món" để thêm.' : 'Không tìm thấy món phù hợp.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {visibleProducts.map((p) => {
              const qty = cart.find((l) => l.product.id === p.id)?.quantity
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={`relative flex min-h-24 flex-col overflow-hidden rounded-2xl border-2 bg-white text-left shadow-sm transition active:scale-95 ${
                    qty ? 'border-teal-600' : 'border-transparent'
                  }`}
                >
                  {p.image_url && <ProductThumb name={p.name} url={p.image_url} className="aspect-[4/3] w-full" />}
                  <div className="flex flex-1 flex-col justify-between p-3">
                    <div className="line-clamp-2 text-base leading-snug font-semibold">{p.name}</div>
                    <div className="mt-1 font-bold text-teal-700">
                      {formatMoney(p.price)}
                      <span className="text-sm font-normal text-slate-400"> /{p.unit}</span>
                    </div>
                  </div>
                  {qty && (
                    <span className="absolute top-2 right-2 flex h-8 min-w-8 items-center justify-center rounded-full bg-teal-700 px-2 text-sm font-bold text-white shadow">
                      {qty}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ---------- Cột phải (máy tính): giỏ hàng luôn hiện ---------- */}
      <aside className="card sticky top-[4.5rem] hidden max-h-[calc(100dvh-5.5rem)] overflow-y-auto p-4 lg:block">
        <h2 className="mb-2 text-lg font-bold">Giỏ hàng {itemCount > 0 && `(${itemCount})`}</h2>
        {cartPanel}
      </aside>

      {/* ---------- Điện thoại: thanh giỏ hàng nổi + cửa sổ giỏ hàng ---------- */}
      {cart.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex min-h-14 items-center justify-between rounded-2xl bg-teal-700 px-4 text-white shadow-lg lg:hidden"
        >
          <span className="font-semibold">🛒 {itemCount} món</span>
          <span className="text-lg font-bold">{formatMoney(total)} ›</span>
        </button>
      )}
      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title={`Giỏ hàng (${itemCount})`}>
        {cartPanel}
      </Modal>

      {/* ---------- Thanh toán xong ---------- */}
      <Modal
        open={!!doneOrder}
        onClose={() => setDoneOrder(null)}
        title="Thanh toán thành công"
        footer={
          <>
            <button className="btn btn-secondary flex-1" onClick={() => doneOrder && print(doneOrder)}>
              🖨 In hóa đơn
            </button>
            <button className="btn btn-primary flex-1" onClick={() => setDoneOrder(null)}>
              Đơn mới
            </button>
          </>
        }
      >
        {doneOrder && (
          <div className="space-y-2 text-center">
            <div className="text-slate-500">Mã hóa đơn</div>
            <div className="text-xl font-bold">{doneOrder.code}</div>
            <div className="pt-2 text-slate-500">Tổng tiền</div>
            <div className="text-2xl font-bold text-teal-700">{formatMoney(doneOrder.total)}</div>
            <div className="pt-2 text-slate-500">Tiền thối</div>
            <div className="text-3xl font-bold text-amber-600">{formatMoney(doneOrder.change_amount)}</div>
          </div>
        )}
      </Modal>
    </div>
  )
}
