# AI百万实盘 - iOS 构建指南

> **版本**: v1.9.0  
> **更新时间**: 2026-06-15  
> **适用平台**: iOS (iPhone/iPad)

---

## ⚠️ 重要说明

**iOS 构建需要在 macOS 系统上完成**，因为需要：
- macOS 操作系统
- Xcode (苹果官方开发工具)
- Apple 开发者账号（可选，越狱设备不需要）

**如果您没有 Mac**：
- 可以请有 Mac 的朋友帮忙构建
- 或使用云服务（如 GitHub Actions、Codemagic 等）

---

## 📋 构建步骤（在 macOS 上操作）

### 1. 准备环境

```bash
# 安装 Node.js (推荐 v18+)
# 下载地址: https://nodejs.org/

# 安装 Java (JDK 11+)
# 下载地址: https://www.oracle.com/java/technologies/downloads/

# 安装 Cocoapods (iOS 依赖管理)
sudo gem install cocoapods
```

### 2. 克隆项目

```bash
git clone https://github.com/ghshhf/millionFund.git
cd millionFund
```

### 3. 安装依赖

```bash
npm install
```

### 4. 构建 Web 应用

```bash
npm run build
```

### 5. 同步 Capacitor iOS 项目

```bash
npx cap sync ios
```

### 6. 打开 Xcode 并构建

```bash
npx cap open ios
```

**在 Xcode 中操作**：
1. 选择目标设备（iPhone/iPad 模拟器或真机）
2. 点击左上角 ▶️ 按钮进行构建
3. 如需导出 IPA 文件：
   - 菜单栏选择 `Product` → `Archive`
   - Archive 完成后点击 `Distribute App`
   - 选择分发方式（Ad Hoc 适合越狱设备）

---

## 📱 越狱设备安装指南

### 方法一：使用 AltStore（推荐）

**适用条件**：
- 设备已越狱 **或** 使用 AltStore 自签名（7天有效期）

**步骤**：
1. 在电脑上安装 AltStore ([官网](https://altstore.io/))
2. 将构建好的 IPA 文件下载到电脑
3. 打开 AltStore，点击 `+` 按钮选择 IPA 文件
4. 输入 Apple ID 密码（自签名模式）
5. 等待安装完成

### 方法二：使用 Cydia Impactor（越狱设备）

**适用条件**：
- 设备已越狱

**步骤**：
1. 下载 Cydia Impactor ([官网](http://www.cydiaimpactor.com/))
2. 连接 iPhone 到电脑
3. 拖拽 IPA 文件到 Cydia Impactor
4. 输入 Apple ID 和密码
5. 等待安装完成

### 方法三：企业签名（需要开发者账号）

**适用条件**：
- 有 Apple 开发者企业账号
- 可以分发给出狱设备用户

**步骤**：
1. 在 Xcode 中配置企业签名
2. 导出 IPA 文件
3. 通过企业 MDM 或网页分发

---

## 🔧 常见问题

### Q1: 我没有 Mac，怎么构建 iOS 版本？

**A**: 有以下方案：
1. **借用朋友的 Mac**（最快）
2. **使用虚拟机**（在 Windows 上装 macOS 虚拟机，但违反 Apple 许可协议）
3. **使用云服务**（如 [Codemagic](https://codemagic.io/)、[GitHub Actions](https://github.com/features/actions)）
4. **购买 Mac mini 远程租赁**（如 [MacStadium](https://www.macstadium.com/)）

### Q2: 越狱设备可以安装未签名的 IPA 吗？

**A**: 可以，但需要：
- 设备已越狱
- 安装 AppSync Unified 插件（通过 Cydia/Sileo）
- 使用 Filza 或 Sideloadly 直接安装

### Q3: 构建失败，提示 "Code signing is required"

**A**: 需要配置签名证书：
1. 打开 Xcode
2. 选择项目 → `Signing & Capabilities`
3. 登录 Apple ID（免费账号即可）
4. 选择团队（Personal Team）
5. 勾选 `Automatically manage signing`

---

## 📦 已提供的文件

在项目压缩包中，您会找到：
- `millionFund-web-v1.9.0.zip` - Web 版本（可部署到服务器）
- `millionFund-desktop-win-v1.9.0.zip` - Windows 桌面端安装包
- `millionFund-android-project-v1.9.0.zip` - Android 项目（可用 Android Studio 打开构建）
- `iOS构建指南.md` - 本文档

---

## 📞 技术支持

如果遇到问题，可以：
1. 查看项目 [GitHub Issues](https://github.com/ghshhf/millionFund/issues)
2. 提交新的 Issue 描述问题
3. 联系开发者（通过 GitHub）

---

**祝构建顺利！如有问题，欢迎反馈。** 🎉
