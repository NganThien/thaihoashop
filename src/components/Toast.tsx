// Thông báo nhỏ hiện ở đầu màn hình (lưu thành công / có lỗi)
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastType = 'success' | 'error'
interface ToastItem {
  id: number
  type: ToastType
  message: string
}
interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const show = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random()
    setItems((list) => [...list, { id, type, message }])
    // Lỗi hiện lâu hơn để kịp đọc
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), type === 'error' ? 6000 : 2500)
  }, [])

  const [api] = useState<ToastApi>(() => ({
    success: (m) => show('success', m),
    error: (m) => show('error', m),
  }))

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}
            className={`pointer-events-auto w-full max-w-md rounded-xl px-4 py-3 text-base font-medium text-white shadow-lg ${
              t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {t.type === 'success' ? '✓ ' : '⚠ '}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast phải nằm trong ToastProvider')
  return ctx
}
