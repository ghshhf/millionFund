// [WHY] 基金重仓股 API
// [WHAT] 获取基金前十重仓股信息

import { unifiedCache, CACHE_KEYS, UNIFIED_CACHE_TTL } from '../unifiedCache'
import { fetchPingzhongData, withConcurrencyControl } from './request'
import { http } from '@/utils/http'
import { logger } from '@/utils/logger'

/**
 * 重仓股信息
 */
export interface HoldingStock {
  code: string
  name: string
  weight: string
  change: number | null
}

/**
 * 获取前十重仓股
 * [WHAT] HTTP 请求替代 queueGlobalVarScript
 */
export async function fetchTopHoldings(code: string): Promise<HoldingStock[]> {
  const cacheKey = `${CACHE_KEYS.TOP_HOLDINGS}_${code}`
  const cached = unifiedCache.get<HoldingStock[]>(cacheKey)
  if (cached) return cached

  const result = await fetchPingzhongData(
    code,
    ['apidata'],
    (vars) => {
      const html = vars['apidata']?.content || ''
      if (!html) return []

      // [WHAT] 解析 HTML 表格数据
      const holdings: HoldingStock[] = []
      
      // [WHAT] 解析表头获取列索引
      const headerRow = (html.match(/<thead[\s\S]*?<tr[\s\S]*?<\/tr>[\s\S]*?<\/thead>/i) || [])[0] || ''
      const headerCells = (headerRow.match(/<th[\s\S]*?>([\s\S]*?)<\/th>/gi) || []).map((th: string) => 
        th.replace(/<[^>]*>/g, '').trim()
      )
      
      let idxCode = -1, idxName = -1, idxWeight = -1
      headerCells.forEach((h: string, i: number) => {
        const t = h.replace(/\s+/g, '')
        if (idxCode < 0 && (t.includes('股票代码') || t.includes('证券代码'))) idxCode = i
        if (idxName < 0 && (t.includes('股票名称') || t.includes('证券名称'))) idxName = i
        if (idxWeight < 0 && (t.includes('占净值比例') || t.includes('占比'))) idxWeight = i
      })

      // [WHAT] 解析数据行
      const rows = html.match(/<tbody[\s\S]*?<\/tbody>/i) || []
      const dataRows = rows.length ? rows[0].match(/<tr[\s\S]*?<\/tr>/gi) || [] : html.match(/<tr[\s\S]*?<\/tr>/gi) || []

      for (const r of dataRows) {
        const tds = (r.match(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi) || []).map((td: string) => 
          td.replace(/<[^>]*>/g, '').trim()
        )
        if (!tds.length) continue

        let stockCode = ''
        let stockName = ''
        let stockWeight = ''

        if (idxCode >= 0 && tds[idxCode]) {
          const m = tds[idxCode].match(/(\d{6})/)
          stockCode = m ? m[1] : tds[idxCode]
        } else {
          const codeIdx = tds.findIndex((txt: string) => /^\d{6}$/.test(txt))
          if (codeIdx >= 0) stockCode = tds[codeIdx]
        }

        if (idxName >= 0 && tds[idxName]) {
          stockName = tds[idxName]
        } else if (stockCode) {
          const i = tds.findIndex((txt: string) => txt && txt !== stockCode && !/%$/.test(txt))
          stockName = i >= 0 ? tds[i] : ''
        }

        if (idxWeight >= 0 && tds[idxWeight]) {
          const wm = tds[idxWeight].match(/([\d.]+)\s*%/)
          stockWeight = wm ? `${wm[1]}%` : tds[idxWeight]
        } else {
          const wIdx = tds.findIndex((txt: string) => /\d+(?:\.\d+)?\s*%/.test(txt))
          stockWeight = wIdx >= 0 ? (tds[wIdx].match(/([\d.]+)\s*%/)?.[1] + '%') : ''
        }

        if (stockCode || stockName || stockWeight) {
          holdings.push({ code: stockCode, name: stockName, weight: stockWeight, change: null })
        }
      }

      return holdings.slice(0, 10)
    },
    []
  )

  // [WHAT] 获取股票实时涨跌（可选）
  if (result.length > 0) {
    const needQuotes = result.filter((h) => /^\d{6}$/.test(h.code))
    if (needQuotes.length > 0) {
      try {
        const tencentCodes = needQuotes.map((h) => {
          const cd = h.code
          if (/^\d{6}$/.test(cd)) {
            const pfx = cd.startsWith('6') || cd.startsWith('9') ? 'sh' : 
              ((cd.startsWith('4') || cd.startsWith('8')) ? 'bj' : 'sz')
            return `s_${pfx}${cd}`
          }
          return null
        }).filter(Boolean).join(',')

        if (tencentCodes) {
          const quoteUrl = `/api/qt/qt.gtimg.cn/q=${tencentCodes}`
          const quoteText = await http.text(quoteUrl, { timeout: 5000 })
          
          // [WHAT] 解析腾讯股票数据
          needQuotes.forEach((h) => {
            const cd = h.code
            const pfx = cd.startsWith('6') || cd.startsWith('9') ? 'sh' : 
              ((cd.startsWith('4') || cd.startsWith('8')) ? 'bj' : 'sz')
            const varName = `v_s_${pfx}${cd}`
            
            // [WHAT] 从响应中提取数据
            const match = quoteText.match(new RegExp(`${varName}="([^"]*)"`, 'i'))
            if (match && match[1]) {
              const parts = match[1].split('~')
              if (parts.length > 5) {
                h.change = parseFloat(parts[5] || '0') || 0
              }
            }
          })
        }
      } catch (e) {
        logger.warn('[holdings] 获取股票涨跌失败', e)
      }
    }
  }

  unifiedCache.set(cacheKey, result, {
    memoryTTL: UNIFIED_CACHE_TTL.FUND_INFO,
    persist: true
  })
  
  return result
}