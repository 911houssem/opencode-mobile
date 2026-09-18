import * as Network from "expo-network"
import { OpenCodeClient, ServerConfig } from "./client"

const PORTS = [4096, 8080]

async function isOpenCode(baseUrl: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const c = new OpenCodeClient({ baseUrl })
    await c.health(timeoutMs)
    return true
  } catch {
    return false
  }
}

function looksPrivateV4(ip: string): boolean {
  const parts = ip.split(".")
  if (parts.length !== 4) return false
  if (!parts.every((p) => /^\d{1,3}$/.test(p))) return false
  const first = Number(parts[0])
  const second = Number(parts[1])
  if (first === 10) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  if (first === 192 && second === 168) return true
  return false
}

async function scanSubnet(ip: string, run = 60): Promise<string | null> {
  const parts = ip.split(".")
  const prefix = parts.slice(0, 3).join(".")
  const last = Number(parts[3])
  const hosts: string[] = []
  for (let i = 1; i <= 254; i++) {
    if (i === last) continue
    hosts.push(`${prefix}.${i}`)
  }

  let found: string | null = null
  let idx = 0
  const worker = async () => {
    while (found === null && idx < hosts.length) {
      const host = hosts[idx++]
      for (const port of PORTS) {
        if (await isOpenCode(`http://${host}:${port}`, 800)) {
          found = `http://${host}:${port}`
          return
        }
      }
    }
  }
  await Promise.all(Array.from({ length: run }, () => worker()))
  return found
}

export async function discoverServer(): Promise<ServerConfig | null> {
  const fixed: string[] = [
    "http://localhost:4096",
    "http://127.0.0.1:4096",
    "http://opencode.local:4096",
    "http://localhost:8080",
    "http://opencode.local:8080",
  ]
  for (const u of fixed) {
    if (await isOpenCode(u, 1500)) return { baseUrl: u }
  }
  try {
    const ip = await Network.getIpAddressAsync()
    if (looksPrivateV4(ip)) {
      const found = await scanSubnet(ip)
      if (found) return { baseUrl: found }
    }
  } catch {
    // ignore discovery over the subnet
  }
  return null
}

export { isOpenCode }