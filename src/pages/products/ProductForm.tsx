// Form thêm / sửa món
import { useEffect, useState, type FormEvent } from 'react'
import type { Category, Product } from '../../types'
import { saveProduct, uploadProductImage } from '../../lib/api'
import { errorMessage } from '../../lib/format'
import { useToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import MoneyInput from '../../components/MoneyInput'
import ProductThumb from '../../components/ProductThumb'

const UNITS = ['phần', 'ly', 'cái', 'chai', 'lon', 'gói', 'hộp', 'kg']

interface Props {
  open: boolean
  product: Product | null // null = thêm món mới
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

export default function ProductForm({ open, product, categories, onClose, onSaved }: Props) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [price, setPrice] = useState<number | null>(null)
  const [unit, setUnit] = useState('phần')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Mỗi lần mở form: điền sẵn thông tin món (khi sửa) hoặc để trống (khi thêm)
  useEffect(() => {
    if (!open) return
    setName(product?.name ?? '')
    setPrice(product?.price ?? null)
    setUnit(product?.unit ?? 'phần')
    setCategoryId(product ? product.category_id : (categories[0]?.id ?? null))
    setImageUrl(product?.image_url ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ điền lại khi mở form
  }, [open, product])

  const pickImage = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      setImageUrl(await uploadProductImage(file))
    } catch (e) {
      toast.error(`Tải ảnh thất bại: ${errorMessage(e)}`)
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('Vui lòng nhập tên món')
    if (price === null) return toast.error('Vui lòng nhập giá')
    if (!unit.trim()) return toast.error('Vui lòng nhập đơn vị')
    setSaving(true)
    try {
      await saveProduct({ name, price, unit, category_id: categoryId, image_url: imageUrl }, product?.id)
      toast.success(product ? 'Đã lưu thay đổi' : `Đã thêm "${name.trim()}"`)
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? 'Sửa món' : 'Thêm món'}
      footer={
        <>
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" form="product-form" className="btn btn-primary flex-1" disabled={saving || uploading}>
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="pf-name">
            Tên món *
          </label>
          <input id="pf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="pf-price">
              Giá bán *
            </label>
            <MoneyInput id="pf-price" value={price} onChange={setPrice} placeholder="0" />
          </div>
          <div>
            <label className="label" htmlFor="pf-unit">
              Đơn vị *
            </label>
            <input
              id="pf-unit"
              className="input"
              list="pf-units"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
            <datalist id="pf-units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="pf-cat">
            Nhóm
          </label>
          <select
            id="pf-cat"
            className="input"
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Chưa phân nhóm —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="label">Ảnh (không bắt buộc)</div>
          <div className="flex items-center gap-3">
            <ProductThumb name={name || '?'} url={imageUrl} className="h-20 w-20 shrink-0 rounded-xl text-3xl" />
            <div className="flex flex-col gap-2">
              <label className={`btn btn-secondary btn-sm cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
                {uploading ? 'Đang tải ảnh...' : imageUrl ? 'Đổi ảnh' : 'Chọn ảnh'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    pickImage(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
              {imageUrl && (
                <button type="button" className="btn btn-secondary btn-sm text-red-600" onClick={() => setImageUrl(null)}>
                  Bỏ ảnh
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}
