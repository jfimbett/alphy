'use server';
import { NextResponse } from 'next/server';
import pool from '@/utils/db';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    const client = await pool.connect();
    const userRes = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    client.release();
    if (userRes.rowCount === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const user = userRes.rows[0];
    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    // Return user data (do not include the password hash)
    const userData = { user_id: user.user_id, email: user.email };
    return NextResponse.json({ success: true, user: userData }, { status: 200 });
  } catch (error) {
    console.error('Error in login:', error);
    return NextResponse.json({ error: 'Error logging in' }, { status: 500 });
  }
}
