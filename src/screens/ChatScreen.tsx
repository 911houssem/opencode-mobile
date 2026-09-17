import React, { useEffect, useRef, useState, useCallback } from "react"
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native"
import { Colors } from "../theme"
import { useApp } from "../store/AppContext"
import { eventBus } from "../api/events"
import {
  SessionMessage,
  ServerEvent,
  PromptAdmitted,
  AssistantContent,
  PermissionRequest,
  PermissionReplyValue,
  ModelRef,
  AssistantContentTool,
} from "../api/types"

interface Props {
  sessionID: string
  onBack: () => void
}

interface StreamingAssistant {
  id: string
  agent: string
  model: ModelRef
  text: string
  reasoning: string
  tools: AssistantContentTool[]
  streaming: boolean
  finish?: string | null
  error?: { type: string; message: string } | null
}

export default function ChatScreen({ sessionID, onBack }: Props) {
  const { client, agents, models, sessions } = useApp()
  const sessionTitle = sessions.find((s) => s.id === sessionID)?.title
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [streaming, setStreaming] = useState<StreamingAssistant | null>(null)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [permissions, setPermissions] = useState<PermissionRequest[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(true)
  const flatListRef = useRef<FlatList>(null)
  const textInputRef = useRef<TextInput>(null)
  const messagesRef = useRef<SessionMessage[]>([])
  messagesRef.current = messages

  // Load messages
  const loadMessages = useCallback(async (cursor?: string) => {
    if (!client) return
    try {
      const res = await client.listMessages(sessionID, {
        limit: 100,
        order: "desc",
      })
      const reversed = [...res.data].reverse()
      if (cursor) {
        setMessages((prev) => [...reversed, ...prev])
      } else {
        setMessages(reversed)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [client, sessionID])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // SSE event handler
  useEffect(() => {
    const unsub = eventBus.subscribe((event: ServerEvent) => {
      const d = event.data as any
      if (d?.sessionID !== sessionID) return

      switch (event.type) {
        case "session.next.prompt.admitted":
        case "session.next.prompt.prompted": {
          const data = event.data as PromptAdmitted
          if (!data.messageID) break
          setStreaming({
            id: data.messageID,
            agent: data.state?.condition ?? "build",
            model: { id: "", providerID: "" },
            text: "",
            reasoning: "",
            tools: [],
            streaming: true,
          })
          setBusy(true)
          break
        }

        case "session.next.text.started": {
          const data = event.data as { timestamp: number; sessionID: string; messageID: string; promptID: string }
          setStreaming((prev) => {
            if (!prev || prev.id !== data.messageID) {
              return {
                id: data.messageID,
                agent: "build",
                model: { id: "", providerID: "" },
                text: "",
                reasoning: "",
                tools: [],
                streaming: true,
              }
            }
            return prev
          })
          break
        }

        case "session.next.text.delta": {
          const data = event.data as { timestamp: number; sessionID: string; messageID: string; id: string; delta: string }
          setStreaming((prev) => {
            if (!prev || prev.id !== data.messageID) return prev
            return { ...prev, text: prev.text + data.delta }
          })
          break
        }

        case "session.next.text.ended": {
          const data = event.data as { timestamp: number; sessionID: string; messageID: string; id: string; text: string; source?: unknown }
          setStreaming((prev) => {
            if (!prev || prev.id !== data.messageID) return prev
            return { ...prev, text: data.text ?? prev.text }
          })
          break
        }

        case "session.next.reasoning.started": {
          setStreaming((prev) => {
            if (!prev) return prev
            return { ...prev, reasoning: "" }
          })
          break
        }

        case "session.next.reasoning.delta": {
          const data = event.data as { delta: string; messageID: string }
          setStreaming((prev) => {
            if (!prev || prev.id !== data.messageID) return prev
            return { ...prev, reasoning: prev.reasoning + data.delta }
          })
          break
        }

        case "session.next.reasoning.ended": {
          const data = event.data as { messageID: string; text: string }
          setStreaming((prev) => {
            if (!prev || prev.id !== data.messageID) return prev
            return { ...prev, reasoning: data.text ?? prev.reasoning }
          })
          break
        }

        case "session.next.tool.called":
        case "session.next.tool.input.delta": {
          const data = event.data as { messageID: string; callID: string; name?: string; state?: any }
          setStreaming((prev) => {
            if (!prev || prev.id !== data.messageID) return prev
            const existing = prev.tools.find((t) => t.id === data.callID)
            if (existing) {
              return {
                ...prev,
                tools: prev.tools.map((t) =>
                  t.id === data.callID
                    ? { ...t, state: { ...t.state, status: data.state?.status ?? t.state.status, text: data.state?.text ?? t.state.text } }
                    : t
                ),
              }
            }
            return {
              ...prev,
              tools: [
                ...prev.tools,
                {
                  type: "tool" as const,
                  id: data.callID,
                  name: data.name ?? "tool",
                  state: { status: "running", text: data.state?.text ?? null },
                },
              ],
            }
          })
          break
        }

        case "session.next.tool.success":
        case "session.next.tool.failed": {
          const data = event.data as { messageID: string; callID: string; state?: any }
          setStreaming((prev) => {
            if (!prev || prev.id !== data.messageID) return prev
            return {
              ...prev,
              tools: prev.tools.map((t) =>
                t.id === data.callID
                  ? { ...t, state: { ...t.state, ...data.state } }
                  : t
              ),
            }
          })
          break
        }

        case "session.next.tool.progress": {
          const data = event.data as { messageID: string; callID: string; output?: string; time?: unknown }
          setStreaming((prev) => {
            if (!prev || prev.id !== data.messageID) return prev
            return {
              ...prev,
              tools: prev.tools.map((t) =>
                t.id === data.callID
                  ? {
                      ...t,
                      state: {
                        ...t.state,
                        status: "running",
                        text: data.output ?? t.state.text,
                      },
                    }
                  : t
              ),
            }
          })
          break
        }

        case "session.next.step.started": {
          const data = event.data as { messageID: string; agent?: string; model?: ModelRef }
          setStreaming((prev) => {
            if (!prev || prev.id !== data.messageID) return prev
            return {
              ...prev,
              agent: data.agent ?? prev.agent,
              model: data.model ?? prev.model,
              streaming: true,
            }
          })
          break
        }

        case "session.next.step.ended":
        case "session.next.step.failed": {
          const data = event.data as { messageID: string; finish?: string; error?: unknown }
          setStreaming(null)
          setBusy(false)
          loadMessages()
          break
        }

        case "session.next.prompt.skipped": {
          setStreaming(null)
          setBusy(false)
          break
        }

        case "permission.v2.asked": {
          const perm: PermissionRequest = {
            id: d.id,
            sessionID: d.sessionID,
            action: d.action,
            resources: d.resources ?? [],
            save: d.save,
            metadata: d.metadata,
            source: d.source,
          }
          setPermissions((prev) => [...prev.filter((p) => p.id !== perm.id), perm])
          break
        }

        case "permission.v2.replied": {
          setPermissions((prev) => prev.filter((p) => p.id !== d.requestID))
          break
        }
      }
    })
    return unsub
  }, [sessionID, loadMessages])

  // Scroll to bottom on new streaming content or messages
  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false })
    }, 50)
  }, [messages, streaming])

  const send = async () => {
    if (!client || !input.trim() || busy) return
    const text = input.trim()
    setInput("")
    try {
      await client.prompt(sessionID, text)
      setBusy(true)
    } catch (e: any) {
      setInput(text)
      // show error inline
    }
  }

  const doInterrupt = async () => {
    if (!client || !busy) return
    try {
      await client.interrupt(sessionID)
    } catch {
      // ignore
    }
  }

  const doPermissionReply = async (perm: PermissionRequest, reply: PermissionReplyValue) => {
    if (!client) return
    try {
      await client.replyPermission(perm.sessionID, perm.id, reply)
    } catch {
      // ignore
    }
  }

  const doSwitchAgent = async (agentID: string) => {
    if (!client) return
    try {
      await client.switchAgent(sessionID, agentID)
      setShowPicker(false)
    } catch {
      // ignore
    }
  }

  const doSwitchModel = async (model: ModelRef) => {
    if (!client) return
    try {
      await client.switchModel(sessionID, model)
      setShowPicker(false)
    } catch {
      // ignore
    }
  }

  const renderContent = (parts: AssistantContent[]) => {
    return parts.map((part) => {
      if (part.type === "text") {
        return (
          <Text key={part.id} style={styles.msgText}>
            {part.text}
          </Text>
        )
      }
      if (part.type === "reasoning") {
        return (
          <Text key={part.id} style={styles.reasoningText}>
            {part.text}
          </Text>
        )
      }
      if (part.type === "tool") {
        const tool = part as AssistantContentTool
        const statusIcon =
          tool.state.status === "completed" ? "✓" :
          tool.state.status === "error" ? "✗" : "⋯"
        const statusColor =
          tool.state.status === "completed" ? Colors.green :
          tool.state.status === "error" ? Colors.red : Colors.yellow
        return (
          <View key={part.id} style={styles.toolCard}>
            <Text style={[styles.toolStatus, { color: statusColor }]}>{statusIcon}</Text>
            <Text style={styles.toolName} numberOfLines={1}>{tool.name}</Text>
            {tool.state.text ? (
              <Text style={styles.toolText} numberOfLines={2}>{tool.state.text}</Text>
            ) : null}
          </View>
        )
      }
      return null
    })
  }

  const renderMessage = ({ item }: { item: SessionMessage }) => {
    if (item.type === "user") {
      return (
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{item.text}</Text>
        </View>
      )
    }
    if (item.type === "assistant") {
      return (
        <View style={styles.assistantBubble}>
          {renderContent(item.content)}
          {item.agent ? <Text style={styles.assistantMeta}>{item.agent} • {item.model.id.split("/").pop()}</Text> : null}
        </View>
      )
    }
    if (item.type === "system") {
      return (
        <View style={styles.systemBubble}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      )
    }
    if (item.type === "shell") {
      return (
        <View style={styles.toolCard}>
          <Text style={styles.toolName}>shell</Text>
          <Text style={styles.toolText} numberOfLines={3}>{item.output}</Text>
        </View>
      )
    }
    if (item.type === "agent-switched") {
      return (
        <View style={styles.switchBubble}>
          <Text style={styles.switchText}>switched to agent: {item.agent}</Text>
        </View>
      )
    }
    if (item.type === "model-switched") {
      return (
        <View style={styles.switchBubble}>
          <Text style={styles.switchText}>switched to model: {item.model.id.split("/").pop()}</Text>
        </View>
      )
    }
    if (item.type === "compaction") {
      return (
        <View style={styles.switchBubble}>
          <Text style={styles.switchText}>conversation compacted ({item.reason})</Text>
        </View>
      )
    }
    return null
  }

  const renderStreaming = () => {
    if (!streaming) return null
    return (
      <View style={styles.assistantBubble}>
        {streaming.reasoning ? (
          <Text style={styles.reasoningText}>{streaming.reasoning}</Text>
        ) : null}
        {streaming.tools.map((tool) => {
          const statusIcon =
            tool.state.status === "completed" ? "✓" :
            tool.state.status === "error" ? "✗" : "⋯"
          const statusColor =
            tool.state.status === "completed" ? Colors.green :
            tool.state.status === "error" ? Colors.red : Colors.yellow
          return (
            <View key={tool.id} style={styles.toolCard}>
              <Text style={[styles.toolStatus, { color: statusColor }]}>{statusIcon}</Text>
              <Text style={styles.toolName} numberOfLines={1}>{tool.name}</Text>
              {tool.state.text ? (
                <Text style={styles.toolText} numberOfLines={2}>{tool.state.text}</Text>
              ) : null}
            </View>
          )
        })}
        {streaming.text ? (
          <Text style={styles.msgText}>{streaming.text}</Text>
        ) : (
          !streaming.reasoning && streaming.streaming ? (
            <ActivityIndicator color={Colors.accent} size="small" style={{ marginTop: 4 }} />
          ) : null
        )}
        {streaming.agent ? (
          <Text style={styles.assistantMeta}>
            {streaming.agent}
            {streaming.model?.id ? ` • ${streaming.model.id.split("/").pop()}` : ""}
          </Text>
        ) : null}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {sessionTitle ?? "Chat session"}
          </Text>
        </View>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.menuBtnText}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Permissions banner */}
      {permissions.length > 0 && (
        <View style={styles.permBanner}>
          <Text style={styles.permTitle}>Permission requested</Text>
          {permissions.map((perm) => (
            <View key={perm.id} style={styles.permRow}>
              <Text style={styles.permAction} numberOfLines={1}>{perm.action}</Text>
              <View style={styles.permActions}>
                <TouchableOpacity
                  style={[styles.permBtn, { backgroundColor: Colors.green }]}
                  onPress={() => doPermissionReply(perm, "always")}
                >
                  <Text style={styles.permBtnText}>Allow</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.permBtn, { backgroundColor: Colors.accent }]}
                  onPress={() => doPermissionReply(perm, "once")}
                >
                  <Text style={styles.permBtnText}>Once</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.permBtn, { backgroundColor: Colors.danger }]}
                  onPress={() => doPermissionReply(perm, "reject")}
                >
                  <Text style={styles.permBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListFooterComponent={
          loading ? (
            <ActivityIndicator color={Colors.accent} style={{ marginTop: 20 }} />
          ) : (
            renderStreaming()
          )
        }
      />

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          ref={textInputRef}
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Message..."
          placeholderTextColor={Colors.textDim}
          multiline
          maxLength={8000}
          editable={!busy}
        />
        {busy ? (
          <TouchableOpacity style={styles.sendBtn} onPress={doInterrupt}>
            <Text style={[styles.sendBtnText, { color: Colors.red }]}>■</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim()}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Model/Agent picker modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Switch agent / model</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <Text style={styles.sectionTitle}>Agents</Text>
              {agents.filter((a) => !a.hidden && a.mode !== "subagent").map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={styles.pickerItem}
                  onPress={() => doSwitchAgent(a.id)}
                >
                  <Text style={styles.pickerItemText}>{a.id}</Text>
                  {a.description ? (
                    <Text style={styles.pickerItemDesc} numberOfLines={1}>{a.description}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Models</Text>
              {models.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.pickerItem}
                  onPress={() => doSwitchModel({ id: m.id, providerID: m.providerID })}
                >
                  <Text style={styles.pickerItemText}>{m.id}</Text>
                  <Text style={styles.pickerItemDesc} numberOfLines={1}>
                    {m.providerID} • {m.status}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 8 },
  backBtnText: { fontSize: 20, color: Colors.accent },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 14, color: Colors.textDim, fontWeight: "600" },
  menuBtn: { padding: 8 },
  menuBtnText: { fontSize: 18, color: Colors.textDim },
  messagesList: { padding: 12, paddingBottom: 8 },
  userBubble: {
    backgroundColor: Colors.accent,
    alignSelf: "flex-end",
    maxWidth: "85%",
    borderRadius: 14,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  userText: { color: "#fff", fontSize: 15, lineHeight: 21 },
  assistantBubble: {
    backgroundColor: Colors.surface,
    alignSelf: "flex-start",
    maxWidth: "92%",
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  msgText: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  reasoningText: {
    color: Colors.textDim,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
    marginBottom: 4,
  },
  assistantMeta: { color: Colors.textDim, fontSize: 11, marginTop: 6 },
  toolCard: {
    backgroundColor: Colors.surface2,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: Colors.yellow,
  },
  toolStatus: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  toolName: { color: Colors.accent, fontSize: 13, fontWeight: "600" },
  toolText: { color: Colors.textDim, fontSize: 12, marginTop: 4, lineHeight: 17 },
  systemBubble: {
    backgroundColor: Colors.surface2,
    alignSelf: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
  },
  systemText: { color: Colors.textDim, fontSize: 12, textAlign: "center" },
  switchBubble: {
    alignSelf: "center",
    marginBottom: 6,
  },
  switchText: { color: Colors.textDim, fontSize: 12, fontStyle: "italic" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    maxHeight: 120,
    textAlignVertical: "center",
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: Colors.surface2 },
  sendBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  permBanner: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    padding: 12,
  },
  permTitle: { color: Colors.yellow, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  permRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 },
  permAction: { color: Colors.text, fontSize: 13, flex: 1 },
  permActions: { flexDirection: "row", gap: 6 },
  permBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  permBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "60%",
  },
  modalTitle: { color: Colors.text, fontSize: 16, fontWeight: "700", marginBottom: 14 },
  sectionTitle: { color: Colors.textDim, fontSize: 12, fontWeight: "700", marginBottom: 6, textTransform: "uppercase" },
  pickerItem: {
    backgroundColor: Colors.surface2,
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  pickerItemText: { color: Colors.text, fontSize: 14, fontWeight: "600" },
  pickerItemDesc: { color: Colors.textDim, fontSize: 12, marginTop: 2 },
})
