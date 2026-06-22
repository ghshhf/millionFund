# AI百万实盘

一款功能丰富的开源基金管理系统，支持 **Web / Android / iOS / Windows / macOS / Linux** 全平台。提供自选基金实时估值、持仓盈亏管理、AI 调仓追踪、趋势分析、市场概览等功能。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Vue](https://img.shields.io/badge/Vue-3.x-brightgreen.svg)
![Capacitor](https://img.shields.io/badge/Capacitor-7.x-blue.svg)
![Platform](https://img.shields.io/badge/Platform-全平台-green.svg)
![Version](https://img.shields.io/badge/version-1.9.7-orange.svg)

## 核心功能

- **实时估值** — 秒级刷新基金实时估值数据（支持盘中估值 / 收盘净值）
- **自选管理** — 添加自选基金，按来源（支付宝 / 腾讯 / 京东）分类筛选
- **持仓追踪** — 记录持仓份额和成本，自动计算浮动盈亏和收益率
- **AI 调仓追踪** — 记录调仓记录，复盘调仓效果，支持成功率统计
- **趋势分析** — 包含均线系统、支撑阻力位预测、相关性分析
- **市场概览** — 查看主要股指、全球指数实时行情
- **基金详情** — 完整的基金信息展示，包含分时图、净值走势、持仓分析
- **深度数据** — 资产配置、持有人结构、同类排名、风格分析

## 全平台支持

| 平台 | 构建方式 | 打包产物 |
|------|---------|---------|
| Web | Vite | `dist/` |
| Android | Gradle + Capacitor | `android/app/build/outputs/apk/release/app-release.apk` |
| iOS | Xcode + Capacitor | `ios/App/` 项目 |
| Windows / macOS / Linux | Electron | `electron/` 项目 |

自动化流程：每次提交自动触发 GitHub Actions 多平台并行构建，打 tag 时自动发布到 Releases。

## 更新记录

### v1.9.7 (2026-06-23)

- **JSONP 安全修复**：`fetchFundEstimateFast` / `fetchLatestNetValue` / `fetchFundDetail` 改为 `fetch + text() + 正则解析`，彻底移除 `<script>` 动态注入风险
- **统一错误处理架构**：新增 `src/utils/errorHandler.ts`，所有 API 调用统一走 `handleApiError`，用户提示更友好
- **启用详情页功能**：`Detail.vue` 分红记录和基金公告功能解除注释并接入数据源
- **ESLint 零警告**：修复所有类型检查和代码风格警告
- **Vite 代理完善**：新增 `/api/fundgz`、`/api/fundmobapi` 代理配置，开发环境彻底告别 JSONP
- **Git 历史清理**：使用 `git filter-repo` 清除敏感数据，仓库历史干净合规

### v1.9.0 (2026-06-14)

- **API 层合并**：删除 `fund.ts`，功能整合至 `fundFast.ts`，减少约 1500 行冗余代码
- **全局变量污染治理**：引入 `queueGlobalVarScript` 串行化队列工具，从根本上解决 JSONP 请求数据覆盖问题
- **统一 API 调用入口**：`fetchFundEstimate / searchFund / fetchNetValueHistory` 等函数统一到 `fundFast.ts`
- **全平台构建统一**：GitHub Actions 支持 Web + Android + Windows + macOS + Linux 并行构建
- **代码清洗**：移除上游项目遗留的 `app-3.0.apk` 和不相关的免责声明
- **重构文件**：`src/api/fundFast.ts`、`src/api/tiantianApi.ts`、`src/views/Detail.vue` 等

### v1.8.0

- 启用 TypeScript strict 模式，修复 233 个类型错误，提升运行时稳定性
- 提取硬编码的基金来源配置，便于扩展
- 配置 Capacitor allowNavigation，修复原生 WebView 跨域请求
- 添加 404 路由和 scrollBehavior，优化导航体验
- 移除无用依赖和废弃的 watch 监听

### v1.7.0

- 添加 Material Design 3 样式系统
- 添加 ProGuard/R8 混淆配置，减小 APK 体积
- 修复 JSONP 全局回调冲突，解决请求丢失问题
- 添加 CSP 安全头，防范 XSS 攻击
- 完善 ESLint 配置和类型检查脚本

## 快速开始

```bash
# 克隆项目
git clone https://github.com/ghshhf/millionFund
cd millionFund

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

### 全平台一键构建

```bash
# 构建所有平台（Web + Android + Electron）
npm run build:all

# 单独构建
npm run build:web       # Web
npm run build:android   # Android APK
npm run build:electron  # 桌面端
```

### Android APK 构建

```bash
# 构建 Web 并同步到 Android
npm run build
npx cap sync

# 命令行构建 Release 版本（需要 JDK 21）
cd android
./gradlew assembleRelease
```

APK 输出位置：
- Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release: `android/app/build/outputs/apk/release/app-release.apk`

### iOS 构建

```bash
npm run build
npx cap sync ios
npx cap open ios
# 在 Xcode 中选择 Product → Archive
```

### Electron 桌面端

```bash
npm run build:electron
```

## 技术栈

- **前端框架**：Vue 3 + TypeScript
- **构建工具**：Vite 7
- **UI 组件**：Vant 4 (Material Design 3 风格)
- **移动打包**：Capacitor 7
- **桌面打包**：Electron
- **路由管理**：Vue Router 4
- **状态管理**：Pinia 3
- **数据可视化**：Lightweight Charts
- **OCR 识别**：Tesseract.js
- **自动化**：GitHub Actions

## 项目结构

```
millionFund/
├── src/                # 前端源码
│   ├── api/            # API 数据层（基金/估值/行情）
│   ├── views/          # 页面组件（首页/持仓/搜索/详情）
│   ├── components/     # 可复用组件
│   ├── stores/         # Pinia 状态管理
│   ├── styles/         # 全局样式
│   └── config/         # 配置文件
├── android/            # Android 原生项目
├── ios/                # iOS 原生项目
├── electron/           # Electron 桌面端
├── scripts/            # 自动化脚本（构建/数据拉取）
└── .github/workflows/  # CI/CD 工作流
```

## 免责声明

⚠️ **重要提示**

- 本工具仅供学习交流使用，不构成任何投资建议
- 基金估值数据仅供参考，以基金公司公布的净值为准
- 数据刷新有延迟，仅供学习和参考
- **投资有风险，理财需谨慎**

## 开源协议

本项目基于 [MIT License](./LICENSE) 开源。
