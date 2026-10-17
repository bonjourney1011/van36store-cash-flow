// Daily stacked bars: cash / money on its way / stock at cost. Chart.js is loaded from cdnjs in index.html.
import { formatShort, formatDayMonth } from './dom-and-format-helpers.js';

let chart = null;

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function renderTrendChart(canvas, trend) {
  if (chart) { chart.destroy(); chart = null; }
  if (!canvas || !window.Chart || !trend.length) return;
  const surface = cssVar('--surface');
  const series = [
    { key: 'tien', label: 'Tiền', color: cssVar('--cash') },
    { key: 'cho_thu', label: 'Chờ thu', color: cssVar('--incoming') },
    { key: 'may_ton', label: 'Máy tồn', color: cssVar('--stock') }
  ];
  chart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: trend.map((point) => formatDayMonth(point.ngay)),
      datasets: series.map((s, index) => ({
        label: s.label,
        data: trend.map((point) => Math.max(0, point[s.key])),
        backgroundColor: s.color,
        // 2px surface-coloured edge = the gap between stacked segments
        borderColor: surface,
        borderWidth: { top: 2, bottom: 0, left: 0, right: 0 },
        borderRadius: index === series.length - 1 ? { topLeft: 4, topRight: 4 } : 0,
        borderSkipped: false,
        maxBarThickness: 28
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: cssVar('--ink-muted'), maxRotation: 0, autoSkipPadding: 12 } },
        y: {
          stacked: true, beginAtZero: true, border: { display: false },
          grid: { color: cssVar('--grid') },
          ticks: { color: cssVar('--ink-muted'), maxTicksLimit: 5, callback: (value) => formatShort(value) }
        }
      },
      plugins: {
        legend: { position: 'top', align: 'start', labels: { color: cssVar('--ink-2'), boxWidth: 12, boxHeight: 12, useBorderRadius: true, borderRadius: 3 } },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${formatShort(item.parsed.y)}`,
            footer: (items) => `Tổng: ${formatShort(items.reduce((sum, item) => sum + item.parsed.y, 0))}`
          }
        }
      }
    }
  });
}
