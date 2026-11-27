// NHẬP / SỬA LẦN MUA HÀNG - tối ưu cho điện thoại, nhập bằng một tay khi đang đi chợ:
//  - gõ tên hàng -> gợi ý từ danh mục, chọn là tự điền đơn vị + giá lần trước
//  - nhập đơn giá (tự tính thành tiền) HOẶC nhập thẳng thành tiền (tự tính đơn giá)
//  - nút "Thêm dòng" và "Lưu" luôn nằm ở cuối màn hình, gần ngón cái
//  - phiếu đang nhập dở được giữ lại trên máy nếu lỡ thoát ra / tải lại trang
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ITEM_GROUPS, type Batch, type Ingredient, type ItemGroup, type PurchaseWithItems } from '../../types'
import {
  deletePurchase,
  getPurchase,
  listBatchPurchases,
  listBatches,
  listIngredients,
  listPlaces,
  savePurchase,
} from '../../lib/api'
import { errorMessage, formatDate, formatMoney, isoToVNDate, normalizeText, todayVN } from '../../lib/format'
import { COMMON_UNITS, GROUP_META, guessGroup, parseQuantity } from '../../lib/costing'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/Confirm'
import MoneyInput from '../../components/MoneyInput'

interface Line {
  key: string
  name: string
  group: ItemGroup
  groupSet: boolean // người dùng đã tự chọn nhóm (không tự đoán nữa)
  qty: string // giữ dạng chữ để gõ được "1,5"
  unit: string
  price: number | null // đơn giá
  total: number | null // thành tiền
  source: 'price' | 'total' // ô người dùng nhập: đơn giá (tự tính thành tiền) hay thành tiền (tự tính đơn giá)
}

interface Draft {
  batchId: number | null
  date: string
  place: string
  note: string
  lines: Line[]
}

const DRAFT_KEY = 'thaihoa:purchase-draft'
const LAST_BATCH_KEY = 'thaihoa:last-batch'

// localStorage có thể bị chặn (chế độ ẩn danh...) nên luôn bọc try/catch
function readStore<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key)
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null
  }
}
function writeStore(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* bỏ qua */
  }
}

let seq = 0
const newKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`
const emptyLine = (group: ItemGroup = 'thịt'): Line => ({
  key: newKey(),
  name: '',
  group,
  groupSet: false,
  qty: '1',
  unit: '',
  price: null,
  total: null,
  source: 'price',
})
const qtyText = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',')
const isBlank = (l: Line) => !l.name.trim() && l.price === null && l.total === null

/** Số lượng, đơn giá, thành tiền thực của một dòng */
function lineValues(l: Line) {
  const qty = parseQuantity(l.qty)
  if (l.source === 'total') {
    return { qty, price: qty && l.total !== null ? Math.round(l.total / qty) : null, total: l.total }
  }
  return { qty, price: l.price, total: qty && l.price !== null ? Math.round(qty * l.price) : null }
}

/** Gộp các dòng hàng của đợt gốc thành danh sách cần mua (giá lấy theo giá lần trước mới nhất) */
function linesFromTemplate(purchases: PurchaseWithItems[], ingredients: Ingredient[]): Line[] {
  const map = new Map<string, Line>()
  for (const p of purchases) {
    for (const it of p.purchase_items) {
      const k = `${normalizeText(it.item_name)}|${it.unit}`
      const existing = map.get(k)
      if (existing) {
        existing.qty = qtyText((parseQuantity(existing.qty) ?? 0) + Number(it.quantity))
        continue
      }
      const ing = ingredients.find((i) => i.id === it.ingredient_id)
      const price = ing && ing.unit === it.unit && ing.last_price !== null ? ing.last_price : it.unit_price
      map.set(k, {
        ...emptyLine(it.item_group),
        name: it.item_name,
        groupSet: true,
        qty: qtyText(Number(it.quantity)),
        unit: it.unit,
        price,
      })
    }
  }
  return [...map.values()]
}

export default function PurchaseFormPage() {
  const { id } = useParams()
  const editId = id ? Number(id) : undefined
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const backTo = (location.state as { from?: string } | null)?.from ?? '/mua-hang'

  const [ready, setReady] = useState(false)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [places, setPlaces] = useState<string[]>([])
  const [original, setOriginal] = useState<PurchaseWithItems | null>(null)

  const [batchId, setBatchId] = useState<number | null>(null)
  const [date, setDate] = useState(todayVN)
  const [place, setPlace] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [saving, setSaving] = useState(false)

  const [activeKey, setActiveKey] = useState<string | null>(null) // dòng đang gõ tên (hiện gợi ý)
  const [focusTarget, setFocusTarget] = useState<{ key: string; field: string } | null>(null)
  const blurTimer = useRef<number | undefined>(undefined)

  // ---------- Tải dữ liệu ban đầu ----------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const templateId = Number(params.get('mau')) || null
        const [ings, bs, pls, purchase, template] = await Promise.all([
          listIngredients(),
          listBatches(),
          listPlaces(),
          editId ? getPurchase(editId) : Promise.resolve(null),
          templateId && !editId ? listBatchPurchases(templateId) : Promise.resolve(null),
        ])
        if (cancelled) return
        setIngredients(ings)
        setBatches(bs)
        setPlaces(pls)

        if (purchase) {
          // Sửa lần mua: điền lại các dòng; dòng nào thành tiền khác SL × đơn giá là dòng nhập thẳng thành tiền
          setOriginal(purchase)
          setBatchId(purchase.batch_id)
          setDate(isoToVNDate(purchase.purchased_at))
          setPlace(purchase.place ?? '')
          setNote(purchase.note ?? '')
          setLines(
            purchase.purchase_items.map((it) => {
              const auto = Math.round(Number(it.quantity) * it.unit_price) === it.line_total
              return {
                ...emptyLine(it.item_group),
                name: it.item_name,
                groupSet: true,
                qty: qtyText(Number(it.quantity)),
                unit: it.unit,
                price: it.unit_price,
                total: it.line_total,
                source: auto ? 'price' : 'total',
              }
            }),
          )
          setReady(true)
          return
        }

        // Lần mua mới: hỏi có tiếp tục phiếu đang nhập dở không
        const draft = readStore<Draft>(DRAFT_KEY)
        if (draft?.lines?.some((l) => !isBlank(l))) {
          const n = draft.lines.filter((l) => !isBlank(l)).length
          const ok = await confirm({
            title: 'Phiếu mua đang nhập dở',
            message: `Bạn có một phiếu mua chưa lưu (${n} dòng). Tiếp tục nhập phiếu đó?`,
            confirmText: 'Tiếp tục nhập',
          })
          if (cancelled) return
          if (ok) {
            setBatchId(draft.batchId)
            setDate(draft.date || todayVN())
            setPlace(draft.place ?? '')
            setNote(draft.note ?? '')
            setLines(draft.lines.length ? draft.lines : [emptyLine()])
            setReady(true)
            return
          }
          writeStore(DRAFT_KEY, null)
        }

        const active = bs.filter((b) => b.status === 'đang mua')
        const fromParam = Number(params.get('dot')) || null
        const last = readStore<number>(LAST_BATCH_KEY)
        setBatchId(fromParam ?? (active.some((b) => b.id === last) ? last : null))
        const fromTemplate = template ? linesFromTemplate(template, ings) : []
        setLines(fromTemplate.length ? fromTemplate : [emptyLine()])
        if (fromTemplate.length) toast.success(`Đã điền sẵn ${fromTemplate.length} mặt hàng của đợt gốc`)
        setReady(true)
      } catch (e) {
        if (!cancelled) toast.error(errorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ tải một lần khi mở trang
  }, [])

  // ---------- Tự giữ phiếu đang nhập dở (chỉ với lần mua mới) ----------
  useEffect(() => {
    if (!ready || editId) return
    const empty = lines.every(isBlank) && !place.trim() && !note.trim()
    writeStore(DRAFT_KEY, empty ? null : ({ batchId, date, place, note, lines } satisfies Draft))
  }, [ready, editId, batchId, date, place, note, lines])

  // ---------- Đưa con trỏ vào ô cần nhập tiếp ----------
  useEffect(() => {
    if (!focusTarget) return
    const el = document.querySelector<HTMLInputElement>(`[data-k="${focusTarget.key}"][data-f="${focusTarget.field}"]`)
    if (el) {
      el.focus()
      el.select?.()
    }
    setFocusTarget(null)
  }, [focusTarget])

  // Tra danh mục theo tên (không phân biệt hoa thường / dấu cách)
  const byName = useMemo(() => {
    const m = new Map<string, Ingredient>()
    ingredients.forEach((i) => m.set(i.name.trim().toLowerCase(), i))
    return m
  }, [ingredients])
  const findExact = useCallback((name: string) => byName.get(name.trim().toLowerCase()), [byName])

  const suggestions = useCallback(
    (name: string): Ingredient[] => {
      const q = normalizeText(name)
      if (!q) return []
      const starts: Ingredient[] = []
      const contains: Ingredient[] = []
      for (const i of ingredients) {
        const n = normalizeText(i.name)
        if (n.startsWith(q)) starts.push(i)
        else if (n.includes(q)) contains.push(i)
      }
      return [...starts, ...contains].slice(0, 5)
    },
    [ingredients],
  )

  const update = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  // Chọn một mặt hàng trong danh mục: điền đơn vị, nhóm, giá lần trước
  const applyIngredient = (key: string, ing: Ingredient) =>
    update(key, {
      name: ing.name,
      unit: ing.unit,
      group: ing.item_group,
      groupSet: true,
      price: ing.last_price,
      total: null,
      source: 'price',
    })

  const pick = (key: string, ing: Ingredient) => {
    clearTimeout(blurTimer.current)
    applyIngredient(key, ing)
    setActiveKey(null)
    setFocusTarget({ key, field: 'qty' })
  }

  const changeName = (l: Line, name: string) => {
    const patch: Partial<Line> = { name }
    // Hàng mới: tự đoán nhóm theo tên nếu người dùng chưa tự chọn
    if (!l.groupSet) {
      const g = guessGroup(name)
      if (g) patch.group = g
    }
    update(l.key, patch)
  }

  const blurName = (l: Line) => {
    // Đợi một chút để kịp nhận lần bấm vào gợi ý
    blurTimer.current = window.setTimeout(() => setActiveKey((k) => (k === l.key ? null : k)), 200)
    // Gõ đúng tên có trong danh mục mà chưa có giá: tự điền
    const ing = findExact(l.name)
    if (ing && l.price === null && l.total === null && !l.unit) applyIngredient(l.key, ing)
  }

  const addLine = () => {
    const last = lines[lines.length - 1]
    const line = emptyLine(last?.group)
    setLines((ls) => [...ls, line])
    setFocusTarget({ key: line.key, field: 'name' })
  }

  const removeLine = async (l: Line) => {
    if (!isBlank(l) && !(await confirm({ title: 'Xóa dòng', message: `Xóa dòng "${l.name || 'chưa đặt tên'}"?`, confirmText: 'Xóa', danger: true })))
      return
    setLines((ls) => (ls.length === 1 ? [emptyLine()] : ls.filter((x) => x.key !== l.key)))
  }

  // Bấm Enter / "Tiếp" trên bàn phím: chuyển sang ô kế tiếp
  const onEnter = (e: KeyboardEvent<HTMLInputElement>, l: Line, field: 'name' | 'qty' | 'money') => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (field === 'name') {
      const first = activeKey === l.key ? suggestions(l.name)[0] : undefined
      if (first && normalizeText(first.name).startsWith(normalizeText(l.name))) return pick(l.key, first)
      return setFocusTarget({ key: l.key, field: 'qty' })
    }
    if (field === 'qty') return setFocusTarget({ key: l.key, field: l.source === 'total' ? 'total' : 'price' })
    const idx = lines.findIndex((x) => x.key === l.key)
    if (idx < lines.length - 1) setFocusTarget({ key: lines[idx + 1].key, field: 'name' })
    else addLine()
  }

  const onNameFocus = (key: string, el: HTMLInputElement) => {
    clearTimeout(blurTimer.current)
    setActiveKey(key)
    // Điện thoại: đưa ô lên giữa màn hình để danh sách gợi ý không bị bàn phím che
    if (window.matchMedia('(pointer: coarse)').matches) {
      setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
    }
  }

  const filled = lines.filter((l) => !isBlank(l))
  const grandTotal = filled.reduce((s, l) => s + (lineValues(l).total ?? 0), 0)

  // Đợt hiển thị để chọn: đợt đang mua + đợt hiện tại (nếu đã chốt)
  const batchOptions = batches.filter((b) => b.status === 'đang mua' || b.id === batchId)

  // ---------- Lưu ----------
  const save = async () => {
    if (filled.length === 0) return toast.error('Chưa có dòng hàng nào')
    for (const l of filled) {
      const n = lines.indexOf(l) + 1
      const v = lineValues(l)
      if (!l.name.trim()) return toast.error(`Dòng ${n}: chưa nhập tên hàng`)
      if (v.qty === null) return toast.error(`Dòng ${n} (${l.name.trim()}): số lượng không hợp lệ`)
      if (v.total === null) return toast.error(`Dòng ${n} (${l.name.trim()}): chưa nhập đơn giá hoặc thành tiền`)
    }
    // Ngày mua: hôm nay -> giờ hiện tại; ngày khác -> 12:00 trưa ngày đó (giờ VN); sửa mà không đổi ngày -> giữ nguyên
    let purchasedAt: string | null
    if (original && isoToVNDate(original.purchased_at) === date) purchasedAt = null
    else purchasedAt = date === todayVN() ? new Date().toISOString() : `${date}T12:00:00+07:00`

    setSaving(true)
    try {
      const saved = await savePurchase(
        {
          batchId,
          purchasedAt,
          place,
          note,
          items: filled.map((l) => {
            const v = lineValues(l)
            return {
              item_name: l.name.trim(),
              item_group: l.group,
              quantity: v.qty!,
              unit: l.unit.trim(),
              unit_price: v.price!,
              line_total: v.total!,
            }
          }),
        },
        editId,
      )
      if (!editId) writeStore(DRAFT_KEY, null)
      writeStore(LAST_BATCH_KEY, batchId)
      toast.success(`Đã lưu lần mua ${formatMoney(saved.total)}`)
      navigate(backTo, { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const discard = async () => {
    const ok = await confirm({
      title: 'Bỏ phiếu mua',
      message: 'Bỏ phiếu đang nhập? Các dòng đã nhập sẽ bị xóa.',
      confirmText: 'Bỏ phiếu',
      danger: true,
    })
    if (!ok) return
    writeStore(DRAFT_KEY, null)
    navigate(backTo, { replace: true })
  }

  const remove = async () => {
    if (!original) return
    const ok = await confirm({
      title: 'Xóa lần mua',
      message: `Xóa lần mua ${formatMoney(original.total)} (${original.purchase_items.length} dòng)? Thao tác này không thể hoàn tác.`,
      confirmText: 'Xóa',
      danger: true,
    })
    if (!ok) return
    try {
      await deletePurchase(original.id)
      toast.success('Đã xóa lần mua')
      navigate(backTo, { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  if (!ready) return <p className="py-10 text-center text-slate-500">Đang tải...</p>

  return (
    <div className="mx-auto max-w-2xl space-y-3 pb-36">
      <div className="flex items-center gap-2">
        <button className="btn-icon" onClick={() => navigate(backTo)} aria-label="Quay lại">
          ←
        </button>
        <h1 className="text-xl font-bold">{editId ? 'Sửa lần mua' : 'Lần mua mới'}</h1>
      </div>

      {/* Thông tin chung */}
      <div className="card grid grid-cols-2 gap-2 p-3">
        <label className="col-span-2">
          <span className="label">Đợt nấu</span>
          <select
            className="input"
            value={batchId ?? ''}
            onChange={(e) => setBatchId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Mua chung (không thuộc đợt nào) —</option>
            {batchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {formatDate(b.date)}
                {b.status === 'đã chốt' ? ' (đã chốt)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Ngày mua</span>
          <input
            type="date"
            className="input"
            value={date}
            max={todayVN()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <label>
          <span className="label">Nơi mua (tùy chọn)</span>
          <input
            className="input"
            list="place-options"
            placeholder="VD: Chợ Bến Thành"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </label>
      </div>

      {/* Các dòng hàng */}
      <ul className="space-y-2">
        {lines.map((l, i) => {
          const v = lineValues(l)
          const sugg = activeKey === l.key ? suggestions(l.name) : []
          const isNew = !!l.name.trim() && !findExact(l.name)
          return (
            <li key={l.key} className="card space-y-2 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-3 w-5 shrink-0 text-center text-sm font-bold text-slate-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <input
                    data-k={l.key}
                    data-f="name"
                    className="input font-semibold"
                    placeholder="Tên hàng (VD: Thịt heo)"
                    autoComplete="off"
                    enterKeyHint="next"
                    value={l.name}
                    onChange={(e) => changeName(l, e.target.value)}
                    onFocus={(e) => onNameFocus(l.key, e.currentTarget)}
                    onBlur={() => blurName(l)}
                    onKeyDown={(e) => onEnter(e, l, 'name')}
                  />
                  {sugg.length > 0 && (
                    <ul
                      className="mt-1 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {sugg.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            className="flex min-h-12 w-full items-center gap-2 px-3 text-left hover:bg-teal-50 active:bg-teal-100"
                            onClick={() => pick(l.key, s)}
                          >
                            <span>{GROUP_META[s.item_group].icon}</span>
                            <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                            <span className="shrink-0 text-sm text-slate-500">
                              {s.last_price !== null ? `${formatMoney(s.last_price)}${s.unit ? `/${s.unit}` : ''}` : s.unit}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button type="button" className="btn-icon mt-1" onClick={() => removeLine(l)} aria-label={`Xóa dòng ${i + 1}`}>
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-[4.5rem_5rem_1fr] gap-2 pl-7">
                <label>
                  <span className="text-xs text-slate-500">Số lượng</span>
                  <input
                    data-k={l.key}
                    data-f="qty"
                    className={`input px-2 text-center ${v.qty === null ? 'border-red-400' : ''}`}
                    inputMode="decimal"
                    enterKeyHint="next"
                    autoComplete="off"
                    value={l.qty}
                    onChange={(e) => update(l.key, { qty: e.target.value.replace(/[^\d.,]/g, '') })}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => onEnter(e, l, 'qty')}
                  />
                </label>
                <label>
                  <span className="text-xs text-slate-500">Đơn vị</span>
                  <input
                    className="input px-2 text-center"
                    list="unit-options"
                    placeholder="kg"
                    autoComplete="off"
                    value={l.unit}
                    onChange={(e) => update(l.key, { unit: e.target.value })}
                  />
                </label>
                <label className="min-w-0">
                  <span className="text-xs text-slate-500">Nhóm {isNew && <b className="text-amber-600">· hàng mới</b>}</span>
                  <select
                    className="input px-2"
                    value={l.group}
                    onChange={(e) => update(l.key, { group: e.target.value as ItemGroup, groupSet: true })}
                  >
                    {ITEM_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {GROUP_META[g].icon} {GROUP_META[g].label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2 pl-7">
                <label>
                  <span className="text-xs text-slate-500">
                    Đơn giá{l.source === 'total' && v.price !== null ? ' (tự tính)' : ''}
                  </span>
                  <MoneyInput
                    inputProps={{
                      'data-k': l.key,
                      'data-f': 'price',
                      enterKeyHint: 'next',
                      onKeyDown: (e) => onEnter(e, l, 'money'),
                    }}
                    className={l.source === 'total' ? 'text-slate-400' : ''}
                    value={v.price}
                    onChange={(val) => update(l.key, { price: val, source: 'price' })}
                  />
                </label>
                <label>
                  <span className="text-xs text-slate-500">
                    Thành tiền{l.source === 'price' && v.total !== null ? ' (tự tính)' : ''}
                  </span>
                  <MoneyInput
                    inputProps={{
                      'data-k': l.key,
                      'data-f': 'total',
                      enterKeyHint: 'next',
                      onKeyDown: (e) => onEnter(e, l, 'money'),
                    }}
                    className={`font-bold ${l.source === 'price' ? 'text-teal-700' : ''}`}
                    value={v.total}
                    onChange={(val) => update(l.key, { total: val, source: 'total' })}
                  />
                </label>
              </div>
            </li>
          )
        })}
      </ul>

      <label className="block">
        <span className="label">Ghi chú (tùy chọn)</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: còn nợ 50k" />
      </label>

      <div className="pt-2 text-center">
        {editId ? (
          <button className="btn btn-secondary text-red-600" onClick={remove}>
            🗑 Xóa lần mua này
          </button>
        ) : (
          <button className="btn btn-secondary text-slate-500" onClick={discard}>
            Bỏ phiếu này
          </button>
        )}
      </div>

      <datalist id="unit-options">
        {COMMON_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <datalist id="place-options">
        {places.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {/* Thanh dưới cùng: tổng tiền + Thêm dòng + Lưu (luôn trong tầm ngón cái) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-slate-500">Tổng ({filled.length} dòng)</span>
            <span className="text-xl font-bold text-teal-700 tabular-nums">{formatMoney(grandTotal)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-secondary min-h-14 text-lg" onClick={addLine}>
              ➕ Thêm dòng
            </button>
            <button type="button" className="btn btn-primary min-h-14 text-lg" onClick={save} disabled={saving}>
              {saving ? 'Đang lưu...' : '💾 Lưu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
