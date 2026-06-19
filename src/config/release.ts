// [WHY] 发布与下载配置
// [WHAT] 集中管理各平台下载链接和发布信息
// [NOTE] 指向 GitHub Releases，每次发布新版本时更新

import { APP_VERSION } from './version'

/** GitHub 仓库信息 */
export const GITHUB_REPO = 'ghshhf/millionFund'
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`
export const RELEASES_URL = `${GITHUB_URL}/releases`

/** 当前版本标签 */
export const CURRENT_TAG = `v${APP_VERSION}`

/** 应用基本信息 */
export const APP_INFO = {
  name: 'AI百万实盘',
  version: APP_VERSION,
  description: '全平台基金管理系统 - 实时估值 · AI调仓追踪 · 多源资讯',
  author: 'millionFund',
  license: 'MIT',
  github: GITHUB_URL,
  homepage: `${GITHUB_URL}#readme`,
}

/** 各平台下载链接 */
export const DOWNLOAD_URLS = {
  /** Android APK（Debug 版） */
  android: {
    debug: `${RELEASES_URL}/download/${CURRENT_TAG}/AI百万实盘-${APP_VERSION}.apk`,
    release: `${RELEASES_URL}/download/${CURRENT_TAG}/AI百万实盘-${APP_VERSION}-release.apk`,
  },
  /** Windows 安装包 */
  windows: {
    nsis: `${RELEASES_URL}/download/${CURRENT_TAG}/AI百万实盘-Setup-${APP_VERSION}.exe`,
    portable: `${RELEASES_URL}/download/${CURRENT_TAG}/AI百万实盘-${APP_VERSION}.exe`,
  },
  /** macOS */
  macos: {
    dmg: `${RELEASES_URL}/download/${CURRENT_TAG}/AI百万实盘-${APP_VERSION}.dmg`,
    arm64: `${RELEASES_URL}/download/${CURRENT_TAG}/AI百万实盘-${APP_VERSION}-arm64.dmg`,
  },
  /** Linux */
  linux: {
    appimage: `${RELEASES_URL}/download/${CURRENT_TAG}/AI百万实盘-${APP_VERSION}.AppImage`,
    deb: `${RELEASES_URL}/download/${CURRENT_TAG}/AI百万实盘_${APP_VERSION}_amd64.deb`,
  },
}

/** 构建时间 */
export function getBuildTime(): string {
  return (window as any).__BUILD_TIME__ || new Date().toISOString()
}
