// app/api/submission-history/route.ts

import { NextResponse } from "next/server"

const BASE_URL = process.env.EXTERNAL_API_BASE_URL
const API_TOKEN = process.env.EXTERNAL_API_TOKEN

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cik = searchParams.get("cik") ?? ""

    const remoteUrl = `${BASE_URL}/submission_history?cik=${cik}&api_token=${API_TOKEN}`
    const response = await fetch(remoteUrl, { method: "GET" })
    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error("Error in /api/submission-history route:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
