// [WHY] 统一管理网络状态，APK 用户在地铁/电梯等弱网环境打开时
//       之前会看到"空白数据"并以为应用坏了
// [WHAT] 监听 navigator.onLine 和 online/offline 事件
//        暴露 isOnline 状态，供 App.vue 顶部显示提示条
// [WHAT 新增] 增加 justRecovered 信号，从 offline → online 时自动触发页面刷新

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useNetworkStore = defineStore('network', () => {
  // 当前是否在线
  const isOnline = ref(true)
  // 是否已初始化
  const initialized = ref(false)
  // 当前网络状态描述
  const statusText = ref('')
  // 网络刚恢复（从 offline → online），各页面 watch 这个信号自动刷新
  const justRecovered = ref(false)
  // 之前是否离线（用于检测"从离线到在线"的状态变化）
  let wasOffline = false

  function updateOnlineStatus() {
    const online = typeof navigator !== 'undefined'
      ? navigator.onLine !== false
      : true

    const prevOnline = isOnline.value
    isOnline.value = online

    if (online && !prevOnline && wasOffline) {
      // 从离线恢复在线：触发恢复信号（各页面会 watch 这个值）
      justRecovered.value = true
      statusText.value = '网络已恢复，正在刷新数据...'
      // 短暂延迟后重置，方便下次继续触发
      setTimeout(() => { justRecovered.value = false }, 500)
    } else if (online) {
      statusText.value = '网络已连接'
    } else {
      statusText.value = '当前无网络连接，数据可能无法加载'
      wasOffline = true
    }

    return isOnline.value !== prevOnline
  }

  function handleOnline() { updateOnlineStatus() }
  function handleOffline() { updateOnlineStatus() }

  function init() {
    if (initialized.value) return
    initialized.value = true
    updateOnlineStatus()

    if (typeof window !== 'undefined' && 'addEventListener' in window) {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
    }
  }

  function cleanup() {
    if (typeof window !== 'undefined' && 'removeEventListener' in window) {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }

  return {
    isOnline,
    statusText,
    justRecovered,
    init,
    cleanup
  }
})
