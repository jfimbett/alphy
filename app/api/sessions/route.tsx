import { NextResponse } from 'next/server';
import pool from '@/utils/db';

export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get latest session with files
    const sessionResult = await client.query(
      `SELECT s.session_id, s.session_data, 
              f.file_id, f.file_name, f.file_type
       FROM sessions s
       LEFT JOIN files f ON f.session_id = s.session_id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({ session_data: {} });
    }

    // Structure response
    const sessionData = sessionResult.rows[0].session_data;
    const files = sessionResult.rows
      .filter(row => row.file_id)
      .map(row => ({
        file_id: row.file_id,
        name: row.file_name,
        type: row.file_type
      }));

    return NextResponse.json({ 
      session_data: { ...sessionData, files }
    });
  } catch (error) {
    console.error('Session load error:', error);
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionData, fileIds } = await request.json();
    
    // Create new session
    const sessionResult = await client.query(
      `INSERT INTO sessions (user_id, session_data)
       VALUES ($1, $2)
       RETURNING session_id`,
      [userId, sessionData]
    );
    
    // Link files to session
    if (fileIds?.length > 0) {
      await client.query(
        `UPDATE files
         SET session_id = $1
         WHERE file_id = ANY($2)`,
        [sessionResult.rows[0].session_id, fileIds]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session save error:', error);
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  } finally {
    client.release();
  }
}