// [WHY] format.ts 单元测试：验证格式化函数
import { describe, it, expect } from 'vitest'
import { formatMoney, formatPercent, formatNetValue, getChangeStatus } from '@/utils/format'

describe('formatMoney', () => {
  it('格式化金额：保留2位小数', () => {
    expect(formatMoney(1234.56)).toBe('1234.56')
    expect(formatMoney(1234.56, '¥')).toBe('¥1234.56')
  })
  it('非数字返回 --', () => {
    expect(formatMoney(NaN)).toBe('--')
    expect(formatMoney('abc')).toBe('--')
  })
  it('integerOnly 只显示整数', () => {
    expect(formatMoney(1234.56, '', true)).toBe('1,234')
  })
})

describe('formatPercent', () => {
  it('格式化百分比：默认保留2位', () => {
    expect(formatPercent(1.23)).toBe('+1.23%')
    expect(formatPercent(-1.23)).toBe('-1.23%')
  })
  it('withSign=false 不显示正负号', () => {
    expect(formatPercent(1.23, false)).toBe('1.23%')
  })
  it('integerOnly 只显示整数', () => {
    expect(formatPercent(1.23, true, true)).toBe('+1%')
  })
})

describe('formatNetValue', () => {
  it('格式化净值：保留4位小数', () => {
    expect(formatNetValue(1.2345)).toBe('1.2345')
  })
  it('非数字返回 --', () => {
    expect(formatNetValue(NaN)).toBe('--')
  })
})

describe('getChangeStatus', () => {
  it('正数返回 up', () => {
    expect(getChangeStatus(1.23)).toBe('up')
  })
  it('负数返回 down', () => {
    expect(getChangeStatus(-1.23)).toBe('down')
  })
  it('0 返回 flat', () => {
    expect(getChangeStatus(0)).toBe('flat')
    expect(getChangeStatus(NaN)).toBe('flat')
  })
})
