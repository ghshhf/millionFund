// [WHY] fundFast.ts 单元测试：mock fetch 测试估值接口
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchFundEstimateFast, fetchLatestNetValue } from '@/api/fundFast'
import { cache } from '@/api/cache'

// Mock fetch globally
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchFundEstimateFast', () => {
  it('fetch 成功时返回 FundEstimate', async () => {
    const mockData = 'jsonpgz({"fundcode":"000001","gsz":"1.234","gszzl":"1.23","gztime":"2024-01-01 15:00","dwjz":"1.2199"})'
    ;(fetch as any).mockResolvedValue({
      text: () => Promise.resolve(mockData),
    })

    const result = await fetchFundEstimateFast('000001')
    expect(result.fundcode).toBe('000001')
    expect(result.gsz).toBe('1.234')
  })

  it('fetch 失败时抛出错误', async () => {
    ;(fetch as any).mockRejectedValue(new Error('network error'))
    await expect(fetchFundEstimateFast('000001')).rejects.toThrow()
  })
})

describe('fetchLatestNetValue', () => {
  it('fetch 成功时返回净值数据', async () => {
    const mockData = 'jsonpgz({"fundcode":"000001","dwjz":"1.2199","jzrq":"2024-01-01","gszzl":"1.23"})'
    ;(fetch as any).mockResolvedValue({
      text: () => Promise.resolve(mockData),
    })

    const result = await fetchLatestNetValue('000001')
    expect(result).not.toBeNull()
    expect(result?.netValue).toBeCloseTo(1.2199, 4)
  })
})
