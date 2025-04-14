// app/api/api-keys/route.ts
import { NextResponse } from 'next/server';
import pool from '@/utils/db';
import crypto from 'crypto';

export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT key, created_at FROM api_keys_app WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return NextResponse.json({ keys: result.rows });
  } catch (error) {
    console.error('API Key Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const apiKey = crypto.randomBytes(32).toString('hex');
    await client.query(
      'INSERT INTO api_keys_app (user_id, key) VALUES ($1, $2)',
      [userId, apiKey]
    );
    return NextResponse.json({ key: apiKey });
  } catch (error) {
    console.error('API Key Creation Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}