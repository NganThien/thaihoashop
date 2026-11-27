// Quản lý nhóm món: thêm, đổi tên, xóa, sắp xếp thứ tự (nút ↑ ↓)
import { useState } from 'react'
import type { Category } from '../../types'
import { createCategory, deleteCategory, renameCategory, reorderCategories } from '../../lib/api'
import { errorMessage } from '../../lib/format'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/Confirm'
import Modal from '../../components/Modal'

interface Props {
  open: boolean
  categories: Category[]
  onClose: () => void
  onChanged: () => Promise<void> | void
}

export default function CategoryManager({ open, categories, onClose, onChanged }: Props) {
  const toast = useToast()
  const confirm = useConfirm()
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)

  // Chạy một thao tác, báo lỗi nếu có, rồi tải lại danh sách
  const run = async (action: () => Promise<void>, successMsg?: string) => {
    setBusy(true)
    try {
      await action()
      if (successMsg) toast.success(successMsg)
      await onChanged()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const add = () => {
    const name = newName.trim()
    if (!name) return toast.error('Vui lòng nhập tên nhóm')
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0)
    run(async () => {
      await createCategory(name, maxOrder + 1)
      setNewName('')
    }, `Đã thêm nhóm "${name}"`)
  }

  const saveRename = (id: number) => {
    const name = editName.trim()
    if (!name) return toast.error('Tên nhóm không được để trống')
    run(async () => {
      await renameCategory(id, name)
      setEditId(null)
    }, 'Đã đổi tên nhóm')
  }

  const remove = async (c: Category) => {
    const ok = await confirm({
      title: 'Xóa nhóm',
      message: `Xóa nhóm "${c.name}"? Các món trong nhóm sẽ chuyển sang "Chưa phân nhóm" (không bị xóa).`,
      confirmText: 'Xóa nhóm',
      danger: true,
    })
    if (ok) run(() => deleteCategory(c.id), `Đã xóa nhóm "${c.name}"`)
  }

  const move = (index: number, dir: -1 | 1) => {
    const ids = categories.map((c) => c.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    run(() => reorderCategories(ids))
  }

  return (
    <Modal open={open} onClose={onClose} title="Nhóm món">
      <ul className="mb-4 divide-y divide-slate-100">
        {categories.length === 0 && <li className="py-4 text-center text-slate-400">Chưa có nhóm nào</li>}
        {categories.map((c, i) => (
          <li key={c.id} className="flex items-center gap-1 py-2">
            {editId === c.id ? (
              <>
                <input
                  className="input flex-1"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveRename(c.id)}
                />
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveRename(c.id)}>
                  Lưu
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>
                  Hủy
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 truncate font-semibold">{c.name}</span>
                <button className="btn-icon" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Lên">
                  ↑
                </button>
                <button
                  className="btn-icon"
                  disabled={busy || i === categories.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Xuống"
                >
                  ↓
                </button>
                <button
                  className="btn-icon"
                  onClick={() => {
                    setEditId(c.id)
                    setEditName(c.name)
                  }}
                  aria-label="Đổi tên"
                >
                  ✏️
                </button>
                <button className="btn-icon" disabled={busy} onClick={() => remove(c)} aria-label="Xóa">
                  🗑
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="label">Thêm nhóm mới</div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="VD: Sinh tố"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn btn-primary" disabled={busy} onClick={add}>
          Thêm
        </button>
      </div>
    </Modal>
  )
}
