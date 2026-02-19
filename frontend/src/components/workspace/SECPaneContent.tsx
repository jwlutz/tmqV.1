import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchSECFilings,
  fetchSECInsiderTransactions,
  fetchSECFilingDetail,
  type SECFiling,
  type SECForm4,
} from '../../api/client'

function formatDate(dateStr: string): string {
  return dateStr // Already YYYY-MM-DD
}

function formatTime(dateStr: string): string {
  // SEC filings don't have time in the API, so we'll show a placeholder
  // In a real implementation, this would come from the filing metadata
  return '—'
}

type ViewMode = 'filings' | 'insider' | 'detail'

export function SECPaneContent() {
  const [symbol, setSymbol] = useState<string>('AAPL')
  const [symbolInput, setSymbolInput] = useState<string>('AAPL')
  const symbolInputRef = useRef<HTMLInputElement>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('filings')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filings, setFilings] = useState<SECFiling[]>([])
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const [insiderData, setInsiderData] = useState<SECForm4[]>([])

  const [selectedFiling, setSelectedFiling] = useState<SECFiling | null>(null)
  const [detailData, setDetailData] = useState<{
    parsed?: SECForm4
    content_preview?: string
  } | null>(null)

  const handleSymbolSubmit = () => {
    const cleaned = symbolInput.trim().toUpperCase()
    if (cleaned && cleaned !== symbol) {
      setSymbol(cleaned)
      setViewMode('filings')
      setSelectedFiling(null)
      setDetailData(null)
    }
  }

  const handleSymbolKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSymbolSubmit()
    }
  }

  const loadFilings = useCallback(async () => {
    if (!symbol) return
    setLoading(true)
    setError(null)

    try {
      const result = await fetchSECFilings(
        symbol,
        undefined,
        100,
        startDate || undefined,
        endDate || undefined
      )
      setFilings(result.filings)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load filings')
    } finally {
      setLoading(false)
    }
  }, [symbol, startDate, endDate])

  const loadInsiderData = useCallback(async () => {
    if (!symbol) return
    setLoading(true)
    setError(null)

    try {
      const result = await fetchSECInsiderTransactions(symbol, 50)
      setInsiderData(result.transactions)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load insider data')
    } finally {
      setLoading(false)
    }
  }, [symbol])

  const loadFilingDetail = useCallback(async (filing: SECFiling) => {
    setSelectedFiling(filing)
    setViewMode('detail')
    setLoading(true)
    setError(null)

    try {
      const result = await fetchSECFilingDetail(symbol, filing.accession_number)
      setDetailData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load filing detail')
    } finally {
      setLoading(false)
    }
  }, [symbol])

  useEffect(() => {
    if (viewMode === 'filings') {
      loadFilings()
    } else if (viewMode === 'insider') {
      loadInsiderData()
    }
  }, [viewMode, loadFilings, loadInsiderData])

  const handleBack = () => {
    setViewMode('filings')
    setSelectedFiling(null)
    setDetailData(null)
  }

  const handleClear = () => {
    setStartDate('')
    setEndDate('')
  }

  // Detail view
  if (viewMode === 'detail' && selectedFiling) {
    return (
      <div className="w-full h-full flex flex-col bg-[#0a0a0a] font-mono text-xs overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-3 py-1.5 border-b border-[#333] bg-[#111]">
          <button
            onClick={handleBack}
            className="text-[#888] hover:text-white transition-colors"
          >
            ← Back
          </button>
          <span className="text-white">{selectedFiling.form_type}</span>
          <span className="text-[#888]">{selectedFiling.accession_number}</span>
          <span className="text-[#888]">{selectedFiling.filing_date}</span>
          <a
            href={selectedFiling.sec_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[#4a9eff] hover:underline"
          >
            View on SEC.gov →
          </a>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="text-[#888]">Loading...</div>
          ) : error ? (
            <div className="text-[#ff6b6b]">{error}</div>
          ) : detailData?.parsed ? (
            <Form4DetailView data={detailData.parsed} />
          ) : detailData?.content_preview ? (
            <pre className="text-[#ccc] whitespace-pre-wrap leading-relaxed">
              {detailData.content_preview}
            </pre>
          ) : (
            <div className="text-[#888]">No content available</div>
          )}
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0a] font-mono text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#333] bg-[#111]">
        <span className="text-white">Filings</span>
        <span className="text-[#4a9eff]">⛓</span>
        <input
          ref={symbolInputRef}
          type="text"
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
          onKeyDown={handleSymbolKeyDown}
          onBlur={handleSymbolSubmit}
          className="w-16 px-1 py-0.5 bg-transparent border-b border-[#444] text-white focus:border-[#4a9eff] focus:outline-none uppercase"
          placeholder="TICKER"
        />
        <span className="text-[#888]">US</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setViewMode('filings')}
            className={`px-2 py-0.5 ${viewMode === 'filings' ? 'text-white bg-[#333]' : 'text-[#888] hover:text-white'}`}
          >
            All
          </button>
          <button
            onClick={() => setViewMode('insider')}
            className={`px-2 py-0.5 ${viewMode === 'insider' ? 'text-white bg-[#333]' : 'text-[#888] hover:text-white'}`}
          >
            Insider
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {viewMode === 'filings' && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[#333] bg-[#0d0d0d]">
          <span className="text-[#888]">No Watchlists</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-0.5 bg-[#1a1a1a] border border-[#333] text-[#ccc] text-xs focus:border-[#4a9eff] focus:outline-none"
            placeholder="mm/dd/yyyy"
          />
          <span className="text-[#888]">📅</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-0.5 bg-[#1a1a1a] border border-[#333] text-[#ccc] text-xs focus:border-[#4a9eff] focus:outline-none"
            placeholder="mm/dd/yyyy"
          />
          <span className="text-[#888]">📅</span>
          <button className="text-[#888] hover:text-white">⬇</button>
          <button
            onClick={handleClear}
            className="px-2 py-0.5 border border-[#444] text-[#888] hover:text-white hover:border-[#666]"
          >
            ⊠Clear
          </button>
          <button className="px-2 py-0.5 border border-[#444] text-[#888] hover:text-white hover:border-[#666]">
            ‖Pause
          </button>
        </div>
      )}

      {/* Table header */}
      <div className="grid grid-cols-[60px_80px_1fr_100px_70px] gap-2 px-3 py-1 border-b border-[#444] bg-[#111] text-[#888]">
        <span>Ticker</span>
        <span>Form</span>
        <span>Description</span>
        <span>Date</span>
        <span>Time</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-3 py-2 text-[#888]">Loading...</div>
        ) : error ? (
          <div className="px-3 py-2 text-[#ff6b6b]">{error}</div>
        ) : viewMode === 'insider' ? (
          <InsiderTableView data={insiderData} symbol={symbol} onSelect={loadFilingDetail} />
        ) : filings.length === 0 ? (
          <div className="px-3 py-2 text-[#888]">No filings found</div>
        ) : (
          filings.map((filing, i) => (
            <div
              key={`${filing.accession_number}-${i}`}
              onClick={() => loadFilingDetail(filing)}
              className="grid grid-cols-[60px_80px_1fr_100px_70px] gap-2 px-3 py-1 border-b border-[#222] hover:bg-[#1a1a1a] cursor-pointer text-[#ccc]"
            >
              <span className="text-white">{symbol}</span>
              <span>{filing.form_type}</span>
              <span className="truncate">{filing.description || 'No description'}</span>
              <span>{formatDate(filing.filing_date)}</span>
              <span className="text-[#888]">{formatTime(filing.filing_date)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function InsiderTableView({
  data,
  symbol,
  onSelect,
}: {
  data: SECForm4[]
  symbol: string
  onSelect: (f: SECFiling) => void
}) {
  if (data.length === 0) {
    return <div className="px-3 py-2 text-[#888]">No insider transactions found</div>
  }

  return (
    <>
      {data.map((form4, i) => {
        const netShares = form4.transactions.reduce((sum, t) => {
          return sum + (t.acquired ? t.shares : -t.shares)
        }, 0)

        const filing: SECFiling = {
          accession_number: form4.accession_number,
          form_type: '4',
          filing_date: form4.filing_date,
          description: `${form4.reporter.name} - ${netShares > 0 ? 'Acquired' : 'Disposed'} ${Math.abs(netShares).toLocaleString()} shares`,
          ticker: form4.issuer.ticker,
          sec_url: '',
        }

        return (
          <div
            key={`${form4.accession_number}-${i}`}
            onClick={() => onSelect(filing)}
            className="grid grid-cols-[60px_80px_1fr_100px_70px] gap-2 px-3 py-1 border-b border-[#222] hover:bg-[#1a1a1a] cursor-pointer text-[#ccc]"
          >
            <span className="text-white">{symbol}</span>
            <span>4</span>
            <span className="truncate">
              {form4.reporter.name} —{' '}
              <span className={netShares > 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}>
                {netShares > 0 ? '+' : ''}{netShares.toLocaleString()}
              </span>
            </span>
            <span>{form4.filing_date}</span>
            <span className="text-[#888]">—</span>
          </div>
        )
      })}
    </>
  )
}

function Form4DetailView({ data }: { data: SECForm4 }) {
  return (
    <div className="space-y-4">
      <div className="border border-[#333] p-3">
        <div className="text-white text-sm">{data.reporter.name}</div>
        <div className="text-[#888] mt-1">
          {[
            data.reporter.is_director && 'Director',
            data.reporter.is_officer && (data.reporter.officer_title || 'Officer'),
            data.reporter.is_ten_percent_owner && '10% Owner',
          ]
            .filter(Boolean)
            .join(' • ') || 'Insider'}
        </div>
      </div>

      {data.transactions.length > 0 && (
        <div>
          <div className="text-[#888] mb-2">TRANSACTIONS</div>
          <div className="border border-[#333]">
            <div className="grid grid-cols-[1fr_60px_80px_80px_80px] gap-2 px-3 py-1 border-b border-[#333] bg-[#111] text-[#888]">
              <span>Security</span>
              <span>Code</span>
              <span className="text-right">Shares</span>
              <span className="text-right">Price</span>
              <span className="text-right">After</span>
            </div>
            {data.transactions.map((txn, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_60px_80px_80px_80px] gap-2 px-3 py-1 border-b border-[#222] text-[#ccc]"
              >
                <span className="truncate">{txn.security}</span>
                <span title={txn.code_meaning}>{txn.code}</span>
                <span className={`text-right ${txn.acquired ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                  {txn.acquired ? '+' : '-'}{txn.shares.toLocaleString()}
                </span>
                <span className="text-right">
                  {txn.price ? `$${txn.price.toFixed(2)}` : '—'}
                </span>
                <span className="text-right text-[#888]">
                  {txn.shares_after.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
