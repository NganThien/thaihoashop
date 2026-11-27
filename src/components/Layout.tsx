// Khung chung: thanh tiêu đề + menu.
// Điện thoại / máy tính bảng: menu ở dưới (4 mục hay dùng + nút "Thêm"); máy tính: menu ở trên.
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useConfirm } from './Confirm'
import Modal from './Modal'
import { SHOP_NAME } from '../config'

const NAV = [
  { to: '/', label: 'Tính tiền', icon: '🧾' },
  { to: '/mua-hang', label: 'Mua hàng', icon: '🛒' },
  { to: '/dot-nau', label: 'Đợt nấu', icon: '🍲' },
  { to: '/hoa-don', label: 'Hóa đơn', icon: '📋' },
  { to: '/mon', label: 'Món', icon: '🍜' },
  { to: '/thong-ke', label: 'Thống kê', icon: '📊' },
  { to: '/lai-lo', label: 'Lãi lỗ', icon: '📈' },
  { to: '/backup', label: 'Backup', icon: '💾' },
]
const MAIN = NAV.slice(0, 4) // hiện trên thanh dưới của điện thoại
const MORE = NAV.slice(4) // nằm trong nút "Thêm"

export default function Layout() {
  const confirm = useConfirm()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  // Màn hình nhập phiếu mua: ẩn menu dưới để có thêm chỗ nhập
  const focusMode = /^\/mua-hang\/.+/.test(pathname)
  const inMore = MORE.some((n) => pathname.startsWith(n.to))

  const logout = async () => {
    setMoreOpen(false)
    if (await confirm({ title: 'Đăng xuất', message: 'Bạn muốn đăng xuất khỏi ứng dụng?', confirmText: 'Đăng xuất' })) {
      await supabase.auth.signOut()
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 bg-teal-700 text-white shadow">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <div className="text-lg font-bold whitespace-nowrap">{SHOP_NAME}</div>
          <nav className="hidden min-w-0 flex-1 gap-1 overflow-x-auto lg:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `shrink-0 rounded-lg px-2.5 py-2 text-[15px] font-semibold whitespace-nowrap ${
                    isActive ? 'bg-white/20' : 'hover:bg-white/10'
                  }`
                }
              >
                {n.icon} {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={logout}
            className="ml-auto shrink-0 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap hover:bg-white/10"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <main
        className={`mx-auto w-full max-w-7xl flex-1 px-3 pt-3 md:px-4 lg:pb-6 ${focusMode ? 'pb-6' : 'pb-24'}`}
      >
        <Outlet />
      </main>

      {/* Menu dưới cùng cho điện thoại / máy tính bảng */}
      {!focusMode && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          {MAIN.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                  isActive ? 'text-teal-700' : 'text-slate-500'
                }`
              }
            >
              <span className="text-xl leading-none">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
              inMore ? 'text-teal-700' : 'text-slate-500'
            }`}
          >
            <span className="text-xl leading-none">☰</span>
            Thêm
          </button>
        </nav>
      )}

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu">
        <div className="grid grid-cols-2 gap-2">
          {MORE.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `flex min-h-16 items-center gap-3 rounded-xl border px-4 text-base font-semibold ${
                  isActive ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-700'
                }`
              }
            >
              <span className="text-2xl">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </div>
        <button className="btn btn-secondary mt-3 w-full" onClick={logout}>
          Đăng xuất
        </button>
      </Modal>
    </div>
  )
}
