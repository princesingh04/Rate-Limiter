import { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { X, Save, Trash2 } from 'lucide-react';

export default function ProjectEditModal({ isOpen, onClose, project, onProjectUpdated }) {
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [algorithm, setAlgorithm] = useState('token-bucket');
  const [capacity, setCapacity] = useState(10);
  const [refillRate, setRefillRate] = useState(1);
  const [windowMs, setWindowMs] = useState(60000);
  const [maxRequests, setMaxRequests] = useState(10);
  
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Prefill form when project changes
  useEffect(() => {
    if (project && isOpen) {
      setName(project.name || '');
      setTargetUrl(project.targetUrl || '');
      
      const config = project.rateLimitConfig || {};
      setAlgorithm(config.algorithm || 'token-bucket');
      setCapacity(config.capacity || 10);
      setRefillRate(config.refillRate || 1);
      setWindowMs(config.windowMs || 60000);
      setMaxRequests(config.maxRequests || 10);
      setError('');
    }
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

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

      await api.patch(`/projects/${project._id}`, payload);
      onProjectUpdated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update endpoint');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${project.name}? This action cannot be undone.`)) {
      return;
    }
    
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/projects/${project._id}`);
      onProjectUpdated(); // Refresh list (it will auto-select another project)
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete endpoint');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="flex justify-between items-center p-5 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Edit Endpoint Settings</h2>
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
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Target URL</label>
              <input
                required
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
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

          <div className="flex justify-between items-center pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-2 rounded-lg flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={16} />
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
            <div className="flex gap-3">
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
                className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-medium transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Save size={16} />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
