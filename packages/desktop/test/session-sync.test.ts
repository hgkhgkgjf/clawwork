import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncFromGateway } from '../src/renderer/lib/session-sync';
import { useTaskStore } from '../src/renderer/stores/taskStore';
import { useMessageStore } from '../src/renderer/stores/messageStore';

describe('syncFromGateway', () => {
  beforeEach(() => {
    useTaskStore.setState({ tasks: [], activeTaskId: null, hydrated: false });
    useMessageStore.setState({
      messagesByTask: {},
      streamingByTask: {},
      streamingThinkingByTask: {},
      processingTasks: new Set(),
      highlightedMessageId: null,
    });

    const windowWithClawwork = (globalThis.window ??= {} as typeof globalThis.window) as Window & {
      clawwork: {
        syncSessions: ReturnType<typeof vi.fn>;
        persistTask: ReturnType<typeof vi.fn>;
        persistTaskUpdate: ReturnType<typeof vi.fn>;
        loadMessages: ReturnType<typeof vi.fn>;
        persistMessage: ReturnType<typeof vi.fn>;
      };
    };
    windowWithClawwork.clawwork = {
      syncSessions: vi.fn(),
      persistTask: vi.fn().mockResolvedValue({ ok: true }),
      persistTaskUpdate: vi.fn().mockResolvedValue({ ok: true }),
      loadMessages: vi.fn().mockResolvedValue({ ok: true, rows: [] }),
      persistMessage: vi.fn().mockResolvedValue({ ok: true }),
    };
  });

  it('filters gateway-injected model values from discovered session metadata', async () => {
    window.clawwork.syncSessions.mockResolvedValue({
      ok: true,
      discovered: [
        {
          gatewayId: 'gw-1',
          taskId: 'task-1',
          sessionKey: 'agent:main:clawwork:task:task-1',
          title: 'Task 1',
          updatedAt: '2026-03-16T00:00:00.000Z',
          agentId: 'main',
          model: 'gateway-injected',
          modelProvider: 'openclaw',
          thinkingLevel: 'medium',
          inputTokens: 1,
          outputTokens: 2,
          contextTokens: 3,
          messages: [],
        },
      ],
    });

    await syncFromGateway();

    const task = useTaskStore.getState().tasks[0];
    expect(task).toBeTruthy();
    expect(task.model).toBeUndefined();
    expect(task.modelProvider).toBe('openclaw');
    expect(window.clawwork.persistTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        model: undefined,
        modelProvider: 'openclaw',
      }),
    );
  });
});
