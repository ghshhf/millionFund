// [WHY] 基金搜索 API
// [WHAT] 基金列表加载、搜索、板块关键词映射

import { unifiedCache, CACHE_KEYS, UNIFIED_CACHE_TTL } from '../unifiedCache'
import { http } from '@/utils/http'
import { logger } from '@/utils/logger'
import type { FundInfo } from '@/types/fund'

// [WHAT] 基金列表内存缓存
let _fundListCache: FundInfo[] | null = null

/**
 * 加载全量基金列表（本地 JSON 或远程）
 */
export async function fetchFundList(): Promise<FundInfo[]> {
  if (_fundListCache) return _fundListCache

  const paths = ['./fund-list.json', '/fund-list.json', 'fund-list.json']

  for (const path of paths) {
    try {
      const data = await http.get<FundInfo[]>(path)
      if (Array.isArray(data) && data.length > 0) {
        _fundListCache = data
        return _fundListCache
      }
    } catch (e) {
      logger.warn('[search] 加载本地基金列表失败', { path, error: e })
    }
  }

  // [WHAT] 回退到远程接口
  try {
    const url = `/api/qt/fund.eastmoney.com/js/fundcode_search.js?rt=${Date.now()}`
    const text = await http.text(url, { timeout: 30000 })
    
    // [WHAT] 解析全局变量 r
    const match = text.match(/var\s+r\s*=\s*(\[[\s\S]*?\]);/)
    if (!match) {
      throw new Error('基金列表数据格式错误')
    }
    
    const raw = JSON.parse(match[1] || '[]')
    if (!Array.isArray(raw)) {
      throw new Error('基金列表数据格式错误')
    }
    
    _fundListCache = raw.map((item: string[]) => ({
      code: item[0] || '',
      pinyin: item[1] || '',
      name: item[2] || '',
      type: item[3] || ''
    }))
    
    return _fundListCache
  } catch (e) {
    logger.error('[search] 获取基金列表失败', e)
    return []
  }
}

/**
 * 板块关键词映射
 */
const sectorKeywords: Record<string, string[]> = {
  // === 科技板块 ===
  '半导体': ['半导体', '芯片', '集成电路', '科技', '电子', 'IC', '晶圆'],
  '软件开发': ['软件', '计算机', '信息技术', '科技', '云计算', '数字'],
  '人工智能': ['人工智能', 'AI', '智能', '机器人', '科技', '算力'],
  '云计算': ['云计算', '云', '数据中心', '大数据', '科技'],
  '通信设备': ['通信', '5G', '设备', '网络', '互联网', '信息', '电信', '光纤'],
  '消费电子': ['消费电子', '电子', '智能', '手机', '科技'],
  
  // === 消费板块 ===
  '白酒': ['白酒', '酒', '消费', '食品饮料', '茅台'],
  '食品饮料': ['食品', '饮料', '消费', '酒', '乳业', '调味品'],
  '家用电器': ['家电', '电器', '消费', '家居', '智能家居'],
  '旅游酒店': ['旅游', '酒店', '餐饮', '消费', '休闲', '服务', '景区'],
  
  // === 金融板块 ===
  '银行': ['银行', '金融', '理财'],
  '证券': ['证券', '券商', '金融', '投资'],
  '保险': ['保险', '金融', '寿险'],
  
  // === 医药健康板块 ===
  '医药生物': ['医药', '生物', '医疗', '健康', '制药', '创新药'],
  '中药': ['中药', '医药', '中医', '健康'],
  '医疗器械': ['医疗器械', '器械', '医疗', '医药', '健康'],
  
  // === 新能源板块 ===
  '新能源': ['新能源', '光伏', '锂电', '风电', '储能', '电池', '太阳能', '清洁能源'],
  '光伏': ['光伏', '太阳能', '新能源', '组件'],
  '锂电池': ['锂电', '电池', '新能源', '储能', '动力电池'],
  
  // === 制造业板块 ===
  '汽车': ['汽车', '新能源车', '智能汽车', '车', '整车', '零部件'],
  '军工': ['军工', '国防', '航空', '航天', '军民融合', '船舶'],
  
  // === 周期板块 ===
  '有色金属': ['有色', '金属', '铜', '铝', '锂', '稀土', '黄金'],
  '煤炭': ['煤炭', '能源', '煤', '焦炭'],
  '化工': ['化工', '化学', '材料', '石化'],
  
  // === 基建地产板块 ===
  '房地产': ['房地产', '地产', '房产', '建筑', '基建', '物业'],
  '建筑': ['建筑', '基建', '工程', '建材', '房地产'],
  
  // === 公用事业板块 ===
  '电力': ['电力', '电网', '发电', '能源', '公用事业'],
  '环保': ['环保', '环境', '污染治理', '绿色', '碳中和'],
}

/**
 * 搜索基金
 */
export async function searchFund(keyword: string, limit = 50): Promise<FundInfo[]> {
  const list = await fetchFundList()
  if (!keyword.trim()) return []
  const kw = keyword.toLowerCase().trim()

  const mappedKeywords = sectorKeywords[kw]

  const results = list.filter(
    (item) =>
      item.code.includes(kw) ||
      item.name.toLowerCase().includes(kw) ||
      item.pinyin.toLowerCase().includes(kw)
  )

  if (mappedKeywords) {
    const keywordResults = list.filter((item) => {
      const name = item.name.toLowerCase()
      return mappedKeywords.some((k) => name.includes(k.toLowerCase()))
    })
    const existingCodes = new Set(results.map((r) => r.code))
    keywordResults.forEach((item) => {
      if (!existingCodes.has(item.code)) {
        results.push(item)
        existingCodes.add(item.code)
      }
    })
  }

  // [WHAT] 字符拆分匹配（当结果少于 10 个时）
  if (results.length < 10 && kw.length >= 2 && !mappedKeywords) {
    const chars = kw.split('')
    const charResults = list.filter((item) => {
      const name = item.name.toLowerCase()
      const matchCount = chars.filter((c) => name.includes(c)).length
      return matchCount >= Math.min(2, chars.length)
    })
    const existingCodes = new Set(results.map((r) => r.code))
    charResults.forEach((item) => {
      if (!existingCodes.has(item.code)) {
        results.push(item)
        existingCodes.add(item.code)
      }
    })
  }

  return results.slice(0, limit)
}