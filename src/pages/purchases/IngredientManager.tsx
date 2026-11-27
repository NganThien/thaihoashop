// DANH MỤC HÀNG HAY MUA: sửa tên gõ sai, đổi đơn vị / nhóm / giá lần trước, xóa.
// Hàng mới được tự thêm khi lưu lần mua nên ở đây không cần nút "thêm".
import { useEffect, useMemo, useState } from 'react'
import { ITEM_GROUPS, type Ingredient, type ItemGroup } from '../../types'
import { deleteIngredient, listIngredients, updateIngredient } from '../../lib/api'
import { errorMessage, formatMoney, normalizeText } from '../../lib/format'
import { COMMON_UNITS, GROUP_META } from '../../lib/costing'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/Confirm'
import Modal from '../../components/Modal'
import MoneyInput from '../../components/MoneyInput'

export default function IngredientManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [items, setItems] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [form, setForm] = useState({ name: '', unit: '', item_group: 'thịt' as ItemGroup, last_price: null as number | null })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setEditing(null)
    listIngredients()
      .then(setItems)
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [open, toast])

  const visible = useMemo(() => {
    const q = normalizeText(search)
    return items.filter((i) => !q || normalizeText(i.name).includes(q))
  }, [items, search])

  const startEdit = (i: Ingredient) => {
    setEditing(i)
    setForm({ name: i.name, unit: i.unit, item_group: i.item_group, last_price: i.last_price })
  }

  const save = async () => {
    if (!editing) return
    if (!form.name.trim()) return toast.error('Vui lòng nhập tên hàng')
    setSaving(true)
    try {
      await updateIngredient(editing.id, form)
      setItems((list) =>
        list
          .map((i) => (i.id === editing.id ? { ...i, ...form, name: form.name.trim(), unit: form.unit.trim() } : i))
          .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
      )
      toast.success('Đã lưu')
      setEditing(null)
    } catch (e) {
      const msg = errorMessage(e)
      toast.error(/duplicate|unique/i.test(msg) ? 'Đã có mặt hàng khác cùng tên' : msg)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!editing) return
    const ok = await confirm({
      title: 'Xóa khỏi danh mục',
      message: `Xóa "${editing.name}" khỏi danh mục gợi ý? Các lần mua cũ vẫn giữ nguyên.`,
      confirmText: 'Xóa',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteIngredient(editing.id)
      setItems((list) => list.filter((i) => i.id !== editing.id))
      toast.success(`Đã xóa "${editing.name}"`)
      setEditing(null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Modal
      open={open}
      onClose={editing ? () => setEditing(null) : onClose}
      title={editing ? 'Sửa mặt hàng' : 'Danh mục hàng hay mua'}
      footer={
        editing && (
          <>
            <button className="btn btn-secondary text-red-600" onClick={remove}>
              🗑
            </button>
            <button className="btn btn-secondary flex-1" onClick={() => setEditing(null)}>
              Quay lại
            </button>
            <button className="btn btn-primary flex-1" onClick={save} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </>
        )
      }
    >
      {editing ? (
        <div className="space-y-3">
          <label className="block">
            <span className="label">Tên hàng</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="label">Đơn vị</span>
              <input
                className="input"
                list="catalog-units"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
              <datalist id="catalog-units">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </label>
            <label>
              <span className="label">Nhóm</span>
              <select
                className="input"
                value={form.item_group}
                onChange={(e) => setForm({ ...form, item_group: e.target.value as ItemGroup })}
              >
                {ITEM_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {GROUP_META[g].icon} {GROUP_META[g].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="label">Giá lần trước (gợi ý khi nhập)</span>
            <MoneyInput value={form.last_price} onChange={(v) => setForm({ ...form, last_price: v })} />
          </label>
          <p className="text-sm text-slate-500">
            Giá lần trước tự cập nhật theo lần mua mới nhất mỗi khi bạn lưu lần mua.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="search"
            className="input"
            placeholder="🔍 Tìm hàng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {loading ? (
            <p className="py-6 text-center text-slate-500">Đang tải...</p>
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-slate-500">
              {items.length === 0 ? 'Chưa có mặt hàng nào. Hàng sẽ tự được thêm khi bạn lưu lần mua.' : 'Không tìm thấy.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((i) => (
                <li key={i.id}>
                  <button className="flex min-h-14 w-full items-center gap-3 py-2 text-left" onClick={() => startEdit(i)}>
                    <span className="text-xl">{GROUP_META[i.item_group].icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{i.name}</span>
                      <span className="text-sm text-slate-500">{GROUP_META[i.item_group].label}</span>
                    </span>
                    <span className="shrink-0 text-right text-sm text-slate-600 tabular-nums">
                      {i.last_price !== null ? formatMoney(i.last_price) : '—'}
                      {i.unit && <span className="block text-slate-400">/{i.unit}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}
