// [WHY] statistics.ts 单元测试：验证收益分析、基金评分等算法
import { describe, it, expect } from 'vitest'
import {
  calculateReturnAnalysis,
  calculateFundScore,
  simulateDIP,
  analyzeBestDIPDay,
  calculateCorrelation,
  predictTrend,
  analyzeAllocation,
} from '@/utils/statistics'
import type { NetValuePoint } from '@/utils/statistics'

// 构造测试用的净值数据
function makeData(points: { date: string; value: number }[]): NetValuePoint[] {
  return points.map(p => ({ date: p.date, value: p.value, change: 0 }))
}

describe('calculateReturnAnalysis', () => {
  it('数据不足时返回 null', () => {
    expect(calculateReturnAnalysis(makeData([{ date: '2024-01-01', value: 1.0 }]))).toBeNull()
  })

  it('正常计算收益分析指标', () => {
    const data = makeData([
      { date: '2024-01-01', value: 1.0 },
      { date: '2024-01-02', value: 1.01 },
      { date: '2024-01-03', value: 1.02 },
    ])
    const result = calculateReturnAnalysis(data)
    expect(result).not.toBeNull()
    expect(result!.totalReturn).toBeCloseTo(2.0, 1)
  })
})

describe('calculateFundScore', () => {
  it('根据 ReturnAnalysis 计算综合评分', () => {
    const analysis = {
      totalReturn: 10,
      annualizedReturn: 8,
      dailyReturn: 0.03,
      volatility: 10,
      maxDrawdown: 15,
      maxDrawdownStart: '2024-01-01',
      maxDrawdownEnd: '2024-01-10',
      sharpeRatio: 0.8,
      sortinoRatio: 1.2,
      calmarRatio: 0.5,
      tradingDays: 252,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    }
    const score = calculateFundScore(analysis)
    expect(score.totalScore).toBeGreaterThan(0)
    expect(score.totalScore).toBeLessThanOrEqual(100)
    expect(['S', 'A', 'B', 'C', 'D']).toContain(score.level)
  })
})

describe('simulateDIP', () => {
  it('数据不足时返回 null', () => {
    expect(simulateDIP(makeData([{ date: '2024-01-01', value: 1.0 }), 1000)).toBeNull()
  })

  it('正常模拟定投收益', () => {
    const data = makeData([
      { date: '2024-01-01', value: 1.0 },
      { date: '2024-02-01', value: 1.01 },
      { date: '2024-03-01', value: 1.02 },
    ])
    const result = simulateDIP(data, 1000)
    expect(result).not.toBeNull()
    expect(result!.periods).toBeGreaterThan(0)
  })
})

describe('analyzeBestDIPDay', () => {
  it('数据不足时返回空数组', () => {
    expect(analyzeBestDIPDay(makeData([{ date: '2024-01-01', value: 1.0 }))).toEqual([])
  })
})

describe('calculateCorrelation', () => {
  it('基金数量不足时返回 null', () => {
    const fundsData = [
      { code: '000001', name: '基金A', data: makeData([{ date: '2024-01-01', value: 1.0 }]) },
    ]
    expect(calculateCorrelation(fundsData)).toBeNull()
  })
})

describe('predictTrend', () => {
  it('数据不足时返回 null', () => {
    expect(predictTrend(makeData([{ date: '2024-01-01', value: 1.0 }))).toBeNull()
  })
})

describe('analyzeAllocation', () => {
  it('正常分析资产配置', () => {
    const holdings = [
      { code: '000001', name: '股票型基金', amount: 50000, type: '股票型' },
      { code: '000002', name: '债券型基金', amount: 50000, type: '债券型' },
    ]
    const result = analyzeAllocation(holdings)
    expect(result.currentAllocation).toHaveLength(2)
    expect(result.suggestedAllocation).toBeDefined()
  })
})
