import { Copy, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import StatsCards from './StatsCards';
import TimeSeriesChart from './TimeSeriesChart';
import RequestTable from './RequestTable';

/**
 * Dashboard — orchestrates stats cards, the time-series chart,
 * and the paginated request log table.
 */
export default function Dashboard({ summary, logs, loading, onPageChange, activeProject }) {
  const [copied, setCopied] = useState(false);

  const proxyUrl = activeProject ? `http://localhost:4000/proxy/${activeProject._id}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(proxyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Project Details Banner ─────────────────────────────── */}
      {activeProject && (
        <div className="glass-card p-5 border-l-4 border-l-indigo-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">{activeProject.name}</h2>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="bg-slate-800 px-2 py-0.5 rounded text-indigo-300 font-mono">
                {activeProject.rateLimitConfig.algorithm}
              </span>
              <span>→ Forwarding to:</span>
              <a href={activeProject.targetUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                {activeProject.targetUrl}
              </a>
            </div>
          </div>
          
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-2 pl-4 flex items-center gap-3 w-full sm:w-auto">
            <span className="text-slate-300 font-mono text-sm max-w-[200px] sm:max-w-none truncate select-all">
              {proxyUrl}
            </span>
            <button 
              onClick={handleCopy}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors"
              title="Copy Proxy URL"
            >
              {copied ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Stats Row ────────────────────────────────────────── */}
      <StatsCards summary={summary} loading={loading} />

      {/* ── Chart ────────────────────────────────────────────── */}
      <div className="glass-card p-6">
        <h2 className="mb-4 text-base font-semibold text-white/80">
          Allowed vs. Blocked — Last 24 Hours
        </h2>
        <TimeSeriesChart summary={summary} />
      </div>

      {/* ── Logs Table ───────────────────────────────────────── */}
      <div className="glass-card p-6">
        <h2 className="mb-4 text-base font-semibold text-white/80">
          Request Log
        </h2>
        <RequestTable logs={logs} loading={loading} onPageChange={onPageChange} />
      </div>
    </div>
  );
}
