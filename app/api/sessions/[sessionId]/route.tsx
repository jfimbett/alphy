// app/api/sessions/[sessionId]/route.tsx
import { NextResponse } from 'next/server';
import pool from '@/utils/db';

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  const client = await pool.connect();
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const sId = parseInt(params.sessionId, 10);
    if (isNaN(sId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    const res = await client.query(
      `SELECT session_id, session_name, created_at
         FROM sessions
        WHERE session_id = $1 AND user_id = $2`,
      [sId, userId]
    );
    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    const session = res.rows[0];
    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json({ error: 'Error fetching session' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const sId = parseInt(params.sessionId, 10);
    if (isNaN(sId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }
    // Optionally, remove the session reference from files (set session_id to NULL)
    await client.query(
      `UPDATE files SET session_id = NULL WHERE session_id = $1 AND user_id = $2`,
      [sId, userId]
    );
    const deleteResult = await client.query(
      `DELETE FROM sessions WHERE session_id = $1 AND user_id = $2`,
      [sId, userId]
    );
    await client.query('COMMIT');
    if (deleteResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Session not found or not authorized' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting session:', error);
    return NextResponse.json({ error: 'Error deleting session' }, { status: 500 });
  } finally {
    client.release();
  }
}
