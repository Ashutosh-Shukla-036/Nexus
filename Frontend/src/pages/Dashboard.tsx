import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import { Card, Badge } from '../components/UI';
import { useToast } from '../components/Toast';
import { Activity, Cpu, HardDrive, MemoryStick, TrendingUp, ShieldCheck, History, RefreshCw, Box, Server } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Metric, App, Service } from '../types';
import { cn } from '../utils/cn';

export const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'uptime'>('overview');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: metrics, isLoading } = useQuery<Metric[]>({
    queryKey: ['metrics'],
    queryFn: apiService.getMetrics,
    refetchInterval: 5000,
  });

  const { data: apps } = useQuery<App[]>({
    queryKey: ['apps'],
    queryFn: apiService.getApps,
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: apiService.getServices,
  });

  const collectMutation = useMutation({
    mutationFn: apiService.collectMetrics,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      toast(`Metrics collected — CPU: ${data.cpu.toFixed(1)}%, RAM: ${data.ram.toFixed(1)}%`, 'success');
    },
    onError: () => toast('Failed to collect metrics', 'error'),
  });

  const currentMetric = metrics?.[0] || { cpu: 0, ram: 0, disk: 0 };
  
  const chartData = [...(metrics || [])].reverse().map(m => ({
    time: new Date(m.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cpu: m.cpu,
    ram: m.ram,
    disk: m.disk
  }));

  // Real quick stats
  const runningApps = apps?.filter(a => a.status === 'running' || a.status === 'static').length ?? 0;
  const totalApps = apps?.length ?? 0;
  const activeServices = services?.filter(s => s.status === 'active').length ?? 0;
  const totalServices = services?.length ?? 0;

  const stats = [
    { label: 'CPU Load', value: `${currentMetric.cpu.toFixed(1)}%`, icon: Cpu, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { label: 'Memory', value: `${currentMetric.ram.toFixed(1)}%`, icon: MemoryStick, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Storage', value: `${currentMetric.disk.toFixed(1)}%`, icon: HardDrive, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-3xl font-bold tracking-tight text-white">Nexus Node</h2>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 ml-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Live</span>
            </div>
          </div>
          <p className="text-slate-400">System orchestration and health monitoring.</p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => collectMutation.mutate()}
            disabled={collectMutation.isPending}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
              "border-slate-700 text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400",
              collectMutation.isPending && "opacity-50"
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", collectMutation.isPending && "animate-spin")} />
            Collect Now
          </button>
          <Badge variant="success">{runningApps}/{totalApps} Apps</Badge>
          <Badge variant="info">{activeServices}/{totalServices} Services</Badge>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'detailed', label: 'Resource Analysis', icon: History },
          { id: 'uptime', label: 'Fleet Status', icon: ShieldCheck },
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

      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat) => (
              <Card key={stat.label} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <Activity className="w-4 h-4 text-slate-700" />
                </div>
                <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                <h3 className="text-2xl font-bold text-white mt-1">{stat.value}</h3>
              </Card>
            ))}
          </div>

          <Card className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-white">Consolidated Load</h3>
                <p className="text-slate-400 text-sm">Aggregated system performance trends.</p>
              </div>
              <span className="text-xs text-slate-600 font-mono">{metrics?.length ?? 0} data points</span>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="cpu" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                  <Area type="monotone" dataKey="ram" stroke="#10b981" strokeWidth={2} fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'detailed' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-2 duration-300">
          <Card className="p-6">
            <h4 className="text-lg font-bold text-white mb-6">CPU Performance Breakdown</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                  <Line type="monotone" dataKey="cpu" stroke="#6366f1" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-6">
            <h4 className="text-lg font-bold text-white mb-6">Memory (RAM) Usage Analysis</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                  <Line type="monotone" dataKey="ram" stroke="#10b981" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="lg:col-span-2 p-6">
            <h4 className="text-lg font-bold text-white mb-6">Storage Growth (Last Hour)</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                  <Area type="stepAfter" dataKey="disk" stroke="#f59e0b" fill="#f59e0b20" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'uptime' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
          {/* Apps status */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-indigo-500/10 p-2.5 rounded-xl">
                <Box className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <h4 className="font-bold text-white">Deployed Applications</h4>
                <p className="text-xs text-slate-500">{totalApps} total · {runningApps} healthy</p>
              </div>
            </div>
            {apps && apps.length > 0 ? (
              <div className="space-y-2">
                {apps.map(app => (
                  <div key={app.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-800/30 border border-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        (app.status === 'running' || app.status === 'static') ? "bg-emerald-500" :
                        app.status === 'deploying' ? "bg-amber-500 animate-pulse" :
                        app.status === 'failed' ? "bg-rose-500" : "bg-slate-600"
                      )} />
                      <span className="text-sm font-medium text-slate-200">{app.name}</span>
                      <Badge variant={app.app_type === 'static' ? 'info' : 'neutral'}>{app.app_type}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500">:{app.port}</span>
                      <Badge variant={
                        (app.status === 'running' || app.status === 'static') ? 'success' :
                        app.status === 'failed' ? 'error' :
                        app.status === 'deploying' ? 'warning' : 'neutral'
                      }>{app.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No applications deployed yet.</p>
            )}
          </Card>

          {/* Services status */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-emerald-500/10 p-2.5 rounded-xl">
                <Server className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h4 className="font-bold text-white">Tracked Services</h4>
                <p className="text-xs text-slate-500">{totalServices} total · {activeServices} active</p>
              </div>
            </div>
            {services && services.length > 0 ? (
              <div className="space-y-2">
                {services.map(svc => (
                  <div key={svc.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-800/30 border border-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        svc.status === 'active' ? "bg-emerald-500" : "bg-slate-600"
                      )} />
                      <span className="text-sm font-medium text-slate-200">{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={svc.enabled ? 'info' : 'neutral'}>{svc.enabled ? 'enabled' : 'disabled'}</Badge>
                      <Badge variant={svc.status === 'active' ? 'success' : 'neutral'}>{svc.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No services tracked yet.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
