// Hộp hỏi xác nhận trước khi xóa / hủy. Dùng: if (await confirm({...})) { ... }
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import Modal from './Modal'

interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmText?: string
  danger?: boolean
}
type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  )

  const close = (ok: boolean) => {
    state?.resolve(ok)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? ''}
        footer={
          <>
            <button className="btn btn-secondary flex-1" onClick={() => close(false)}>
              Không
            </button>
            <button className={`btn flex-1 ${state?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
              {state?.confirmText ?? 'Đồng ý'}
            </button>
          </>
        }
      >
        <div className="text-base text-slate-700">{state?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm phải nằm trong ConfirmProvider')
  return ctx
}
