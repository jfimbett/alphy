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

// Verify the DELETE handler is properly using query params
export async function DELETE(request: Request) {
  const userId = request.headers.get('x-user-id');
  const { searchParams } = new URL(request.url);
  const keyToDelete = searchParams.get('key');

  if (!userId || !keyToDelete) {
    return NextResponse.json(
      { error: 'Missing required parameters' }, 
      { status: 400 }  // More appropriate status than 401
    );
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM api_keys_app WHERE user_id = $1 AND key = $2 RETURNING *',
      [userId, keyToDelete]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Key not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Key Deletion Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}