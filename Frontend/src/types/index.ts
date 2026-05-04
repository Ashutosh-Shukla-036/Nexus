export interface App {
  id: string;
  name: string;
  repo_url: string;
  port: number;
  domain: string | null;
  subfolder: string | null;
  status: 'stopped' | 'pending' | 'deploying' | 'running' | 'static' | 'failed';
  app_type: 'service' | 'static';
  created_at: string;
}

export interface Metric {
  id: string;
  cpu: number;
  ram: number;
  disk: number;
  recorded_at: string;
}

export interface Service {
  id: string;
  name: string;
  enabled: boolean;
  status: 'active' | 'inactive' | 'failed' | string;
}

export interface UptimeCheck {
  id: string;
  app_id: string;
  status_code: number;
  response_time: number;
  checked_at: string;
}

export interface ScanResponse {
  status: string;
  scan_id: string;
  folders: string[];
}

export interface DeployRequest {
  name: string;
  repo_url: string;
  port: number;
  scan_id: string;
  subfolder?: string;
  env_vars?: Record<string, string>;
}
