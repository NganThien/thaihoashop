// Khung chung: thanh tiêu đề + menu. Điện thoại: menu ở dưới; máy tính: menu ở trên.
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useConfirm } from './Confirm'
import { SHOP_NAME } from '../config'

const NAV = [
  { to: '/', label: 'Tính tiền', icon: '🧾' },
  { to: '/mon', label: 'Món', icon: '🍜' },
  { to: '/hoa-don', label: 'Hóa đơn', icon: '📋' },
  { to: '/thong-ke', label: 'Thống kê', icon: '📊' },
  { to: '/backup', label: 'Backup', icon: '💾' },
]

export default function Layout() {
  const confirm = useConfirm()

  const logout = async () => {
    if (await confirm({ title: 'Đăng xuất', message: 'Bạn muốn đăng xuất khỏi ứng dụng?', confirmText: 'Đăng xuất' })) {
      await supabase.auth.signOut()
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 bg-teal-700 text-white shadow">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <div className="text-lg font-bold whitespace-nowrap">{SHOP_NAME}</div>
          <nav className="hidden flex-1 gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 font-semibold ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`
                }
              >
                {n.icon} {n.label}
              </NavLink>
            ))}
          </nav>
          <button onClick={logout} className="ml-auto rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/10">
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 pt-3 pb-24 md:px-4 md:pb-6">
        <Outlet />
      </main>

      {/* Menu dưới cùng cho điện thoại */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
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
      </nav>
    </div>
  )
}
