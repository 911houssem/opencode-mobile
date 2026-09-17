export interface LocationRef {
  directory: string
  workspaceID?: string | null
}

export interface ModelRef {
  id: string
  providerID: string
  variant?: string | null
}

export interface SessionInfo {
  id: string
  parentID?: string | null
  projectID: string
  agent?: string | null
  model?: ModelRef | null
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: { read: number; write: number }
  }
  time: { created: number; updated: number; archived?: number | null }
  title: string
  location: LocationRef
  subpath?: string | null
  revert?: unknown
}

export interface SessionListResponse {
  data: SessionInfo[]
  cursor?: { previous?: string | null; next?: string | null } | null
}

export interface MessageListResponse {
  data: SessionMessage[]
  cursor?: { previous?: string | null; next?: string | null } | null
}

export interface AdmittedResponse {
  admittedSeq: number
  id: string
}

export interface TimeStamp {
  created: number
  createdBy?: string | null
  completed?: number | null
}

export interface ToolStateRunning {
  status: "running"
  text?: string | null
}

export interface ToolStateBase {
  status: string
  pending?: boolean
}

export interface ToolState {
  status: string
  pending?: boolean
  text?: string | null
  input?: unknown
  content?: Array<{ type: string; text?: string }>
  result?: unknown
  error?: { type: string; message: string } | null
  structured?: Record<string, unknown>
}

export interface MessageBase {
  id: string
  metadata?: Record<string, unknown>
  time: TimeStamp
}

export interface UserMessage extends MessageBase {
  type: "user"
  text: string
  files?: Array<{ type: string; metadata?: unknown }>
  agents?: Array<{ type: string; metadata?: unknown }>
}

export interface AssistantContentText {
  type: "text"
  id: string
  text: string
}

export interface AssistantContentReasoning {
  type: "reasoning"
  id: string
  text: string
}

export interface AssistantContentTool {
  type: "tool"
  id: string
  name: string
  state: ToolState
}

export type AssistantContent = AssistantContentText | AssistantContentReasoning | AssistantContentTool

export interface AssistantMessage extends MessageBase {
  type: "assistant"
  agent: string
  model: ModelRef
  content: AssistantContent[]
  snapshot?: unknown
  finish?: string | null
  cost?: number | null
  tokens?: unknown
  error?: { type: string; message: string } | null
  time: TimeStamp
}

export interface SystemMessage extends MessageBase {
  type: "system"
  text: string
}

export interface ShellMessage extends MessageBase {
  type: "shell"
  callID: string
  command: string
  output: string
}

export interface AgentSwitchedMessage extends MessageBase {
  type: "agent-switched"
  agent: string
}

export interface ModelSwitchedMessage extends MessageBase {
  type: "model-switched"
  model: ModelRef
}

export interface SyntheticMessage extends MessageBase {
  type: "synthetic"
  sessionID: string
  text: string
}

export interface CompactionMessage extends MessageBase {
  type: "compaction"
  reason: "auto" | "manual"
  summary: string
  recent: string
}

export type SessionMessage =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | ShellMessage
  | AgentSwitchedMessage
  | ModelSwitchedMessage
  | SyntheticMessage
  | CompactionMessage

export interface AssistantState {
  condition?: string
  content: {
    type: "text" | "reasoning" | "tool"
    id: string
    text?: string
  }[]
}

export interface ChatPending {
  id: string
  sessionID: string
  request: { text: string }
  delivery?: string
}

export interface AgentInfo {
  id: string
  model?: ModelRef | null
  description?: string | null
  mode: "subagent" | "primary" | "all"
  hidden: boolean
  color?: string | null
  steps?: number | null
  permissions?: unknown
}

export interface ModelInfo {
  id: string
  providerID: string
  name: string
  status: string
  enabled: boolean
  limit: { context: number; input?: number | null; output: number }
}

export interface ServerEvent<T = unknown> {
  id: string
  metadata?: Record<string, unknown>
  durable?: { aggregateID: string; seq: number; version: number } | null
  location?: LocationRef | null
  type: string
  data: T
}

export interface PromptAdmitted {
  timestamp: number
  sessionID: string
  messageID: string
  state: AssistantState
  snapshot?: unknown
  cost?: number
  tokens?: unknown
  finish?: string | null
  error?: { type: string; message: string } | null
}

export interface PromptDeltaBase {
  timestamp: number
  sessionID: string
  messageID: string
}

export interface PermissionRequest {
  id: string
  sessionID: string
  action: string
  resources: string[]
  save?: unknown
  metadata?: Record<string, unknown>
  source?: { type: string; messageID?: string } | null
}

export type PermissionReplyValue = "once" | "always" | "reject"