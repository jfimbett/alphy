// app/api/financial-data/route.ts
import { NextResponse } from "next/server"
import { Pool } from 'pg';

const pool = new Pool({
    port: 5432,
    host: 'localhost',
    user: 'postgres',
    password: '1234',
    database: 'sec_financial_data',
});

export async function GET(request: Request) {
  try {
    // 1) Parse query params from the URL
    const { searchParams } = new URL(request.url)
    const nameParam = (searchParams.get("name") ?? "").trim().toLowerCase()
    const tickerParam = (searchParams.get("ticker") ?? "").trim().toLowerCase()
    const cikParam = (searchParams.get("cik") ?? "").trim()

    // 2) Prepare placeholders.
    //    For name, we use a LIKE pattern if it's not empty: '%<name>%'
    //    For ticker, we do an exact match but case-insensitive, so we store it in lowercase and compare with LOWER(t.ticker).
    //    For cik, we do an exact match.
    const nameFilter = nameParam ? `%${nameParam}%` : ""
    const tickerFilter = tickerParam // empty if none provided
    const cikFilter = cikParam // empty if none provided

    // 3) Connect to the database
    const client = await pool.connect()

    // 4) Build and run the query
    //    Explanation:
    //    - LEFT JOIN `tickers` so we can gather possible tickers per `companies` row
    //    - Filter with a combination of name, ticker, and/or cik
    //    - If the corresponding parameter is empty, we skip that filter
    //    - Group by c.cik, c.name so we can do array_agg on the tickers
    const sql = `
      SELECT
        c.cik,
        c.name,
        ARRAY_AGG(t.ticker) AS tickers
      FROM companies c
      LEFT JOIN tickers t ON c.cik = t.cik
      WHERE
        ($1 = '' OR LOWER(c.name) LIKE $1)
        AND ($2 = '' OR LOWER(t.ticker) = $2)
        AND ($3 = '' OR c.cik = $3)
      GROUP BY c.cik, c.name
      ORDER BY c.name ASC
      LIMIT 50;
    `

    const result = await client.query(sql, [
      nameFilter,
      tickerFilter,
      cikFilter,
    ])

    client.release()

    // 5) Return JSON response
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error in /api/financial-data:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
