// CHI TIẾT ĐỢT NẤU & TÍNH GIÁ MÂM
//  - Tổng chi phí, chia theo nhóm hàng (kèm %)
//  - Giá vốn / mâm = tổng chi phí ÷ số mâm
//  - Giá bán gợi ý = giá vốn × (1 + % lãi), làm tròn lên 5.000đ
//  - Giá bán chốt (tự nhập) -> lãi mỗi mâm, tổng lãi của đợt
//  Đổi số mâm / % lãi / giá chốt thì kết quả tính lại ngay và tự lưu.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ITEM_GROUPS, type Batch, type ItemGroup, type Product, type PurchaseWithItems } from '../../types'
import {
  deleteBatch,
  getBatch,
  getProduct,
  listBatchPurchases,
  saveBatchProduct,
  updateBatch,
  type BatchInput,
} from '../../lib/api'
import { errorMessage, formatDate, formatDateTime, formatMoney, normalizeText } from '../../lib/format'
import { calcPricing, formatPercent, formatQuantity, GROUP_META, sumByGroup } from '../../lib/costing'
import { exportBatchPricing } from '../../lib/excel'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/Confirm'
import MoneyInput from '../../components/MoneyInput'
import BatchForm from './BatchForm'
import { BatchStatusBadge } from './BatchStatusBadge'

type Changes = Partial<Pick<BatchInput, 'tray_count' | 'profit_percent' | 'final_price'>>

/** Hiển thị số tiền có dấu: +37.000 ₫ / −12.000 ₫ */
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatMoney(Math.abs(n))}`

export default function BatchDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const [batch, setBatch] = useState<Batch | null>(null)
  const [purchases, setPurchases] = useState<PurchaseWithItems[]>([])
  const [product, setProduct] = useState<Product | null>(null)
  const [origin, setOrigin] = useState<{ batch: Batch; total: number } | null>(null)
  const [loadError, setLoadError] = useState('')

  // Ô nhập tính giá (lưu tự động sau khi ngừng gõ)
  const [trays, setTrays] = useState<number | null>(null)
  const [pct, setPct] = useState<number | null>(null)
  const [finalPrice, setFinalPrice] = useState<number | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const [form, setForm] = useState<'edit' | 'copy' | null>(null)
  const [openGroup, setOpenGroup] = useState<ItemGroup | null>(null)
  const [busy, setBusy] = useState<'product' | 'excel' | null>(null)

  const load = useCallback(async () => {
    try {
      const [b, ps] = await Promise.all([getBatch(id), listBatchPurchases(id)])
      setBatch(b)
      setPurchases(ps)
      setTrays(b.tray_count)
      setPct(b.profit_percent)
      setFinalPrice(b.final_price)
      setProduct(b.product_id ? await getProduct(b.product_id) : null)
      if (b.copied_from_id) {
        const [ob, ops] = await Promise.all([getBatch(b.copied_from_id), listBatchPurchases(b.copied_from_id)])
        setOrigin({ batch: ob, total: ops.reduce((s, p) => s + p.total, 0) })
      } else setOrigin(null)
    } catch (e) {
      setLoadError(errorMessage(e))
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // ---------- Tự lưu số mâm / % lãi / giá chốt ----------
  const pendingChanges = useCallback((): Changes | null => {
    if (!batch) return null
    const c: Changes = {}
    if (trays !== null && trays > 0 && trays !== batch.tray_count) c.tray_count = trays
    if (pct !== null && pct <= 1000 && pct !== batch.profit_percent) c.profit_percent = pct
    if (finalPrice !== batch.final_price) c.final_price = finalPrice
    return Object.keys(c).length ? c : null
  }, [batch, trays, pct, finalPrice])

  const persist = useCallback(
    async (c: Changes) => {
      setSaveState('saving')
      try {
        await updateBatch(id, c)
        setBatch((b) => (b ? { ...b, ...c } : b))
        setSaveState('saved')
      } catch (e) {
        setSaveState('idle')
        toast.error(errorMessage(e))
      }
    },
    [id, toast],
  )

  useEffect(() => {
    const c = pendingChanges()
    if (!c) return
    const t = setTimeout(() => persist(c), 700)
    return () => clearTimeout(t)
  }, [pendingChanges, persist])

  // Rời trang khi chưa kịp lưu: lưu nốt
  const pendingRef = useRef(pendingChanges)
  useEffect(() => {
    pendingRef.current = pendingChanges
  })
  useEffect(
    () => () => {
      const c = pendingRef.current()
      if (c) updateBatch(id, c).catch(() => {})
    },
    [id],
  )

  // ---------- Số liệu ----------
  const items = useMemo(() => purchases.flatMap((p) => p.purchase_items), [purchases])
  const totalCost = purchases.reduce((s, p) => s + p.total, 0)
  const groups = useMemo(() => sumByGroup(items), [items])
  const validTrays = trays !== null && trays > 0 ? trays : null
  const pricing =
    validTrays !== null ? calcPricing(totalCost, validTrays, pct ?? 0, finalPrice) : null

  // Gộp các dòng hàng cùng tên + đơn vị trong một nhóm (để xem chi tiết nhóm)
  const groupItems = (g: ItemGroup) => {
    const map = new Map<string, { name: string; unit: string; qty: number; total: number }>()
    for (const it of items.filter((x) => x.item_group === g)) {
      const k = `${normalizeText(it.item_name)}|${it.unit}`
      const row = map.get(k) ?? { name: it.item_name, unit: it.unit, qty: 0, total: 0 }
      row.qty += Number(it.quantity)
      row.total += it.line_total
      map.set(k, row)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }

  // ---------- Thao tác ----------
  const flush = async () => {
    const c = pendingChanges()
    if (c) await persist(c)
  }

  const saveProduct = async () => {
    if (!finalPrice) return toast.error('Vui lòng nhập giá bán chốt trước')
    setBusy('product')
    try {
      await flush()
      const p = await saveBatchProduct(id)
      setProduct(p)
      setBatch((b) => (b ? { ...b, product_id: p.id } : b))
      toast.success(`Đã lưu món "${p.name}" giá ${formatMoney(p.price)} vào danh sách món`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const toggleStatus = async () => {
    if (!batch) return
    const status = batch.status === 'đang mua' ? 'đã chốt' : 'đang mua'
    try {
      await updateBatch(id, { status })
      setBatch({ ...batch, status })
      toast.success(status === 'đã chốt' ? 'Đã chốt đợt' : 'Đã mở lại đợt')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const doExport = async () => {
    if (!batch) return
    setBusy('excel')
    try {
      await flush()
      const current = { ...batch, ...(pendingChanges() ?? {}) }
      await exportBatchPricing(current, purchases, `ThaiHoaShop_TinhGia_${batch.date}_${batch.id}.xlsx`)
      toast.success('Đã xuất bảng tính giá')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!batch) return
    const ok = await confirm({
      title: 'Xóa đợt nấu',
      message:
        purchases.length > 0
          ? `Xóa đợt "${batch.name}"? ${purchases.length} lần mua của đợt (${formatMoney(totalCost)}) sẽ chuyển thành "Mua chung" và vẫn được tính vào chi phí.`
          : `Xóa đợt "${batch.name}"?`,
      confirmText: 'Xóa đợt',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteBatch(id)
      toast.success(`Đã xóa đợt "${batch.name}"`)
      navigate('/dot-nau', { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  if (loadError) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-600">{loadError}</p>
        <Link to="/dot-nau" className="btn btn-secondary mt-3">
          ← Về danh sách đợt
        </Link>
      </div>
    )
  }
  if (!batch) return <p className="py-10 text-center text-slate-500">Đang tải...</p>

  const here = { from: `/dot-nau/${id}` } // để nút Quay lại / Lưu ở trang mua hàng trở về đây

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {/* ---------- Tiêu đề ---------- */}
      <div className="flex items-start gap-2">
        <Link to="/dot-nau" className="btn-icon" aria-label="Về danh sách đợt">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">{batch.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>Ngày nấu {formatDate(batch.date)}</span>
            <BatchStatusBadge status={batch.status} />
          </div>
          {batch.note && <p className="mt-1 text-sm text-slate-600">📝 {batch.note}</p>}
        </div>
      </div>

      {/* Thanh thao tác: biểu tượng ở trên, chữ ở dưới cho vừa màn hình điện thoại */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: '✏️', label: 'Sửa', onClick: () => setForm('edit') },
          { icon: '📋', label: 'Sao chép', onClick: () => setForm('copy') },
          { icon: '⬇', label: busy === 'excel' ? 'Đang xuất' : 'Excel', onClick: doExport, disabled: busy !== null },
          { icon: '🗑', label: 'Xóa', onClick: remove, danger: true },
        ].map((a) => (
          <button
            key={a.label}
            className={`btn btn-secondary min-h-14 flex-col gap-0 px-1 text-sm ${a.danger ? 'text-red-600' : ''}`}
            onClick={a.onClick}
            disabled={a.disabled}
          >
            <span className="text-lg leading-tight">{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>

      {/* ---------- Đợt sao chép: mua theo danh sách đợt gốc ---------- */}
      {origin && (
        <div className="card space-y-2 border-teal-200 bg-teal-50 p-3">
          <p className="text-sm text-teal-900">
            📋 Sao chép từ đợt{' '}
            <Link to={`/dot-nau/${origin.batch.id}`} className="font-semibold underline">
              {origin.batch.name}
            </Link>{' '}
            ({origin.batch.tray_count} mâm, chi phí {formatMoney(origin.total)})
          </p>
          {purchases.length === 0 && origin.total > 0 && (
            <p className="text-sm text-teal-900">
              Ước tính theo đợt gốc: khoảng <b>{formatMoney(origin.total / origin.batch.tray_count)}</b> tiền vốn / mâm.
            </p>
          )}
          <Link
            to={`/mua-hang/moi?dot=${id}&mau=${origin.batch.id}`}
            state={here}
            className="btn btn-primary w-full"
          >
            🛒 Mua hàng theo danh sách đợt gốc
          </Link>
        </div>
      )}

      {/* ---------- Tính giá mâm ---------- */}
      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Tính giá mâm</h2>
          <span className="text-xs text-slate-400">
            {saveState === 'saving' ? 'Đang lưu...' : saveState === 'saved' ? '✓ Đã lưu' : ''}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-slate-600">Tổng chi phí</span>
          <span className="text-xl font-bold tabular-nums">{formatMoney(totalCost)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="label">Số mâm</span>
            <MoneyInput
              value={trays}
              onChange={setTrays}
              suffix="mâm"
              className={`pr-14 font-semibold ${validTrays === null ? 'border-red-400' : ''}`}
            />
          </label>
          <label>
            <span className="label">% lãi mong muốn</span>
            <MoneyInput
              value={pct}
              onChange={setPct}
              suffix="%"
              className={`font-semibold ${pct !== null && pct > 1000 ? 'border-red-400' : ''}`}
            />
          </label>
        </div>

        <dl className="space-y-2 rounded-xl bg-slate-50 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-slate-600">Giá vốn / mâm</dt>
            <dd className="text-lg font-semibold whitespace-nowrap tabular-nums">
              {pricing ? formatMoney(pricing.costPerTray) : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-600">
              Giá bán gợi ý
              <span className="block text-xs text-slate-500">+{pct ?? 0}% lãi, làm tròn lên 5.000đ</span>
            </dt>
            <dd className="text-lg font-bold whitespace-nowrap text-teal-700 tabular-nums">
              {pricing ? formatMoney(pricing.suggested) : '—'}
            </dd>
          </div>
        </dl>

        <label className="block">
          <span className="label">Giá bán chốt / mâm</span>
          <div className="flex gap-2">
            <div className="flex-1">
              <MoneyInput value={finalPrice} onChange={setFinalPrice} className="text-lg font-bold" placeholder="Nhập giá bán" />
            </div>
            <button
              type="button"
              className="btn btn-secondary shrink-0"
              disabled={!pricing || pricing.suggested <= 0}
              onClick={() => pricing && setFinalPrice(pricing.suggested)}
            >
              Dùng giá gợi ý
            </button>
          </div>
        </label>

        {pricing && pricing.profitPerTray !== null && pricing.totalProfit !== null && (
          <dl className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-600">{pricing.profitPerTray < 0 ? '⚠ Lỗ mỗi mâm' : 'Lãi mỗi mâm'}</dt>
              <dd className={`text-lg font-semibold tabular-nums ${pricing.profitPerTray < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {signed(Math.round(pricing.profitPerTray))}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-600">Doanh thu ({validTrays} mâm)</dt>
              <dd className="font-semibold tabular-nums">{formatMoney(pricing.revenue ?? 0)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2 border-t border-slate-100 pt-2">
              <dt className="font-semibold">{pricing.totalProfit < 0 ? '⚠ Tổng lỗ cả đợt' : 'Tổng lãi cả đợt'}</dt>
              <dd className={`text-xl font-bold tabular-nums ${pricing.totalProfit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {signed(Math.round(pricing.totalProfit))}
              </dd>
            </div>
          </dl>
        )}

        <button className="btn btn-primary w-full" onClick={saveProduct} disabled={busy !== null || !finalPrice}>
          {busy === 'product' ? 'Đang lưu...' : '🍽 Lưu giá mâm vào danh sách món'}
        </button>
        {product && (
          <p className="text-center text-sm text-slate-500">
            Món trong danh sách: <b>{product.name}</b> – {formatMoney(product.price)}
            {product.price !== finalPrice && finalPrice ? ' (chưa cập nhật giá mới)' : ''}
            {!product.is_active ? ' (đang ẩn)' : ''}
          </p>
        )}

        <button className="btn btn-secondary w-full" onClick={toggleStatus}>
          {batch.status === 'đang mua' ? '✓ Chốt đợt (đã mua xong)' : '↺ Mở lại đợt (mua thêm)'}
        </button>
      </section>

      {/* ---------- Chi phí theo nhóm ---------- */}
      <section className="card p-4">
        <h2 className="mb-2 text-lg font-bold">Chi phí theo nhóm</h2>
        {totalCost === 0 ? (
          <p className="py-4 text-center text-slate-400">Chưa có chi phí nào.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ITEM_GROUPS.map((g) => {
              const amount = groups[g]
              const share = totalCost ? amount / totalCost : 0
              const open = openGroup === g
              return (
                <li key={g}>
                  <button
                    className="w-full py-2 text-left disabled:cursor-default"
                    disabled={amount === 0}
                    onClick={() => setOpenGroup(open ? null : g)}
                    aria-expanded={open}
                  >
                    <div className={`flex items-baseline justify-between gap-2 ${amount === 0 ? 'text-slate-400' : ''}`}>
                      <span className="font-semibold">
                        {GROUP_META[g].icon} {GROUP_META[g].label}
                        {amount > 0 && <span className="ml-1 text-xs text-slate-400">{open ? '▲' : '▼'}</span>}
                      </span>
                      <span className="tabular-nums">
                        <span className="mr-2 text-sm text-slate-500">{formatPercent(share)}</span>
                        <b>{formatMoney(amount)}</b>
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      {amount > 0 && <div className="h-2 rounded-full bg-teal-600" style={{ width: `${share * 100}%` }} />}
                    </div>
                  </button>
                  {open && (
                    <ul className="mb-2 space-y-1 rounded-xl bg-slate-50 p-2 text-sm">
                      {groupItems(g).map((r) => (
                        <li key={`${r.name}|${r.unit}`} className="flex justify-between gap-2">
                          <span className="min-w-0 truncate">
                            {r.name}{' '}
                            <span className="text-slate-500">
                              {formatQuantity(r.qty)} {r.unit}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums">{formatMoney(r.total)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ---------- Các lần mua của đợt ---------- */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Các lần mua ({purchases.length})</h2>
          <Link to={`/mua-hang/moi?dot=${id}`} state={here} className="btn btn-primary btn-sm">
            + Thêm lần mua
          </Link>
        </div>
        {purchases.length === 0 ? (
          <p className="py-4 text-center text-slate-400">Chưa có lần mua nào cho đợt này.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {purchases.map((p) => (
              <li key={p.id}>
                <Link to={`/mua-hang/${p.id}`} state={here} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      {formatDateTime(p.purchased_at)}
                      {p.place && <span className="font-normal text-slate-500"> · {p.place}</span>}
                    </div>
                    <div className="truncate text-sm text-slate-500">
                      {p.purchase_items.map((i) => i.item_name).join(', ')}
                    </div>
                  </div>
                  <span className="shrink-0 font-bold tabular-nums">{formatMoney(p.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BatchForm
        open={form !== null}
        mode={form ?? 'edit'}
        batch={batch}
        onClose={() => setForm(null)}
        onSaved={(b) => {
          const mode = form
          setForm(null)
          if (mode === 'copy') navigate(`/dot-nau/${b.id}`)
          else {
            setBatch(b)
            setTrays(b.tray_count)
            setPct(b.profit_percent)
          }
        }}
      />
    </div>
  )
}
