import { NextResponse } from 'next/server';
import pool from '@/utils/db';

// In a real app, you'd parse the token/session to get the actual user_id.
const MOCK_USER_ID = 1;

export async function GET() {
  try {
    const client = await pool.connect();

    // We'll just return the most recent session_data for this user.
    const result = await client.query(
      `SELECT session_data 
         FROM sessions 
        WHERE user_id = $1 
        ORDER BY updated_at DESC 
        LIMIT 1`,
      [MOCK_USER_ID]
    );

    client.release();

    // If no row found, return an empty object
    if (result.rows.length === 0) {
      return NextResponse.json({ session_data: null });
    }

    return NextResponse.json({ session_data: result.rows[0].session_data });
  } catch (error) {
    console.error('Error loading session:', error);
    return NextResponse.json({ error: 'Error loading session' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // body should contain "fileTree", "extractedTexts", "summaries", "chatHistory", etc.
    const { fileTree, extractedTexts, summaries, chatHistory } = body;

    const sessionData = {
      fileTree,
      extractedTexts,
      summaries,
      chatHistory,
    };

    const client = await pool.connect();

    // Upsert logic: For simplicity, just INSERT a new row each time we save.
    // Or you could find the existing row for user_id=1 and UPDATE it.
    const result = await client.query(
      `INSERT INTO sessions (user_id, session_data, updated_at) 
       VALUES ($1, $2, NOW())
       RETURNING session_id`,
      [MOCK_USER_ID, sessionData]
    );

    client.release();

    return NextResponse.json({ success: true, session_id: result.rows[0].session_id });
  } catch (error) {
    console.error('Error saving session:', error);
    return NextResponse.json({ error: 'Error saving session' }, { status: 500 });
  }
}
