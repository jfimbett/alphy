'use server';
import { NextResponse } from 'next/server';
import pool from '@/utils/db';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, company, reason } = body;
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    const client = await pool.connect();
    // Check if the user already exists
    const userCheck = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck && userCheck.rowCount !== null && userCheck.rowCount > 0) {
      client.release();
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }
    // Hash the password
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);
    // Insert new user
    const result = await client.query(
      `INSERT INTO users (email, password_hash, company, reason) 
       VALUES ($1, $2, $3, $4) RETURNING user_id, email`,
      [email, password_hash, company, reason]
    );
    client.release();
    return NextResponse.json({ success: true, user: result.rows[0] }, { status: 200 });
  } catch (error) {
    console.error('Error in signup:', error);
    return NextResponse.json({ error: 'Error signing up' }, { status: 500 });
  }
}
