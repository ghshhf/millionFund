export interface TradeRecord {
  id: string
  fundCode: string
  fundName: string
  type: 'buy' | 'sell' | 'dividend'
  amount: number    // 金额
  price: number     // 净值
  shares: number   // 份额
  date: string     // YYYY-MM-DD
  note: string
}

const STORAGE_KEY = 'fund_trades'

export function getTrades(): TradeRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as TradeRecord[]
  } catch {
    return []
  }
}

export function saveTrades(trades: TradeRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades))
}

export function addTrade(trade: TradeRecord): void {
  const trades = getTrades()
  trades.unshift(trade)
  saveTrades(trades)
}

export function deleteTrade(id: string): void {
  let trades = getTrades()
  trades = trades.filter(t => t.id !== id)
  saveTrades(trades)
}
