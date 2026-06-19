<template>
  <div class="about-page">
    <!-- 导航栏 -->
    <div class="page-header">
      <van-icon name="arrow-left" size="22" @click="router.back()" />
      <span class="header-title">关于</span>
      <div style="width: 22px"></div>
    </div>

    <div class="scroll-content">
      <!-- ========== 应用信息 ========== -->
      <div class="app-hero">
        <div class="app-icon">📊</div>
        <div class="app-name">{{ APP_INFO.name }}</div>
        <div class="app-version">v{{ APP_INFO.version }}</div>
        <div class="app-desc">{{ APP_INFO.description }}</div>
      </div>

      <!-- ========== 全平台下载 ========== -->
      <div class="section">
        <div class="section-title">📥 下载安装</div>
        <div class="section-desc">选择你的平台下载对应版本，已检测到你正在使用 <strong>{{ platformLabel }}</strong></div>

        <!-- Android -->
        <div class="download-card" v-if="showAndroid">
          <div class="download-icon">📱</div>
          <div class="download-info">
            <div class="download-name">Android APK</div>
            <div class="download-desc">适用于 Android 手机/平板</div>
          </div>
          <div class="download-buttons">
            <van-button type="primary" size="small" round @click="downloadApk('debug')">下载 APK</van-button>
            <van-button plain size="small" round @click="downloadApk('release')">正式版</van-button>
          </div>
        </div>

        <!-- Windows -->
        <div class="download-card">
          <div class="download-icon">🪟</div>
          <div class="download-info">
            <div class="download-name">Windows 桌面版</div>
            <div class="download-desc">适用于 Windows 10/11 x64</div>
          </div>
          <div class="download-buttons">
            <van-button type="primary" size="small" round @click="downloadWin('nsis')">下载安装包</van-button>
            <van-button plain size="small" round @click="downloadWin('portable')">便携版</van-button>
          </div>
        </div>

        <!-- macOS -->
        <div class="download-card">
          <div class="download-icon">🍎</div>
          <div class="download-info">
            <div class="download-name">macOS 桌面版</div>
            <div class="download-desc">适用于 Intel / Apple Silicon Mac</div>
          </div>
          <div class="download-buttons">
            <van-button type="primary" size="small" round @click="downloadMac('dmg')">下载 DMG</van-button>
            <van-button plain size="small" round @click="downloadMac('arm64')">Apple Silicon</van-button>
          </div>
        </div>

        <!-- Linux -->
        <div class="download-card">
          <div class="download-icon">🐧</div>
          <div class="download-info">
            <div class="download-name">Linux 桌面版</div>
            <div class="download-desc">适用于 x64 Linux 发行版</div>
          </div>
          <div class="download-buttons">
            <van-button type="primary" size="small" round @click="downloadLinux('appimage')">AppImage</van-button>
            <van-button plain size="small" round @click="downloadLinux('deb')">.deb 包</van-button>
          </div>
        </div>

        <!-- Web 版 -->
        <div class="download-card" v-if="isWeb">
          <div class="download-icon">🌐</div>
          <div class="download-info">
            <div class="download-name">Web 在线版</div>
            <div class="download-desc">浏览器直接访问，无需安装</div>
          </div>
          <div class="download-buttons">
            <van-button plain size="small" round @click="copyWebUrl">复制链接</van-button>
          </div>
        </div>
      </div>

      <!-- ========== 构建信息 ========== -->
      <div class="section">
        <div class="section-title">🔧 构建信息</div>
        <div class="info-grid">
          <div class="info-row"><span class="info-label">版本号</span><span class="info-value">{{ APP_INFO.version }}</span></div>
          <div class="info-row"><span class="info-label">当前平台</span><span class="info-value">{{ platformLabel }}</span></div>
          <div class="info-row"><span class="info-label">构建时间</span><span class="info-value">{{ buildTime }}</span></div>
          <div class="info-row"><span class="info-label">数据源</span><span class="info-value">{{ dataSourceCount }} 个</span></div>
        </div>
      </div>

      <!-- ========== 开源信息 ========== -->
      <div class="section">
        <div class="section-title">📄 开源信息</div>
        <div class="info-grid">
          <div class="info-row"><span class="info-label">开源协议</span><span class="info-value">{{ APP_INFO.license }}</span></div>
          <div class="info-row"><span class="info-label">项目地址</span><span class="info-value link" @click="openUrl(APP_INFO.github)">{{ GITHUB_REPO }}</span></div>
        </div>
        <div class="disclaimer">
          <div class="disclaimer-title">⚠️ 免责声明</div>
          <div class="disclaimer-text">本工具仅供学习交流使用，不构成任何投资建议。基金估值数据仅供参考，以基金公司公布的净值为准。<strong>投资有风险，理财需谨慎。</strong></div>
        </div>
      </div>

      <!-- 底部间距 -->
      <div class="bottom-spacer"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import { APP_INFO, GITHUB_REPO, DOWNLOAD_URLS, RELEASES_URL, getBuildTime } from '@/config/release'
import { getPlatform, isWeb, isAndroid, isElectron, isMobile } from '@/utils/platform'

const router = useRouter()

const buildTime = ref(getBuildTime())

/** 平台标签 */
const platformLabel = computed(() => {
  switch (getPlatform()) {
    case 'android': return 'Android'
    case 'ios': return 'iOS'
    case 'electron': return 'Windows/Mac/Linux 桌面端'
    default: return 'Web 浏览器'
  }
})

/** 是否显示 Android 下载（非 Android 原生应用时显示） */
const showAndroid = computed(() => !isAndroid())

/** 数据源数量 */
const dataSourceCount = 10

// ========== 下载处理 ==========

function downloadApk(type: 'debug' | 'release') {
  const url = DOWNLOAD_URLS.android[type]
  window.open(url, '_blank')
  showToast('正在下载 APK...')
}

function downloadWin(type: 'nsis' | 'portable') {
  const url = DOWNLOAD_URLS.windows[type]
  window.open(url, '_blank')
  showToast('正在下载 Windows 安装包...')
}

function downloadMac(type: 'dmg' | 'arm64') {
  const url = DOWNLOAD_URLS.macos[type]
  window.open(url, '_blank')
  showToast('正在下载 macOS 安装包...')
}

function downloadLinux(type: 'appimage' | 'deb') {
  const url = DOWNLOAD_URLS.linux[type]
  window.open(url, '_blank')
  showToast('正在下载 Linux 安装包...')
}

async function copyWebUrl() {
  try {
    await navigator.clipboard.writeText(window.location.origin)
    showSuccessToast('链接已复制')
  } catch {
    showToast('复制失败，请手动复制地址栏链接')
  }
}

function openUrl(url: string) {
  window.open(url, '_blank')
}
</script>

<style scoped>
.about-page {
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
}

/* ========== 应用信息 ========== */
.app-hero {
  text-align: center;
  padding: 32px 20px 24px;
  background: linear-gradient(135deg, var(--color-primary-bg), transparent);
}

.app-icon {
  font-size: 56px;
  margin-bottom: 12px;
}

.app-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.app-version {
  display: inline-block;
  font-size: 14px;
  font-weight: 600;
  color: #1677ff;
  background: rgba(22, 119, 255, 0.1);
  padding: 4px 16px;
  border-radius: 12px;
  margin-bottom: 12px;
}

.app-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  max-width: 280px;
  margin: 0 auto;
}

/* ========== 区块 ========== */
.section {
  margin: 12px 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.section-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 12px;
  line-height: 1.4;
}

/* ========== 下载卡片 ========== */
.download-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin-bottom: 10px;
  transition: all 0.2s;
}

.download-card:active {
  transform: scale(0.99);
}

.download-icon {
  font-size: 28px;
  min-width: 40px;
  text-align: center;
}

.download-info {
  flex: 1;
  min-width: 0;
}

.download-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.download-desc {
  font-size: 11px;
  color: var(--text-muted);
}

.download-buttons {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

/* ========== 信息网格 ========== */
.info-grid {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.info-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.info-value.link {
  color: #1677ff;
  cursor: pointer;
}

/* ========== 免责声明 ========== */
.disclaimer {
  margin-top: 12px;
  padding: 14px 16px;
  background: rgba(255, 152, 0, 0.08);
  border: 1px solid rgba(255, 152, 0, 0.2);
  border-radius: 10px;
}

.disclaimer-title {
  font-size: 14px;
  font-weight: 600;
  color: #e6a23c;
  margin-bottom: 6px;
}

.disclaimer-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.bottom-spacer {
  height: 40px;
}
</style>
