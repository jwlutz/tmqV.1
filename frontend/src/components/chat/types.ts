export interface ToolStatus {
  name: string;
  status: 'running' | 'complete';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolStatus?: ToolStatus;
}
