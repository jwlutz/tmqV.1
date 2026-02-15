import { useEffect, useRef } from 'react';
import { createChart, AreaSeries, LineSeries, CandlestickSeries, HistogramSeries, IChartApi, UTCTimestamp } from 'lightweight-charts';
import { EquityPoint } from './types';

export interface OHLCVPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface EquityCurveChartProps {
  data: EquityPoint[];
  ohlcv?: OHLCVPoint[];
}

export function EquityCurveChart({ data, ohlcv }: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
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

    if (ohlcv && ohlcv.length > 0) {
      // Show OHLCV candlesticks on right price scale
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
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
          color: c.close >= c.open ? '#22c55e40' : '#ef444440',
        }))
      );

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
      // No OHLCV — show equity curve as area chart (original behavior)
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
  }, [data, ohlcv]);

  return <div ref={containerRef} className="w-full h-full" />;
}
