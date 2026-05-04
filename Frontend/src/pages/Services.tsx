import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../api';
import { Card, Button, Badge } from '../components/UI';
import { useToast } from '../components/Toast';
import { 
  Play, 
  Square, 
  RotateCw, 
  Trash2, 
  Terminal, 
  Power, 
  PowerOff, 
  List, 
  PlusCircle,
  Settings2,
  Activity,
  AlertCircle,
  ScrollText
} from 'lucide-react';
import { Service } from '../types';
import { cn } from '../utils/cn';

export const Services = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'management'>('list');
  const [newServiceName, setNewServiceName] = useState('');

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: apiService.getServices,
    refetchInterval: 5000,
  });

  const actionMutation = useMutation({
    mutationFn: ({ name, action }: { name: string; action: string }) => {
      switch (action) {
        case 'start': return apiService.startService(name);
        case 'stop': return apiService.stopService(name);
        case 'restart': return apiService.restartService(name);
        case 'enable': return apiService.enableService(name);
        case 'disable': return apiService.disableService(name);
        case 'delete': return apiService.deleteService(name);
        default: return Promise.reject('Invalid action');
      }
    },
    onSuccess: (data, variables) => {
      if (data.error) {
        toast(data.error, 'error');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['services'] });
      const labels: Record<string, string> = {
        start: 'started', stop: 'stopped', restart: 'restarted',
        enable: 'enabled on boot', disable: 'disabled on boot', delete: 'removed',
      };
      toast(`${variables.name} ${labels[variables.action] || variables.action}`, 'success');
    },
    onError: (_, variables) => toast(`Failed to ${variables.action} ${variables.name}`, 'error'),
  });

  const addMutation = useMutation({
    mutationFn: apiService.addService,
    onSuccess: (data) => {
      if (data.error) {
        toast(data.error, 'error');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setActiveTab('list');
      toast(`Service "${newServiceName}" registered`, 'success');
      setNewServiceName('');
    },
    onError: () => toast('Failed to register service', 'error'),
  });

  const tabs = [
    { id: 'list', label: 'All Services', icon: List },
    { id: 'management', label: 'Boot Management', icon: Settings2 },
    { id: 'add', label: 'Register New', icon: PlusCircle },
  ] as const;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-3xl font-bold tracking-tight text-white">System Services</h2>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Active Monitor</span>
          </div>
        </div>
        <p className="text-slate-400">Manage and monitor systemd services running on your node.</p>
      </div>

      <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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

      <div className="min-h-[400px]">
        {activeTab === 'list' && (
          <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-bottom-2 duration-300">
            {services?.length === 0 ? (
              <Card className="p-12 text-center border-dashed border-2">
                <Terminal className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white">No services tracked</h3>
                <p className="text-slate-400 mt-2">Register a systemd service to start managing it.</p>
                <Button onClick={() => setActiveTab('add')} className="mt-6">Register First Service</Button>
              </Card>
            ) : (
              services?.map((service) => (
                <Card key={service.id} className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-xl transition-colors",
                      service.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'
                    )}>
                      <Activity className={cn("w-6 h-6", service.status === 'active' && "animate-pulse")} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-white text-lg">{service.name}</h3>
                        <Badge variant={service.status === 'active' ? 'success' : 'neutral'}>
                          {service.status}
                        </Badge>
                        {service.enabled && (
                          <Badge variant="info">boot</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 font-mono uppercase tracking-widest">systemd process</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {/* View Logs shortcut */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10"
                      onClick={() => navigate('/logs')}
                      title="View Logs"
                    >
                      <ScrollText className="w-4 h-4" />
                    </Button>

                    {service.status === 'active' ? (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => actionMutation.mutate({ name: service.name, action: 'stop' })}
                        isLoading={actionMutation.isPending && actionMutation.variables?.name === service.name && actionMutation.variables?.action === 'stop'}
                      >
                        <Square className="w-4 h-4 fill-current" />
                        Stop
                      </Button>
                    ) : (
                      <Button 
                        variant="primary" 
                        size="sm" 
                        onClick={() => actionMutation.mutate({ name: service.name, action: 'start' })}
                        isLoading={actionMutation.isPending && actionMutation.variables?.name === service.name && actionMutation.variables?.action === 'start'}
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Start
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => actionMutation.mutate({ name: service.name, action: 'restart' })}
                      isLoading={actionMutation.isPending && actionMutation.variables?.name === service.name && actionMutation.variables?.action === 'restart'}
                      title="Restart Service"
                    >
                      <RotateCw className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'management' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            <Card className="p-6 bg-indigo-600/5 border-indigo-500/20">
              <div className="flex gap-4 items-start text-indigo-400">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <div>
                  <h4 className="font-bold text-white">Boot Management</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    Enable or disable services to control whether they start automatically when the system boots.
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4">
              {services?.map((service) => (
                <Card key={service.id} className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-2.5 rounded-lg",
                      service.enabled ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-800 text-slate-600'
                    )}>
                      {service.enabled ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{service.name}</h3>
                      <p className="text-xs text-slate-500">Currently {service.enabled ? 'Enabled' : 'Disabled'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {service.enabled ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-rose-500/20 text-rose-500 hover:bg-rose-500/10 hover:border-rose-500"
                        onClick={() => actionMutation.mutate({ name: service.name, action: 'disable' })}
                        isLoading={actionMutation.isPending && actionMutation.variables?.name === service.name && actionMutation.variables?.action === 'disable'}
                      >
                        <PowerOff className="w-4 h-4" />
                        Disable on Boot
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500"
                        onClick={() => actionMutation.mutate({ name: service.name, action: 'enable' })}
                        isLoading={actionMutation.isPending && actionMutation.variables?.name === service.name && actionMutation.variables?.action === 'enable'}
                      >
                        <Power className="w-4 h-4" />
                        Enable on Boot
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-slate-500 hover:text-rose-500"
                      onClick={() => {
                        if (confirm('Delete service from Nexus tracking?')) {
                          actionMutation.mutate({ name: service.name, action: 'delete' });
                        }
                      }}
                      isLoading={actionMutation.isPending && actionMutation.variables?.name === service.name && actionMutation.variables?.action === 'delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'add' && (
          <div className="max-w-2xl mx-auto animate-in zoom-in-95 duration-300">
            <Card className="p-8 border-slate-700 shadow-2xl">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">Register System Service</h3>
                <p className="text-slate-400 text-sm">
                  Add an existing systemd service to Nexus to manage it from this dashboard. 
                  This will not create a new service, only track an existing one.
                </p>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                addMutation.mutate({ name: newServiceName, enabled: true });
              }} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Service Identifier</label>
                  <div className="relative">
                    <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. nginx, postgresql, docker"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 italic">
                    Note: The service must already exist in your system's systemd directory.
                  </p>
                </div>
                
                <div className="pt-4 flex gap-4">
                  <Button type="button" variant="secondary" onClick={() => setActiveTab('list')} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-[2]" isLoading={addMutation.isPending}>
                    Register Service
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
