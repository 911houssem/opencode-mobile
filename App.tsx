import React, { useState, useEffect, useCallback } from "react"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { AppProvider, useApp } from "./src/store/AppContext"
import SetupScreen from "./src/screens/SetupScreen"
import SessionsScreen from "./src/screens/SessionsScreen"
import ChatScreen from "./src/screens/ChatScreen"

type Screen =
  | { name: "setup" }
  | { name: "sessions" }
  | { name: "chat"; sessionID: string }

function Navigator() {
  const { connected } = useApp()
  const [screen, setScreen] = useState<Screen>({ name: "sessions" })

  useEffect(() => {
    if (!connected) {
      setScreen({ name: "setup" })
      return
    }
    setScreen((prev) =>
      prev.name === "setup" ? { name: "sessions" } : prev
    )
  }, [connected])

  const openSession = useCallback((sessionID: string) => {
    setScreen({ name: "chat", sessionID })
  }, [])

  const backToSessions = useCallback(() => {
    setScreen({ name: "sessions" })
  }, [])

  if (!connected) return <SetupScreen />

  switch (screen.name) {
    case "chat":
      return <ChatScreen sessionID={screen.sessionID} onBack={backToSessions} />
    case "sessions":
    default:
      return <SessionsScreen onOpen={openSession} />
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppProvider>
        <Navigator />
      </AppProvider>
    </SafeAreaProvider>
  )
}