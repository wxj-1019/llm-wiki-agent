import { create } from 'zustand';

export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'awaiting_approval';

export interface ReasoningStep {
  text: string;
  evidence?: string;
}

export interface AlternativeAction {
  label: string;
  description?: string;
}

export interface AgentStep {
  id: string;
  tool_name: string;
  params: Record<string, unknown>;
  status: AgentStepStatus;
  risk_level?: string;
  confidence?: number;
  reasoning?: ReasoningStep[];
  alternatives?: AlternativeAction[];
  decision?: string;
  result?: {
    success: boolean;
    data?: unknown;
    error?: string;
    duration_ms?: number;
  };
}

export interface AgentToolCall {
  step_id: string;
  tool_name: string;
  params: Record<string, unknown>;
  status: 'running' | 'success' | 'failed' | 'awaiting_approval';
  result?: string;
  duration_ms?: number;
}

export interface AgentReflection {
  text: string;
  timestamp: number;
}

export interface PendingApproval {
  req_id: string;
  step_id: string;
  tool_name: string;
  params: Record<string, unknown>;
  risk_level: string;
  reason: string;
  created_at: number;
}

export interface AgentExecutionState {
  session_id: string;
  goal: string;
  strategy: string;
  status: 'idle' | 'planning' | 'executing' | 'reflecting' | 'summarizing' | 'done' | 'error';
  steps: AgentStep[];
  tool_calls: AgentToolCall[];
  reflections: AgentReflection[];
  content: string;
  error: string | null;
  started_at: number;
  finished_at: number | null;
}

interface AgentChatState {
  executions: AgentExecutionState[];
  currentExecution: AgentExecutionState | null;
  isConnected: boolean;
  pendingApprovals: PendingApproval[];
  history: AgentExecutionState[];
  historyLoading: boolean;
  startExecution: (goal: string, strategy: string) => AgentExecutionState;
  updateExecution: (sessionId: string, partial: Partial<AgentExecutionState>) => void;
  addStep: (sessionId: string, step: AgentStep) => void;
  updateStep: (sessionId: string, stepId: string, partial: Partial<AgentStep>) => void;
  addToolCall: (sessionId: string, call: AgentToolCall) => void;
  updateToolCall: (sessionId: string, stepId: string, partial: Partial<AgentToolCall>) => void;
  addReflection: (sessionId: string, reflection: AgentReflection) => void;
  setContent: (sessionId: string, content: string) => void;
  setError: (sessionId: string, error: string) => void;
  setDone: (sessionId: string) => void;
  setConnected: (connected: boolean) => void;
  clearCurrent: () => void;
  addPendingApproval: (approval: PendingApproval) => void;
  removePendingApproval: (reqId: string) => void;
  loadHistory: () => Promise<void>;
  setHistory: (history: AgentExecutionState[]) => void;
}

export const useAgentChatStore = create<AgentChatState>((set, get) => ({
  executions: [],
  currentExecution: null,
  isConnected: false,
  pendingApprovals: [],
  history: [],
  historyLoading: false,

  startExecution: (goal, strategy) => {
    const session_id = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const exec: AgentExecutionState = {
      session_id,
      goal,
      strategy,
      status: 'planning',
      steps: [],
      tool_calls: [],
      reflections: [],
      content: '',
      error: null,
      started_at: Date.now(),
      finished_at: null,
    };
    set((state) => ({
      executions: [exec, ...state.executions],
      currentExecution: exec,
      isConnected: true,
    }));
    return exec;
  },

  updateExecution: (sessionId, partial) => {
    set((state) => {
      const executions = state.executions.map((e) =>
        e.session_id === sessionId ? { ...e, ...partial } : e
      );
      const currentExecution = state.currentExecution?.session_id === sessionId
        ? { ...state.currentExecution, ...partial }
        : state.currentExecution;
      return { executions, currentExecution };
    });
  },

  addStep: (sessionId, step) => {
    set((state) => {
      const updateExec = (e: AgentExecutionState) =>
        e.session_id === sessionId ? { ...e, steps: [...e.steps, step] } : e;
      return {
        executions: state.executions.map(updateExec),
        currentExecution: state.currentExecution ? updateExec(state.currentExecution) : null,
      };
    });
  },

  updateStep: (sessionId, stepId, partial) => {
    set((state) => {
      const updateExec = (e: AgentExecutionState) =>
        e.session_id === sessionId
          ? { ...e, steps: e.steps.map((s) => (s.id === stepId ? { ...s, ...partial } : s)) }
          : e;
      return {
        executions: state.executions.map(updateExec),
        currentExecution: state.currentExecution ? updateExec(state.currentExecution) : null,
      };
    });
  },

  addToolCall: (sessionId, call) => {
    set((state) => {
      const updateExec = (e: AgentExecutionState) =>
        e.session_id === sessionId ? { ...e, tool_calls: [...e.tool_calls, call] } : e;
      return {
        executions: state.executions.map(updateExec),
        currentExecution: state.currentExecution ? updateExec(state.currentExecution) : null,
      };
    });
  },

  updateToolCall: (sessionId, stepId, partial) => {
    set((state) => {
      const updateExec = (e: AgentExecutionState) =>
        e.session_id === sessionId
          ? { ...e, tool_calls: e.tool_calls.map((c) => (c.step_id === stepId ? { ...c, ...partial } : c)) }
          : e;
      return {
        executions: state.executions.map(updateExec),
        currentExecution: state.currentExecution ? updateExec(state.currentExecution) : null,
      };
    });
  },

  addReflection: (sessionId, reflection) => {
    set((state) => {
      const updateExec = (e: AgentExecutionState) =>
        e.session_id === sessionId ? { ...e, reflections: [...e.reflections, reflection] } : e;
      return {
        executions: state.executions.map(updateExec),
        currentExecution: state.currentExecution ? updateExec(state.currentExecution) : null,
      };
    });
  },

  setContent: (sessionId, content) => {
    set((state) => {
      const updateExec = (e: AgentExecutionState) =>
        e.session_id === sessionId ? { ...e, content } : e;
      return {
        executions: state.executions.map(updateExec),
        currentExecution: state.currentExecution ? updateExec(state.currentExecution) : null,
      };
    });
  },

  setError: (sessionId, error) => {
    set((state) => {
      const updateExec = (e: AgentExecutionState) =>
        e.session_id === sessionId ? { ...e, error, status: 'error' as const } : e;
      return {
        executions: state.executions.map(updateExec),
        currentExecution: state.currentExecution ? updateExec(state.currentExecution) : null,
      };
    });
  },

  setDone: (sessionId) => {
    set((state) => {
      const updateExec = (e: AgentExecutionState) =>
        e.session_id === sessionId ? { ...e, status: 'done' as const, finished_at: Date.now() } : e;
      return {
        executions: state.executions.map(updateExec),
        currentExecution: state.currentExecution ? updateExec(state.currentExecution) : null,
        isConnected: false,
      };
    });
  },

  setConnected: (connected) => set({ isConnected: connected }),

  clearCurrent: () => set({ currentExecution: null, isConnected: false }),

  addPendingApproval: (approval) => {
    set((state) => ({
      pendingApprovals: [...state.pendingApprovals, approval],
    }));
  },

  removePendingApproval: (reqId) => {
    set((state) => ({
      pendingApprovals: state.pendingApprovals.filter((a) => a.req_id !== reqId),
    }));
  },

  loadHistory: async () => {
    set({ historyLoading: true });
    try {
      const res = await fetch('/api/jarvis/executions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const executions = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      set({ history: executions, historyLoading: false });
    } catch {
      set({ historyLoading: false });
    }
  },

  setHistory: (history) => set({ history }),
}));