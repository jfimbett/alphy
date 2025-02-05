// app/api/account-data/route.ts
import { NextResponse } from "next/server"

const BASE_URL = process.env.EXTERNAL_API_BASE_URL
const API_TOKEN = process.env.EXTERNAL_API_TOKEN

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    // e.g. "AccountsPayableCurrent"
    const accountParam = searchParams.get("account") ?? ""
    // e.g. "2022" or "2023"
    const yearParam = searchParams.get("year") ?? ""

    if (!accountParam) {
      return NextResponse.json({ error: "Missing 'account' query param" }, { status: 400 })
    }

    // Remote endpoint might be something like:
    //    /all_data_for_account?account=AccountsPayableCurrent&year=2022&api_token=...
    const remoteUrl = `${BASE_URL}/all_data_for_account?account=${accountParam}&year=${yearParam}&api_token=${API_TOKEN}`

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
    console.error("Error in /api/account-data route:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
