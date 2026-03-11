/**
 * Paginated request log table with status badges and responsive design.
 */
export default function RequestTable({ logs, loading, onPageChange }) {
  const { data = [], page = 1, totalPages = 1, total = 0 } = logs;

  return (
    <div>
      {/* ── Table ──────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['Timestamp', 'IP Address', 'Route', 'Status', 'Algorithm', 'Latency'].map(
                (col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/30"
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/30">
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/30">
                  No request logs yet. Send some requests to{' '}
                  <code className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-xs text-brand-300">
                    /proxy/*
                  </code>
                </td>
              </tr>
            ) : (
              data.map((log, i) => (
                <tr
                  key={log._id || i}
                  className="transition-colors hover:bg-white/[0.02]"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-white/50">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-white/60">
                    {log.ipAddress}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-white/70">
                    {log.targetRoute}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={log.status === 'Passed' ? 'badge-passed' : 'badge-blocked'}>
                      {log.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-white/40">
                    {log.algorithm || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-white/50">
                    {log.responseTime}ms
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
          <p className="text-xs text-white/30">
            {total} total logs — page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/60 transition-all hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/60 transition-all hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
