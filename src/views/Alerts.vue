<template>
  <div class="alerts-page">
    <!-- 导航栏 -->
    <div class="page-header">
      <van-icon name="arrow-left" size="22" @click="router.back()" />
      <span class="header-title">涨跌提醒</span>
      <div style="width: 22px"></div>
    </div>

    <div class="scroll-content">
      <!-- 功能占位 -->
      <div class="placeholder">
        <div class="placeholder-icon">🔔</div>
        <div class="placeholder-title">涨跌提醒</div>
        <div class="placeholder-desc">
          功能开发中，敬请期待
        </div>
        <div class="placeholder-status">
          <van-tag type="primary" plain>功能开发中</van-tag>
        </div>
      </div>

      <!-- 预告功能列表 -->
      <div class="section">
        <div class="section-title">📋 即将支持</div>
        <div class="feature-list">
          <div class="feature-item">
            <van-icon name="bell" size="18" color="#1677ff" />
            <span>净值跌破/突破提醒</span>
          </div>
          <div class="feature-item">
            <van-icon name="trending-up" size="18" color="#1677ff" />
            <span>单日涨跌幅提醒</span>
          </div>
          <div class="feature-item">
            <van-icon name="clock" size="18" color="#1677ff" />
            <span>定时估值推送</span>
          </div>
        </div>
      </div>

      <div class="bottom-spacer"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<style scoped>
.alerts-page {
  height: 100%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  padding-top: max(12px, env(safe-area-inset-top, 0px));
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.scroll-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 60px;
}

/* 占位区域 */
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 32px;
  margin-bottom: 40px;
}

.placeholder-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.placeholder-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.placeholder-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 300px;
  margin-bottom: 16px;
}

.placeholder-status {
  margin-top: 8px;
}

/* 区块 */
.section {
  width: 100%;
  max-width: 400px;
  padding: 0 16px;
  box-sizing: border-box;
  margin-bottom: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.feature-list {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  font-size: 14px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.feature-item:last-child {
  border-bottom: none;
}

.bottom-spacer {
  height: 40px;
}
</style>
