// Form tạo / sửa / sao chép đợt nấu
import { useEffect, useState, type FormEvent } from 'react'
import type { Batch } from '../../types'
import { createBatch, updateBatch } from '../../lib/api'
import { errorMessage, todayVN } from '../../lib/format'
import { useToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import MoneyInput from '../../components/MoneyInput'

interface Props {
  open: boolean
  /** 'new' = tạo mới, 'edit' = sửa `batch`, 'copy' = tạo đợt mới từ `batch` */
  mode: 'new' | 'edit' | 'copy'
  batch?: Batch | null
  onClose: () => void
  onSaved: (batch: Batch) => void
}

const TITLES = { new: 'Tạo đợt nấu', edit: 'Sửa đợt nấu', copy: 'Sao chép đợt' }

export default function BatchForm({ open, mode, batch, onClose, onSaved }: Props) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [date, setDate] = useState(todayVN)
  const [trays, setTrays] = useState<number | null>(10)
  const [pct, setPct] = useState<number | null>(30)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Mỗi lần mở form: điền sẵn theo chế độ
  useEffect(() => {
    if (!open) return
    setName(mode === 'edit' ? (batch?.name ?? '') : mode === 'copy' ? `${batch?.name ?? ''} (bản sao)` : '')
    setDate(mode === 'edit' && batch ? batch.date : todayVN())
    setTrays(batch && mode !== 'new' ? batch.tray_count : 10)
    setPct(batch && mode !== 'new' ? batch.profit_percent : 30)
    setNote(batch && mode !== 'new' ? (batch.note ?? '') : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ điền lại khi mở form
  }, [open, mode, batch])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('Vui lòng nhập tên đợt')
    if (!trays || trays <= 0) return toast.error('Số mâm phải lớn hơn 0')
    if (pct === null || pct > 1000) return toast.error('% lãi không hợp lệ')
    const input = { name, date, tray_count: trays, profit_percent: pct, note: note.trim() || null }
    setSaving(true)
    try {
      let saved: Batch
      if (mode === 'edit' && batch) {
        await updateBatch(batch.id, input)
        saved = { ...batch, ...input, name: name.trim() }
        toast.success('Đã lưu thay đổi')
      } else {
        saved = await createBatch({ ...input, copied_from_id: mode === 'copy' && batch ? batch.id : null })
        toast.success(mode === 'copy' ? `Đã sao chép thành "${saved.name}"` : `Đã tạo đợt "${saved.name}"`)
      }
      onSaved(saved)
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
      title={TITLES[mode]}
      footer={
        <>
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" form="batch-form" className="btn btn-primary flex-1" disabled={saving}>
            {saving ? 'Đang lưu...' : mode === 'copy' ? 'Sao chép' : 'Lưu'}
          </button>
        </>
      }
    >
      <form id="batch-form" onSubmit={submit} className="space-y-3">
        {mode === 'copy' && (
          <p className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900">
            Đợt mới sẽ nhớ danh sách hàng của đợt gốc. Khi đi chợ, bấm <b>"Mua hàng theo danh sách đợt gốc"</b> trong
            trang đợt mới để điền sẵn các dòng hàng.
          </p>
        )}
        <label className="block">
          <span className="label">Tên đợt</span>
          <input
            className="input"
            placeholder="VD: Tiệc nhà anh Nam 30/11"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={mode !== 'edit'}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="label">Ngày nấu</span>
            <input type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <label>
            <span className="label">Số mâm</span>
            <MoneyInput value={trays} onChange={setTrays} suffix="mâm" className="pr-14" />
          </label>
        </div>
        <label className="block">
          <span className="label">% lãi mong muốn</span>
          <MoneyInput value={pct} onChange={setPct} suffix="%" />
        </label>
        <label className="block">
          <span className="label">Ghi chú (tùy chọn)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: 8 người/mâm" />
        </label>
      </form>
    </Modal>
  )
}
