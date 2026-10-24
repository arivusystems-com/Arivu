import type { AnalyticsExecuteResult } from '@/types/analytics.types';
import {
  ANALYTICS_CHART_PALETTE,
  ANALYTICS_CHART_TOKENS,
  type AnalyticsChartThemeMode,
} from './analyticsChartTheme';
import {
  buildCategoryAxis,
  buildChartAnimationBase,
  buildIndexedBarItemStyle,
  buildLineSeriesOptions,
  buildPieSeriesOptions,
  buildPieSliceColor,
  buildFunnelSliceColor,
  buildPremiumGrid,
  buildPremiumTooltip,
  buildValueAxis,
  seriesColorAt,
  seriesPieColorAt,
} from './chartStyles';

export interface WidgetColumnMapping {
  dimension?: string;
  metric?: string;
  series?: Array<{ field: string; label?: string }>;
}

export interface WidgetChartConfig {
  chartType: string;
  columnMapping?: WidgetColumnMapping;
  orientation?: 'horizontal' | 'vertical';
  stacked?: boolean;
  smooth?: boolean;
  showLegend?: boolean;
  showDataLabels?: boolean;
}

function columnKeys(result: AnalyticsExecuteResult): string[] {
  return (result.columns || []).map((col) => col.key);
}

function resolveFieldKey(result: AnalyticsExecuteResult, preferred?: string | null): string | null {
  const keys = columnKeys(result);
  if (preferred && keys.includes(preferred)) return preferred;
  return keys[0] || null;
}

function resolveMetricKey(result: AnalyticsExecuteResult, mapping?: WidgetColumnMapping): string | null {
  const keys = columnKeys(result);
  if (mapping?.metric && keys.includes(mapping.metric)) {
    return mapping.metric;
  }

  const typedNumeric = (result.columns || [])
    .filter((col) => col.type === 'number')
    .map((col) => col.key);
  const countLike = typedNumeric.find((key) =>
    /(?:^|_)(count|total|sum|amount|value|metric)(?:_|$)/i.test(key),
  );
  if (countLike) return countLike;

  const numeric = keys.find((key) => {
    const sample = result.rows?.[0]?.[key];
    return typeof sample === 'number';
  });
  return numeric || keys[keys.length - 1] || null;
}

function isNumericColumn(result: AnalyticsExecuteResult, key: string): boolean {
  const meta = (result.columns || []).find((col) => col.key === key);
  if (meta?.type === 'number') return true;
  const sample = result.rows?.[0]?.[key];
  return typeof sample === 'number';
}

function rowLabel(row: Record<string, unknown>, dimensionKey: string | null): string {
  if (!dimensionKey) return '';
  const value = row[dimensionKey];
  if (value === null || value === undefined) return '—';
  return String(value);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveDimensionKey(
  result: AnalyticsExecuteResult,
  mapping?: WidgetColumnMapping,
): string | null {
  const keys = columnKeys(result);
  if (mapping?.dimension && keys.includes(mapping.dimension)) {
    return mapping.dimension;
  }

  const metricKey = resolveMetricKey(result, mapping);
  const candidates = keys.filter((key) => key !== metricKey);
  if (!candidates.length) return null;

  const stringCol = (result.columns || []).find(
    (col) => col.key !== metricKey && col.type === 'string',
  );
  if (stringCol) return stringCol.key;

  const nonNumeric = candidates.find((key) => !isNumericColumn(result, key));
  if (nonNumeric) return nonNumeric;

  let bestKey: string | null = null;
  let bestUnique = 0;
  for (const key of candidates) {
    const unique = new Set(
      (result.rows || []).map((row) => String(row[key] ?? '')),
    ).size;
    if (unique > bestUnique) {
      bestUnique = unique;
      bestKey = key;
    }
  }

  return bestKey;
}

function buildDistinctPieData(
  rows: Array<Record<string, unknown>>,
  dimensionKey: string | null,
  metricKey: string,
  palette: string[],
  themeMode: AnalyticsChartThemeMode,
) {
  const rim = themeMode === 'dark' ? '#111827' : '#ffffff';
  const seenNames = new Map<string, number>();

  return rows.map((row, index) => {
    let name = rowLabel(row, dimensionKey) || `Item ${index + 1}`;
    const seen = seenNames.get(name) ?? 0;
    seenNames.set(name, seen + 1);
    if (seen > 0) {
      name = `${name} (${seen + 1})`;
    }

    const color = seriesPieColorAt(palette, index);

    return {
      name,
      value: toNumber(row[metricKey]),
      itemStyle: {
        ...buildPieSliceColor(color),
        borderRadius: 10,
        borderColor: rim,
        borderWidth: 2,
      },
    };
  });
}

function buildLegend(themeMode: AnalyticsChartThemeMode, show: boolean): Record<string, unknown> | undefined {
  if (!show) return undefined;
  const tokens = ANALYTICS_CHART_TOKENS[themeMode];
  return {
    bottom: 0,
    icon: 'circle',
    itemWidth: 8,
    itemHeight: 8,
    itemGap: 16,
    textStyle: {
      color: tokens.textMuted,
      fontSize: 11,
    },
  };
}

export function buildChartOption(
  result: AnalyticsExecuteResult,
  config: WidgetChartConfig,
  themeMode: AnalyticsChartThemeMode = 'light',
): Record<string, unknown> | null {
  const rows = result.rows || [];
  if (rows.length === 0) return null;

  const palette = [...ANALYTICS_CHART_PALETTE[themeMode]];
  const mapping = config.columnMapping || {};
  const dimensionKey = resolveDimensionKey(result, mapping);
  const metricKey = resolveMetricKey(result, mapping);

  if (!metricKey) return null;

  const chartType = String(config.chartType || 'bar').toLowerCase();
  const base = buildChartAnimationBase();

  if (chartType === 'pie' || chartType === 'donut') {
    return {
      ...base,
      color: palette,
      tooltip: buildPremiumTooltip(themeMode, 'item'),
      legend: buildLegend(themeMode, config.showLegend !== false),
      series: [
        {
          ...buildPieSeriesOptions(chartType, themeMode),
          colorBy: 'data',
          data: buildDistinctPieData(rows, dimensionKey, metricKey, palette, themeMode),
        },
      ],
    };
  }

  if (chartType === 'funnel') {
    return {
      ...base,
      color: palette,
      tooltip: buildPremiumTooltip(themeMode, 'item'),
      series: [
        {
          type: 'funnel',
          sort: 'descending',
          gap: 4,
          label: {
            color: ANALYTICS_CHART_TOKENS[themeMode].textMuted,
            fontSize: 11,
          },
          itemStyle: {
            borderRadius: 8,
            borderColor: themeMode === 'dark' ? '#111827' : '#ffffff',
            borderWidth: 2,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 14,
              shadowColor: 'rgba(96, 73, 231, 0.25)',
            },
          },
          data: rows.map((row, index) => ({
            name: rowLabel(row, dimensionKey),
            value: toNumber(row[metricKey]),
            itemStyle: {
              ...buildFunnelSliceColor(seriesColorAt(palette, index)),
              borderRadius: 8,
              borderColor: themeMode === 'dark' ? '#111827' : '#ffffff',
              borderWidth: 2,
            },
          })),
        },
      ],
    };
  }

  const categories = rows.map((row) => rowLabel(row, dimensionKey));
  const values = rows.map((row) => toNumber(row[metricKey]));
  const horizontal = config.orientation === 'horizontal';
  const primary = seriesColorAt(palette, 0);

  if (chartType === 'gauge') {
    const value = toNumber(rows[0]?.[metricKey]);
    return {
      ...base,
      series: [
        {
          type: 'gauge',
          min: 0,
          max: Math.max(value * 1.25, 100),
          progress: { show: true, width: 12 },
          axisLine: { lineStyle: { width: 12 } },
          pointer: { width: 4 },
          detail: {
            valueAnimation: true,
            formatter: '{value}',
            color: ANALYTICS_CHART_TOKENS[themeMode].textMuted,
            fontSize: 18,
          },
          data: [{ value }],
        },
      ],
    };
  }

  if (chartType === 'scatter') {
    const xKey = resolveFieldKey(result, mapping.dimension) || metricKey;
    const yKey = resolveMetricKey(result, mapping) || metricKey;
    return {
      ...base,
      grid: buildPremiumGrid(),
      tooltip: buildPremiumTooltip(themeMode, 'item'),
      xAxis: buildValueAxis(themeMode),
      yAxis: buildValueAxis(themeMode),
      series: [
        {
          type: 'scatter',
          symbolSize: 10,
          data: rows.map((row, index) => ({
            value: [toNumber(row[xKey]), toNumber(row[yKey])],
            itemStyle: { color: seriesColorAt(palette, index) },
          })),
        },
      ],
    };
  }

  if (chartType === 'heatmap') {
    const xCategories = [...new Set(rows.map((row) => rowLabel(row, dimensionKey)))];
    const yCategories = [...new Set(rows.map((row) => rowLabel(row, resolveFieldKey(result, mapping.series?.[0]?.field))))];
    const heatData: Array<[number, number, number]> = [];
    rows.forEach((row) => {
      const xIndex = xCategories.indexOf(rowLabel(row, dimensionKey));
      const yIndex = yCategories.indexOf(
        rowLabel(row, resolveFieldKey(result, mapping.series?.[0]?.field)),
      );
      if (xIndex >= 0 && yIndex >= 0) {
        heatData.push([xIndex, yIndex, toNumber(row[metricKey])]);
      }
    });
    const maxVal = Math.max(...heatData.map((entry) => entry[2]), 1);
    return {
      ...base,
      tooltip: buildPremiumTooltip(themeMode, 'item'),
      grid: buildPremiumGrid(),
      xAxis: { type: 'category', data: xCategories, splitArea: { show: true } },
      yAxis: { type: 'category', data: yCategories, splitArea: { show: true } },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
      },
      series: [{ type: 'heatmap', data: heatData, label: { show: false } }],
    };
  }

  if (chartType === 'combo') {
    const seriesField = mapping.series?.[0]?.field;
    const lineKey = seriesField && columnKeys(result).includes(seriesField) ? seriesField : metricKey;
    return {
      ...base,
      color: palette,
      grid: buildPremiumGrid(),
      tooltip: buildPremiumTooltip(themeMode, 'axis'),
      legend: buildLegend(themeMode, config.showLegend !== false),
      xAxis: buildCategoryAxis(themeMode, categories),
      yAxis: buildValueAxis(themeMode),
      series: [
        {
          type: 'bar',
          name: metricKey,
          colorBy: 'data',
          data: values.map((value, index) => ({
            value,
            itemStyle: buildIndexedBarItemStyle(palette, index, false),
          })),
          barWidth: '42%',
        },
        {
          ...buildLineSeriesOptions(seriesColorAt(palette, 1), themeMode, { smooth: config.smooth }),
          name: lineKey,
          data: rows.map((row) => toNumber(row[lineKey])),
        },
      ],
    };
  }

  if (chartType === 'line' || chartType === 'area') {
    const seriesData = horizontal ? values.slice().reverse() : values;
    return {
      ...base,
      color: palette,
      grid: buildPremiumGrid(),
      tooltip: buildPremiumTooltip(themeMode, 'axis'),
      xAxis: horizontal ? buildValueAxis(themeMode) : buildCategoryAxis(themeMode, categories),
      yAxis: horizontal ? buildCategoryAxis(themeMode, categories, true) : buildValueAxis(themeMode),
      series: [
        {
          ...buildLineSeriesOptions(primary, themeMode, {
            smooth: config.smooth,
            area: chartType === 'area',
          }),
          data: seriesData,
        },
      ],
    };
  }

  const barData = horizontal ? values.slice().reverse() : values;

  return {
    ...base,
    color: palette,
    grid: buildPremiumGrid(),
    tooltip: buildPremiumTooltip(themeMode, 'axis'),
    xAxis: horizontal ? buildValueAxis(themeMode) : buildCategoryAxis(themeMode, categories),
    yAxis: horizontal ? buildCategoryAxis(themeMode, categories, true) : buildValueAxis(themeMode),
    series: [
      {
        type: 'bar',
        stack: config.stacked ? 'total' : undefined,
        colorBy: 'data',
        data: barData.map((value, index) => ({
          value,
          itemStyle: buildIndexedBarItemStyle(palette, index, horizontal),
        })),
        barWidth: '54%',
        barMaxWidth: 44,
        emphasis: {
          itemStyle: {
            opacity: 0.94,
            shadowBlur: 14,
          },
        },
        label: config.showDataLabels
          ? {
              show: true,
              position: horizontal ? 'right' : 'top',
              color: ANALYTICS_CHART_TOKENS[themeMode].textMuted,
              fontSize: 11,
              fontWeight: 500,
            }
          : undefined,
      },
    ],
  };
}

export function extractKpiValue(
  result: AnalyticsExecuteResult,
  valueField?: string | null,
): number | null {
  const row = result.rows?.[0];
  if (!row) return null;
  const key = resolveFieldKey(result, valueField) || resolveMetricKey(result, { metric: valueField || undefined });
  if (!key) return null;
  return toNumber(row[key]);
}

export function resolveKpiThresholdColor(
  value: number,
  thresholds?: Array<{ min: number | null; max: number | null; color: string }> | null,
): string | null {
  if (!thresholds?.length) return null;
  for (const band of thresholds) {
    const min = band.min ?? Number.NEGATIVE_INFINITY;
    const max = band.max ?? Number.POSITIVE_INFINITY;
    if (value >= min && value <= max) return band.color;
  }
  return null;
}
