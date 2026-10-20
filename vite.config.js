import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// npm run dev        -> http://localhost:5173 (میکروفون کار می‌کنه)
// npm run dev:https  -> https روی شبکه‌ی محلی (برای تست با گوشی)
export default defineConfig(({ mode }) => ({
  plugins: mode === 'https' ? [react(), basicSsl()] : [react()],
}))
