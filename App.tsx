import React, { useState, useEffect, useCallback } from "react"
import { View, ActivityIndicator } from "react-native"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { AppProvider, useApp } from "./src/store/AppContext"
import SetupScreen from "./src/screens/SetupScreen"
import SessionsScreen from "./src/screens/SessionsScreen"
import ChatScreen from "./src/screens/ChatScreen"
import DirectChatScreen from "./src/screens/DirectChatScreen"
import { Colors } from "./src/theme"

type Screen =
  | { name: "setup" }
  | { name: "sessions" }
  | { name: "chat"; sessionID: string }

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg }}>
      <ActivityIndicator color={Colors.accent} size="large" />
    </View>
  )
}

function Navigator() {
  const { mode, connected, discovering, resetAll } = useApp()
  const [screen, setScreen] = useState<Screen>({ name: "sessions" })

  useEffect(() => {
    if (mode !== "server" || !connected) {
      setScreen({ name: "setup" })
      return
    }
    setScreen((prev) =>
      prev.name === "setup" ? { name: "sessions" } : prev
    )
  }, [mode, connected])

  const openSession = useCallback((sessionID: string) => {
    setScreen({ name: "chat", sessionID })
  }, [])

  const backToSessions = useCallback(() => {
    setScreen({ name: "sessions" })
  }, [])

  if (discovering) return <Loading />

  // Direct AI mode → straight to chat
  if (mode === "direct") {
    return (
      <DirectChatScreen
        onExit={() => resetAll()}
      />
    )
  }

  if (mode !== "server" || !connected) {
    return <SetupScreen />
  }

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