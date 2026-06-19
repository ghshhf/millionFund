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
            <div class="download-desc">适用于 Android 手机/平板，下载后直接安装</div>
          </div>
          <div class="download-buttons">
            <van-button type="primary" size="small" round @click="downloadAndInstallApk">📲 安装 APK</van-button>
            <van-button plain size="small" round @click="showApkQr = true">二维码</van-button>
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

        <!-- PWA 安装横幅 -->
        <div v-if="canInstallPwa" class="pwa-install-banner">
          <div class="pwa-install-info">
            <span>📲</span>
            <span>安装到桌面，体验更流畅</span>
          </div>
          <van-button type="primary" size="small" round @click="installPwa">一键安装</van-button>
        </div>
      </div>

      <!-- ========== APK 安装二维码弹窗 ========== -->
      <van-overlay :show="showApkQr" @click="showApkQr = false">
        <div class="qr-modal" @click.stop>
          <div class="qr-title">📱 扫码安装 Android 版</div>
          <div class="qr-hint">用手机相机或浏览器扫码即可下载 APK</div>
          <img :src="apkQrUrl" alt="APK 下载二维码" class="qr-image" />
          <div class="qr-url">{{ apkDownloadUrl }}</div>
          <van-button type="primary" size="small" round @click="downloadApk('debug')">直接下载</van-button>
          <van-button plain size="small" round style="margin-top: 8px" @click="showApkQr = false">关闭</van-button>
        </div>
      </van-overlay>

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
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import { APP_INFO, GITHUB_REPO, DOWNLOAD_URLS, RELEASES_URL, getBuildTime } from '@/config/release'
import { getPlatform, isWeb, isAndroid, isElectron, isMobile } from '@/utils/platform'

const router = useRouter()

const buildTime = ref(getBuildTime())

// ========== PWA 安装 ==========
const pwaInstallEvent = ref<any>(null)
const canInstallPwa = ref(false)

onMounted(() => {
  // [WHAT] 监听 PWA beforeinstallprompt 事件
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    pwaInstallEvent.value = e
    canInstallPwa.value = true
  })

  // [WHAT] PWA 安装成功
  window.addEventListener('appinstalled', () => {
    canInstallPwa.value = false
    pwaInstallEvent.value = null
    showSuccessToast('安装成功 🎉')
  })
})

async function installPwa() {
  if (!pwaInstallEvent.value) {
    showToast('请使用浏览器菜单"添加到主屏幕"')
    return
  }
  pwaInstallEvent.value.prompt()
  const result = await pwaInstallEvent.value.userChoice
  if (result.outcome === 'accepted') {
    showSuccessToast('安装成功 🎉')
  }
  pwaInstallEvent.value = null
  canInstallPwa.value = false
}

/** 点击安装/下载 APK */
async function downloadAndInstallApk() {
  const dlUrl = DOWNLOAD_URLS.android.debug
  
  // [WHAT] Android 设备上直接下载 APK，系统会弹出安装提示
  if (isAndroid()) {
    // Android 原生应用：通过 Capacitor 或系统浏览器下载
    window.open(dlUrl, '_system')
    showToast('APK 下载中，请查看通知栏')
    return
  }
  
  // [WHAT] Web/桌面端：在浏览器中打开下载
  window.open(dlUrl, '_blank')
  showToast('正在下载 APK...')
  
  // [WHAT] 提示扫码安装
  showConfirmDialog({
    title: '📱 手机安装',
    message: '用手机扫描二维码即可直接安装到手机',
    confirmButtonText: '扫码安装',
  }).then(() => {
    showApkQr.value = true
  }).catch(() => {
    // 取消
  })
}

/** 是否显示 APK 安装二维码 */
const showApkQr = ref(false)
const apkDownloadUrl = DOWNLOAD_URLS.android.debug

/** 生成二维码（用在线 API 生成） */
const apkQrUrl = computed(() => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(apkDownloadUrl)}`
})

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

/* ========== PWA 安装横幅 ========== */
.pwa-install-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin-top: 8px;
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.1), rgba(22, 119, 255, 0.05));
  border: 1px solid rgba(22, 119, 255, 0.2);
  border-radius: 12px;
}
.pwa-install-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
}

/* ========== APK 二维码弹窗 ========== */
.qr-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 280px;
  background: var(--bg-card);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.qr-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.qr-hint {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}
.qr-image {
  width: 180px;
  height: 180px;
  border-radius: 8px;
  background: #fff;
  padding: 8px;
}
.qr-url {
  font-size: 10px;
  color: var(--text-muted);
  word-break: break-all;
  text-align: center;
  max-width: 100%;
}

.bottom-spacer {
  height: 40px;
}
</style>
