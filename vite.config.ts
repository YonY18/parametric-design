import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Keep the CAD worker as a native module worker so Vite can bundle its WASM asset.

export default defineConfig({
  plugins: [react()],
})
