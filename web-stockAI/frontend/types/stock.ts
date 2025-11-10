export interface CompanyOfficer {
  name: string
  age?: number
  title: string
  yearBorn?: number
}

export interface StockInfo {
  symbol: string
  shortName: string
  longName: string
  exchange: string
  currency: string
  
  address1?: string
  address2?: string
  city?: string
  country?: string
  phone?: string
  website?: string
  
  industry?: string
  industryDisp?: string
  sector?: string
  sectorDisp?: string
  longBusinessSummary?: string
  fullTimeEmployees?: number
  companyOfficers?: CompanyOfficer[]
  
  currentPrice: number
  previousClose: number
  open: number
  dayLow: number
  dayHigh: number
  
  volume: number
  averageVolume: number
  
  marketCap?: number
  enterpriseValue?: number
  beta?: number
  
  fiftyTwoWeekLow?: number
  fiftyTwoWeekHigh?: number
  fiftyDayAverage?: number
  twoHundredDayAverage?: number
  
  trailingPE?: number
  priceToBook?: number
  dividendYield?: number
  dividendRate?: number
  payoutRatio?: number
  
  totalRevenue?: number
  revenuePerShare?: number
  revenueGrowth?: number
  grossMargins?: number
  ebitdaMargins?: number
  operatingMargins?: number
  profitMargins?: number
  
  totalCash?: number
  totalDebt?: number
  debtToEquity?: number
  currentRatio?: number
  quickRatio?: number
  
  returnOnAssets?: number
  returnOnEquity?: number
  freeCashflow?: number
  operatingCashflow?: number
  
  earningsGrowth?: number
  epsTrailingTwelveMonths?: number
  
  bookValue?: number
  sharesOutstanding?: number
  floatShares?: number
  heldPercentInsiders?: number
  heldPercentInstitutions?: number
}

export interface StockRealtime {
  symbol: string
  price: number
  change: number
  change_percent: number
  day_volume: number
  last_size: number
}

export interface MatchedOrder {
  time: string
  price: number
  last_size: number
  change: number
}

