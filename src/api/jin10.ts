// [WHY] 金十数据 API - 获取财经资讯和快讯
// [WHAT] 提供实时财经新闻、快讯、日历事件等数据
// [DEPS] 依赖 apiEndpoints 配置和 cache 工具

import { getCache, setCache } from '@/api/cache'
import { http } from '@/utils/http'

const CACHE_TTL = {
  NEWS: 60,
  FLASH: 30,
  CALENDAR: 300,
}

export interface NewsItem {
  id: string
  title: string
  summary: string
  url: string
  time: string
  category: string
  tags: string[]
}

export interface FlashItem {
  id: string
  content: string
  time: string
  type: 'important' | 'normal' | 'warning'
}

export interface CalendarItem {
  id: string
  title: string
  time: string
  importance: 'high' | 'medium' | 'low'
  actual?: string
  forecast?: string
  previous?: string
  currency?: string
}

export interface NewsCategory {
  id: string
  name: string
  icon: string
}

const NEWS_CATEGORIES: NewsCategory[] = [
  { id: 'all', name: '全部', icon: '📰' },
  { id: 'fund', name: '基金', icon: '💰' },
  { id: 'stock', name: '股票', icon: '📈' },
  { id: 'macro', name: '宏观', icon: '🌍' },
  { id: 'crypto', name: '加密货币', icon: '🪙' },
  { id: 'commodity', name: '商品', icon: '🛢️' },
  { id: 'forex', name: '外汇', icon: '💱' },
]

export function getNewsCategories(): NewsCategory[] {
  return NEWS_CATEGORIES
}

export async function fetchNewsList(page = 1, pageSize = 20, category = 'all'): Promise<NewsItem[]> {
  const cacheKey = `news_${category}_${page}_${pageSize}`
  const cached = getCache<NewsItem[]>(cacheKey)
  if (cached) return cached

  try {
    const url = 'https://www.jin10.com/api/get_news_list'
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
      type: category === 'all' ? '' : category,
    })

    const data = await http.get<{ data: any[] }>(`${url}?${params}`)

    if (data && Array.isArray(data.data)) {
      const newsList: NewsItem[] = data.data.map((item: any) => ({
        id: String(item.id),
        title: item.title || '',
        summary: item.content || item.summary || '',
        url: `https://www.jin10.com${item.url || ''}`,
        time: item.time || item.publish_time || '',
        category: item.type || 'general',
        tags: item.tags || [],
      }))
      setCache(cacheKey, newsList, CACHE_TTL.NEWS)
      return newsList
    }

    return await fallbackNewsList(page, pageSize, category)
  } catch {
    return await fallbackNewsList(page, pageSize, category)
  }
}

export async function fetchFlashNews(): Promise<FlashItem[]> {
  const cacheKey = 'flash_news'
  const cached = getCache<FlashItem[]>(cacheKey)
  if (cached) return cached

  try {
    const url = 'https://flash-api.jin10.com/get_flash_list'
    const params = new URLSearchParams({
      limit: '20',
    })

    const data = await http.get<{ data: any[] }>(`${url}?${params}`)

    if (data && Array.isArray(data.data)) {
      const flashList: FlashItem[] = data.data.map((item: any) => ({
        id: String(item.id),
        content: item.content || '',
        time: item.time || '',
        type: item.is_important ? 'important' : item.is_warning ? 'warning' : 'normal',
      }))
      setCache(cacheKey, flashList, CACHE_TTL.FLASH)
      return flashList
    }

    return fallbackFlashList()
  } catch {
    return fallbackFlashList()
  }
}

export async function fetchEconomicCalendar(date?: string): Promise<CalendarItem[]> {
  const targetDate = date || new Date().toISOString().split('T')[0]
  const cacheKey = `calendar_${targetDate}`
  const cached = getCache<CalendarItem[]>(cacheKey)
  if (cached) return cached

  try {
    const url = 'https://www.jin10.com/api/get_economic_calendar'
    const params = new URLSearchParams({
      date: targetDate!,
    })

    const data = await http.get<{ data: any[] }>(`${url}?${params}`)

    if (data && Array.isArray(data.data)) {
      const calendarList: CalendarItem[] = data.data.map((item: any) => ({
        id: String(item.id),
        title: item.name || '',
        time: item.time || '',
        importance: item.importance || 'medium',
        actual: item.actual || undefined,
        forecast: item.forecast || undefined,
        previous: item.previous || undefined,
        currency: item.currency || undefined,
      }))
      setCache(cacheKey, calendarList, CACHE_TTL.CALENDAR)
      return calendarList
    }

    return fallbackCalendarList(targetDate!)
  } catch {
    return fallbackCalendarList(targetDate!)
  }
}

async function fallbackNewsList(page: number, pageSize: number, category: string): Promise<NewsItem[]> {
  const mockNews: NewsItem[] = [
    {
      id: '1',
      title: '央行宣布下调存款准备金率0.5个百分点',
      summary: '中国人民银行决定于2024年1月15日下调金融机构存款准备金率0.5个百分点，释放长期资金约1.2万亿元。',
      url: '#',
      time: '2024-01-15 10:30',
      category: 'macro',
      tags: ['央行', '货币政策'],
    },
    {
      id: '2',
      title: '新基金发行回暖，权益类基金占比提升',
      summary: '本周新基金发行市场明显回暖，权益类基金发行数量和规模均呈现上升趋势，投资者风险偏好有所改善。',
      url: '#',
      time: '2024-01-15 09:45',
      category: 'fund',
      tags: ['新基金', '发行'],
    },
    {
      id: '3',
      title: 'A股三大指数集体高开，科技股领涨',
      summary: '今日A股三大指数集体高开，沪指涨0.35%，深成指涨0.48%，创业板指涨0.62%，科技股表现活跃。',
      url: '#',
      time: '2024-01-15 09:35',
      category: 'stock',
      tags: ['A股', '科技股'],
    },
    {
      id: '4',
      title: '美联储维持利率不变，暗示明年降息三次',
      summary: '美联储宣布维持基准利率在5.25%-5.50%区间不变，并在最新的点阵图中暗示2024年可能降息三次。',
      url: '#',
      time: '2024-01-14 23:00',
      category: 'macro',
      tags: ['美联储', '利率'],
    },
    {
      id: '5',
      title: '黄金价格突破2000美元关口',
      summary: '受全球地缘政治紧张局势影响，国际黄金价格突破2000美元/盎司关口，创近三个月新高。',
      url: '#',
      time: '2024-01-14 22:30',
      category: 'commodity',
      tags: ['黄金', '大宗商品'],
    },
    {
      id: '6',
      title: '新能源主题基金业绩回暖',
      summary: '随着新能源板块近期反弹，相关主题基金业绩出现明显回暖，部分基金近一周涨幅超过5%。',
      url: '#',
      time: '2024-01-14 18:00',
      category: 'fund',
      tags: ['新能源', '主题基金'],
    },
    {
      id: '7',
      title: '北向资金单日净流入超80亿元',
      summary: '今日北向资金延续净流入态势，单日净流入金额超过80亿元，显示外资对A股市场信心持续增强。',
      url: '#',
      time: '2024-01-14 15:30',
      category: 'stock',
      tags: ['北向资金', '外资'],
    },
    {
      id: '8',
      title: '人民币汇率创半年新高',
      summary: '在国内经济基本面支撑下，人民币对美元汇率中间价报7.1825，创近半年以来新高。',
      url: '#',
      time: '2024-01-14 11:00',
      category: 'forex',
      tags: ['人民币', '汇率'],
    },
  ]

  const filtered = category === 'all' 
    ? mockNews 
    : mockNews.filter(n => n.category === category)
  
  const start = (page - 1) * pageSize
  return filtered.slice(start, start + pageSize)
}

function fallbackFlashList(): FlashItem[] {
  return [
    { id: '1', content: '【快讯】央行公开市场今日净投放1000亿元', time: '10:30', type: 'normal' },
    { id: '2', content: '【重要】工信部：将出台新一轮新能源汽车支持政策', time: '10:15', type: 'important' },
    { id: '3', content: '【快讯】国内成品油价格上调窗口今日开启', time: '09:45', type: 'normal' },
    { id: '4', content: '【快讯】北向资金净流入已超50亿元', time: '09:35', type: 'normal' },
    { id: '5', content: '【警告】某热门基金大额赎回，请注意风险', time: '09:20', type: 'warning' },
  ]
}

function fallbackCalendarList(date: string): CalendarItem[] {
  return [
    {
      id: '1',
      title: '中国GDP数据',
      time: '10:00',
      importance: 'high',
      actual: '5.2%',
      forecast: '5.0%',
      previous: '4.9%',
      currency: 'CNY',
    },
    {
      id: '2',
      title: '美国CPI数据',
      time: '21:30',
      importance: 'high',
      actual: '3.1%',
      forecast: '3.2%',
      previous: '3.4%',
      currency: 'USD',
    },
    {
      id: '3',
      title: '英国央行利率决议',
      time: '20:00',
      importance: 'medium',
      currency: 'GBP',
    },
  ]
}
