// app/api/company-facts/route.ts

import { NextResponse } from "next/server"

// We'll assume you're using .env for the base URL and token.
// If not, you can hardcode them here.
const BASE_URL = process.env.NEXT_PUBLIC_EXTERNAL_API_BASE_URL
const API_TOKEN = process.env.NEXT_PUBLIC_EXTERNAL_API_TOKEN

export async function GET(request: Request) {
  try {
    // 1) Extract query params from the incoming request
    const { searchParams } = new URL(request.url)
    // e.g. "320193"
    const cik = searchParams.get("cik") ?? ""

    // 2) Build the remote URL
    const remoteUrl = `${BASE_URL}/company_facts?cik=${cik}&api_token=${API_TOKEN}`

    console.log("Fetching from:", remoteUrl)

    // 3) Fetch from the external API (server-to-server, no CORS issues here)
    const response = await fetch(remoteUrl, {
      method: "GET",
    })

    if (!response.ok) {
      // e.g. 404, 500, ...
      return NextResponse.json(
        { error: `Upstream error: ${response.statusText}` },
        { status: response.status }
      )
    }

    // 4) Return the JSON response to the client
    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
