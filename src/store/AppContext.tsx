import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { OpenCodeClient, ServerConfig } from "../api/client"
import { connectEvents, disconnectEvents, eventBus } from "../api/events"
import { SessionInfo, ServerEvent, AgentInfo, ModelInfo } from "../api/types"
import { discoverServer } from "../api/discover"

const CONFIG_KEY = "oc_config"

interface AppState {
  config: ServerConfig | null
  client: OpenCodeClient | null
  connected: boolean
  discovering: boolean
  discoverAndConnect: () => Promise<boolean>
  sessions: SessionInfo[]
  loadingSessions: boolean
  loadSessions: () => Promise<void>
  connect: (config: ServerConfig) => Promise<void>
  disconnect: () => void
  agents: AgentInfo[]
  models: ModelInfo[]
  loadAgentsAndModels: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [client, setClient] = useState<OpenCodeClient | null>(null)
  const [connected, setConnected] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const clientRef = useRef(client)
  clientRef.current = client

  const loadSessions = useCallback(async () => {
    const c = clientRef.current
    if (!c) return
    setLoadingSessions(true)
    try {
      const res = await c.listSessions({ limit: 100, order: "desc" })
      setSessions(res.data)
    } catch {
      // server might be unreachable
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const loadAgentsAndModels = useCallback(async () => {
    const c = clientRef.current
    if (!c) return
    try {
      const [a, m] = await Promise.all([c.listAgents(), c.listModels()])
      setAgents(a)
      setModels(m.filter((m) => m.enabled))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!client) return
    connectEvents(client)
    loadSessions()
    loadAgentsAndModels()
    return () => disconnectEvents()
  }, [client])

  // Listen to session-list-changing events and refresh
  useEffect(() => {
    const unsub = eventBus.subscribe((event: ServerEvent) => {
      if (
        event.type === "session.created" ||
        event.type === "session.updated"
      ) {
        loadSessions()
      }
    })
    return unsub
  }, [loadSessions])

  const connect = useCallback(async (cfg: ServerConfig) => {
    const c = new OpenCodeClient(cfg)
    await c.health()
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
    setConfig(cfg)
    setClient(c)
    setConnected(true)
  }, [])

  const discoverAndConnect = useCallback(async () => {
    setDiscovering(true)
    try {
      const cfg = await discoverServer()
      if (cfg) {
        await connect(cfg)
        return true
      }
      return false
    } finally {
      setDiscovering(false)
    }
  }, [connect])

  useEffect(() => {
    ;(async () => {
      const raw = await AsyncStorage.getItem(CONFIG_KEY)
      if (raw) {
        try {
          const cfg: ServerConfig = JSON.parse(raw)
          await connect(cfg)
          return
        } catch {
          // corrupted config; fall through to discovery
        }
      }
      await discoverAndConnect()
    })()
  }, [])

  const disconnect = useCallback(() => {
    disconnectEvents()
    AsyncStorage.removeItem(CONFIG_KEY)
    setConfig(null)
    setClient(null)
    setConnected(false)
    setSessions([])
    setAgents([])
    setModels([])
  }, [])

  return (
    <Ctx.Provider
      value={{
        config,
        client,
        connected,
        discovering,
        discoverAndConnect,
        sessions,
        loadingSessions,
        loadSessions,
        connect,
        disconnect,
        agents,
        models,
        loadAgentsAndModels,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useApp must be inside AppProvider")
  return ctx
}
