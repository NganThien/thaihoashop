import type { ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
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
import PurchasesPage from './pages/purchases/PurchasesPage'
import PurchaseFormPage from './pages/purchases/PurchaseFormPage'
import BatchesPage from './pages/batches/BatchesPage'
import BatchDetailPage from './pages/batches/BatchDetailPage'
import ProfitPage from './pages/profit/ProfitPage'

// Mở trang khác id thì tạo lại trang từ đầu (không dùng lẫn dữ liệu của trang trước)
function Keyed({ page: Page }: { page: ComponentType }) {
  const { id } = useParams()
  return <Page key={id ?? 'new'} />
}

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
        <Route path="mua-hang" element={<PurchasesPage />} />
        <Route path="mua-hang/moi" element={<Keyed page={PurchaseFormPage} />} />
        <Route path="mua-hang/:id" element={<Keyed page={PurchaseFormPage} />} />
        <Route path="dot-nau" element={<BatchesPage />} />
        <Route path="dot-nau/:id" element={<Keyed page={BatchDetailPage} />} />
        <Route path="lai-lo" element={<ProfitPage />} />
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
