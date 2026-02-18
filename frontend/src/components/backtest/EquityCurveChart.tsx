import { useEffect, useRef, useState } from 'react';
import { createChart, AreaSeries, LineSeries, CandlestickSeries, HistogramSeries, IChartApi, ISeriesApi, UTCTimestamp, SeriesMarker, createSeriesMarkers } from 'lightweight-charts';
import { EquityPoint } from './types';

export interface OHLCVPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TradeMarker {
  entry_date: string;
  exit_date: string;
  side: string;
  pnl: number;
  return_pct: number;
}

export interface ChartDisplayOptions {
  showPrice: boolean;
  showEquity: boolean;
  showTrades: boolean;
}

interface EquityCurveChartProps {
  data: EquityPoint[];
  ohlcv?: OHLCVPoint[];
  trades?: TradeMarker[];
  options?: ChartDisplayOptions;
}

const DEFAULT_OPTIONS: ChartDisplayOptions = {
  showPrice: true,
  showEquity: true,
  showTrades: true,
};

export function EquityCurveChart({ data, ohlcv, trades, options = DEFAULT_OPTIONS }: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { showPrice, showEquity, showTrades } = options;
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Track container size with ResizeObserver (needed for FlexLayout deferred sizing)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setContainerSize(prev =>
          prev.width !== width || prev.height !== height ? { width, height } : prev
        );
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    // Guard against 0-dimension containers (FlexLayout may render before sizing)
    const { width, height } = containerSize;
    if (width === 0 || height === 0) return;

    const chart = createChart(containerRef.current, {
      width,
      height,
      layout: {
        background: { color: '#0b0f19' },
        textColor: '#e8ecf4',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: true,
      },
    });

    // Reference to the series we'll add markers to (use ISeriesApi for proper typing)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let markerSeries: ISeriesApi<any> | null = null;

    if (ohlcv && ohlcv.length > 0 && showPrice) {
      // Show OHLCV candlesticks on right price scale
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });

      candleSeries.setData(
        ohlcv.map(c => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );

      markerSeries = candleSeries;

      // Volume histogram
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });

      volumeSeries.setData(
        ohlcv.map(c => ({
          time: c.time as UTCTimestamp,
          value: c.volume ?? 0,
          color: c.close >= c.open ? '#26a69a40' : '#ef535040',
        }))
      );
    }

    if (showEquity) {
      if (ohlcv && ohlcv.length > 0 && showPrice) {
        // Equity curve as line overlay on separate scale
        const equitySeries = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 2,
          priceScaleId: 'equity',
        });

        equitySeries.priceScale().applyOptions({
          scaleMargins: { top: 0.1, bottom: 0.2 },
        });

        equitySeries.setData(
          data.map(p => ({
            time: p.time as UTCTimestamp,
            value: p.value,
          }))
        );
      } else {
        // No OHLCV or price hidden — show equity curve as area chart
        const areaSeries = chart.addSeries(AreaSeries, {
          lineColor: '#22c55e',
          topColor: 'rgba(34, 197, 94, 0.3)',
          bottomColor: 'rgba(34, 197, 94, 0.0)',
          lineWidth: 2,
        });

        areaSeries.setData(
          data.map(p => ({
            time: p.time as UTCTimestamp,
            value: p.value,
          }))
        );

        if (!markerSeries) markerSeries = areaSeries;

        const baseline = chart.addSeries(LineSeries, {
          color: 'rgba(255,255,255,0.2)',
          lineWidth: 1,
          lineStyle: 2,
        });
        baseline.setData([
          { time: data[0].time as UTCTimestamp, value: data[0].value },
          { time: data[data.length - 1].time as UTCTimestamp, value: data[0].value },
        ]);
      }
    }

    // Add trade markers (buy/sell arrows) using v5 createSeriesMarkers API
    if (showTrades && trades && trades.length > 0 && markerSeries) {
      try {
        const markers: SeriesMarker<UTCTimestamp>[] = [];

        for (const trade of trades) {
          // Entry marker (buy = green arrow up, short = red arrow down)
          const entryTime = Math.floor(new Date(trade.entry_date).getTime() / 1000) as UTCTimestamp;
          const isLong = trade.side.toLowerCase() === 'long' || trade.side.toLowerCase() === 'buy';

          markers.push({
            time: entryTime,
            position: isLong ? 'belowBar' : 'aboveBar',
            color: '#22c55e',
            shape: isLong ? 'arrowUp' : 'arrowDown',
            text: 'BUY',
            size: 1,
          });

          // Exit marker
          const exitTime = Math.floor(new Date(trade.exit_date).getTime() / 1000) as UTCTimestamp;
          const isProfitable = trade.pnl > 0;

          markers.push({
            time: exitTime,
            position: isLong ? 'aboveBar' : 'belowBar',
            color: isProfitable ? '#22c55e' : '#ef4444',
            shape: isLong ? 'arrowDown' : 'arrowUp',
            text: 'SELL',
            size: 1,
          });
        }

        // Sort markers by time (required by lightweight-charts)
        markers.sort((a, b) => (a.time as number) - (b.time as number));

        // Use v5 createSeriesMarkers API
        createSeriesMarkers(markerSeries, markers);
      } catch (err) {
        console.warn('Failed to set trade markers:', err);
      }
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, ohlcv, trades, showPrice, showEquity, showTrades, containerSize]);

  return <div ref={containerRef} className="w-full h-full" />;
}