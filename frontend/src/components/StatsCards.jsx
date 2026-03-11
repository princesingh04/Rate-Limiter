import { useMemo } from 'react';

/**
 * Animated summary cards derived from the hourly aggregation data.
 */
export default function StatsCards({ summary, loading }) {
  const stats = useMemo(() => {
    if (!summary || summary.length === 0) {
      return { totalAllowed: 0, totalBlocked: 0, blockRate: 0, avgResponseTime: 0 };
    }

    const totalAllowed = summary.reduce((sum, h) => sum + (h.allowed || 0), 0);
    const totalBlocked = summary.reduce((sum, h) => sum + (h.blocked || 0), 0);
    const total = totalAllowed + totalBlocked;
    const blockRate = total > 0 ? ((totalBlocked / total) * 100).toFixed(1) : 0;

    const avgResponseTime =
      summary.reduce((sum, h) => sum + (h.avgResponseTime || 0), 0) / summary.length;

    return { totalAllowed, totalBlocked, blockRate, avgResponseTime: avgResponseTime.toFixed(1) };
  }, [summary]);

  const cards = [
    {
      label: 'Total Requests',
      value: stats.totalAllowed + stats.totalBlocked,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
        </svg>
      ),
      color: 'from-blue-500 to-blue-700',
      glow: 'shadow-blue-500/20',
    },
    {
      label: 'Allowed',
      value: stats.totalAllowed,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'from-emerald-500 to-emerald-700',
      glow: 'shadow-emerald-500/20',
    },
    {
      label: 'Blocked',
      value: stats.totalBlocked,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      color: 'from-red-500 to-red-700',
      glow: 'shadow-red-500/20',
    },
    {
      label: 'Block Rate',
      value: `${stats.blockRate}%`,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      color: 'from-amber-500 to-amber-700',
      glow: 'shadow-amber-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className={`glass-card group relative overflow-hidden p-5 transition-all duration-300 hover:scale-[1.02] hover:border-white/[0.15] animate-slide-up`}
          style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
        >
          {/* Gradient glow blob */}
          <div
            className={`absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br ${card.color} opacity-15 blur-2xl transition-opacity group-hover:opacity-25`}
          />

          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                {card.label}
              </p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums">
                {loading ? '—' : card.value}
              </p>
            </div>
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.color} shadow-lg ${card.glow} text-white/90`}
            >
              {card.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
