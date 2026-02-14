import { useEffect, useRef } from 'react';
import { createChart, AreaSeries, LineSeries, IChartApi, UTCTimestamp } from 'lightweight-charts';
import { EquityPoint } from './types';

interface EquityCurveChartProps {
  data: EquityPoint[];
}

export function EquityCurveChart({ data }: EquityCurveChartProps) {
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
  }, [data]);

  return <div ref={containerRef} className="w-full h-full" />;
}
