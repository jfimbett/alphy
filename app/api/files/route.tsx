import { NextResponse } from 'next/server';
import pool from '@/utils/db';

export async function GET() {
  try {
    const client = await pool.connect();
    const result = await client.query(`SELECT * FROM files;`);
    client.release();

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error fetching files' }, { status: 500 });
  }
}
