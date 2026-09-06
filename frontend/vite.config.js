import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(async ({ command, mode }) => {
  const isTest = process.env.VITEST;
  let plugins = [react()];

  if (!isTest) {
    const tailwindcss = (await import('@tailwindcss/vite')).default;
    plugins.push(tailwindcss());
  }

  return {
    plugins,
    test: {
      environment: 'happy-dom',
      setupFiles: ['./vitest.setup.js'],
      globals: true,
      css: false
    }
  }
})
