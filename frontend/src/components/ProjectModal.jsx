import { useState } from 'react';
import { api } from '../context/AuthContext';
import { X } from 'lucide-react';

export default function ProjectModal({ isOpen, onClose, onProjectCreated }) {
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [algorithm, setAlgorithm] = useState('token-bucket');
  const [capacity, setCapacity] = useState(10);
  const [refillRate, setRefillRate] = useState(1);
  const [windowMs, setWindowMs] = useState(60000);
  const [maxRequests, setMaxRequests] = useState(10);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        name,
        targetUrl,
        rateLimitConfig: {
          algorithm,
          capacity: Number(capacity),
          refillRate: Number(refillRate),
          windowMs: Number(windowMs),
          maxRequests: Number(maxRequests)
        }
      };

      await api.post('/projects', payload);
      onProjectCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create endpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="flex justify-between items-center p-5 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Create New Endpoint</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">{error}</div>}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Project Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production API"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <label className="block text-sm font-medium text-slate-300">Target URL</label>
                <button
                  type="button"
                  onClick={() => setTargetUrl('https://httpbin.org')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Use test URL (httpbin.org)
                </button>
              </div>
              <input
                required
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="e.g. https://api.my-app.com"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            
            <div className="pt-2 border-t border-slate-800">
              <label className="block text-sm font-medium text-slate-300 mb-1">Rate Limiting Algorithm</label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 mb-3"
              >
                <option value="token-bucket">Token Bucket</option>
                <option value="sliding-window-log">Sliding Window Log</option>
              </select>

              {/* Algorithm Pros & Cons Helper Text */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-400 leading-relaxed mb-4">
                {algorithm === 'token-bucket' ? (
                  <>
                    <strong className="text-indigo-300 block mb-1">Why Token Bucket?</strong>
                    <span className="text-emerald-400">Pros:</span> Memory highly efficient. Allows temporary bursts of traffic smoothly.<br/>
                    <span className="text-amber-400">Cons:</span> High bursts could temporarily spike load on your backend servers. Best for general public APIs.
                  </>
                ) : (
                  <>
                    <strong className="text-indigo-300 block mb-1">Why Sliding Window Log?</strong>
                    <span className="text-emerald-400">Pros:</span> Extremely accurate enforcement. No edge-case bursts allowed.<br/>
                    <span className="text-amber-400">Cons:</span> Requires higher memory (stores every request timestamp). Best for strict, sensitive endpoints.
                  </>
                )}
              </div>
            </div>

            {algorithm === 'token-bucket' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Capacity (Tokens)</label>
                  <input
                    type="number" required min={1}
                    value={capacity} onChange={(e) => setCapacity(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Refill Rate (Per sec)</label>
                  <input
                    type="number" required min={1}
                    value={refillRate} onChange={(e) => setRefillRate(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Window Size (ms)</label>
                  <input
                    type="number" required min={1000} step={1000}
                    value={windowMs} onChange={(e) => setWindowMs(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Max Requests</label>
                  <input
                    type="number" required min={1}
                    value={maxRequests} onChange={(e) => setMaxRequests(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-medium transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Creating...' : 'Create Endpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
