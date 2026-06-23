// [WHY] statistics.ts 单元测试
import {
  calculateReturnAnalysis,
  calculateFundScore,
  simulateDIP,
  analyzeBestDIPDay,
  predictTrend,
} from '@/utils/statistics'
import type { NetValuePoint, ReturnAnalysis } from '@/types/fund'

// 辅助：生成测试数据
function makeData(points: { date: string; value: number }[]): NetValuePoint[] {
  return points.map(p => ({ date: p.date, value: p.value }))
}

// 生成足够的数据点（60+ 用于 analyzeBestDIPDay，30+ 用于 predictTrend）
function makeEnoughData(count: number, startValue = 1.0): NetValuePoint[] {
  const data: NetValuePoint[] = []
  for (let i = 0; i < count; i++) {
    const date = new Date(2024, 0, i + 1)
    const dateStr = date.toISOString().split('T')[0]!
    data.push({
      date: dateStr,
      value: startValue + i * 0.001,
    })
  }
  return data
}

describe('calculateReturnAnalysis', () => {
  it('数据不足时返回 null', () => {
    const data = makeData([{ date: '2024-01-01', value: 1.0 }])
    expect(calculateReturnAnalysis(data)).toBeNull()
  })

  it('正常计算收益分析', () => {
    const data = makeEnoughData(30)
    const result = calculateReturnAnalysis(data)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('annualizedReturn')
    expect(result).toHaveProperty('volatility')
    expect(result).toHaveProperty('sharpeRatio')
    expect(result).toHaveProperty('maxDrawdown')
  })
})

describe('calculateFundScore', () => {
  it('根据 ReturnAnalysis 计算评分', () => {
    const analysis: ReturnAnalysis = {
      totalReturn: 0.25,
      annualizedReturn: 0.15,
      dailyReturn: 0.0006,
      volatility: 0.12,
      maxDrawdown: -0.08,
      maxDrawdownStart: '2024-02-01',
      maxDrawdownEnd: '2024-03-01',
      sharpeRatio: 1.2,
      sortinoRatio: 1.5,
      calmarRatio: 1.8,
      tradingDays: 250,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    }
    const score = calculateFundScore(analysis)
    expect(score).toHaveProperty('totalScore')
    expect(score).toHaveProperty('level')
    expect(score.totalScore).toBeGreaterThanOrEqual(0)
    expect(score.totalScore).toBeLessThanOrEqual(100)
    expect(['S', 'A', 'B', 'C', 'D']).toContain(score.level)
  })
})

describe('simulateDIP', () => {
  it('数据不足时返回 null', () => {
    const data = makeData([{ date: '2024-01-01', value: 1.0 }])
    expect(simulateDIP(data, 1000, 'monthly')).toBeNull()
  })

  it('正常模拟定投收益', () => {
    const data = makeEnoughData(12) // 12 个月数据
    const result = simulateDIP(data, 1000, 'monthly')
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('totalInvested')
    expect(result).toHaveProperty('currentValue')
    expect(result).toHaveProperty('totalReturn')
  })
})

describe('analyzeBestDIPDay', () => {
  it('数据不足时返回空数组', () => {
    const data = makeData([{ date: '2024-01-01', value: 1.0 }])
    expect(analyzeBestDIPDay(data)).toEqual([])
  })

  it('分析最佳定投日', () => {
    const data = makeEnoughData(60) // 需要 60+ 数据点
    const result = analyzeBestDIPDay(data)
    expect(Array.isArray(result)).toBe(true)
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('day')
      expect(result[0]).toHaveProperty('averageReturn')
    }
  })
})

describe('predictTrend', () => {
  it('数据不足时返回 null', () => {
    const data = makeData([{ date: '2024-01-01', value: 1.0 }])
    expect(predictTrend(data)).toBeNull()
  })

  it('正常预测趋势', () => {
    const data = makeEnoughData(30) // 需要 30+ 数据点
    const result = predictTrend(data)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('trend')
    // TrendPrediction 可能没有 shortMA/longMA，只检查返回的字段
    expect(result?.trend).toBeDefined()
  })
})
