import React, { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native"
import { Colors } from "../theme"
import { useApp } from "../store/AppContext"

export default function SetupScreen() {
  const { connect, discoverAndConnect, discovering } = useApp()
  const [url, setUrl] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const connectTo = async (targetUrl: string) => {
    setLoading(true)
    try {
      const baseUrl = targetUrl.trim().replace(/\/+$/, "")
      await connect({
        baseUrl,
        username: username.trim() || undefined,
        password: password.trim() || undefined,
      })
      setUrl(targetUrl.trim().replace(/\/+$/, ""))
    } catch (e: any) {
      Alert.alert("Connection failed", e?.message ?? "Could not reach server")
    } finally {
      setLoading(false)
    }
  }

  const testConnection = () => connectTo(url)

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>OpenCode Mobile</Text>
        <Text style={styles.subtitle}>
          Connect to your OpenCode server
        </Text>

        {discovering && (
          <View style={styles.searchingBox}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.searchingText}>
              Searching for a server automatically...
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.searchBtn, (loading || discovering) && styles.buttonDisabled]}
          onPress={() => discoverAndConnect()}
          disabled={loading || discovering}
        >
          <Text style={styles.searchBtnText}>
            {discovering ? "Searching..." : "Search for server (automatic)"}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or enter manually</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.label}>Server URL</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="http://192.168.1.100:4096"
          placeholderTextColor={Colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <View style={styles.presets}>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => connectTo("http://localhost:4096")}
            disabled={loading}
          >
            <Text style={styles.presetText}>On this device (Termux)</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Username (optional)</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="opencode"
          placeholderTextColor={Colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Password (optional)</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="password"
          placeholderTextColor={Colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={testConnection}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Connect</Text>
          )}
        </TouchableOpacity>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>How it works (auto-connect)</Text>
          <Text style={styles.tipText}>
            The app finds your server automatically — no link needed in most cases:
            {'\n'}• Server on this phone (Termux): found instantly.
            {'\n'}• Server on your PC on the same WiFi: run{'\n'}
            <Text style={styles.code}>opencode serve --port 4096 --mdns</Text>
            {'\n'}{'\n'}Only if nothing is found, enter the address manually (or tap "On this device (Termux)").
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 24, paddingTop: 60 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textDim,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 32,
  },
  label: {
    fontSize: 13,
    color: Colors.textDim,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    marginBottom: 16,
  },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  presetChip: {
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetText: { color: Colors.accent, fontSize: 13, fontWeight: "600" },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  searchingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.surface2,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  searchingText: { color: Colors.text, fontSize: 14 },
  searchBtn: {
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  searchBtnText: { color: Colors.accent, fontSize: 15, fontWeight: "600" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textDim, fontSize: 12 },
  tipBox: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 16,
    marginTop: 28,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipTitle: { color: Colors.text, fontSize: 14, fontWeight: "700", marginBottom: 8 },
  tipText: { color: Colors.textDim, fontSize: 13, lineHeight: 20 },
  code: { color: Colors.accent, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
})
