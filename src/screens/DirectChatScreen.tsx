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
  Alert,
  ActivityIndicator,
} from "react-native"
import { Colors } from "../theme"
import { useApp } from "../store/AppContext"
import {
  DirectChatMessage,
  DirectConfig,
  streamDirectChat,
  CancelStream,
} from "../api/direct"

interface Props {
  onExit: () => void
}

export default function DirectChatScreen({ onExit }: Props) {
  const { direct } = useApp()
  const [messages, setMessages] = useState<DirectChatMessage[]>([])
  const [streamText, setStreamText] = useState("")
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const cancelRef = useRef<CancelStream | null>(null)
  const cfgRef = useRef<DirectConfig | null>(direct)
  cfgRef.current = direct

  const messagesRef = useRef<DirectChatMessage[]>([])
  messagesRef.current = messages

  useEffect(() => {
    return () => {
      cancelRef.current?.()
    }
  }, [])

  useEffect(() => {
    setImmediate(() => flatListRef.current?.scrollToEnd({ animated: false }))
  }, [messages, streamText])

  const send = useCallback(async () => {
    const cfg = cfgRef.current
    if (!cfg || !input.trim() || busy) return
    const text = input.trim()
    setInput("")
    const updated: DirectChatMessage[] = [...messagesRef.current, { role: "user", content: text }]
    setMessages(updated)
    setStreamText("")
    setBusy(true)

    const history = [...updated].slice(-20)
    let full = ""

    const cancel = streamDirectChat(
      cfg,
      history,
      (delta) => {
        full += delta
        setStreamText(full)
      },
      () => {
        if (full.trim().length > 0) {
          setMessages((prev) => [...prev, { role: "assistant", content: full }])
        }
        setStreamText("")
        setBusy(false)
        cancelRef.current = null
      },
      (msg) => {
        setStreamText("")
        setBusy(false)
        cancelRef.current = null
        Alert.alert("Error", msg)
      }
    )
    cancelRef.current = cancel
  }, [input, busy])

  const interrupt = useCallback(() => {
    cancelRef.current?.()
    cancelRef.current = null
    if (streamText.trim().length > 0) {
      setMessages((prev) => [...prev, { role: "assistant", content: streamText }])
    }
    setStreamText("")
    setBusy(false)
  }, [streamText])

  const newChat = useCallback(() => {
    cancelRef.current?.()
    cancelRef.current = null
    setStreamText("")
    setBusy(false)
    setMessages([])
    setShowMenu(false)
  }, [])

  if (!direct) return null

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onExit}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {direct.provider === "anthropic" ? "Claude" : "GPT"} • {direct.model}
          </Text>
        </View>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(true)}>
          <Text style={styles.menuBtnText}>≡</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, i) => `${i}-${item.role}`}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) =>
          item.role === "user" ? (
            <View key={index} style={styles.userBubble}>
              <Text style={styles.userText}>{item.content}</Text>
            </View>
          ) : (
            <View key={index} style={styles.assistantBubble}>
              <Text style={styles.msgText}>{item.content}</Text>
            </View>
          )
        }
        ListFooterComponent={
          busy ? (
            <View style={styles.assistantBubble}>
              {streamText ? (
                <Text style={styles.msgText}>{streamText}</Text>
              ) : (
                <ActivityIndicator color={Colors.accent} size="small" style={{ marginTop: 4 }} />
              )}
            </View>
          ) : null
        }
      />

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder={busy ? "AI is responding..." : "Message..."}
          placeholderTextColor={Colors.textDim}
          multiline
          maxLength={8000}
          editable={!busy}
        />
        {busy ? (
          <TouchableOpacity style={styles.sendBtn} onPress={interrupt}>
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

      {/* Menu */}
      <Modal
        visible={showMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>OpenCode Mobile — Direct AI</Text>
            <TouchableOpacity style={styles.menuItem} onPress={newChat}>
              <Text style={styles.menuItemText}>New chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, { borderColor: Colors.danger }]}
              onPress={() => {
                setShowMenu(false)
                onExit()
              }}
            >
              <Text style={[styles.menuItemText, { color: Colors.red }]}>
                Change settings
              </Text>
            </TouchableOpacity>
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
  headerTitle: { fontSize: 13, color: Colors.textDim, fontWeight: "600" },
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
  },
  modalTitle: { color: Colors.text, fontSize: 16, fontWeight: "700", marginBottom: 14 },
  menuItem: {
    backgroundColor: Colors.surface2,
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuItemText: { color: Colors.text, fontSize: 15, fontWeight: "600" },
})