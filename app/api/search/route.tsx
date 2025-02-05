// app/api/search/route.ts
import { NextResponse } from 'next/server';
import pool from '../../../utils/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';

  try {
    const client = await pool.connect();
    const searchQuery = `
      SELECT 
        c.cik,
        c.name,
        ARRAY_AGG(t.ticker) as tickers,
        ts_rank(to_tsvector('english', c.name), plainto_tsquery('english', $1)) as rank
      FROM companies c
      LEFT JOIN tickers t ON c.cik = t.cik
      WHERE 
        to_tsvector('english', c.name) @@ plainto_tsquery('english', $1) OR
        t.ticker = $1 OR
        c.cik = $1
      GROUP BY c.cik, c.name
      ORDER BY rank DESC
      LIMIT 10;
    `;

    const result = await client.query(searchQuery, [query]);
    client.release();

    return NextResponse.json(result.rows.map(row => ({
      ...row,
      searchTerm: row.tickers.includes(query.toUpperCase()) ? query.toUpperCase() : row.cik === query ? query : row.name
    })));
  } catch  {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}