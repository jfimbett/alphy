// app/api/test/route.ts
import { NextResponse } from 'next/server';
import pool from '@/utils/db';

export async function GET() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM files ORDER BY file_id;');
    client.release();

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching data', error);
    return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
  }
}
