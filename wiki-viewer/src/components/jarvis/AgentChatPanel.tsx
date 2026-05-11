import { useAgentChatStore } from '@/stores/agentChatStore';
import { useAgentChat } from '@/hooks/useAgentChat';
import { GoalInput } from './GoalInput';
import { ExecutionPanel } from './ExecutionPanel';

export function AgentChatPanel() {
  const { connect } = useAgentChat();
  const isConnected = useAgentChatStore((s) => s.isConnected);
  const current = useAgentChatStore((s) => s.currentExecution);

  const handleSubmit = (description: string, strategy: string) => {
    connect({ description, strategy });
  };

  return (
    <div className="space-y-4">
      <GoalInput onSubmit={handleSubmit} isLoading={isConnected} />
      {current && <ExecutionPanel />}
    </div>
  );
}
