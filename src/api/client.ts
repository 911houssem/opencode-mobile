import {
  AdmittedResponse,
  AgentInfo,
  ModelInfo,
  MessageListResponse,
  ModelRef,
  PermissionReplyValue,
  SessionInfo,
  SessionListResponse,
} from "./types"

export interface ServerConfig {
  baseUrl: string
  username?: string
  password?: string
}

export class OpenCodeClient {
  readonly config: ServerConfig

  constructor(config: ServerConfig) {
    this.config = config
  }

  private authHeader(): Record<string, string> {
    if (!this.config.username && !this.config.password) return {}
    const creds = `${this.config.username ?? ""}:${this.config.password ?? ""}`
    const encoded = this.encodeUtf8Base64(creds)
    return { Authorization: `Basic ${encoded}` }
  }

  private encodeUtf8Base64(str: string): string {
    const bytes: number[] = []
    for (let i = 0; i < str.length; i++) {
      let code = str.charCodeAt(i)
      if (code > 127) {
        const encoded = encodeURIComponent(str[i])
        for (let j = 0; j < encoded.length; j++) {
          const charCode = encoded.charCodeAt(j)
          if (charCode === 37) {
            bytes.push(parseInt(encoded.slice(j + 1, j + 3), 16))
            j += 2
          } else {
            bytes.push(charCode)
          }
        }
      } else {
        bytes.push(code)
      }
    }
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    let out = ""
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i]
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined
      const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined
      out += chars[b0 >> 2]
      out += chars[((b0 & 3) << 4) | (b1 !== undefined ? b1 >> 4 : 0)]
      out += b1 !== undefined ? chars[((b1 & 15) << 2) | (b2 !== undefined ? b2 >> 6 : 0)] : "="
      out += b2 !== undefined ? chars[b2 & 63] : "="
    }
    return out
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}${path}`
    const headers: Record<string, string> = { ...this.authHeader() }
    if (init?.body) headers["Content-Type"] = "application/json"
    const res = await fetch(url, { ...init, headers })
    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      try {
        const body = await res.json()
        msg = (body as any).message ?? JSON.stringify(body)
      } catch {
        /* ignore parse error */
      }
      throw new Error(msg)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  private qs(params?: Record<string, string | number | undefined>): string {
    if (!params) return ""
    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null
    )
    if (!entries.length) return ""
    return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")
  }

  async health(): Promise<void> {
    await this.request("/health")
  }

  async listSessions(opts?: {
    limit?: number
    order?: "asc" | "desc"
    cursor?: string
  }): Promise<SessionListResponse> {
    return this.request(
      "/api/session" + this.qs({ limit: opts?.limit, order: opts?.order, cursor: opts?.cursor })
    )
  }

  async createSession(body?: { agent?: string; model?: ModelRef }): Promise<SessionInfo> {
    return this.request("/api/session", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    })
  }

  async switchAgent(sessionID: string, agent: string): Promise<void> {
    await this.request(`/api/session/${encodeURIComponent(sessionID)}/agent`, {
      method: "POST",
      body: JSON.stringify({ agent }),
    })
  }

  async switchModel(sessionID: string, model: ModelRef): Promise<void> {
    await this.request(`/api/session/${encodeURIComponent(sessionID)}/model`, {
      method: "POST",
      body: JSON.stringify({ model }),
    })
  }

  async prompt(
    sessionID: string,
    text: string,
    opts?: { resume?: boolean }
  ): Promise<AdmittedResponse> {
    return this.request(`/api/session/${encodeURIComponent(sessionID)}/prompt`, {
      method: "POST",
      body: JSON.stringify({
        prompt: { text },
        resume: opts?.resume ?? true,
      }),
    })
  }

  async interrupt(sessionID: string): Promise<void> {
    await this.request(`/api/session/${encodeURIComponent(sessionID)}/interrupt`, {
      method: "POST",
    })
  }

  async replyPermission(
    sessionID: string,
    requestID: string,
    reply: PermissionReplyValue
  ): Promise<void> {
    await this.request(
      `/api/session/${encodeURIComponent(sessionID)}/permission/${encodeURIComponent(requestID)}/reply`,
      { method: "POST", body: JSON.stringify({ reply }) }
    )
  }

  async listMessages(
    sessionID: string,
    opts?: { limit?: number; order?: "asc" | "desc"; cursor?: string }
  ): Promise<MessageListResponse> {
    return this.request(
      `/api/session/${encodeURIComponent(sessionID)}/message` +
        this.qs({ limit: opts?.limit, order: opts?.order, cursor: opts?.cursor })
    )
  }

  async listAgents(): Promise<AgentInfo[]> {
    const res = await this.request<{ location?: unknown; data: AgentInfo[] }>("/api/agent")
    return res.data
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await this.request<{ location?: unknown; data: ModelInfo[] }>("/api/model")
    return res.data
  }

  async getSession(sessionID: string): Promise<SessionInfo> {
    return this.request(`/api/session/${encodeURIComponent(sessionID)}`)
  }

  get eventUrl(): string {
    return `${this.config.baseUrl.replace(/\/+$/, "")}/api/event`
  }

  get authHeaders(): Record<string, string> {
    return this.authHeader()
  }
}