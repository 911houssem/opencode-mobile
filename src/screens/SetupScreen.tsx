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
import { DirectProvider, PROVIDER_MODELS } from "../api/direct"

export default function SetupScreen() {
  const { connect, enableDirect, discoverAndConnect, discovering } = useApp()

  // Direct AI mode
  const [provider, setProvider] = useState<DirectProvider>("anthropic")
  const [model, setModel] = useState(PROVIDER_MODELS.anthropic[0])
  const [apiKey, setApiKey] = useState("")
  const [directLoading, setDirectLoading] = useState(false)

  // Server mode
  const [url, setUrl] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const pickProvider = (p: DirectProvider) => {
    setProvider(p)
    setModel(PROVIDER_MODELS[p][0])
  }

  const startDirect = async () => {
    if (!apiKey.trim()) {
      Alert.alert("API key required", "Paste your provider API key to start chatting.")
      return
    }
    setDirectLoading(true)
    try {
      await enableDirect({
        provider,
        model: model.trim() || PROVIDER_MODELS[provider][0],
        apiKey: apiKey.trim(),
      })
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not save settings")
    } finally {
      setDirectLoading(false)
    }
  }

  const testConnection = () => {
    if (!url.trim()) {
      Alert.alert("Error", "Enter the server URL")
      return
    }
    setLoading(true)
    ;(async () => {
      try {
        const baseUrl = url.trim().replace(/\/+$/, "")
        await connect({
          baseUrl,
          username: username.trim() || undefined,
          password: password.trim() || undefined,
        })
      } catch (e: any) {
        Alert.alert("Connection failed", e?.message ?? "Could not reach server")
      } finally {
        setLoading(false)
      }
    })()
  }

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
          Pick one and start — no server required
        </Text>

        {/* Direct AI */}
        <Text style={styles.section}>Direct AI (recommended)</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>
            Chat directly with an AI provider. No server, no hosting, no links.
          </Text>

          <View style={styles.chips}>
            {(["anthropic", "openai"] as DirectProvider[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, provider === p && styles.chipActive]}
                onPress={() => pickProvider(p)}
              >
                <Text
                  style={[styles.chipText, provider === p && styles.chipTextActive]}
                >
                  {p === "anthropic" ? "Anthropic (Claude)" : "OpenAI (GPT)"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Model</Text>
          <View style={styles.chips}>
            {PROVIDER_MODELS[provider].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, model === m && styles.chipActive]}
                onPress={() => setModel(m)}
              >
                <Text
                  style={[styles.chipText, model === m && styles.chipTextActive]}
                >
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>API key</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={
              provider === "anthropic" ? "sk-ant-..." : "sk-..."
            }
            placeholderTextColor={Colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, directLoading && styles.buttonDisabled]}
            onPress={startDirect}
            disabled={directLoading}
          >
            {directLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Start chatting</Text>
            )}
          </TouchableOpacity>

          <View style={styles.tipBox}>
            <Text style={styles.tipText}>
              Your key is stored securely on this phone only. Get one at{"\n"}
              platform.anthropic.com or platform.openai.com.
            </Text>
          </View>
        </View>

        {/* Server mode */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or OpenCode server</Text>
          <View style={styles.dividerLine} />
        </View>

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

        <TouchableOpacity
          style={styles.presetChip}
          onPress={() => setUrl("http://localhost:4096")}
          disabled={loading}
        >
          <Text style={styles.presetText}>On this device (Termux)</Text>
        </TouchableOpacity>

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
          <Text style={styles.tipText}>
            Server mode: run{"\n"}
            <Text style={styles.code}>opencode serve --port 4096 --mdns</Text>
            {"\n"}on your computer, then tap search. Or run it on this phone via Termux.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingTop: 48 },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textDim,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 22,
  },
  section: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  cardText: { color: Colors.textDim, fontSize: 13, marginBottom: 14, lineHeight: 19 },
  label: {
    fontSize: 13,
    color: Colors.textDim,
    marginBottom: 6,
    marginTop: 10,
    fontWeight: "600",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: "#0d2b45" },
  chipText: { color: Colors.textDim, fontSize: 13 },
  chipTextActive: { color: Colors.accent, fontWeight: "700" },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    marginTop: 8,
    marginBottom: 14,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  tipBox: {
    backgroundColor: Colors.surface2,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  tipText: { color: Colors.textDim, fontSize: 12, lineHeight: 18 },
  code: { color: Colors.accent, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textDim, fontSize: 12 },
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
  presetChip: {
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  presetText: { color: Colors.accent, fontSize: 13, fontWeight: "600" },
})