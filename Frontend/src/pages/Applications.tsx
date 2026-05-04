import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import { Card, Button, Badge, Modal } from '../components/UI';
import { useToast } from '../components/Toast';
import { 
  ExternalLink, 
  Trash2, 
  Rocket, 
  Globe, 
  Box, 
  Code, 
  LayoutGrid, 
  Ship, 
  ServerCog,
  AlertTriangle,
  Eye,
  Plus,
  X,
  Variable
} from 'lucide-react';
import { App } from '../types';
import { cn } from '../utils/cn';

export const Applications = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'fleet' | 'deploy' | 'infrastructure'>('fleet');
  const [step, setStep] = useState(1);
  const [repoUrl, setRepoUrl] = useState('');
  const [scanData, setScanData] = useState<{ scan_id: string; folders: string[] } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    port: 3000,
    subfolder: '',
  });
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [detailApp, setDetailApp] = useState<App | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { data: apps, isLoading } = useQuery<App[]>({
    queryKey: ['apps'],
    queryFn: apiService.getApps,
    refetchInterval: 10000,
  });

  const totalApps = apps?.length ?? 0;

  const scanMutation = useMutation({
    mutationFn: apiService.scanRepo,
    onSuccess: (data) => {
      if (data.error) {
        toast(data.error, 'error');
        return;
      }
      setScanData(data);
      setStep(2);
      toast(`Repository scanned — ${data.folders.length} folders found`, 'success');
    },
    onError: () => toast('Failed to scan repository', 'error'),
  });

  const deployMutation = useMutation({
    mutationFn: apiService.deployApp,
    onSuccess: (data) => {
      if (data.error) {
        toast(data.error, 'error');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      setActiveTab('fleet');
      setStep(1);
      setScanData(null);
      setRepoUrl('');
      setFormData({ name: '', port: 3000, subfolder: '' });
      setEnvVars([]);
      toast(`Deployment started for "${formData.name}"`, 'success');
    },
    onError: () => toast('Deployment request failed', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: apiService.deleteApp,
    onSuccess: (data) => {
      if (data.error) {
        toast(data.error, 'error');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      toast('Application removed successfully', 'success');
    },
    onError: () => toast('Failed to remove application', 'error'),
  });

  // View app details using GET /apps/{name}
  const viewAppDetails = async (name: string) => {
    setDetailLoading(true);
    try {
      const data = await apiService.getApp(name);
      if (data.error) {
        toast(data.error, 'error');
        return;
      }
      setDetailApp(data);
    } catch {
      toast('Failed to load app details', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  // Convert envVars array to object for API
  const envVarsToObject = () => {
    const obj: Record<string, string> = {};
    envVars.forEach(({ key, value }) => {
      if (key.trim()) obj[key.trim()] = value;
    });
    return obj;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-3xl font-bold tracking-tight text-white">Applications</h2>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Syncing</span>
          </div>
        </div>
        <p className="text-slate-400">Manage your high-performance application fleet.</p>
      </div>

      <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
        {[
          { id: 'fleet', label: 'App Fleet', icon: LayoutGrid },
          { id: 'deploy', label: 'New Deployment', icon: Ship },
          { id: 'infrastructure', label: 'Infrastructure', icon: ServerCog },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              activeTab === tab.id
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'fleet' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-2 duration-300">
          {apps?.length === 0 ? (
            <Card className="col-span-full p-12 flex flex-col items-center justify-center text-center gap-4 border-dashed border-2">
              <Rocket className="w-12 h-12 text-slate-700" />
              <div>
                <h4 className="text-xl font-bold text-white">No applications yet</h4>
                <p className="text-slate-400 max-w-sm mx-auto mt-2">Deploy your first application from GitHub to see it listed here.</p>
              </div>
              <Button onClick={() => setActiveTab('deploy')} className="mt-4">Deploy Now</Button>
            </Card>
          ) : (
            apps?.map((app) => (
              <Card key={app.id} className="p-6 group hover:border-slate-700 transition-colors">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-4">
                    <div className="bg-slate-800 p-3 rounded-xl group-hover:bg-indigo-500/10 group-hover:text-indigo-500 transition-colors">
                      {app.app_type === 'static' ? <Globe className="w-6 h-6" /> : <Box className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{app.name}</h3>
                      <p className="text-xs text-slate-500 font-mono mt-1 opacity-60 truncate max-w-[200px]">{app.repo_url}</p>
                    </div>
                  </div>
                  <Badge variant={
                    app.status === 'running' || app.status === 'static' ? 'success' :
                    app.status === 'deploying' || app.status === 'pending' ? 'info' :
                    app.status === 'failed' ? 'error' : 'neutral'
                  }>
                    {app.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-slate-800/30 border border-slate-800/50 p-3 rounded-xl">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Port</p>
                    <p className="text-sm font-medium text-slate-200">{app.port}</p>
                  </div>
                  <div className="bg-slate-800/30 border border-slate-800/50 p-3 rounded-xl">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Domain</p>
                    <p className="text-sm font-medium text-slate-200 truncate">{app.domain || `${app.name}.localhost`}</p>
                  </div>
                  <div className="bg-slate-800/30 border border-slate-800/50 p-3 rounded-xl">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Type</p>
                    <p className="text-sm font-medium text-slate-200">{app.app_type}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => viewAppDetails(app.name)}
                  >
                    <Eye className="w-4 h-4" />
                    Details
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => window.open(`http://${app.domain || `${app.name}.localhost`}`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-slate-500 hover:text-rose-500 hover:bg-rose-500/10"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this app?')) {
                        deleteMutation.mutate(app.name);
                      }
                    }}
                    isLoading={deleteMutation.isPending && deleteMutation.variables === app.name}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'deploy' && (
        <div className="max-w-2xl mx-auto animate-in zoom-in-95 duration-300">
          <Card className="p-8 border-slate-700 shadow-2xl">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-white mb-2">Deploy Application</h3>
              <div className="flex gap-4 mt-4">
                {[1, 2].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-indigo-500' : 'bg-slate-800'}`} />
                ))}
              </div>
            </div>

            {step === 1 ? (
              <form onSubmit={(e) => { e.preventDefault(); scanMutation.mutate(repoUrl); }} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">GitHub Repository URL</label>
                  <div className="relative">
                    <Code className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="https://github.com/user/repo or git@github.com:user/repo.git"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full py-3" isLoading={scanMutation.isPending}>
                  Scan Repository
                </Button>
              </form>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                deployMutation.mutate({
                  ...formData,
                  repo_url: repoUrl,
                  scan_id: scanData?.scan_id,
                  env_vars: envVarsToObject(),
                });
              }} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-400 mb-2">Application Name</label>
                    <input
                      type="text"
                      required
                      pattern="^[a-zA-Z0-9-]+$"
                      placeholder="my-cool-app"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Port</label>
                    <input
                      type="number"
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Subfolder</label>
                    <select
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                      value={formData.subfolder}
                      onChange={(e) => setFormData({ ...formData, subfolder: e.target.value })}
                    >
                      <option value="">Root folder</option>
                      {scanData?.folders.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Environment Variables */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-400">
                      <Variable className="w-4 h-4" />
                      Environment Variables
                    </label>
                    <button
                      type="button"
                      onClick={() => setEnvVars([...envVars, { key: '', value: '' }])}
                      className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Variable
                    </button>
                  </div>
                  {envVars.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No environment variables set. Click "Add Variable" to configure.</p>
                  ) : (
                    <div className="space-y-2">
                      {envVars.map((env, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder="KEY"
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                            value={env.key}
                            onChange={(e) => {
                              const updated = [...envVars];
                              updated[index].key = e.target.value;
                              setEnvVars(updated);
                            }}
                          />
                          <span className="text-slate-600">=</span>
                          <input
                            type="text"
                            placeholder="value"
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                            value={env.value}
                            onChange={(e) => {
                              const updated = [...envVars];
                              updated[index].value = e.target.value;
                              setEnvVars(updated);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setEnvVars(envVars.filter((_, i) => i !== index))}
                            className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button type="button" variant="secondary" onClick={() => setStep(1)} className="flex-1">Back</Button>
                  <Button type="submit" className="flex-[2]" isLoading={deployMutation.isPending}>Launch Deployment</Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'infrastructure' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
          <Card className="p-8 border-amber-500/20 bg-amber-500/5">
            <div className="flex gap-4">
              <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
              <div>
                <h3 className="text-xl font-bold text-white">Resource Isolation</h3>
                <p className="text-slate-400 mt-2">
                  Nexus currently runs applications as systemd services under the host user. 
                  Port conflicts are prevented at the database level.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nginx Status</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-sm text-slate-200">Proxy Engine Online</span>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Storage Root</p>
                    <p className="text-sm text-slate-200 mt-2 font-mono">/srv/apps/</p>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Apps</p>
                    <p className="text-sm text-slate-200 mt-2 font-bold">{totalApps} deployed</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* App Detail Modal — uses GET /apps/{name} */}
      <Modal open={!!detailApp} onClose={() => setDetailApp(null)} title={detailApp?.name || 'App Details'}>
        {detailLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        ) : detailApp && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Badge variant={
                (detailApp.status === 'running' || detailApp.status === 'static') ? 'success' :
                detailApp.status === 'failed' ? 'error' :
                detailApp.status === 'deploying' ? 'warning' : 'neutral'
              }>{detailApp.status}</Badge>
              <Badge variant={detailApp.app_type === 'static' ? 'info' : 'neutral'}>{detailApp.app_type}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Repository', value: detailApp.repo_url, mono: true },
                { label: 'Port', value: detailApp.port },
                { label: 'Domain', value: detailApp.domain || `${detailApp.name}.localhost` },
                { label: 'Subfolder', value: detailApp.subfolder || '/' },
                { label: 'App Type', value: detailApp.app_type },
                { label: 'Created', value: new Date(detailApp.created_at).toLocaleString() },
              ].map((item) => (
                <div key={item.label} className={cn("bg-slate-800/30 border border-slate-800/50 p-4 rounded-xl", item.label === 'Repository' && 'col-span-2')}>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{item.label}</p>
                  <p className={cn("text-sm text-slate-200", item.mono && "font-mono text-xs break-all")}>{String(item.value)}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => window.open(`http://${detailApp.domain || `${detailApp.name}.localhost`}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
                Open Application
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (confirm(`Delete ${detailApp.name}?`)) {
                    deleteMutation.mutate(detailApp.name);
                    setDetailApp(null);
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
