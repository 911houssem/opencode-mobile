import { OpenCodeClient } from "./client"
import { ServerEvent } from "./types"

type Listener = (event: ServerEvent) => void

class EventBus {
  private listeners = new Set<Listener>()

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit(event: ServerEvent) {
    for (const l of this.listeners) {
      try {
        l(event)
      } catch {
        // ignore listener errors
      }
    }
  }
}

export const eventBus = new EventBus()

let currentSource: any = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectDelay = 1000
let activeClient: OpenCodeClient | null = null

export function connectEvents(client: OpenCodeClient) {
  if (currentSource) {
    disconnectEvents()
  }
  activeClient = client
  reconnectDelay = 1000
  doConnect(client)
}

export function disconnectEvents() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (currentSource) {
    try {
      currentSource.close()
    } catch {
      /* ignore */
    }
    currentSource = null
  }
  activeClient = null
}

function doConnect(client: OpenCodeClient) {
  import("react-native-sse")
    .then((mod) => {
      const EventSource: any = mod.default ?? mod
      const es = new EventSource(client.eventUrl, {
        method: "GET",
        headers: client.authHeaders,
        pollingInterval: 0,
      })

      currentSource = es

      es.addEventListener("message", (event: any) => {
        if (!event.data) return
        try {
          const parsed: ServerEvent = JSON.parse(event.data)
          eventBus.emit(parsed)
        } catch {
          // ignore malformed data
        }
      })

      es.addEventListener("open", () => {
        reconnectDelay = 1000
      })

      es.addEventListener("error", () => {
        scheduleReconnect(client)
      })

      es.addEventListener("close", () => {
        currentSource = null
        scheduleReconnect(client)
      })
    })
    .catch(() => {
      scheduleReconnect(client)
    })
}

function scheduleReconnect(client: OpenCodeClient) {
  if (reconnectTimer) return
  if (!activeClient) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    reconnectDelay = Math.min(reconnectDelay * 1.5, 15000)
    doConnect(client)
  }, reconnectDelay)
}
