// app/api/sessions/route.tsx
import { NextResponse } from 'next/server';
import pool from '@/utils/db';
// app/api/sessions/route.tsx
export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId || isNaN(parseInt(userId))) { // Add numeric validation
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  

    const result = await client.query(`
      SELECT 
        s.session_id,
        s.session_name,
        s.created_at,
        (SELECT COUNT(*)::int FROM files f WHERE f.session_id = s.session_id) AS file_count
      FROM sessions s
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
    `, [userId]);


    
    const sessions = result.rows.map((row) => ({
      session_id: row.session_id,
      session_name: row.session_name,
      created_at: row.created_at,
      file_count: row.file_count
    }));

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Session load error:', error);
    //alert(error);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
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

    // Validate user exists first
    const userCheck = await client.query(
      'SELECT user_id FROM users WHERE user_id = $1',
      [userId]
    );
    if (userCheck.rowCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { sessionName } = await request.json();

    const result = await client.query(
      `INSERT INTO sessions (user_id, session_name)
       VALUES ($1, $2)
       RETURNING session_id, created_at`,
      [userId, sessionName]
    );

    const sessionId = result.rows[0].session_id;

    await client.query('COMMIT');
    return NextResponse.json({
      success: true,
      session_id: sessionId,
      created_at: result.rows[0].created_at
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Session save error:', error);
    return NextResponse.json(
      { error: 'Failed to save session' }, 
      { status: 500 }
    );
  } finally {
    client.release();
  }
}