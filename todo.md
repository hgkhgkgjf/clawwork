# feat: Usage & Cost Dashboard

> Branch: `feat/usage-dashboard`
> Priority: P0 — users need to know what they're spending
> PR Target: `main`

## Summary

Display token usage and cost data from the Gateway. Users running parallel tasks need visibility into how much each task (and overall) is consuming.

## Why This Matters

- ClawWork runs multiple tasks in parallel — cost can accumulate fast without users noticing
- Current local token counters (`inputTokens`/`outputTokens`/`contextTokens` in tasks table) are rough estimates from chat events — not authoritative
- Gateway has the real usage data via `usage.status` and `usage.cost`

## Gateway RPC Methods

### `usage.status`

```typescript
// Request: (empty or minimal params)
{}

// Response (inferred from method name — verify against Gateway source):
{
  totalInputTokens: number,
  totalOutputTokens: number,
  totalContextTokens: number,
  // possibly per-session or per-period breakdowns
}
```

### `usage.cost`

```typescript
// Request: (empty or minimal params)
{}

// Response (inferred — verify against Gateway source):
{
  totalCostUsd: number,
  // possibly per-model or per-period breakdowns
}
```

**Important:** Before implementing, call these methods from the Gateway client and log the actual response shape. The whitepaper doesn't fully document the response schema. Inspect the response and adapt the UI accordingly.

## Implementation Steps

### Step 1: Discover Actual Response Schema

Before writing any UI, add temporary code to call both methods and log responses:

```typescript
// In gateway-client.ts or a test script
const usageStatus = await gw.sendReq('usage.status', {});
const usageCost = await gw.sendReq('usage.cost', {});
console.log('usage.status response:', JSON.stringify(usageStatus, null, 2));
console.log('usage.cost response:', JSON.stringify(usageCost, null, 2));
```

Update this todo.md with the actual response schemas before proceeding.

### Step 2: Gateway Client Methods

**File:** `packages/desktop/src/main/ws/gateway-client.ts`

```typescript
async getUsageStatus(): Promise<Record<string, unknown>> {
  return this.sendReq('usage.status', {});
}

async getUsageCost(): Promise<Record<string, unknown>> {
  return this.sendReq('usage.cost', {});
}
```

### Step 3: IPC + Preload

**File:** `packages/desktop/src/main/ipc/ws-handlers.ts`

```typescript
ipcMain.handle('ws:usage-status', async (_e, { gatewayId }) => {
  const gw = getGateway(gatewayId);
  return gw.getUsageStatus();
});

ipcMain.handle('ws:usage-cost', async (_e, { gatewayId }) => {
  const gw = getGateway(gatewayId);
  return gw.getUsageCost();
});
```

**File:** `packages/desktop/src/preload/index.ts`

```typescript
getUsageStatus: (gatewayId: string) => ipcRenderer.invoke('ws:usage-status', { gatewayId }),
getUsageCost: (gatewayId: string) => ipcRenderer.invoke('ws:usage-cost', { gatewayId }),
```

### Step 4: Shared Types

**File:** `packages/shared/src/types.ts`

Define interfaces based on actual Gateway response (from Step 1). Placeholder:

```typescript
export interface UsageStatus {
  totalInputTokens: number;
  totalOutputTokens: number;
  // ... extend based on actual response
}

export interface UsageCost {
  totalCostUsd: number;
  // ... extend based on actual response
}
```

### Step 5: Usage Store

**File:** `packages/desktop/src/renderer/stores/usageStore.ts` (new)

Zustand store:

```typescript
interface UsageState {
  status: UsageStatus | null;
  cost: UsageCost | null;
  loading: boolean;
  error: string | null;
  fetchUsage: (gatewayId: string) => Promise<void>;
}
```

- Fetch on app init (after Gateway connect)
- Refresh periodically (every 60 seconds) or on demand
- Refresh after each chat.send completion (when final chat event arrives)

### Step 6: UI — Status Bar / Footer Indicator

**Placement option A: Bottom status bar**

Add a compact usage indicator in the app's bottom status bar (if one exists) or create one:

```
┌──────────────────────────────────────────────────────┐
│  [Connected: gateway.local]    📊 12.3K tokens  $0.04 │
└──────────────────────────────────────────────────────┘
```

Click to expand into a detail panel.

**Placement option B: RightPanel section**

Add a "Usage" section in the Task detail panel (RightPanel) showing per-task and overall usage.

**Recommended: both** — summary in status bar, detail in a panel.

### Step 7: UI — Usage Detail Panel

**File:** `packages/desktop/src/renderer/components/UsagePanel.tsx` (new)

Shows:
- Total input / output / context tokens
- Total cost (USD)
- Per-task breakdown (if Gateway provides per-session data)
- Per-model breakdown (if available)
- Refresh button
- Time period selector (today / this week / all time — if Gateway supports)

### Step 8: Per-Task Token Display

**File:** `packages/desktop/src/renderer/layouts/RightPanel/index.tsx`

The existing Task metadata already has `inputTokens`/`outputTokens`/`contextTokens` fields in the DB schema. Show these in the Task detail panel alongside model info:

```
Model: claude-sonnet-4-6
Tokens: 5.2K in / 3.1K out / 8.3K context
```

These local counters update from chat events. The gateway-level `usage.status` provides the authoritative totals.

## Key Existing Code References

| What | File |
|------|------|
| Gateway client | `packages/desktop/src/main/ws/gateway-client.ts` |
| IPC handlers | `packages/desktop/src/main/ipc/ws-handlers.ts` |
| Preload | `packages/desktop/src/preload/index.ts` |
| Task DB schema | `packages/desktop/src/main/db/schema.ts` — `inputTokens`, `outputTokens`, `contextTokens` |
| RightPanel | `packages/desktop/src/renderer/layouts/RightPanel/index.tsx` |
| Existing stores | `packages/desktop/src/renderer/stores/` — follow pattern from `taskStore.ts` |
| UI components | `packages/desktop/src/renderer/components/` — use shadcn/ui |

## UX Notes

- Token numbers should be human-readable: "12.3K" not "12,345"
- Cost in USD with 2 decimal places
- Use the app's green accent color for the usage indicator
- Show a warning icon if context tokens are approaching the model's limit (if known from `models.list`)
- Graceful handling if Gateway doesn't support these methods (older server) — just hide the UI

## Testing

- Connect to Gateway → verify usage data loads
- Send several messages → verify token counts update
- Disconnect Gateway → verify usage UI shows stale data with "Last updated: X" timestamp
- Multiple tasks in parallel → verify per-task and total counters both update
- Call usage.status / usage.cost manually → verify response matches expected schema
