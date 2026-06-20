<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
// 金十数据
import { fetchNewsList, fetchFlashNews, fetchEconomicCalendar, getNewsCategories, type NewsItem, type FlashItem, type CalendarItem } from '@/api/jin10'
// 财联社
import { fetchClsTelegram, fetchClsHotTopics, fetchClsPlateMovement, type TelegramItem, type HotTopic, type PlateMovement } from '@/api/cls'
// 雪球
import { fetchHotDiscussions, fetchStockSentimentList, fetchUserViews, type HotDiscussion, type StockSentiment, type UserView } from '@/api/xueqiu'
// 东方财富 Choice
import { fetchNorthFlow, fetchSectorFlows, fetchMainForceFlow, type NorthFlowData, type SectorFlow, type MainForceFlow } from '@/api/choice'
import { showToast, showLoadingToast, closeToast } from 'vant'
import { logger, copyLogsToClipboard } from '@/utils/logger'

const router = useRouter()

// ========== 数据源选择 ==========
type DataSource = 'jin10' | 'cls' | 'xueqiu' | 'choice'
const activeSource = ref<DataSource>('jin10')

// ========== 各个数据源的 tab 状态 ==========
// 金十数据
const jin10Tab = ref<'news' | 'flash' | 'calendar'>('news')
const activeCategory = ref('all')
const newsList = ref<NewsItem[]>([])
const flashList = ref<FlashItem[]>([])
const calendarList = ref<CalendarItem[]>([])
const categories = computed(() => getNewsCategories())
const newsPage = ref(1)
const hasMoreNews = ref(true)

// 财联社
const clsTab = ref<'telegram' | 'hotTopics' | 'plate'>('telegram')
const telegramList = ref<TelegramItem[]>([])
const hotTopicsList = ref<HotTopic[]>([])
const plateList = ref<PlateMovement[]>([])

// 雪球
const xueqiuTab = ref<'discussion' | 'sentiment' | 'views'>('discussion')
const discussionType = ref<'fund' | 'stock'>('fund')
const discussionList = ref<HotDiscussion[]>([])
const sentimentList = ref<StockSentiment[]>([])
const userViewsList = ref<UserView[]>([])

// 东方财富 Choice
const choiceTab = ref<'north' | 'sector' | 'mainforce'>('north')
const northFlow = ref<NorthFlowData | null>(null)
const sectorFlows = ref<SectorFlow[]>([])
const mainForceFlows = ref<MainForceFlow[]>([])

// 通用
const isLoading = ref(false)

// ========== 金十数据 ==========

async function loadJin10News() {
  if (isLoading.value) return
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  try {
    const data = await fetchNewsList(newsPage.value, 20, activeCategory.value)
    if (data.length === 0) hasMoreNews.value = false
    else { newsList.value = [...newsList.value, ...data]; newsPage.value++ }
  } catch { showToast('加载失败') }
  finally { isLoading.value = false; closeToast() }
}

async function loadJin10Flash() {
  if (isLoading.value) return
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  try { flashList.value = await fetchFlashNews() }
  catch { showToast('加载失败') }
  finally { isLoading.value = false; closeToast() }
}

async function loadJin10Calendar() {
  if (isLoading.value) return
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  try {
    const today = new Date().toISOString().split('T')[0]
    calendarList.value = await fetchEconomicCalendar(today)
  } catch { showToast('加载失败') }
  finally { isLoading.value = false; closeToast() }
}

function onJin10TabChange(tab: 'news' | 'flash' | 'calendar') {
  jin10Tab.value = tab
  if (tab === 'news' && newsList.value.length === 0) loadJin10News()
  else if (tab === 'flash' && flashList.value.length === 0) loadJin10Flash()
  else if (tab === 'calendar' && calendarList.value.length === 0) loadJin10Calendar()
}

function onCategoryChange(category: string) {
  activeCategory.value = category
  newsList.value = []; newsPage.value = 1; hasMoreNews.value = true
  loadJin10News()
}

// ========== 财联社 ==========

async function loadClsTelegram() {
  if (isLoading.value) return
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  try { telegramList.value = await fetchClsTelegram() }
  catch { showToast('加载失败') }
  finally { isLoading.value = false; closeToast() }
}

async function loadClsHotTopics() {
  if (isLoading.value) return
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  try { hotTopicsList.value = await fetchClsHotTopics() }
  catch { showToast('加载失败') }
  finally { isLoading.value = false; closeToast() }
}

async function loadClsPlate() {
  if (isLoading.value) return
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  try { plateList.value = await fetchClsPlateMovement() }
  catch { showToast('加载失败') }
  finally { isLoading.value = false; closeToast() }
}

function onClsTabChange(tab: 'telegram' | 'hotTopics' | 'plate') {
  clsTab.value = tab
  if (tab === 'telegram' && telegramList.value.length === 0) loadClsTelegram()
  else if (tab === 'hotTopics' && hotTopicsList.value.length === 0) loadClsHotTopics()
  else if (tab === 'plate' && plateList.value.length === 0) loadClsPlate()
}

async function onCopyLogs(): Promise<void> {
  const ok = await copyLogsToClipboard()
  if (ok) showToast(`日志已复制 (${logger.getAll().length}条)`)
  else showToast('复制失败，请手动复制')
}

// ========== 雪球 ==========

async function loadXueqiuDiscussions() {
  if (isLoading.value) return
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  try { discussionList.value = await fetchHotDiscussions(discussionType.value) }
  catch { showToast('加载失败') }
  finally { isLoading.value = false; closeToast() }
}

async function loadXueqiuSentiment() {
  if (isLoading.value) return
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  try { sentimentList.value = await fetchStockSentimentList(discussionType.value) }
  catch { showToast('加载失败') }
  finally { isLoading.value = false; closeToast() }
}

async function loadXueqiuViews() {
  if (isLoading.value) return
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  try { userViewsList.value = await fetchUserViews() }
  catch { showToast('加载失败') }
  finally { isLoading.value = false; closeToast() }
}

function onXueqiuTabChange(tab: 'discussion' | 'sentiment' | 'views') {
  xueqiuTab.value = tab
  if (tab === 'discussion' && discussionList.value.length === 0) loadXueqiuDiscussions()
  else if (tab === 'sentiment' && sentimentList.value.length === 0) loadXueqiuSentiment()
  else if (tab === 'views' && userViewsList.value.length === 0) loadXueqiuViews()
}

function onXueqiuTypeChange(type: 'fund' | 'stock') {
  discussionType.value = type
  discussionList.value = []; sentimentList.value = []
  loadXueqiuDiscussions()
}

// ========== 东方财富 Choice ==========

async function loadChoiceNorth() {
  if (isLoading.value) return
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  try { northFlow.value = await fetchNorthFlow() }
  catch { showToast('加载失败') }
  finally { isLoading.value = false; closeToast() }
}

async function loadChoiceSector() {
  if (isLoading.value) return
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  try { sectorFlows.value = await fetchSectorFlows() }
  catch { showToast('加载失败') }
  finally { isLoading.value = false; closeToast() }
}

async function loadChoiceMainForce() {
  if (isLoading.value) return
  isLoading.value = true
  showLoadingToast({ message: '加载中...', forbidClick: true })
  try { mainForceFlows.value = await fetchMainForceFlow() }
  catch { showToast('加载失败') }
  finally { isLoading.value = false; closeToast() }
}

function onChoiceTabChange(tab: 'north' | 'sector' | 'mainforce') {
  choiceTab.value = tab
  if (tab === 'north' && !northFlow.value) loadChoiceNorth()
  else if (tab === 'sector' && sectorFlows.value.length === 0) loadChoiceSector()
  else if (tab === 'mainforce' && mainForceFlows.value.length === 0) loadChoiceMainForce()
}

// ========== 数据源切换 ==========

function onSourceChange(source: DataSource) {
  activeSource.value = source

  // 首次进入加载
  if (source === 'cls') {
    if (clsTab.value === 'telegram' && telegramList.value.length === 0) loadClsTelegram()
    else if (clsTab.value === 'hotTopics' && hotTopicsList.value.length === 0) loadClsHotTopics()
    else if (clsTab.value === 'plate' && plateList.value.length === 0) loadClsPlate()
  } else if (source === 'xueqiu') {
    if (xueqiuTab.value === 'discussion' && discussionList.value.length === 0) loadXueqiuDiscussions()
    else if (xueqiuTab.value === 'sentiment' && sentimentList.value.length === 0) loadXueqiuSentiment()
    else if (xueqiuTab.value === 'views' && userViewsList.value.length === 0) loadXueqiuViews()
  } else if (source === 'choice') {
    if (choiceTab.value === 'north' && !northFlow.value) loadChoiceNorth()
    else if (choiceTab.value === 'sector' && sectorFlows.value.length === 0) loadChoiceSector()
    else if (choiceTab.value === 'mainforce' && mainForceFlows.value.length === 0) loadChoiceMainForce()
  }
}

function refreshCurrentSource() {
  // 重置并重新加载当前数据源
  switch (activeSource.value) {
    case 'jin10':
      jin10Tab.value = 'news'
      newsList.value = []; newsPage.value = 1; hasMoreNews.value = true
      loadJin10News()
      break
    case 'cls':
      clsTab.value = 'telegram'
      telegramList.value = []; loadClsTelegram()
      break
    case 'xueqiu':
      xueqiuTab.value = 'discussion'
      discussionList.value = []; sentimentList.value = []; userViewsList.value = []
      loadXueqiuDiscussions()
      break
    case 'choice':
      choiceTab.value = 'north'
      northFlow.value = null
      loadChoiceNorth()
      break
  }
}

onMounted(() => {
  loadJin10News()
})
</script>

<template>
  <div class="news-page">
    <!-- 导航栏 -->
    <div class="custom-nav-bar">
      <div class="nav-title">财经资讯</div>
      <div class="nav-actions">
        <van-icon name="replay" size="20" @click="refreshCurrentSource" title="刷新" style="margin-right: 12px" />
        <van-icon name="description-o" size="20" @click="onCopyLogs" title="复制日志" />
      </div>
    </div>

    <!-- 数据源切换 -->
    <div class="source-tabs">
      <div
        class="source-item"
        :class="{ active: activeSource === 'jin10' }"
        @click="onSourceChange('jin10')"
      >金十数据</div>
      <div
        class="source-item"
        :class="{ active: activeSource === 'cls' }"
        @click="onSourceChange('cls')"
      >财联社</div>
      <div
        class="source-item"
        :class="{ active: activeSource === 'xueqiu' }"
        @click="onSourceChange('xueqiu')"
      >雪球</div>
      <div
        class="source-item"
        :class="{ active: activeSource === 'choice' }"
        @click="onSourceChange('choice')"
      >资金流向</div>
    </div>

    <!-- ==================== 金十数据 ==================== -->
    <template v-if="activeSource === 'jin10'">
      <div class="sub-tabs">
        <div class="sub-tab" :class="{ active: jin10Tab === 'news' }" @click="onJin10TabChange('news')">📰 新闻</div>
        <div class="sub-tab" :class="{ active: jin10Tab === 'flash' }" @click="onJin10TabChange('flash')">⚡ 快讯</div>
        <div class="sub-tab" :class="{ active: jin10Tab === 'calendar' }" @click="onJin10TabChange('calendar')">📅 日历</div>
      </div>

      <!-- 新闻 -->
      <div v-if="jin10Tab === 'news'" class="content-area">
        <div class="category-scroll-x">
          <div class="category-list">
            <div v-for="cat in categories" :key="cat.id" class="category-item" :class="{ active: activeCategory === cat.id }" @click="onCategoryChange(cat.id)">
              <span>{{ cat.icon }}</span><span>{{ cat.name }}</span>
            </div>
          </div>
        </div>
        <div class="scroll-list">
          <template v-if="newsList.length > 0">
            <div v-for="news in newsList" :key="news.id" class="news-card" @click="router.push(news.url)">
              <div class="news-time">{{ news.time }}</div>
              <div class="news-category-tag">{{ news.category }}</div>
              <div class="news-title">{{ news.title }}</div>
              <div class="news-summary">{{ news.summary }}</div>
              <div v-if="news.tags?.length" class="news-tags">
                <span v-for="tag in news.tags.slice(0, 3)" :key="tag" class="news-tag">{{ tag }}</span>
              </div>
            </div>
          </template>
          <van-empty v-else description="暂无新闻" />
          <div v-if="hasMoreNews" class="load-more" @click="loadJin10News">
            <van-loading v-if="isLoading" size="small" />
            <span v-else>点击加载更多</span>
          </div>
        </div>
      </div>

      <!-- 快讯 -->
      <div v-else-if="jin10Tab === 'flash'" class="content-area">
        <div class="scroll-list">
          <template v-if="flashList.length > 0">
            <div v-for="flash in flashList" :key="flash.id" class="flash-card" :class="'flash-' + flash.type">
              <div class="flash-header">
                <span class="flash-type-badge" :class="'flash-' + flash.type">
                  {{ flash.type === 'important' ? '重要' : flash.type === 'warning' ? '警告' : '快讯' }}
                </span>
                <span class="flash-time">{{ flash.time }}</span>
              </div>
              <div class="flash-content">{{ flash.content }}</div>
            </div>
          </template>
          <van-empty v-else description="暂无快讯" />
        </div>
      </div>

      <!-- 日历 -->
      <div v-else-if="jin10Tab === 'calendar'" class="content-area">
        <div class="scroll-list">
          <template v-if="calendarList.length > 0">
            <div v-for="item in calendarList" :key="item.id" class="calendar-card">
              <div class="calendar-time">{{ item.time }}</div>
              <span class="calendar-importance" :class="'imp-' + item.importance">
                {{ item.importance === 'high' ? '高' : item.importance === 'medium' ? '中' : '低' }}
              </span>
              <div class="calendar-title">{{ item.title }}</div>
              <div v-if="item.currency" class="calendar-currency">{{ item.currency }}</div>
              <div v-if="item.actual || item.forecast || item.previous" class="calendar-data-row">
                <div class="data-cell"><span class="data-lbl">实际</span><span class="data-val">{{ item.actual || '--' }}</span></div>
                <div class="data-cell"><span class="data-lbl">预期</span><span class="data-val">{{ item.forecast || '--' }}</span></div>
                <div class="data-cell"><span class="data-lbl">前值</span><span class="data-val">{{ item.previous || '--' }}</span></div>
              </div>
            </div>
          </template>
          <van-empty v-else description="暂无经济数据" />
        </div>
      </div>
    </template>

    <!-- ==================== 财联社 ==================== -->
    <template v-if="activeSource === 'cls'">
      <div class="sub-tabs">
        <div class="sub-tab" :class="{ active: clsTab === 'telegram' }" @click="onClsTabChange('telegram')">📡 电报</div>
        <div class="sub-tab" :class="{ active: clsTab === 'hotTopics' }" @click="onClsTabChange('hotTopics')">🔥 热门</div>
        <div class="sub-tab" :class="{ active: clsTab === 'plate' }" @click="onClsTabChange('plate')">📊 异动</div>
      </div>

      <!-- 电报 -->
      <div v-if="clsTab === 'telegram'" class="content-area">
        <div class="scroll-list">
          <template v-if="telegramList.length > 0">
            <div v-for="item in telegramList" :key="item.id" class="flash-card" :class="'flash-' + item.type">
              <div class="flash-header">
                <span class="flash-type-badge" :class="'flash-' + item.type">
                  {{ item.type === 'urgent' ? '紧急' : item.type === 'important' ? '重要' : '快讯' }}
                </span>
                <span class="flash-time">{{ item.time }}</span>
              </div>
              <div class="flash-content">{{ item.content }}</div>
              <div v-if="item.stocks?.length" class="related-stocks">
                <span v-for="s in item.stocks.slice(0, 3)" :key="s" class="stock-tag">{{ s }}</span>
              </div>
            </div>
          </template>
          <van-empty v-else description="暂无电报" />
        </div>
      </div>

      <!-- 热门主题 -->
      <div v-if="clsTab === 'hotTopics'" class="content-area">
        <div class="scroll-list">
          <template v-if="hotTopicsList.length > 0">
            <div v-for="(topic, idx) in hotTopicsList" :key="topic.id" class="topic-card">
              <div class="topic-rank">{{ idx + 1 }}</div>
              <div class="topic-info">
                <div class="topic-name">{{ topic.name }}</div>
                <div class="topic-heat">热度 {{ topic.热度 >= 10000 ? (topic.热度 / 10000).toFixed(0) + '万' : topic.热度 }}</div>
              </div>
              <div class="topic-change" :class="topic.change >= 0 ? 'up' : 'down'">
                {{ topic.change >= 0 ? '+' : '' }}{{ topic.change }}%
              </div>
            </div>
          </template>
          <van-empty v-else description="暂无热门主题" />
        </div>
      </div>

      <!-- 板块异动 -->
      <div v-if="clsTab === 'plate'" class="content-area">
        <div class="scroll-list">
          <template v-if="plateList.length > 0">
            <div v-for="plate in plateList" :key="plate.id" class="plate-card">
              <div class="plate-name">{{ plate.plateName }}</div>
              <div class="plate-change" :class="plate.direction">{{ plate.direction === 'up' ? '+' : '-' }}{{ plate.changePercent }}%</div>
              <div class="plate-leader">领涨：{{ plate.leadingStock }}</div>
              <div class="plate-reason">{{ plate.reason }}</div>
            </div>
          </template>
          <van-empty v-else description="暂无板块异动" />
        </div>
      </div>
    </template>

    <!-- ==================== 雪球 ==================== -->
    <template v-if="activeSource === 'xueqiu'">
      <div class="sub-tabs">
        <div class="sub-tab" :class="{ active: xueqiuTab === 'discussion' }" @click="onXueqiuTabChange('discussion')">💬 热帖</div>
        <div class="sub-tab" :class="{ active: xueqiuTab === 'sentiment' }" @click="onXueqiuTabChange('sentiment')">🌡️ 情绪</div>
        <div class="sub-tab" :class="{ active: xueqiuTab === 'views' }" @click="onXueqiuTabChange('views')">👤 大V</div>
      </div>

      <!-- 类型切换 -->
      <div v-if="xueqiuTab === 'discussion' || xueqiuTab === 'sentiment'" class="type-switch-bar">
        <span class="type-switch" :class="{ active: discussionType === 'fund' }" @click="onXueqiuTypeChange('fund')">基金</span>
        <span class="type-switch" :class="{ active: discussionType === 'stock' }" @click="onXueqiuTypeChange('stock')">股票</span>
      </div>

      <!-- 热帖 -->
      <div v-if="xueqiuTab === 'discussion'" class="content-area">
        <div class="scroll-list">
          <template v-if="discussionList.length > 0">
            <div v-for="item in discussionList" :key="item.id" class="discuss-card">
              <div class="discuss-header">
                <span class="discuss-user">{{ item.userName }}</span>
                <span class="discuss-time">{{ item.createTime }}</span>
              </div>
              <div class="discuss-title">{{ item.title }}</div>
              <div class="discuss-content">{{ item.content }}</div>
              <div class="discuss-footer">
                <span>❤️ {{ item.likeCount >= 1000 ? (item.likeCount / 1000).toFixed(1) + 'k' : item.likeCount }}</span>
                <span>💬 {{ item.commentCount >= 1000 ? (item.commentCount / 1000).toFixed(1) + 'k' : item.commentCount }}</span>
                <span v-if="item.stockName" class="discuss-stock">{{ item.stockName }}</span>
              </div>
            </div>
          </template>
          <van-empty v-else description="暂无热门讨论" />
        </div>
      </div>

      <!-- 情绪 -->
      <div v-if="xueqiuTab === 'sentiment'" class="content-area">
        <div class="scroll-list">
          <template v-if="sentimentList.length > 0">
            <div v-for="item in sentimentList" :key="item.code" class="sentiment-card">
              <div class="sentiment-header">
                <div class="sentiment-code">{{ item.name }}</div>
                <div class="sentiment-badge" :class="item.sentiment">
                  {{ item.sentiment === 'bullish' ? '🟢 看多' : item.sentiment === 'bearish' ? '🔴 看空' : '⚪ 中性' }}
                </div>
              </div>
              <div class="sentiment-bar-wrap">
                <div class="sentiment-bar">
                  <div class="bar-bullish" :style="{ width: item.bullishRatio + '%' }"></div>
                </div>
                <span class="sentiment-ratio">{{ item.bullishRatio }}% 看多</span>
              </div>
              <div class="sentiment-stats">
                <span>讨论 {{ item.discussionCount }}</span>
                <span>排名 #{{ item.hotRank }}</span>
              </div>
            </div>
          </template>
          <van-empty v-else description="暂无情绪数据" />
        </div>
      </div>

      <!-- 大V观点 -->
      <div v-if="xueqiuTab === 'views'" class="content-area">
        <div class="scroll-list">
          <template v-if="userViewsList.length > 0">
            <div v-for="item in userViewsList" :key="item.id" class="views-card">
              <div class="views-user">
                <span class="views-name">{{ item.userName }}</span>
                <span class="views-desc">{{ item.userDesc }}</span>
              </div>
              <div class="views-title">{{ item.title }}</div>
              <div class="views-summary">{{ item.summary }}</div>
              <div class="views-footer">
                <span class="views-direction" :class="item.direction">
                  {{ item.direction === 'bullish' ? '看多 ↗' : item.direction === 'bearish' ? '看空 ↘' : '中性 →' }}
                </span>
                <span>❤️ {{ item.likes }}</span>
              </div>
            </div>
          </template>
          <van-empty v-else description="暂无大V观点" />
        </div>
      </div>
    </template>

    <!-- ==================== 东方财富 资金流向 ==================== -->
    <template v-if="activeSource === 'choice'">
      <div class="sub-tabs">
        <div class="sub-tab" :class="{ active: choiceTab === 'north' }" @click="onChoiceTabChange('north')">🔄 北向资金</div>
        <div class="sub-tab" :class="{ active: choiceTab === 'sector' }" @click="onChoiceTabChange('sector')">📊 板块资金</div>
        <div class="sub-tab" :class="{ active: choiceTab === 'mainforce' }" @click="onChoiceTabChange('mainforce')">💰 主力资金</div>
      </div>

      <!-- 北向资金 -->
      <div v-if="choiceTab === 'north'" class="content-area">
        <div class="scroll-list">
          <div v-if="northFlow" class="north-card">
            <div class="north-date">{{ northFlow.date }}</div>
            <div class="north-total">
              <span class="total-label">北向合计净流入</span>
              <span class="total-value" :class="northFlow.totalNetInflow >= 0 ? 'up' : 'down'">
                {{ northFlow.totalNetInflow >= 0 ? '+' : '' }}{{ northFlow.totalNetInflow.toFixed(2) }} 亿
              </span>
            </div>
            <div class="north-detail">
              <div class="north-item">
                <span class="north-item-label">沪股通</span>
                <span class="north-item-value" :class="northFlow.shNetInflow >= 0 ? 'up' : 'down'">
                  {{ northFlow.shNetInflow >= 0 ? '+' : '' }}{{ northFlow.shNetInflow.toFixed(2) }}亿
                </span>
              </div>
              <div class="north-item">
                <span class="north-item-label">深股通</span>
                <span class="north-item-value" :class="northFlow.szNetInflow >= 0 ? 'up' : 'down'">
                  {{ northFlow.szNetInflow >= 0 ? '+' : '' }}{{ northFlow.szNetInflow.toFixed(2) }}亿
                </span>
              </div>
              <div class="north-item">
                <span class="north-item-label">当日余额</span>
                <span class="north-item-value">{{ northFlow.balance.toFixed(0) }}亿</span>
              </div>
            </div>
            <!-- 近5日趋势 -->
            <div v-if="northFlow.recent5Day.length" class="north-trend">
              <div class="trend-title">近5日北向资金</div>
              <div class="trend-bars">
                <div v-for="day in northFlow.recent5Day" :key="day.date" class="trend-bar-item">
                  <div class="trend-bar-track">
                    <div
                      class="trend-bar-fill"
                      :class="day.value >= 0 ? 'up' : 'down'"
                      :style="{ height: Math.abs(day.value) / 50 * 100 + '%' }"
                    ></div>
                  </div>
                  <div class="trend-bar-label">{{ day.date.slice(-2) }}</div>
                </div>
              </div>
            </div>
          </div>
          <van-empty v-else description="暂无北向资金数据" />
        </div>
      </div>

      <!-- 板块资金 -->
      <div v-if="choiceTab === 'sector'" class="content-area">
        <div class="scroll-list">
          <template v-if="sectorFlows.length > 0">
            <div v-for="(item, idx) in sectorFlows" :key="idx" class="sector-flow-card">
              <div class="sector-flow-rank">{{ idx + 1 }}</div>
              <div class="sector-flow-info">
                <div class="sector-flow-name">{{ item.sectorName }}</div>
                <div class="sector-flow-leader" v-if="item.leadingStock">领涨：{{ item.leadingStock }}</div>
              </div>
              <div class="sector-flow-value" :class="item.netInflow >= 0 ? 'up' : 'down'">
                {{ item.netInflow >= 0 ? '+' : '' }}{{ item.netInflow.toFixed(1) }}亿
              </div>
            </div>
          </template>
          <van-empty v-else description="暂无板块资金数据" />
        </div>
      </div>

      <!-- 主力资金 -->
      <div v-if="choiceTab === 'mainforce'" class="content-area">
        <div class="scroll-list">
          <template v-if="mainForceFlows.length > 0">
            <div class="mainforce-summary">
              <div v-for="item in mainForceFlows" :key="item.label" class="mainforce-item" :class="{ 'mainforce-main': item.isMain }">
                <div class="mainforce-label">{{ item.label }}</div>
                <div class="mainforce-value" :class="item.netInflow >= 0 ? 'up' : 'down'">
                  {{ item.netInflow >= 0 ? '+' : '' }}{{ item.netInflow.toFixed(1) }}亿
                </div>
                <div v-if="item.ratio > 0" class="mainforce-bar-wrap">
                  <div class="mainforce-bar">
                    <div class="bar-fill" :class="item.netInflow >= 0 ? 'up' : 'down'" :style="{ width: Math.abs(item.ratio) + '%' }"></div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <van-empty v-else description="暂无主力资金数据" />
        </div>
      </div>
    </template>
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

.nav-title { font-size: 18px; font-weight: 600; color: var(--text-primary); }
.nav-actions { display: flex; align-items: center; gap: 8px; }

/* 数据源切换 */
.source-tabs {
  display: flex;
  background: var(--bg-secondary);
  padding: 8px 12px;
  gap: 6px;
  border-bottom: 1px solid var(--border-color);
}
.source-item {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-primary);
  transition: all 0.2s;
  cursor: pointer;
}
.source-item.active {
  color: #fff;
  background: #1677ff;
  font-weight: 600;
}

.sub-tabs {
  display: flex;
  background: var(--bg-primary);
  padding: 6px 12px;
  gap: 4px;
  border-bottom: 1px solid var(--border-color);
}
.sub-tab {
  flex: 1;
  text-align: center;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  transition: all 0.2s;
  cursor: pointer;
}
.sub-tab.active {
  color: var(--text-primary);
  background: var(--color-primary);
  font-weight: 600;
}

/* 类型切换 */
.type-switch-bar {
  display: flex;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}
.type-switch {
  padding: 4px 16px;
  border-radius: 12px;
  font-size: 12px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
}
.type-switch.active {
  background: var(--color-primary);
  color: #fff;
}

/* 内容区 */
.content-area { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.scroll-list { flex: 1; overflow-y: auto; padding-bottom: 20px; }

.category-scroll-x {
  overflow-x: auto;
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
  cursor: pointer;
}
.category-item.active { background: var(--color-primary); color: #fff; }

/* 新闻卡片 */
.news-card {
  background: var(--bg-card);
  margin: 12px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}
.news-time { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
.news-category-tag {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  margin-bottom: 8px;
}
.news-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; line-height: 1.4; }
.news-summary { font-size: 14px; color: var(--text-secondary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.news-tags { display: flex; gap: 6px; margin-top: 10px; }
.news-tag { font-size: 11px; padding: 2px 6px; border-radius: 3px; background: rgba(0,0,0,0.05); color: var(--text-secondary); }

/* 快讯/电报卡片 */
.flash-card { margin: 8px 12px; padding: 14px; border-radius: 10px; border-left: 4px solid; }
.flash-normal { background: var(--bg-card); border-left-color: var(--color-primary); }
.flash-important { background: rgba(255,152,0,0.1); border-left-color: #ff9800; }
.flash-warning { background: rgba(245,108,108,0.1); border-left-color: #f56c6c; }
.flash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.flash-type-badge { font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 3px; }
.flash-normal .flash-type-badge { background: var(--color-primary-bg); color: var(--color-primary); }
.flash-important .flash-type-badge { background: rgba(255,152,0,0.2); color: #ff9800; }
.flash-warning .flash-type-badge { background: rgba(245,108,108,0.2); color: #f56c6c; }
.flash-time { font-size: 12px; color: var(--text-muted); }
.flash-content { font-size: 15px; color: var(--text-primary); line-height: 1.5; }
.related-stocks { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
.stock-tag { font-size: 11px; padding: 1px 6px; border-radius: 3px; background: rgba(22,119,255,0.1); color: #1677ff; }

/* 日历卡片 */
.calendar-card { background: var(--bg-card); margin: 12px; padding: 16px; border-radius: 12px; border: 1px solid var(--border-color); }
.calendar-time { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
.calendar-importance { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-bottom: 8px; }
.imp-high { background: rgba(245,108,108,0.1); color: #f56c6c; }
.imp-medium { background: rgba(255,152,0,0.1); color: #ff9800; }
.imp-low { background: rgba(103,194,58,0.1); color: #67c23a; }
.calendar-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.calendar-currency { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
.calendar-data-row { display: flex; gap: 20px; }
.data-cell { display: flex; flex-direction: column; gap: 4px; }
.data-lbl { font-size: 11px; color: var(--text-muted); }
.data-val { font-size: 14px; font-weight: 600; color: var(--text-primary); }

/* 热门主题 */
.topic-card {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  margin: 4px 12px;
  background: var(--bg-card);
  border-radius: 10px;
  gap: 12px;
}
.topic-rank { font-size: 18px; font-weight: 700; color: var(--text-muted); min-width: 28px; }
.topic-info { flex: 1; }
.topic-name { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.topic-heat { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.topic-change { font-size: 16px; font-weight: 700; }
.up { color: #f56c6c; }
.down { color: #67c23a; }

/* 板块异动 */
.plate-card { margin: 8px 12px; padding: 14px; border-radius: 10px; background: var(--bg-card); border: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.plate-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.plate-change { font-size: 15px; font-weight: 700; }
.plate-leader { font-size: 12px; color: var(--text-secondary); margin-left: auto; }
.plate-reason { width: 100%; font-size: 12px; color: var(--text-muted); }

/* 雪球 - 讨论 */
.discuss-card { margin: 8px 12px; padding: 14px; border-radius: 10px; background: var(--bg-card); border: 1px solid var(--border-color); }
.discuss-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
.discuss-user { font-size: 13px; font-weight: 600; color: #1677ff; }
.discuss-time { font-size: 11px; color: var(--text-muted); }
.discuss-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
.discuss-content { font-size: 14px; color: var(--text-secondary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px; }
.discuss-footer { display: flex; gap: 16px; font-size: 12px; color: var(--text-muted); }
.discuss-stock { background: rgba(22,119,255,0.1); color: #1677ff; padding: 1px 6px; border-radius: 3px; }

/* 雪球 - 情绪 */
.sentiment-card { margin: 8px 12px; padding: 14px; border-radius: 10px; background: var(--bg-card); border: 1px solid var(--border-color); }
.sentiment-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.sentiment-code { font-size: 15px; font-weight: 600; }
.sentiment-badge { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
.sentiment-badge.bullish { background: rgba(245,108,108,0.1); color: #f56c6c; }
.sentiment-badge.bearish { background: rgba(103,194,58,0.1); color: #67c23a; }
.sentiment-badge.neutral { background: rgba(144,147,153,0.1); color: #909399; }
.sentiment-bar-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.sentiment-bar { flex: 1; height: 6px; border-radius: 3px; background: #e8e8e8; overflow: hidden; }
.bar-bullish { height: 100%; background: #f56c6c; border-radius: 3px; transition: width 0.3s; }
.sentiment-ratio { font-size: 12px; color: var(--text-muted); min-width: 70px; text-align: right; }
.sentiment-stats { display: flex; gap: 16px; font-size: 12px; color: var(--text-muted); }

/* 雪球 - 大V观点 */
.views-card { margin: 8px 12px; padding: 14px; border-radius: 10px; background: var(--bg-card); border: 1px solid var(--border-color); }
.views-user { margin-bottom: 8px; }
.views-name { font-size: 14px; font-weight: 600; color: #1677ff; margin-right: 8px; }
.views-desc { font-size: 11px; color: var(--text-muted); }
.views-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
.views-summary { font-size: 14px; color: var(--text-secondary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px; }
.views-footer { display: flex; justify-content: space-between; font-size: 13px; }
.views-direction { font-weight: 600; }
.views-direction.bullish { color: #f56c6c; }
.views-direction.bearish { color: #67c23a; }
.views-direction.neutral { color: #909399; }

/* 北向资金 */
.north-card { margin: 12px; padding: 20px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border-color); }
.north-date { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; }
.north-total { text-align: center; margin-bottom: 20px; }
.total-label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.total-value { font-size: 28px; font-weight: 700; }
.north-detail { display: flex; gap: 12px; margin-bottom: 20px; }
.north-item { flex: 1; text-align: center; padding: 10px; background: var(--bg-secondary); border-radius: 8px; }
.north-item-label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
.north-item-value { font-size: 14px; font-weight: 600; }
.north-trend { border-top: 1px solid var(--border-color); padding-top: 16px; }
.trend-title { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
.trend-bars { display: flex; justify-content: space-around; align-items: flex-end; height: 80px; gap: 8px; }
.trend-bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.trend-bar-track { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.trend-bar-fill { width: 60%; min-height: 4px; border-radius: 3px; transition: height 0.3s; }
.trend-bar-fill.up { background: #f56c6c; }
.trend-bar-fill.down { background: #67c23a; }
.trend-bar-label { font-size: 10px; color: var(--text-muted); margin-top: 4px; }

/* 板块资金 */
.sector-flow-card { display: flex; align-items: center; padding: 14px 16px; margin: 4px 12px; background: var(--bg-card); border-radius: 10px; gap: 12px; }
.sector-flow-rank { font-size: 16px; font-weight: 700; color: var(--text-muted); min-width: 24px; }
.sector-flow-info { flex: 1; }
.sector-flow-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.sector-flow-leader { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.sector-flow-value { font-size: 15px; font-weight: 700; }

/* 主力资金 */
.mainforce-summary { margin: 12px; padding: 16px; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); }
.mainforce-item { padding: 12px 0; border-bottom: 1px solid var(--border-color); }
.mainforce-item:last-child { border-bottom: none; }
.mainforce-item.mainforce-main { background: rgba(22,119,255,0.03); margin: 0 -8px; padding: 12px 8px; border-radius: 8px; }
.mainforce-label { font-size: 14px; color: var(--text-primary); margin-bottom: 4px; }
.mainforce-value { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
.mainforce-bar-wrap { display: flex; align-items: center; gap: 8px; }
.mainforce-bar { flex: 1; height: 6px; border-radius: 3px; background: #e8e8e8; overflow: hidden; }
.mainforce-bar .bar-fill { height: 100%; border-radius: 3px; }
.mainforce-bar .bar-fill.up { background: #f56c6c; }
.mainforce-bar .bar-fill.down { background: #67c23a; }

.load-more { text-align: center; padding: 16px; font-size: 14px; color: var(--text-secondary); cursor: pointer; }
</style>
