import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/Toast';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Applications } from './pages/Applications';
import { Services } from './pages/Services';
import { SystemLogs } from './pages/SystemLogs';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <div className="flex min-h-screen bg-slate-950 text-slate-200">
            <Sidebar />
            <main className="flex-1 overflow-auto p-8 relative">
              <div className="max-w-7xl mx-auto h-full">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/apps" element={<Applications />} />
                  <Route path="/services" element={<Services />} />
                  <Route path="/logs" element={<SystemLogs />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </main>
          </div>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
