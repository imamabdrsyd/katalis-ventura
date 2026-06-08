export type AgentImportSessionStatus = 'running' | 'completed' | 'error';

export interface AgentImportStep {
  id: string;
  type: 'thinking' | 'progress' | 'result' | 'error';
  message: string;
  current?: number;
  total?: number;
  timestamp: number;
}

export interface AgentImportSession {
  status: AgentImportSessionStatus;
  startedAt: string;
  updatedAt: string;
  current?: number;
  total?: number;
  steps: AgentImportStep[];
}

export const AGENT_IMPORT_SESSION_EVENT = 'axion-agent-import-session';

const KEY_PREFIX = 'axion-agent-import:';
const STALE_AFTER_MS = 5 * 60 * 1000;

function writeAgentImportSession(businessId: string, session: AgentImportSession): void {
  sessionStorage.setItem(`${KEY_PREFIX}${businessId}`, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent(AGENT_IMPORT_SESSION_EVENT, {
    detail: { businessId },
  }));
}

export function readAgentImportSession(businessId: string): AgentImportSession | null {
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${businessId}`);
    return raw ? JSON.parse(raw) as AgentImportSession : null;
  } catch {
    return null;
  }
}

export function startAgentImportSession(businessId: string): void {
  try {
    const now = new Date().toISOString();
    writeAgentImportSession(businessId, {
      status: 'running',
      startedAt: now,
      updatedAt: now,
      current: 0,
      steps: [],
    });
  } catch {
    // Session storage is optional; the import itself must continue without it.
  }
}

export function updateAgentImportSession(
  businessId: string,
  update: Partial<AgentImportSession> & Pick<AgentImportSession, 'status'>,
): void {
  try {
    const existing = readAgentImportSession(businessId);
    const now = new Date().toISOString();
    writeAgentImportSession(businessId, {
      ...existing,
      ...update,
      startedAt: update.startedAt ?? existing?.startedAt ?? now,
      updatedAt: now,
      steps: update.steps ?? existing?.steps ?? [],
    });
  } catch {
    // Session storage is optional; the import itself must continue without it.
  }
}

export function appendAgentImportStep(businessId: string, step: AgentImportStep): void {
  try {
    const existing = readAgentImportSession(businessId);
    if (!existing) return;
    writeAgentImportSession(businessId, {
      ...existing,
      updatedAt: new Date().toISOString(),
      steps: [...(existing.steps ?? []), step].slice(-100),
    });
  } catch {
    // Session storage is optional; the import itself must continue without it.
  }
}

export function isAgentImportSessionRunning(session: AgentImportSession | null): boolean {
  if (session?.status !== 'running') return false;
  const updatedAt = Date.parse(session.updatedAt);
  return Number.isFinite(updatedAt) && Date.now() - updatedAt < STALE_AFTER_MS;
}
