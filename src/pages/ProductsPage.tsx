// QUẢN LÝ MÓN: danh sách, tìm kiếm, lọc nhóm, thêm/sửa, ẩn/hiện, xóa
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category, Product } from '../types'
import { deleteProduct, isProductUsed, listCategories, listProducts, setProductActive } from '../lib/api'
import { errorMessage, formatMoney, normalizeText } from '../lib/format'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import CategoryChips, { matchCategory, type CategoryFilter } from '../components/CategoryChips'
import ProductThumb from '../components/ProductThumb'
import ProductForm from './products/ProductForm'
import CategoryManager from './products/CategoryManager'

export default function ProductsPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CategoryFilter>('all')
  // undefined = đóng form; null = thêm mới; Product = đang sửa
  const [editing, setEditing] = useState<Product | null | undefined>(undefined)
  const [showCategories, setShowCategories] = useState(false)

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([listProducts(), listCategories()])
      setProducts(p)
      setCategories(c)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const categoryName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? 'Chưa phân nhóm'

  const visible = useMemo(() => {
    const q = normalizeText(search)
    return products.filter((p) => matchCategory(p.category_id, filter) && (!q || normalizeText(p.name).includes(q)))
  }, [products, search, filter])

  const toggleActive = async (p: Product) => {
    try {
      await setProductActive(p.id, !p.is_active)
      toast.success(p.is_active ? `Đã ẩn "${p.name}"` : `Đã hiện lại "${p.name}"`)
      load()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const remove = async (p: Product) => {
    try {
      // Món đã có trong hóa đơn thì không xóa hẳn được -> gợi ý ẩn
      if (await isProductUsed(p.id)) {
        if (!p.is_active) {
          toast.error('Món đã có trong hóa đơn nên không thể xóa hẳn. Món đang được ẩn.')
          return
        }
        const ok = await confirm({
          title: 'Không thể xóa món',
          message: `"${p.name}" đã có trong hóa đơn nên không thể xóa hẳn (để hóa đơn cũ không bị sai). Bạn có muốn ẨN món này không?`,
          confirmText: 'Ẩn món',
        })
        if (ok) await toggleActive(p)
        return
      }
      const ok = await confirm({
        title: 'Xóa món',
        message: `Xóa hẳn "${p.name}"? Thao tác này không thể hoàn tác.`,
        confirmText: 'Xóa',
        danger: true,
      })
      if (!ok) return
      await deleteProduct(p.id)
      toast.success(`Đã xóa "${p.name}"`)
      load()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="w-full text-xl font-bold sm:mr-auto sm:w-auto">Quản lý món</h1>
        <button className="btn btn-secondary flex-1 sm:flex-none" onClick={() => setShowCategories(true)}>
          Nhóm món
        </button>
        <button className="btn btn-primary flex-1 sm:flex-none" onClick={() => setEditing(null)}>
          + Thêm món
        </button>
      </div>

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
        <p className="py-10 text-center text-slate-500">Đang tải...</p>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-slate-500">Không có món nào.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {visible.map((p) => (
            <li key={p.id} className={`card flex flex-col gap-3 p-3 ${p.is_active ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-3">
                <ProductThumb name={p.name} url={p.image_url} className="h-14 w-14 shrink-0 rounded-xl text-2xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{p.name}</span>
                    {!p.is_active && (
                      <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        Đang ẩn
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-teal-700">
                    {formatMoney(p.price)} <span className="text-sm font-normal text-slate-500">/ {p.unit}</span>
                  </div>
                  <div className="text-sm text-slate-500">{categoryName(p.category_id)}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(p)}>
                  ✏️ Sửa
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(p)}>
                  {p.is_active ? '🙈 Ẩn' : '👁 Hiện'}
                </button>
                <button className="btn btn-secondary btn-sm text-red-600" onClick={() => remove(p)}>
                  🗑 Xóa
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ProductForm
        open={editing !== undefined}
        product={editing ?? null}
        categories={categories}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined)
          load()
        }}
      />

      <CategoryManager
        open={showCategories}
        categories={categories}
        onClose={() => setShowCategories(false)}
        onChanged={load}
      />
    </div>
  )
}
