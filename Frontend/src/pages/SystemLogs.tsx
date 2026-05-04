import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService, getWSUrl } from '../api';
import { Card, Button } from '../components/UI';
import { useToast } from '../components/Toast';
import { 
  Terminal, 
  Download, 
  Trash2, 
  StopCircle, 
  PlayCircle, 
  Cpu, 
  ShieldAlert, 
  Layers,
  Search
} from 'lucide-react';
import { Service } from '../types';
import { cn } from '../utils/cn';

export const SystemLogs = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'services' | 'nginx' | 'deployment'>('services');
  const [selectedService, setSelectedService] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const ws = useRef<WebSocket | null>(null);

  const { data: services } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: apiService.getServices,
  });

  useEffect(() => {
    if (services && services.length > 0 && !selectedService) {
      setSelectedService(services[0].name);
    }
  }, [services, selectedService]);

  const connectToLogs = (target?: any) => {
    const serviceToStream = typeof target === 'string' ? target : selectedService;
    if (!serviceToStream) {
      toast('Select a service first', 'warning');
      return;
    }
    if (ws.current) ws.current.close();
    setLogs([]);
    
    const url = getWSUrl(`/logs/${serviceToStream}`);
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setIsConnected(true);
      if (serviceToStream !== 'nexus') {
        toast(`Connected to ${serviceToStream} logs`, 'success');
      }
    };
    ws.current.onclose = () => setIsConnected(false);
    ws.current.onerror = () => toast('WebSocket connection failed', 'error');
    ws.current.onmessage = (event) => {
      setLogs((prev) => [...prev, event.data].slice(-500));
    };
  };

  const disconnectLogs = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setIsConnected(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const filteredLogs = logs.filter(log => 
    log.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Export logs as text file
  const exportLogs = useCallback(() => {
    if (logs.length === 0) {
      toast('No logs to export', 'warning');
      return;
    }
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-logs-${selectedService || activeTab}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`Exported ${logs.length} log lines`, 'success');
  }, [logs, selectedService, activeTab, toast]);

  const tabs = [
    { id: 'services', label: 'Service Logs', icon: Cpu },
    { id: 'nginx', label: 'Nginx Traffic', icon: ShieldAlert },
    { id: 'deployment', label: 'Deployment Logs', icon: Layers },
  ] as const;

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Observability</h2>
          <p className="text-slate-400">Deep system inspection and real-time event streaming.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between gap-4 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                disconnectLogs();
                setLogs([]);
                if (tab.id === 'deployment') {
                  setTimeout(() => connectToLogs('nexus'), 50);
                } else if (tab.id === 'nginx') {
                  setTimeout(() => connectToLogs('nginx'), 50);
                }
              }}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200",
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

        <div className="flex gap-2 items-center px-2 pb-1 md:pb-0">
          {activeTab === 'services' && (
            <>
              <select
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={selectedService}
                onChange={(e) => {
                  setSelectedService(e.target.value);
                  disconnectLogs();
                  setLogs([]);
                }}
              >
                {services?.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              {!isConnected ? (
                <Button size="sm" onClick={connectToLogs} className="gap-2">
                  <PlayCircle className="w-4 h-4" />
                  Connect
                </Button>
              ) : (
                <Button size="sm" variant="danger" onClick={disconnectLogs} className="gap-2">
                  <StopCircle className="w-4 h-4" />
                  Kill Stream
                </Button>
              )}
            </>
          )}
        </div>
      </div>



      <Card className="flex-1 bg-[#010409] border-slate-800 flex flex-col min-h-0 shadow-2xl relative overflow-hidden">
        {/* Log Header/Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-mono text-slate-300">
                {activeTab === 'services' ? `journalctl -u ${selectedService}` : activeTab === 'nginx' ? 'tail -f /var/log/nginx/access.log' : 'journalctl -u nexus'}
              </span>
            </div>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
              <input 
                type="text" 
                placeholder="Filter logs..."
                className="w-full bg-slate-950 border border-slate-800 rounded-md py-1 pl-8 pr-3 text-[11px] text-slate-400 focus:outline-none focus:border-indigo-500/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => { setLogs([]); toast('Terminal cleared', 'info'); }}
              className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-400/10 rounded-md transition-all"
              title="Clear Terminal"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button 
              onClick={exportLogs}
              className="p-1.5 text-slate-600 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-all"
              title="Export Logs"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Terminal Area */}
        <div 
          ref={scrollRef}
          className="flex-1 p-6 overflow-y-auto font-mono text-[12px] leading-relaxed custom-scrollbar"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-3">
              <div className={cn("p-4 rounded-full bg-slate-900/50", isConnected && "animate-pulse")}>
                <Terminal className="w-8 h-8 opacity-40" />
              </div>
              <p className="text-sm font-medium tracking-wide">
                {isConnected ? 'Awaiting incoming log stream...' : activeTab === 'services' ? 'Terminal offline. Select a service and connect.' : 'Connecting to Nexus Engine...'}
              </p>
            </div>
          ) : (
            filteredLogs.map((log, i) => (
              <div key={i} className="group flex gap-4 hover:bg-indigo-500/5 -mx-6 px-6 py-0.5 border-l-2 border-transparent hover:border-indigo-500/50 transition-colors">
                <span className="text-slate-800 select-none w-10 text-right font-bold">{i + 1}</span>
                <span className="text-slate-300 break-all whitespace-pre-wrap flex-1">{log}</span>
              </div>
            ))
          )}
        </div>

        {/* Status Bar */}
        <div className="px-4 py-1.5 border-t border-slate-800 bg-slate-900/80 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500")} />
              <span className="text-[10px] uppercase font-bold text-slate-500">{isConnected ? 'Socket Connected' : 'Disconnected'}</span>
            </div>
            <span className="text-[10px] text-slate-600 font-mono">Buffer: {logs.length}/500 lines</span>
          </div>
          <div className="text-[10px] text-slate-600 italic">
            Nexus Journaling Engine v1.1
          </div>
        </div>
      </Card>
    </div>
  );
};
