// [WHY] Service Worker - PWA 离线缓存与安装支持
// [WHAT] 缓存应用 Shell 和静态资源，支持离线访问和 PWA 安装

const CACHE_NAME = 'fund-app-v1'

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// [WHAT] 安装时预缓存核心文件
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    })
  )
})

// [WHAT] 激活时清理旧缓存
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    })
  )
})

// [WHAT] 拦截网络请求：网络优先，缓存兜底
self.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // [WHAT] 只缓存 GET 请求的成功响应
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || new Response('离线', { status: 503 })
        })
      })
  )
})

export {}
