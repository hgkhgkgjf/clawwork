# feat: Session Reset & Delete

> Branch: `feat/session-reset`
> Priority: P0 — critical for daily usage
> PR Target: `main`

## Summary

Add ability to reset (clear context) or delete a Task's Gateway session. Without this, users have no way to handle context overflow or clean up stale tasks — they can only create new ones.

## Why This Matters

1. Long conversations hit the Agent's context window limit → Agent degrades or errors
2. Gateway auto-resets sessions at 4 AM — users don't know this happens and get confused when context disappears
3. "Start fresh on this task" is a basic operation that's currently impossible
4. Deleting completed tasks should clean up the server-side session too

## Gateway RPC Methods

### `sessions.reset`

```typescript
// Request
{
  key: string,              // sessionKey, e.g. "agent:main:clawwork:task:<taskId>"
  reason?: "new" | "reset"  // "new" = fresh session, "reset" = restart context
}

// Response
{ ok: true }
```

### `sessions.delete`

```typescript
// Request
{
  key: string,
  deleteTranscript?: boolean  // also remove transcript files on server
}

// Response
{ ok: true }
```

## Implementation Steps

### Step 1: Gateway Client Methods

**File:** `packages/desktop/src/main/ws/gateway-client.ts`

Add two methods following the existing pattern (see `sendChatMessage`, `abortChat`):

```typescript
async resetSession(sessionKey: string, reason: 'new' | 'reset' = 'reset'): Promise<Record<string, unknown>> {
  return this.sendReq('sessions.reset', { key: sessionKey, reason });
}

async deleteSession(sessionKey: string, deleteTranscript: boolean = true): Promise<Record<string, unknown>> {
  return this.sendReq('sessions.delete', { key: sessionKey, deleteTranscript });
}
```

### Step 2: IPC Handlers

**File:** `packages/desktop/src/main/ipc/ws-handlers.ts`

Add two IPC handlers:

```typescript
ipcMain.handle('ws:session-reset', async (_e, { gatewayId, sessionKey, reason }) => {
  const gw = getGateway(gatewayId);
  return gw.resetSession(sessionKey, reason);
});

ipcMain.handle('ws:session-delete', async (_e, { gatewayId, sessionKey }) => {
  const gw = getGateway(gatewayId);
  return gw.deleteSession(sessionKey, true);
});
```

### Step 3: Preload API

**File:** `packages/desktop/src/preload/index.ts`

Expose to renderer:

```typescript
resetSession: (gatewayId: string, sessionKey: string, reason?: 'new' | 'reset') =>
  ipcRenderer.invoke('ws:session-reset', { gatewayId, sessionKey, reason }),

deleteSession: (gatewayId: string, sessionKey: string) =>
  ipcRenderer.invoke('ws:session-delete', { gatewayId, sessionKey }),
```

### Step 4: UI — Context Menu Actions

**File:** `packages/desktop/src/renderer/components/ContextMenu.tsx`

The Task context menu (right-click on a task in LeftNav) should add:

- **"Reset Session"** — calls `resetSession` with `reason: 'reset'`, then clears local message history for that task, shows a system message "Session reset" in chat
- **"New Session"** — calls `resetSession` with `reason: 'new'`, same local cleanup
- **"Delete Task"** — existing local delete + now also calls `deleteSession` to clean up server-side

**File:** `packages/desktop/src/renderer/layouts/LeftNav/TaskItem.tsx`

Verify the context menu is wired up here.

### Step 5: UI — Chat Area Action

**File:** `packages/desktop/src/renderer/layouts/MainArea/index.tsx` (or the chat header area)

Add a button or menu option in the chat header: "Reset Context" (with a confirmation dialog).

After reset:
1. Clear local messages for this task from `messageStore`
2. Insert a local system message: "Session context has been reset"
3. Task remains in LeftNav, ready for new conversation

### Step 6: Local State Cleanup

**File:** `packages/desktop/src/renderer/stores/messageStore.ts` (or equivalent)

On session reset:
- Clear messages for the task from the local store
- Optionally clear from local SQLite DB (messages table)
- Keep the Task record itself intact (it's just the session that resets)

On task delete:
- Remove task from `taskStore`
- Remove messages from `messageStore`
- Remove artifacts from `artifactStore` (if applicable)
- Call `deleteSession` on Gateway
- Remove local task directory from workspace

## Key Existing Code References

| What | File |
|------|------|
| Gateway client base | `packages/desktop/src/main/ws/gateway-client.ts` — `sendReq()` method |
| Existing IPC handlers | `packages/desktop/src/main/ipc/ws-handlers.ts` |
| Preload bridge | `packages/desktop/src/preload/index.ts` |
| Context menu | `packages/desktop/src/renderer/components/ContextMenu.tsx` |
| Task item in nav | `packages/desktop/src/renderer/layouts/LeftNav/TaskItem.tsx` |
| Task store | `packages/desktop/src/renderer/stores/taskStore.ts` |
| Message store | `packages/desktop/src/renderer/stores/messageStore.ts` (find via grep `messageStore`) |
| DB schema | `packages/desktop/src/main/db/schema.ts` — `tasks` and `messages` tables |

## UX Details

- **Reset confirmation dialog:** "This will clear the conversation context on the server. Local message history will be cleared. The task itself will remain. Continue?"
- **Delete confirmation dialog:** "This will permanently delete the task, all messages, and the server session. This cannot be undone. Continue?"
- After reset, the chat area shows empty with the system message, and the ChatInput is focused and ready.
- If Gateway is disconnected, grey out the reset/delete options with tooltip "Requires Gateway connection".

## Testing

- Create a task, send some messages, reset → verify messages cleared locally and new messages don't see old context
- Create a task, send some messages, delete → verify task removed from LeftNav, session deleted on Gateway
- Reset while Gateway is disconnected → verify button is disabled / shows error
- Reset → immediately send a new message → verify Agent responds without old context
