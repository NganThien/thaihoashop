import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Thư viện Supabase khá lớn; app nhỏ nên không cần tách file, tắt cảnh báo
  build: { chunkSizeWarningLimit: 800 },
})
