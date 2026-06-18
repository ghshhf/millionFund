// [WHY] ActionSheet composable - 管理快捷操作菜单状态
// [WHAT] 提供打开/关闭 ActionSheet 的统一接口，支持自定义标题和操作列表

import { ref } from 'vue'

export interface ActionSheetAction {
  name: string
  key: string
}

export function useActionSheet() {
  const show = ref(false)
  const title = ref('')
  const actions = ref<ActionSheetAction[]>([])
  
  // 当前操作的上下文数据
  const context = ref<Record<string, unknown>>({})

  function open(options: {
    title: string
    actions: ActionSheetAction[]
    context?: Record<string, unknown>
  }) {
    title.value = options.title
    actions.value = options.actions
    context.value = options.context || {}
    show.value = true
  }

  function close() {
    show.value = false
  }

  function onSelect(index: number) {
    const action = actions.value[index]
    if (!action) return
    close()
    return { action, context: context.value }
  }

  return {
    show,
    title,
    actions,
    context,
    open,
    close,
    onSelect,
  }
}
