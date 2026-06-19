<template>
  <div class="page-placeholder">
    <div class="placeholder-icon">⚙️</div>
    <h2>设置</h2>
    <p class="placeholder-desc">功能开发中，敬请期待</p>
    <van-button type="primary" size="small" @click="router.push('/')">返回首页</van-button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<style scoped>
.page-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 48px 24px;
  text-align: center;
}
.placeholder-icon {
  font-size: 64px;
  margin-bottom: 16px;
}
.page-placeholder h2 {
  margin: 0 0 8px 0;
  font-size: 20px;
  color: var(--van-text-color);
}
.placeholder-desc {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: var(--van-text-color-2);
}
</style>
