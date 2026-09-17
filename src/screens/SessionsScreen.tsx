import React, { useEffect, useCallback } from "react"
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native"
import { Colors } from "../theme"
import { useApp } from "../store/AppContext"
import { SessionInfo } from "../api/types"

interface Props {
  onOpen: (sessionID: string) => void
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString()
}

export default function SessionsScreen({ onOpen }: Props) {
  const { sessions, loadSessions, loadingSessions, client, disconnect, connected } = useApp()
  const [refreshing, setRefreshing] = React.useState(false)
  const [creating, setCreating] = React.useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await loadSessions()
    setRefreshing(false)
  }, [loadSessions])

  useEffect(() => {
    if (!connected) return
    loadSessions()
  }, [connected])

  const createSession = async () => {
    if (!client || creating) return
    setCreating(true)
    try {
      const session = await client.createSession()
      onOpen(session.id)
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to create session")
    } finally {
      setCreating(false)
    }
  }

  const openSettings = () => {
    Alert.alert("Settings", `Connected to:\n${client?.config.baseUrl ?? ""}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Change server",
        style: "destructive",
        onPress: () => disconnect(),
      },
    ])
  }

  const renderItem = ({ item }: { item: SessionInfo }) => (
    <TouchableOpacity style={styles.card} onPress={() => onOpen(item.id)}>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {item.title || "Untitled session"}
      </Text>
      <View style={styles.cardMeta}>
        {item.agent ? <Text style={styles.tag}>{item.agent}</Text> : null}
        {item.model ? (
          <Text style={styles.tagDim}>{item.model.id.split("/").pop()}</Text>
        ) : null}
        <Text style={styles.time}>{formatTime(item.time.created)}</Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sessions</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={openSettings}>
            <Text style={styles.iconBtnText}>⚙</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, styles.iconBtnAccent]}
            onPress={createSession}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.iconBtnText, { color: "#fff" }]}>+</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={sessions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={sessions.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={Colors.accent}
          />
        }
        ListEmptyComponent={
          loadingSessions ? (
            <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No sessions</Text>
              <Text style={styles.emptyHint}>Tap + to create one</Text>
            </View>
          )
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: Colors.text },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnAccent: { backgroundColor: Colors.accent },
  iconBtnText: { fontSize: 18, color: Colors.textDim, fontWeight: "700" },
  list: { paddingVertical: 4 },
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: { color: Colors.text, fontSize: 15, fontWeight: "600" },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  tag: {
    backgroundColor: Colors.accent,
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  tagDim: {
    color: Colors.textDim,
    fontSize: 12,
  },
  time: { color: Colors.textDim, fontSize: 12, marginLeft: "auto" },
  emptyContainer: { flex: 1 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { color: Colors.textDim, fontSize: 16 },
  emptyHint: { color: Colors.textDim, fontSize: 13, marginTop: 6 },
})