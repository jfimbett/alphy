// app/api/all-accounts/route.ts
import { NextResponse } from "next/server"

const BASE_URL = process.env.EXTERNAL_API_BASE_URL // e.g. "https://df1c-194-214-160-21.ngrok-free.app"
const API_TOKEN = process.env.EXTERNAL_API_TOKEN   // e.g. "t3stt%40ken"

export async function GET() {
  try {
    // Build remote URL
    const remoteUrl = `${BASE_URL}/all_accounts?api_token=${API_TOKEN}`

    // Server-to-server fetch => no CORS issue
    const response = await fetch(remoteUrl)
    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error("Error in /api/all-accounts route:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
