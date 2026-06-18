import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

const APP_VERSION = getPackageVersion()

// [WHY] 配置 Vite 构建工具，支持 Vue3 和 Vant 组件自动导入
// [WHAT] 使用 unplugin-vue-components 自动导入 Vant 组件，无需手动 import
// [WHY] 全平台打包（Electron + Capacitor）需要相对路径，file:// 协议下绝对路径会失效
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    // [WHY] 在构建时注入版本号，logger 与页面都能直接读取
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
  },
  esbuild: {
    drop: ['debugger'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  },
})
