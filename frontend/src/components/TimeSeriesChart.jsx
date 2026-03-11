import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

/**
 * Time-series line chart — Allowed vs. Blocked requests per hour.
 * Uses gradient fills for a premium look.
 */
export default function TimeSeriesChart({ summary }) {
  const chartData = useMemo(() => {
    if (!summary || summary.length === 0) {
      // Generate placeholder 24-hour labels with zero data
      const now = new Date();
      const labels = [];
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now);
        d.setHours(d.getHours() - i, 0, 0, 0);
        labels.push(
          d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        );
      }
      return {
        labels,
        allowed: new Array(24).fill(0),
        blocked: new Array(24).fill(0),
      };
    }

    const labels = summary.map((h) => {
      const d = new Date(h.hour);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    });
    const allowed = summary.map((h) => h.allowed || 0);
    const blocked = summary.map((h) => h.blocked || 0);
    return { labels, allowed, blocked };
  }, [summary]);

  const data = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Allowed',
        data: chartData.allowed,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#10b981',
        pointBorderWidth: 0,
        borderWidth: 2,
      },
      {
        label: 'Blocked',
        data: chartData.blocked,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#ef4444',
        pointBorderWidth: 0,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          color: 'rgba(255,255,255,0.5)',
          usePointStyle: true,
          pointStyleWidth: 8,
          padding: 16,
          font: { family: 'Inter', size: 12 },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#fff',
        bodyColor: 'rgba(255,255,255,0.7)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        titleFont: { family: 'Inter', weight: '600' },
        bodyFont: { family: 'Inter' },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
        ticks: { color: 'rgba(255,255,255,0.3)', font: { family: 'Inter', size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
        ticks: {
          color: 'rgba(255,255,255,0.3)',
          font: { family: 'Inter', size: 11 },
          precision: 0,
        },
      },
    },
  };

  return (
    <div className="h-72 sm:h-80">
      <Line data={data} options={options} />
    </div>
  );
}
