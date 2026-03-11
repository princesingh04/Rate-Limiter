import { useState, useEffect, useCallback } from 'react';
import Dashboard from '../components/Dashboard';
import ProjectModal from '../components/ProjectModal';
import ProjectEditModal from '../components/ProjectEditModal';
import { useAuth, api } from '../context/AuthContext';
import { LogOut, Plus, Settings, Copy } from 'lucide-react';

export default function DashboardShell() {
  const { user, logout } = useAuth();
  
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [summary, setSummary] = useState([]);
  const [logs, setLogs] = useState({ data: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user's projects
  const fetchProjects = useCallback(async () => {
    try {
      const { data } = await api.get('/projects');
      setProjects(data);
      if (data.length > 0 && !activeProjectId) {
        setActiveProjectId(data[0]._id);
      }
    } catch (err) {
      console.error('Failed to load projects');
    }
  }, [activeProjectId]);

  // Load analytics for the active project
  const fetchAnalytics = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const query = activeProjectId ? `projectId=${activeProjectId}&` : '';
      const [summaryRes, logsRes] = await Promise.all([
        api.get(`/analytics/summary?${query}`),
        api.get(`/analytics/logs?${query}page=${page}&limit=20`),
      ]);
      setSummary(summaryRes.data);
      setLogs(logsRes.data);
      setError(null);
    } catch (err) {
      if (err.response?.status === 401) return; // handled by interceptor/auth flow
      setError('Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (projects.length === 0) {
      setLoading(false);
      return; 
    }
    fetchAnalytics();
    const interval = setInterval(() => fetchAnalytics(logs.page), 10_000);
    return () => clearInterval(interval);
  }, [fetchAnalytics, projects.length, logs.page]);

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col">
      {/* ─── Header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold tracking-tight text-white">Rate Limiter SaaS</h1>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-700/50 hidden sm:block" />

            {/* Project Selector */}
            {projects.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={activeProjectId || ''}
                  onChange={(e) => setActiveProjectId(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 max-w-[200px]"
                >
                  {projects.map(p => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/80 rounded-lg transition-colors"
                  title="Endpoint Settings"
                >
                  <Settings size={18} />
                </button>
              </div>
            )}
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-slate-400 hover:text-white transition-colors p-2 bg-slate-800/50 rounded-lg hidden sm:flex items-center gap-2"
            >
               <Plus size={16} /> New Endpoint
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => fetchAnalytics(logs.page)}
              className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700 hover:text-white active:scale-95"
            >
              <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Refresh
            </button>
            <div className="h-6 w-px bg-slate-700/50" />
            
            <button
              onClick={logout}
              className="text-slate-400 hover:text-red-400 transition-colors p-2"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ──────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-6 animate-fade-in rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <h2 className="text-xl font-medium text-white mb-2">Welcome to the Gateway</h2>
            <p className="text-slate-400 max-w-lg mb-6">
              You haven't created any proxy endpoints yet. Create an endpoint to wrap your target URL with intelligent rate limiting.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus size={18} />
              Create Your First Endpoint
            </button>
          </div>
        ) : (
          <Dashboard
            summary={summary}
            logs={logs}
            loading={loading}
            onPageChange={(page) => fetchAnalytics(page)}
            activeProject={projects.find(p => p._id === activeProjectId)}
          />
        )}
      </main>

      <ProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onProjectCreated={() => fetchProjects()} 
      />
      <ProjectEditModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        project={projects.find(p => p._id === activeProjectId)}
        onProjectUpdated={() => fetchProjects()}
      />
    </div>
  );
}
