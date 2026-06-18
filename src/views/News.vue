<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { fetchNewsList, fetchFlashNews, fetchEconomicCalendar, getNewsCategories, type NewsItem, type FlashItem, type CalendarItem, type NewsCategory } from '@/api/jin10'
import { showToast, showLoadingToast, closeToast } from 'vant'
import { logger, copyLogsToClipboard } from '@/utils/logger'

const router = useRouter()

const activeTab = ref<'news' | 'flash' | 'calendar'>('news')
const activeCategory = ref('all')
const newsList = ref<NewsItem[]>([])
const flashList = ref<FlashItem[]>([])
const calendarList = ref<CalendarItem[]>([])
const isLoading = ref(false)
const page = ref(1)
const hasMore = ref(true)

const categories = computed(() => getNewsCategories())

async function loadNews() {
  if (isLoading.value) return
  
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  
  try {
    const data = await fetchNewsList(page.value, 20, activeCategory.value)
    if (data.length === 0) {
      hasMore.value = false
    } else {
      newsList.value = [...newsList.value, ...data]
      page.value++
    }
  } catch (error) {
    logger.error('加载新闻失败', error)
    showToast('加载失败，请重试')
  } finally {
    isLoading.value = false
    closeToast()
  }
}

async function loadFlash() {
  if (isLoading.value) return
  
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  
  try {
    flashList.value = await fetchFlashNews()
  } catch (error) {
    logger.error('加载快讯失败', error)
    showToast('加载失败，请重试')
  } finally {
    isLoading.value = false
    closeToast()
  }
}

async function loadCalendar() {
  if (isLoading.value) return
  
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  
  try {
    const today = new Date().toISOString().split('T')[0]
    calendarList.value = await fetchEconomicCalendar(today)
  } catch (error) {
    logger.error('加载日历失败', error)
    showToast('加载失败，请重试')
  } finally {
    isLoading.value = false
    closeToast()
  }
}

function onTabChange(tab: 'news' | 'flash' | 'calendar') {
  activeTab.value = tab
  page.value = 1
  hasMore.value = true
  
  switch (tab) {
    case 'news':
      if (newsList.value.length === 0) loadNews()
      break
    case 'flash':
      if (flashList.value.length === 0) loadFlash()
      break
    case 'calendar':
      if (calendarList.value.length === 0) loadCalendar()
      break
  }
}

function onCategoryChange(category: string) {
  activeCategory.value = category
  newsList.value = []
  page.value = 1
  hasMore.value = true
  loadNews()
}

function onRefresh() {
  switch (activeTab.value) {
    case 'news':
      newsList.value = []
      page.value = 1
      hasMore.value = true
      loadNews()
      break
    case 'flash':
      flashList.value = []
      loadFlash()
      break
    case 'calendar':
      calendarList.value = []
      loadCalendar()
      break
  }
}

async function onCopyLogs(): Promise<void> {
  const ok = await copyLogsToClipboard()
  if (ok) {
    showToast(`日志已复制 (${logger.getAll().length}条)`)
  } else {
    showToast('复制失败，请手动复制')
  }
}

function getFlashTypeClass(type: string) {
  switch (type) {
    case 'important':
      return 'flash-important'
    case 'warning':
      return 'flash-warning'
    default:
      return 'flash-normal'
  }
}

function getFlashTypeLabel(type: string) {
  switch (type) {
    case 'important':
      return '重要'
    case 'warning':
      return '警告'
    default:
      return '快讯'
  }
}

function getImportanceClass(importance: string) {
  switch (importance) {
    case 'high':
      return 'importance-high'
    case 'medium':
      return 'importance-medium'
    default:
      return 'importance-low'
  }
}

function getImportanceLabel(importance: string) {
  switch (importance) {
    case 'high':
      return '高'
    case 'medium':
      return '中'
    default:
      return '低'
  }
}

onMounted(() => {
  loadNews()
})
</script>

<template>
  <div class="news-page">
    <div class="custom-nav-bar">
      <div class="nav-title">财经资讯</div>
      <div class="nav-actions">
        <van-icon name="description-o" size="20" @click="onCopyLogs" title="复制日志" />
      </div>
    </div>

    <div class="tabs-container">
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'news' }"
        @click="onTabChange('news')"
      >
        📰 新闻
      </div>
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'flash' }"
        @click="onTabChange('flash')"
      >
        ⚡ 快讯
      </div>
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'calendar' }"
        @click="onTabChange('calendar')"
      >
        📅 日历
      </div>
    </div>

    <div v-if="activeTab === 'news'" class="content-area">
      <scroll-view class="category-scroll" scroll-x>
        <div class="category-list">
          <div 
            v-for="cat in categories" 
            :key="cat.id"
            class="category-item"
            :class="{ active: activeCategory === cat.id }"
            @click="onCategoryChange(cat.id)"
          >
            <span>{{ cat.icon }}</span>
            <span>{{ cat.name }}</span>
          </div>
        </div>
      </scroll-view>

      <van-pull-refresh v-model="isLoading" @refresh="onRefresh" class="news-list-container">
        <template v-if="newsList.length > 0">
          <div v-for="news in newsList" :key="news.id" class="news-card" @click="router.push(news.url)">
            <div class="news-time">{{ news.time }}</div>
            <div class="news-category">{{ news.category }}</div>
            <div class="news-title">{{ news.title }}</div>
            <div class="news-summary">{{ news.summary }}</div>
            <div v-if="news.tags && news.tags.length > 0" class="news-tags">
              <span v-for="tag in news.tags.slice(0, 3)" :key="tag" class="news-tag">{{ tag }}</span>
            </div>
          </div>
        </template>
        <van-empty v-else description="暂无新闻" />
        
        <div v-if="hasMore" class="load-more">
          <van-loading size="small" v-if="isLoading" />
          <span v-else @click="loadNews">点击加载更多</span>
        </div>
      </van-pull-refresh>
    </div>

    <div v-else-if="activeTab === 'flash'" class="content-area">
      <van-pull-refresh v-model="isLoading" @refresh="onRefresh" class="flash-list-container">
        <template v-if="flashList.length > 0">
          <div v-for="flash in flashList" :key="flash.id" class="flash-card" :class="getFlashTypeClass(flash.type)">
            <div class="flash-header">
              <span class="flash-type" :class="getFlashTypeClass(flash.type)">
                {{ getFlashTypeLabel(flash.type) }}
              </span>
              <span class="flash-time">{{ flash.time }}</span>
            </div>
            <div class="flash-content">{{ flash.content }}</div>
          </div>
        </template>
        <van-empty v-else description="暂无快讯" />
      </van-pull-refresh>
    </div>

    <div v-else-if="activeTab === 'calendar'" class="content-area">
      <van-pull-refresh v-model="isLoading" @refresh="onRefresh" class="calendar-list-container">
        <template v-if="calendarList.length > 0">
          <div v-for="item in calendarList" :key="item.id" class="calendar-card">
            <div class="calendar-time">{{ item.time }}</div>
            <div class="calendar-importance" :class="getImportanceClass(item.importance)">
              {{ getImportanceLabel(item.importance) }}
            </div>
            <div class="calendar-title">{{ item.title }}</div>
            <div v-if="item.currency" class="calendar-currency">{{ item.currency }}</div>
            <div v-if="item.actual || item.forecast || item.previous" class="calendar-data">
              <div class="data-item">
                <span class="data-label">实际</span>
                <span class="data-value">{{ item.actual || '--' }}</span>
              </div>
              <div class="data-item">
                <span class="data-label">预期</span>
                <span class="data-value">{{ item.forecast || '--' }}</span>
              </div>
              <div class="data-item">
                <span class="data-label">前值</span>
                <span class="data-value">{{ item.previous || '--' }}</span>
              </div>
            </div>
          </div>
        </template>
        <van-empty v-else description="暂无经济数据" />
      </van-pull-refresh>
    </div>
  </div>
</template>

<style scoped>
.news-page {
  height: 100%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.custom-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  padding-top: max(12px, env(safe-area-inset-top, 0px));
}

.nav-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.tabs-container {
  display: flex;
  background: var(--bg-secondary);
  padding: 8px 12px;
  gap: 8px;
  border-bottom: 1px solid var(--border-color);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  transition: all 0.2s;
}

.tab-item.active {
  color: var(--text-primary);
  background: var(--color-primary);
  font-weight: 600;
}

.content-area {
  flex: 1;
  overflow: hidden;
}

.category-scroll {
  white-space: nowrap;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.category-list {
  display: inline-flex;
  padding: 10px 12px;
  gap: 10px;
}

.category-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: 20px;
  background: var(--bg-secondary);
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.category-item.active {
  background: var(--color-primary);
  color: var(--text-primary);
}

.news-list-container,
.flash-list-container,
.calendar-list-container {
  height: calc(100% - 50px);
}

.news-card {
  background: var(--bg-card);
  margin: 12px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.news-time {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.news-category {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  margin-bottom: 8px;
}

.news-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  line-height: 1.4;
}

.news-summary {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-tags {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}

.news-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-secondary);
}

.flash-card {
  margin: 8px 12px;
  padding: 14px;
  border-radius: 10px;
  border-left: 4px solid;
}

.flash-normal {
  background: var(--bg-card);
  border-left-color: var(--color-primary);
}

.flash-important {
  background: rgba(255, 152, 0, 0.1);
  border-left-color: #ff9800;
}

.flash-warning {
  background: rgba(245, 108, 108, 0.1);
  border-left-color: #f56c6c;
}

.flash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.flash-type {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
}

.flash-normal .flash-type {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.flash-important .flash-type {
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
}

.flash-warning .flash-type {
  background: rgba(245, 108, 108, 0.2);
  color: #f56c6c;
}

.flash-time {
  font-size: 12px;
  color: var(--text-muted);
}

.flash-content {
  font-size: 15px;
  color: var(--text-primary);
  line-height: 1.5;
}

.calendar-card {
  background: var(--bg-card);
  margin: 12px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.calendar-time {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.calendar-importance {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.importance-high {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.importance-medium {
  background: rgba(255, 152, 0, 0.1);
  color: #ff9800;
}

.importance-low {
  background: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}

.calendar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.calendar-currency {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.calendar-data {
  display: flex;
  gap: 16px;
}

.data-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.data-label {
  font-size: 11px;
  color: var(--text-muted);
}

.data-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.load-more {
  text-align: center;
  padding: 16px;
  font-size: 14px;
  color: var(--text-secondary);
}

.load-more span {
  cursor: pointer;
}

.load-more span:active {
  color: var(--color-primary);
}
</style>
