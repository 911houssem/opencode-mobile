import EventSource from "react-native-sse"

export type DirectProvider = "anthropic" | "openai"

export interface DirectConfig {
  provider: DirectProvider
  model: string
  apiKey: string
}

export interface DirectChatMessage {
  role: "user" | "assistant"
  content: string
}

export const PROVIDER_MODELS: Record<DirectProvider, string[]> = {
  anthropic: [
    "claude-sonnet-4-5",
    "claude-3-7-sonnet-20250219",
    "claude-3-5-sonnet-20241022",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
}

export function directSystemPrompt(): string {
  return (
    "You are OpenCode Mobile, an AI coding assistant. " +
    "Be concise, practical and helpful. Use Markdown where useful. " +
    "Answer in the user's language."
  )
}

export type CancelStream = () => void

export function streamDirectChat(
  cfg: DirectConfig,
  history: DirectChatMessage[],
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (message: string) => void
): CancelStream {
  if (cfg.provider === "anthropic") {
    return streamAnthropic(cfg, history, onDelta, onDone, onError)
  }
  return streamOpenAI(cfg, history, onDelta, onDone, onError)
}

function streamAnthropic(
  cfg: DirectConfig,
  history: DirectChatMessage[],
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (message: string) => void
): CancelStream {
  const es = new EventSource("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 4096,
      system: directSystemPrompt(),
      messages: history.map((m) => ({
        role: m.role,
        content: [{ type: "text", text: m.content }],
      })),
      stream: true,
    }),
    pollingInterval: 0,
  })

  es.addEventListener("message", (event: any) => {
    if (!event.data) return
    let obj: any
    try {
      obj = JSON.parse(event.data)
    } catch {
      return
    }
    switch (obj.type) {
      case "content_block_delta":
        if (obj.delta?.type === "text_delta" && typeof obj.delta.text === "string") {
          onDelta(obj.delta.text)
        }
        break
      case "message_stop":
        onDone()
        break
      case "error":
        onError(obj.error?.message ?? "Provider error")
        break
    }
  })

  es.addEventListener("error", (event: any) => {
    onError(event?.message ?? "Connection failed")
  })

  return () => es.close()
}

function streamOpenAI(
  cfg: DirectConfig,
  history: DirectChatMessage[],
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (message: string) => void
): CancelStream {
  const es = new EventSource("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: directSystemPrompt() },
        ...history,
      ],
      stream: true,
    }),
    pollingInterval: 0,
  })

  es.addEventListener("message", (event: any) => {
    if (!event.data) return
    const lines = String(event.data).split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed === "[DONE]") {
        onDone()
        return
      }
      try {
        const obj = JSON.parse(trimmed)
        const delta = obj.choices?.[0]?.delta?.content
        if (typeof delta === "string" && delta.length > 0) onDelta(delta)
      } catch {
        // skip malformed chunk
      }
    }
  })

  es.addEventListener("error", (event: any) => {
    onError(event?.message ?? "Connection failed")
  })

  return () => es.close()
}