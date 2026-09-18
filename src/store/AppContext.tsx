import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"
import { OpenCodeClient, ServerConfig } from "../api/client"
import { connectEvents, disconnectEvents, eventBus } from "../api/events"
import { SessionInfo, ServerEvent, AgentInfo, ModelInfo } from "../api/types"
import { discoverServer } from "../api/discover"
import { DirectConfig } from "../api/direct"

const CONFIG_KEY = "oc_config"
const DIRECT_CFG_KEY = "oc_direct"
const API_KEY_KEY = "oc_api_key"

export type AppMode = "server" | "direct" | null

interface AppState {
  mode: AppMode
  config: ServerConfig | null
  client: OpenCodeClient | null
  connected: boolean
  discovering: boolean
  discoverAndConnect: () => Promise<boolean>
  direct: DirectConfig | null
  enableDirect: (cfg: DirectConfig) => Promise<void>
  resetAll: () => Promise<void>
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
  const [mode, setMode] = useState<AppMode>(null)
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [client, setClient] = useState<OpenCodeClient | null>(null)
  const [connected, setConnected] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [direct, setDirect] = useState<DirectConfig | null>(null)
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
    setMode("server")
  }, [])

  const enableDirect = useCallback(async (cfg: DirectConfig) => {
    await SecureStore.setItemAsync(API_KEY_KEY, cfg.apiKey)
    await AsyncStorage.setItem(
      DIRECT_CFG_KEY,
      JSON.stringify({ provider: cfg.provider, model: cfg.model })
    )
    setDirect(cfg)
    setMode("direct")
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
      // 1) saved server config
      const raw = await AsyncStorage.getItem(CONFIG_KEY)
      if (raw) {
        try {
          const cfg: ServerConfig = JSON.parse(raw)
          await connect(cfg)
          return
        } catch {
          // corrupted; continue
        }
      }
      // 2) saved direct (AI) config
      const directRaw = await AsyncStorage.getItem(DIRECT_CFG_KEY)
      if (directRaw) {
        try {
          const saved = JSON.parse(directRaw)
          const apiKey = await SecureStore.getItemAsync(API_KEY_KEY)
          if (apiKey) {
            setDirect({ provider: saved.provider, model: saved.model, apiKey })
            setMode("direct")
            return
          }
        } catch {
          // continue
        }
      }
      // 3) auto-discover local server
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
    setMode(null)
  }, [])

  const resetAll = useCallback(async () => {
    disconnectEvents()
    await AsyncStorage.multiRemove([CONFIG_KEY, DIRECT_CFG_KEY])
    try {
      await SecureStore.deleteItemAsync(API_KEY_KEY)
    } catch {
      // ignore
    }
    setConfig(null)
    setClient(null)
    setConnected(false)
    setDirect(null)
    setSessions([])
    setAgents([])
    setModels([])
    setMode(null)
  }, [])

  return (
    <Ctx.Provider
      value={{
        mode,
        config,
        client,
        connected,
        discovering,
        discoverAndConnect,
        direct,
        enableDirect,
        resetAll,
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