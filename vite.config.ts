import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'
import { fileURLToPath, URL } from 'node:url'

// [WHY] 配置 Vite 构建工具，支持 Vue3 和 Vant 组件自动导入
// [WHAT] 使用 unplugin-vue-components 自动导入 Vant 组件，无需手动 import
// [WHY] 全平台打包（Electron + Capacitor）需要相对路径，file:// 协议下绝对路径会失效
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    // [HOW] VantResolver 会自动识别 Vant 组件并导入对应的样式
    Components({
      resolvers: [VantResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // [WHAT] 定义全局常量，构建时注入
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  // [WHY] 移除 debugger 语句；console.warn/error 保留用于线上问题排查
  esbuild: {
    drop: ['debugger'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})
