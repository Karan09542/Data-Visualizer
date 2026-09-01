import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  CircleDot,
  Download,
  ArrowUpDown,
  Filter,
  Layers,
  Sparkles,
  TrendingUp,
  Hash,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { CustomSelect } from './image-workspace/components/shared/CustomSelect';

export interface TableChartVisualizerProps {
  data: any[];
  title?: string;
}

type ChartType = 'bar' | 'line' | 'area' | 'donut' | 'scatter';
type AggregationType = 'sum' | 'avg' | 'count' | 'max' | 'min';
type SortOrder = 'desc' | 'asc' | 'alpha';
type ColorTheme = 'emerald' | 'cyan' | 'violet' | 'amber';

const COLOR_PALETTES: Record<ColorTheme, string[]> = {
  emerald: [
    '#10b981', '#059669', '#34d399', '#6ee7b7', '#047857',
    '#065f46', '#a7f3d0', '#2dd4bf', '#0d9488', '#14b8a6'
  ],
  cyan: [
    '#06b6d4', '#0891b2', '#22d3ee', '#67e8f9', '#0e7490',
    '#155e75', '#a5f3fc', '#3b82f6', '#2563eb', '#60a5fa'
  ],
  violet: [
    '#8b5cf6', '#7c3aed', '#a78bfa', '#c4b5fd', '#6d28d9',
    '#5b21b6', '#ddd6fe', '#ec4899', '#db2777', '#f472b6'
  ],
  amber: [
    '#f59e0b', '#d97706', '#fbbf24', '#fcd34d', '#b45309',
    '#92400e', '#fef3c7', '#f97316', '#ea580c', '#fb923c'
  ],
};

export function TableChartVisualizer({ data, title }: TableChartVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Parse table data using d3.csv utilities
  const parsedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    try {
      // Convert records to CSV format using d3.csvFormat
      const csvString = d3.csvFormat(data);
      // Parse CSV text with automatic type conversion using d3.csvParse
      return d3.csvParse(csvString, d3.autoType);
    } catch {
      return data;
    }
  }, [data]);

  // Extract all columns and determine numeric vs categorical
  const { allColumns, numericColumns, categoricalColumns } = useMemo(() => {
    if (!parsedData || parsedData.length === 0) {
      return { allColumns: [], numericColumns: [], categoricalColumns: [] };
    }

    const sample = parsedData.slice(0, 50);
    const keys = Object.keys(parsedData[0] || {});
    const numCols: string[] = [];
    const catCols: string[] = [];

    keys.forEach((key) => {
      let numCount = 0;
      let validCount = 0;
      sample.forEach((row: any) => {
        const val = row[key];
        if (val !== null && val !== undefined && val !== '') {
          validCount++;
          if (typeof val === 'number' && !isNaN(val)) {
            numCount++;
          }
        }
      });
      if (validCount > 0 && numCount / validCount >= 0.7) {
        numCols.push(key);
      } else {
        catCols.push(key);
      }
    });

    return {
      allColumns: keys,
      numericColumns: numCols,
      categoricalColumns: catCols.length > 0 ? catCols : keys,
    };
  }, [parsedData]);

  // Controls state
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [xAxisKey, setXAxisKey] = useState<string>('');
  const [yAxisKey, setYAxisKey] = useState<string>('');
  const [aggregation, setAggregation] = useState<AggregationType>('sum');
  const [topN, setTopN] = useState<number>(15);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [colorTheme, setColorTheme] = useState<ColorTheme>('emerald');
  const [isChartOnlyFullscreen, setIsChartOnlyFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Escape to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChartOnlyFullscreen) {
        setIsChartOnlyFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChartOnlyFullscreen]);

  // Window resize tracking
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleChartOnlyFullscreen = () => {
    setIsChartOnlyFullscreen((prev) => !prev);
  };

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    value: number | string;
    percentage?: string;
    count?: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    title: '',
    value: 0,
  });

  // Auto-select initial columns
  useEffect(() => {
    if (categoricalColumns.length > 0 && (!xAxisKey || !allColumns.includes(xAxisKey))) {
      setXAxisKey(categoricalColumns[0]);
    } else if (allColumns.length > 0 && !xAxisKey) {
      setXAxisKey(allColumns[0]);
    }

    if (numericColumns.length > 0 && (!yAxisKey || !allColumns.includes(yAxisKey))) {
      setYAxisKey(numericColumns[0]);
    } else if (!yAxisKey) {
      setYAxisKey('__count__');
    }
  }, [allColumns, numericColumns, categoricalColumns, xAxisKey, yAxisKey]);

  // Aggregate and compute chart dataset
  const chartData = useMemo(() => {
    if (!parsedData || parsedData.length === 0 || !xAxisKey) return [];

    const isCountMetric = yAxisKey === '__count__' || !yAxisKey;

    // Group records by X-Axis dimension
    const groups = d3.group(parsedData, (d: any) => {
      const val = d[xAxisKey];
      if (val === null || val === undefined || val === '') return '(Empty)';
      if (val instanceof Date) return val.toLocaleDateString();
      return String(val);
    });

    const result: { label: string; value: number; count: number; raw: any[] }[] = [];

    groups.forEach((rows, key) => {
      const count = rows.length;
      let val = 0;

      if (isCountMetric) {
        val = count;
      } else {
        const numbers = rows
          .map((r: any) => Number(r[yAxisKey]))
          .filter((n) => !isNaN(n));

        if (numbers.length === 0) {
          val = 0;
        } else if (aggregation === 'sum') {
          val = d3.sum(numbers);
        } else if (aggregation === 'avg') {
          val = d3.mean(numbers) || 0;
        } else if (aggregation === 'max') {
          val = d3.max(numbers) || 0;
        } else if (aggregation === 'min') {
          val = d3.min(numbers) || 0;
        } else {
          val = numbers.length;
        }
      }

      result.push({
        label: key,
        value: Number(val.toFixed(2)),
        count,
        raw: rows,
      });
    });

    // Sorting
    if (sortOrder === 'desc') {
      result.sort((a, b) => b.value - a.value);
    } else if (sortOrder === 'asc') {
      result.sort((a, b) => a.value - b.value);
    } else {
      result.sort((a, b) => a.label.localeCompare(b.label));
    }

    // Top N slicing
    if (topN > 0 && result.length > topN) {
      return result.slice(0, topN);
    }

    return result;
  }, [parsedData, xAxisKey, yAxisKey, aggregation, sortOrder, topN]);

  // Overall statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const values = chartData.map((d) => d.value);
    const sum = d3.sum(values);
    const avg = d3.mean(values) || 0;
    const max = d3.max(values) || 0;
    const min = d3.min(values) || 0;
    const maxItem = chartData.find((d) => d.value === max);
    const minItem = chartData.find((d) => d.value === min);

    return {
      total: sum,
      average: avg,
      max: { value: max, label: maxItem?.label || '' },
      min: { value: min, label: minItem?.label || '' },
      count: chartData.length,
    };
  }, [chartData]);

  // Render D3 Visualization
  useEffect(() => {
    const targetEl = svgContainerRef.current || containerRef.current;
    if (!svgRef.current || !targetEl || chartData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const rect = targetEl.getBoundingClientRect();
    const width = Math.max(rect.width, 320);
    const height = Math.max(rect.height - (isChartOnlyFullscreen ? 20 : 10), 380);

    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const colors = COLOR_PALETTES[colorTheme];

    // Defs for gradients & filters
    const defs = svg.append('defs');

    // Emerald gradient
    const emeraldGrad = defs
      .append('linearGradient')
      .attr('id', 'emerald-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    emeraldGrad.append('stop').attr('offset', '0%').attr('stop-color', colors[0]).attr('stop-opacity', 0.95);
    emeraldGrad.append('stop').attr('offset', '100%').attr('stop-color', colors[1] || colors[0]).attr('stop-opacity', 0.65);

    // Area gradient
    const areaGrad = defs
      .append('linearGradient')
      .attr('id', 'area-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    areaGrad.append('stop').attr('offset', '0%').attr('stop-color', colors[0]).attr('stop-opacity', 0.45);
    areaGrad.append('stop').attr('offset', '100%').attr('stop-color', colors[0]).attr('stop-opacity', 0.02);

    // Glow filter
    const filter = defs.append('filter').attr('id', 'glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    filter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    // ----------------------------------------------------------------
    // 1. DONUT / PIE CHART
    // ----------------------------------------------------------------
    if (chartType === 'donut') {
      const margin = 20;
      const radius = Math.min(width, height) / 2 - margin;
      const innerRadius = radius * 0.55;

      const g = svg
        .append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

      const pie = d3
        .pie<any>()
        .value((d) => Math.max(d.value, 0))
        .sort(null);

      const arc = d3.arc<any>().innerRadius(innerRadius).outerRadius(radius).cornerRadius(4).padAngle(0.02);
      const hoverArc = d3.arc<any>().innerRadius(innerRadius).outerRadius(radius + 8).cornerRadius(4);

      const totalVal = d3.sum(chartData, (d) => d.value) || 1;

      // Center summary text
      const centerGroup = g.append('g').attr('text-anchor', 'middle');
      centerGroup
        .append('text')
        .attr('class', 'center-title text-xs uppercase font-mono tracking-wider fill-slate-400 dark:fill-emerald-400')
        .attr('dy', '-0.5em')
        .text(yAxisKey === '__count__' ? 'Total Records' : `${aggregation.toUpperCase()}`);

      const centerValText = centerGroup
        .append('text')
        .attr('class', 'center-val text-xl font-bold font-mono fill-slate-800 dark:fill-emerald-100')
        .attr('dy', '1em')
        .text(totalVal.toLocaleString());

      const arcs = g
        .selectAll('.arc')
        .data(pie(chartData))
        .enter()
        .append('g')
        .attr('class', 'arc cursor-pointer');

      arcs
        .append('path')
        .attr('fill', (_d, i) => colors[i % colors.length])
        .attr('stroke', '#0a0f0d')
        .attr('stroke-width', 2)
        .transition()
        .duration(700)
        .attrTween('d', function (d) {
          const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
          return function (t) {
            return arc(i(t)) || '';
          };
        });

      arcs
        .on('mouseenter', function (event, d) {
          d3.select(this)
            .select('path')
            .transition()
            .duration(200)
            .attr('d', hoverArc as any)
            .attr('filter', 'url(#glow)');

          const pct = ((d.data.value / totalVal) * 100).toFixed(1) + '%';
          centerValText.text(d.data.value.toLocaleString());

          const containerBounds = containerRef.current?.getBoundingClientRect();
          const offsetX = containerBounds ? event.clientX - containerBounds.left : event.clientX;
          const offsetY = containerBounds ? event.clientY - containerBounds.top : event.clientY;

          setTooltip({
            visible: true,
            x: offsetX,
            y: offsetY,
            title: d.data.label,
            value: d.data.value,
            percentage: pct,
            count: d.data.count,
          });
        })
        .on('mousemove', (event) => {
          const containerBounds = containerRef.current?.getBoundingClientRect();
          const offsetX = containerBounds ? event.clientX - containerBounds.left : event.clientX;
          const offsetY = containerBounds ? event.clientY - containerBounds.top : event.clientY;
          setTooltip((prev) => ({ ...prev, x: offsetX, y: offsetY }));
        })
        .on('mouseleave', function () {
          d3.select(this)
            .select('path')
            .transition()
            .duration(200)
            .attr('d', arc as any)
            .attr('filter', null);

          centerValText.text(totalVal.toLocaleString());
          setTooltip((prev) => ({ ...prev, visible: false }));
        });

      return;
    }

    // ----------------------------------------------------------------
    // 2. RECTANGULAR CHARTS: BAR, LINE, AREA, SCATTER
    // ----------------------------------------------------------------
    // Adaptive label sizing & rotation
    const maxLabelLength = d3.max(chartData, (d) => d.label.length) || 5;
    const estInnerWidth = width - 65 - 30;
    const approxBandWidth = estInnerWidth / (chartData.length || 1);
    const avgCharWidth = 6.8;
    const maxLabelPixelWidth = maxLabelLength * avgCharWidth;

    // Need rotation if labels don't fit horizontally within their band width, or more than 5 items
    const needsRotation = approxBandWidth < maxLabelPixelWidth + 12 || chartData.length > 5 || maxLabelLength > 7;
    const rotationAngle = approxBandWidth < 28 ? -65 : approxBandWidth < 45 ? -50 : -38;

    const dynamicBottomMargin = needsRotation
      ? Math.min(Math.max(65, Math.sin(Math.abs(rotationAngle) * (Math.PI / 180)) * maxLabelPixelWidth + 32), 125)
      : 45;

    const margin = {
      top: 25,
      right: 30,
      bottom: dynamicBottomMargin,
      left: width < 500 ? 50 : 65,
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    // X Scale
    const xScale = d3
      .scaleBand()
      .domain(chartData.map((d) => d.label))
      .range([0, innerWidth])
      .padding(0.28);

    // Y Scale
    const maxVal = d3.max(chartData, (d) => d.value) || 1;
    const minVal = Math.min(0, d3.min(chartData, (d) => d.value) || 0);
    const yScale = d3
      .scaleLinear()
      .domain([minVal, maxVal * 1.1])
      .nice()
      .range([innerHeight, 0]);

    // Horizontal grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', 'currentColor')
      .attr('class', 'text-slate-200 dark:text-emerald-950/50')
      .attr('stroke-dasharray', '3,3');

    // Axes
    const xAxis = d3.axisBottom(xScale);

    // On very compact screens, skip alternating labels if bands are extremely narrow (<18px)
    let tickStep = 1;
    if (approxBandWidth < 18) {
      tickStep = Math.ceil(18 / approxBandWidth);
    }
    if (tickStep > 1) {
      xAxis.tickValues(chartData.map((d) => d.label).filter((_, i) => i % tickStep === 0));
    }

    const yAxis = d3.axisLeft(yScale).ticks(height < 400 ? 4 : 6).tickFormat(d3.format('~s') as any);

    // Render X Axis
    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .attr('class', 'text-slate-500 dark:text-emerald-400 text-[11px] font-mono');

    if (needsRotation) {
      const maxChars = approxBandWidth < 24 ? 8 : approxBandWidth < 36 ? 12 : 18;
      xAxisGroup
        .selectAll('text')
        .attr('transform', `rotate(${rotationAngle})`)
        .attr('text-anchor', 'end')
        .attr('dx', '-0.6em')
        .attr('dy', rotationAngle < -50 ? '0.25em' : '0.4em')
        .style('font-size', approxBandWidth < 22 ? '10px' : '11px')
        .text((d: any) => {
          const str = String(d);
          return str.length > maxChars ? str.substring(0, maxChars - 1) + '…' : str;
        })
        .append('title')
        .text((d: any) => String(d));
    } else {
      xAxisGroup
        .selectAll('text')
        .attr('dy', '0.8em')
        .text((d: any) => {
          const maxChars = Math.floor((approxBandWidth - 4) / avgCharWidth);
          const str = String(d);
          return str.length > maxChars && maxChars > 3
            ? str.substring(0, maxChars - 1) + '…'
            : str;
        })
        .append('title')
        .text((d: any) => String(d));
    }

    // Render Y Axis
    g.append('g')
      .call(yAxis)
      .attr('class', 'text-slate-500 dark:text-emerald-400 text-[11px] font-mono');

    // ----------------- BAR CHART -----------------
    if (chartType === 'bar') {
      const bars = g
        .selectAll('.bar')
        .data(chartData)
        .enter()
        .append('rect')
        .attr('class', 'bar cursor-pointer transition-colors')
        .attr('x', (d) => xScale(d.label) || 0)
        .attr('width', xScale.bandwidth())
        .attr('y', innerHeight)
        .attr('height', 0)
        .attr('rx', 4)
        .attr('ry', 4)
        .attr('fill', (_d, i) => colors[i % colors.length])
        .attr('opacity', 0.88);

      bars
        .transition()
        .duration(600)
        .delay((_d, i) => i * 20)
        .ease(d3.easeCubicOut)
        .attr('y', (d) => yScale(Math.max(0, d.value)))
        .attr('height', (d) => Math.abs(yScale(d.value) - yScale(0)));

      bars
        .on('mouseenter', function (event, d) {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('opacity', 1)
            .attr('filter', 'url(#glow)');

          const containerBounds = containerRef.current?.getBoundingClientRect();
          const offsetX = containerBounds ? event.clientX - containerBounds.left : event.clientX;
          const offsetY = containerBounds ? event.clientY - containerBounds.top : event.clientY;

          const totalVal = d3.sum(chartData, (item) => item.value) || 1;
          const pct = ((d.value / totalVal) * 100).toFixed(1) + '%';

          setTooltip({
            visible: true,
            x: offsetX,
            y: offsetY,
            title: d.label,
            value: d.value,
            percentage: pct,
            count: d.count,
          });
        })
        .on('mousemove', (event) => {
          const containerBounds = containerRef.current?.getBoundingClientRect();
          const offsetX = containerBounds ? event.clientX - containerBounds.left : event.clientX;
          const offsetY = containerBounds ? event.clientY - containerBounds.top : event.clientY;
          setTooltip((prev) => ({ ...prev, x: offsetX, y: offsetY }));
        })
        .on('mouseleave', function () {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('opacity', 0.88)
            .attr('filter', null);
          setTooltip((prev) => ({ ...prev, visible: false }));
        });
    }

    // ----------------- LINE / AREA CHART -----------------
    if (chartType === 'line' || chartType === 'area') {
      const lineGen = d3
        .line<any>()
        .x((d) => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
        .y((d) => yScale(d.value))
        .curve(d3.curveMonotoneX);

      if (chartType === 'area') {
        const areaGen = d3
          .area<any>()
          .x((d) => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
          .y0(innerHeight)
          .y1((d) => yScale(d.value))
          .curve(d3.curveMonotoneX);

        g.append('path')
          .datum(chartData)
          .attr('fill', 'url(#area-grad)')
          .attr('d', areaGen);
      }

      // Line path
      const path = g
        .append('path')
        .datum(chartData)
        .attr('fill', 'none')
        .attr('stroke', colors[0])
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('d', lineGen);

      // Path transition animation
      const pathLength = path.node()?.getTotalLength() || 1000;
      path
        .attr('stroke-dasharray', `${pathLength} ${pathLength}`)
        .attr('stroke-dashoffset', pathLength)
        .transition()
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);

      // Data dots
      const dots = g
        .selectAll('.dot')
        .data(chartData)
        .enter()
        .append('circle')
        .attr('class', 'dot cursor-pointer')
        .attr('cx', (d) => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
        .attr('cy', (d) => yScale(d.value))
        .attr('r', 0)
        .attr('fill', '#0a0f0d')
        .attr('stroke', colors[0])
        .attr('stroke-width', 2.5);

      dots
        .transition()
        .duration(500)
        .delay((_d, i) => i * 25 + 400)
        .attr('r', 5);

      dots
        .on('mouseenter', function (event, d) {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('r', 8)
            .attr('fill', colors[0])
            .attr('filter', 'url(#glow)');

          const containerBounds = containerRef.current?.getBoundingClientRect();
          const offsetX = containerBounds ? event.clientX - containerBounds.left : event.clientX;
          const offsetY = containerBounds ? event.clientY - containerBounds.top : event.clientY;

          const totalVal = d3.sum(chartData, (item) => item.value) || 1;
          const pct = ((d.value / totalVal) * 100).toFixed(1) + '%';

          setTooltip({
            visible: true,
            x: offsetX,
            y: offsetY,
            title: d.label,
            value: d.value,
            percentage: pct,
            count: d.count,
          });
        })
        .on('mouseleave', function () {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('r', 5)
            .attr('fill', '#0a0f0d')
            .attr('filter', null);
          setTooltip((prev) => ({ ...prev, visible: false }));
        });
    }

    // ----------------- SCATTER PLOT -----------------
    if (chartType === 'scatter') {
      const circles = g
        .selectAll('.scatter-dot')
        .data(chartData)
        .enter()
        .append('circle')
        .attr('class', 'scatter-dot cursor-pointer')
        .attr('cx', (d) => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
        .attr('cy', (d) => yScale(d.value))
        .attr('r', 0)
        .attr('fill', (_d, i) => colors[i % colors.length])
        .attr('opacity', 0.85)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5);

      circles
        .transition()
        .duration(600)
        .delay((_d, i) => i * 15)
        .ease(d3.easeBackOut)
        .attr('r', (d) => Math.max(5, Math.min(16, 5 + Math.sqrt(d.count) * 2)));

      circles
        .on('mouseenter', function (event, d) {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('opacity', 1)
            .attr('stroke-width', 3)
            .attr('filter', 'url(#glow)');

          const containerBounds = containerRef.current?.getBoundingClientRect();
          const offsetX = containerBounds ? event.clientX - containerBounds.left : event.clientX;
          const offsetY = containerBounds ? event.clientY - containerBounds.top : event.clientY;

          setTooltip({
            visible: true,
            x: offsetX,
            y: offsetY,
            title: d.label,
            value: d.value,
            count: d.count,
          });
        })
        .on('mouseleave', function () {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('opacity', 0.85)
            .attr('stroke-width', 1.5)
            .attr('filter', null);
          setTooltip((prev) => ({ ...prev, visible: false }));
        });
    }
  }, [chartData, chartType, colorTheme, yAxisKey, aggregation, isChartOnlyFullscreen, dimensions]);

  // Export chart as PNG or SVG
  const handleExport = (format: 'png' | 'svg') => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current;

    if (format === 'svg') {
      const serializer = new XMLSerializer();
      const source = serializer.serializeToString(svgElement);
      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'chart'}_visualizer.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const serializer = new XMLSerializer();
      const source = serializer.serializeToString(svgElement);
      const img = new Image();
      const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 2;
        const rect = svgElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
          ctx.fillStyle = '#0a0f0d';
          ctx.fillRect(0, 0, rect.width, rect.height);
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          const pngUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `${title || 'chart'}_visualizer.png`;
          a.click();
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#fafcfb] dark:bg-[#0a0f0d] overflow-hidden text-slate-800 dark:text-emerald-50">
      {/* Visualizer Configuration Bar */}
      <div className="relative z-30 p-3 border-b border-slate-200/90 dark:border-emerald-950/70 bg-white/95 dark:bg-[#0d1613]/95 backdrop-blur-md shrink-0 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Chart Type Selector */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#121f19] p-1 rounded-lg border border-slate-200/80 dark:border-emerald-900/40">
          <button
            onClick={() => setChartType('bar')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              chartType === 'bar'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300'
            }`}
            title="Vertical Bar Chart"
          >
            <BarChart3 size={14} />
            <span className="hidden md:inline">Bar</span>
          </button>

          <button
            onClick={() => setChartType('line')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              chartType === 'line'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300'
            }`}
            title="Line Curve Chart"
          >
            <LineChart size={14} />
            <span className="hidden md:inline">Line</span>
          </button>

          <button
            onClick={() => setChartType('area')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              chartType === 'area'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300'
            }`}
            title="Gradient Area Chart"
          >
            <Activity size={14} />
            <span className="hidden md:inline">Area</span>
          </button>

          <button
            onClick={() => setChartType('donut')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              chartType === 'donut'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300'
            }`}
            title="Donut / Pie Distribution"
          >
            <PieChart size={14} />
            <span className="hidden md:inline">Donut</span>
          </button>

          <button
            onClick={() => setChartType('scatter')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              chartType === 'scatter'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300'
            }`}
            title="Scatter Plot"
          >
            <CircleDot size={14} />
            <span className="hidden md:inline">Scatter</span>
          </button>
        </div>

        {/* Center / Right: Dimension & Metric Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* X Axis Dimension */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium hidden sm:inline">Dimension:</span>
            <CustomSelect
              value={xAxisKey}
              onChange={(val) => setXAxisKey(val)}
              options={allColumns.map((col) => ({ value: col, label: col }))}
              className="w-32 sm:w-36"
              buttonClassName="!py-1 !px-2.5 text-xs font-mono bg-slate-50 dark:bg-[#121f19] border-slate-200 dark:border-emerald-900/60 text-slate-800 dark:text-emerald-100 hover:border-emerald-500/50"
              menuClassName="dark:bg-[#101c17] dark:border-emerald-900/80"
            />
          </div>

          {/* Y Axis Metric */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium hidden sm:inline">Metric:</span>
            <CustomSelect
              value={yAxisKey}
              onChange={(val) => setYAxisKey(val)}
              options={[
                { value: '__count__', label: 'Count of Records' },
                ...numericColumns.map((col) => ({ value: col, label: `${col} (num)` })),
                ...allColumns
                  .filter((c) => !numericColumns.includes(c))
                  .map((col) => ({ value: col, label: col })),
              ]}
              className="w-36 sm:w-44"
              buttonClassName="!py-1 !px-2.5 text-xs font-mono bg-slate-50 dark:bg-[#121f19] border-slate-200 dark:border-emerald-900/60 text-slate-800 dark:text-emerald-100 hover:border-emerald-500/50"
              menuClassName="dark:bg-[#101c17] dark:border-emerald-900/80"
            />
          </div>

          {/* Aggregation (if not Count) */}
          {yAxisKey !== '__count__' && (
            <div className="flex items-center gap-1 text-xs">
              <CustomSelect
                value={aggregation}
                onChange={(val) => setAggregation(val as AggregationType)}
                options={[
                  { value: 'sum', label: 'Sum' },
                  { value: 'avg', label: 'Average' },
                  { value: 'max', label: 'Max' },
                  { value: 'min', label: 'Min' },
                  { value: 'count', label: 'Count' },
                ]}
                className="w-24 sm:w-28"
                buttonClassName="!py-1 !px-2.5 text-xs font-mono bg-slate-50 dark:bg-[#121f19] border-slate-200 dark:border-emerald-900/60 text-slate-800 dark:text-emerald-100 hover:border-emerald-500/50"
                menuClassName="dark:bg-[#101c17] dark:border-emerald-900/80"
              />
            </div>
          )}

          {/* Top N Limiter */}
          <div className="flex items-center gap-1 text-xs">
            <CustomSelect
              value={topN}
              onChange={(val) => setTopN(Number(val))}
              options={[
                { value: 10, label: 'Top 10' },
                { value: 15, label: 'Top 15' },
                { value: 25, label: 'Top 25' },
                { value: 50, label: 'Top 50' },
                { value: 0, label: 'All Rows' },
              ]}
              className="w-24 sm:w-28"
              buttonClassName="!py-1 !px-2.5 text-xs font-mono bg-slate-50 dark:bg-[#121f19] border-slate-200 dark:border-emerald-900/60 text-slate-800 dark:text-emerald-100 hover:border-emerald-500/50"
              menuClassName="dark:bg-[#101c17] dark:border-emerald-900/80"
            />
          </div>

          {/* Sort Order */}
          <button
            onClick={() => {
              if (sortOrder === 'desc') setSortOrder('asc');
              else if (sortOrder === 'asc') setSortOrder('alpha');
              else setSortOrder('desc');
            }}
            className="p-1.5 rounded-md bg-slate-50 dark:bg-[#121f19] border border-slate-200 dark:border-emerald-900/60 text-slate-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
            title={`Sort: ${sortOrder === 'desc' ? 'High to Low' : sortOrder === 'asc' ? 'Low to High' : 'A-Z'}`}
          >
            <ArrowUpDown size={13} />
          </button>

          {/* Palette Selector */}
          <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-emerald-900/50">
            {(['emerald', 'cyan', 'violet', 'amber'] as ColorTheme[]).map((theme) => (
              <button
                key={theme}
                onClick={() => setColorTheme(theme)}
                className={`w-3.5 h-3.5 rounded-full transition-transform ${
                  colorTheme === theme ? 'scale-125 ring-2 ring-emerald-500' : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: COLOR_PALETTES[theme][0] }}
                title={`Color theme: ${theme}`}
              />
            ))}
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-emerald-900/50">
            <button
              onClick={() => handleExport('png')}
              className="flex items-center gap-1 px-2 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
              title="Download chart as PNG image"
            >
              <Download size={12} />
              <span className="hidden sm:inline">PNG</span>
            </button>
            <button
              onClick={() => handleExport('svg')}
              className="flex items-center gap-1 px-2 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
              title="Download chart as SVG vector"
            >
              <span className="text-[11px] font-mono">SVG</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Badges */}
      {stats && (
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-2 px-3 py-2 border-b border-slate-200/80 dark:border-emerald-950/50 bg-slate-50/50 dark:bg-[#0c1411]/50 shrink-0 text-xs">
          <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#101c17] border border-slate-200/80 dark:border-emerald-900/40">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Total</span>
            <span className="font-bold text-sm text-slate-800 dark:text-emerald-200 font-mono">
              {stats.total.toLocaleString()}
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#101c17] border border-slate-200/80 dark:border-emerald-900/40">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Average</span>
            <span className="font-bold text-sm text-slate-800 dark:text-emerald-200 font-mono">
              {stats.average.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#101c17] border border-slate-200/80 dark:border-emerald-900/40 truncate">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono truncate">
              Peak Max ({stats.max.label})
            </span>
            <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.max.value.toLocaleString()}
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#101c17] border border-slate-200/80 dark:border-emerald-900/40 truncate">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono truncate">
              Min ({stats.min.label})
            </span>
            <span className="font-bold text-sm text-slate-600 dark:text-slate-300 font-mono">
              {stats.min.value.toLocaleString()}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#101c17] border border-slate-200/80 dark:border-emerald-900/40">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Categories</span>
            <span className="font-bold text-sm text-slate-800 dark:text-emerald-200 font-mono">
              {stats.count.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* D3 SVG Canvas Area (Normal Mode or Fullscreen Mode for Charts Only) */}
      <div
        ref={containerRef}
        className={
          isChartOnlyFullscreen
            ? 'fixed inset-0 z-[99999] bg-[#fafcfb] dark:bg-[#0a0f0d] flex flex-col p-3 sm:p-5 overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            : 'flex-1 w-full relative overflow-hidden p-2 min-h-[300px]'
        }
      >
        {/* Fullscreen Minimal Controls Header (Only in Fullscreen Charts Only Mode) */}
        {isChartOnlyFullscreen && (
          <div className="relative z-40 flex flex-wrap items-center justify-between gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-white/95 dark:bg-[#0d1613]/95 backdrop-blur-xl border border-slate-200/90 dark:border-emerald-950/80 rounded-xl sm:rounded-2xl shadow-xl shadow-emerald-950/20 shrink-0 mb-2.5 max-w-full">
            {/* Title & Interactive Field Selectors */}
            <div className="flex items-center gap-1.5 flex-wrap max-w-full min-w-0">
              {title && (
                <span className="font-semibold text-xs text-slate-800 dark:text-emerald-100 truncate max-w-[70px] sm:max-w-[150px] shrink-0" title={title}>
                  {title}
                </span>
              )}

              <div className="flex items-center gap-0.5 bg-emerald-50/85 dark:bg-emerald-950/60 px-1 py-0.5 rounded-lg border border-emerald-500/30 shrink-0 max-w-full shadow-xs">
                {/* First Field: Dimension (X-Axis) */}
                <div className="relative" title="Select Dimension (X-Axis)">
                  <CustomSelect
                    value={xAxisKey}
                    onChange={(val) => setXAxisKey(val)}
                    options={allColumns.map((col) => ({ value: col, label: col }))}
                    className="w-auto min-w-[50px] max-w-[85px] sm:max-w-[130px]"
                    buttonClassName="!py-0.5 !px-1 text-[11px] sm:text-xs font-mono !bg-transparent !border-0 text-emerald-800 dark:text-emerald-200 hover:text-emerald-950 dark:hover:text-white"
                    menuClassName="dark:bg-[#101c17] dark:border-emerald-900/80 shadow-2xl z-[9999]"
                  />
                </div>

                <span className="text-[10px] text-emerald-500/80 font-mono select-none shrink-0">•</span>

                {/* Second Field: Metric (Y-Axis) */}
                <div className="relative" title="Select Metric (Y-Axis)">
                  <CustomSelect
                    value={yAxisKey}
                    onChange={(val) => setYAxisKey(val)}
                    options={[
                      { value: '__count__', label: 'Count' },
                      ...numericColumns.map((col) => ({ value: col, label: col })),
                      ...allColumns
                        .filter((c) => !numericColumns.includes(c))
                        .map((col) => ({ value: col, label: col })),
                    ]}
                    className="w-auto min-w-[45px] max-w-[75px] sm:max-w-[120px]"
                    buttonClassName="!py-0.5 !px-1 text-[11px] sm:text-xs font-mono !bg-transparent !border-0 text-emerald-800 dark:text-emerald-200 hover:text-emerald-950 dark:hover:text-white"
                    menuClassName="dark:bg-[#101c17] dark:border-emerald-900/80 shadow-2xl z-[9999]"
                  />
                </div>

                {/* Aggregation Selector if metric is numeric */}
                {yAxisKey !== '__count__' && (
                  <div className="relative border-l border-emerald-500/30 pl-0.5 ml-0.5 shrink-0" title="Aggregation Method">
                    <CustomSelect
                      value={aggregation}
                      onChange={(val) => setAggregation(val as AggregationType)}
                      options={[
                        { value: 'sum', label: 'Sum' },
                        { value: 'avg', label: 'Avg' },
                        { value: 'max', label: 'Max' },
                        { value: 'min', label: 'Min' },
                        { value: 'count', label: 'Count' },
                      ]}
                      className="w-auto min-w-[36px] max-w-[48px] sm:max-w-[62px]"
                      buttonClassName="!py-0.5 !px-1 text-[10px] sm:text-[11px] font-mono !bg-emerald-600/15 !border-0 text-emerald-700 dark:text-emerald-300 rounded"
                      menuClassName="dark:bg-[#101c17] dark:border-emerald-900/80 shadow-2xl z-[9999]"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Quick Chart Type Switcher in Fullscreen */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#121f19] p-1 rounded-lg border border-slate-200/80 dark:border-emerald-900/40">
              <button
                onClick={() => setChartType('bar')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  chartType === 'bar' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                }`}
                title="Bar Chart"
              >
                <BarChart3 size={13} />
                <span className="hidden sm:inline">Bar</span>
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  chartType === 'line' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                }`}
                title="Line Chart"
              >
                <LineChart size={13} />
                <span className="hidden sm:inline">Line</span>
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  chartType === 'area' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                }`}
                title="Area Chart"
              >
                <Activity size={13} />
                <span className="hidden sm:inline">Area</span>
              </button>
              <button
                onClick={() => setChartType('donut')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  chartType === 'donut' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                }`}
                title="Donut Chart"
              >
                <PieChart size={13} />
                <span className="hidden sm:inline">Donut</span>
              </button>
              <button
                onClick={() => setChartType('scatter')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  chartType === 'scatter' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                }`}
                title="Scatter Plot"
              >
                <CircleDot size={13} />
                <span className="hidden sm:inline">Scatter</span>
              </button>
            </div>

            {/* Actions: Export & Exit Fullscreen */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('png')}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
                title="Download PNG"
              >
                <Download size={12} />
                <span className="hidden sm:inline">PNG</span>
              </button>
              <button
                onClick={() => handleExport('svg')}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
                title="Download SVG"
              >
                <span>SVG</span>
              </button>

              <button
                onClick={() => setIsChartOnlyFullscreen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm shadow-emerald-500/30 transition-all cursor-pointer ml-1"
                title="Exit Fullscreen (Esc)"
              >
                <Minimize2 size={14} />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          </div>
        )}

        {/* Floating Fullscreen Button on Chart Canvas (When not in fullscreen) */}
        {!isChartOnlyFullscreen && chartData.length > 0 && (
          <button
            onClick={toggleChartOnlyFullscreen}
            className="absolute top-4 right-4 p-1.5 sm:px-2.5 sm:py-1.5 bg-white/90 dark:bg-[#091511]/90 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-slate-700 dark:text-emerald-300 hover:text-white dark:hover:text-white rounded-lg border border-slate-200/90 dark:border-emerald-500/30 backdrop-blur-md shadow-md transition-all z-20 flex items-center gap-1.5 text-xs font-medium group cursor-pointer"
            title="Fullscreen (View Chart Only)"
          >
            <Maximize2 size={13} className="group-hover:scale-110 transition-transform" />
            <span className="hidden md:inline">Chart Fullscreen</span>
          </button>
        )}

        {/* Main Chart Canvas Area */}
        <div ref={svgContainerRef} className="flex-1 w-full h-full min-h-0 relative">
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-emerald-700/60 font-mono text-sm gap-2">
              <BarChart3 size={32} className="opacity-40" />
              <span>No data available to visualize. Select columns above.</span>
            </div>
          ) : (
            <svg ref={svgRef} className="w-full h-full select-none" />
          )}

          {/* Floating Tooltip */}
          {tooltip.visible && (
            <div
              className="pointer-events-none absolute z-50 bg-[#091511]/95 dark:bg-[#06100c]/95 backdrop-blur-xl border border-emerald-500/30 rounded-lg shadow-2xl p-2.5 text-xs text-white transform -translate-x-1/2 -translate-y-full -mt-2 transition-all duration-75 min-w-[140px]"
              style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
            >
              <div className="font-semibold text-emerald-300 border-b border-emerald-800/40 pb-1 mb-1 truncate">
                {tooltip.title}
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-slate-400 font-mono">Value:</span>
                <span className="font-bold font-mono text-emerald-100">{tooltip.value.toLocaleString()}</span>
              </div>
              {tooltip.percentage && (
                <div className="flex justify-between items-center gap-3">
                  <span className="text-slate-400 font-mono">Share:</span>
                  <span className="font-medium font-mono text-emerald-400">{tooltip.percentage}</span>
                </div>
              )}
              {tooltip.count !== undefined && (
                <div className="flex justify-between items-center gap-3">
                  <span className="text-slate-400 font-mono">Records:</span>
                  <span className="font-medium font-mono text-slate-300">{tooltip.count}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
