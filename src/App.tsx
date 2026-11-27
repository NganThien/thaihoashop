import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/Auth'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/Confirm'
import { PrintProvider } from './components/Print'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import PosPage from './pages/PosPage'
import ProductsPage from './pages/ProductsPage'
import OrdersPage from './pages/OrdersPage'
import StatsPage from './pages/StatsPage'
import BackupPage from './pages/BackupPage'

function AppRoutes() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-slate-500">Đang tải...</div>
  }

  // Chưa đăng nhập: chỉ hiện màn hình đăng nhập
  if (!session) return <LoginPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PosPage />} />
        <Route path="mon" element={<ProductsPage />} />
        <Route path="hoa-don" element={<OrdersPage />} />
        <Route path="thong-ke" element={<StatsPage />} />
        <Route path="backup" element={<BackupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <PrintProvider>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </PrintProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
