import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Server, Box, Terminal, Activity } from 'lucide-react';
import { apiService } from '../api';
import { cn } from '../utils/cn';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Box, label: 'Applications', path: '/apps' },
  { icon: Server, label: 'Services', path: '/services' },
  { icon: Terminal, label: 'System Logs', path: '/logs' },
];

export const Sidebar = () => {
  // Live health check — polls every 10s
  const { data: health, isError } = useQuery({
    queryKey: ['health'],
    queryFn: apiService.getHealth,
    refetchInterval: 10000,
    retry: 1,
  });

  const isOnline = health?.status === 'ok' && !isError;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-lg">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Nexus</h1>
          <p className="text-xs text-slate-400">Self-Hosted PaaS</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive
                  ? "bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 shadow-[0_0_15px_rgba(79,70,229,0.1)]"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            )} />
            <span className="text-xs font-medium text-slate-300">
              {isOnline ? 'System Online' : 'System Offline'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
            Node: localhost:8000
          </p>
        </div>
      </div>
    </aside>
  );
};
