import { NextResponse } from 'next/server';
import pool from '@/utils/db';
import crypto from 'crypto';

// Existing company data endpoint
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = request.headers.get('x-api-key');
  const companyName = searchParams.get('name');
  const sessionId = searchParams.get('sessionId');

  // Handle API key management requests
  if (searchParams.get('action') === 'manageKeys') {
    try {
      const userId = 'user_id_from_request'; // Implement proper auth
      const client = await pool.connect();
      const result = await client.query(
        'SELECT key, created_at FROM api_keys WHERE user_id = $1',
        [userId]
      );
      client.release();
      return NextResponse.json({ keys: result.rows });
    } catch (error) {
      console.error('API Key Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // Existing company data logic
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  let client;
  try {
    client = await pool.connect();
    const keyCheck = await client.query(
      'SELECT user_id FROM api_keys WHERE key = $1',
      [apiKey]
    );
    
    if (keyCheck.rowCount === 0) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const heavyRes = await fetch(
      `${process.env.NEXTAUTH_URL}/api/store-heavy-data?sessionId=${sessionId}`
    );
    if (!heavyRes.ok) {
      return NextResponse.json({ error: 'Session data not found' }, { status: 404 });
    }

    const heavyData = await heavyRes.json();
    const company = heavyData.consolidatedCompanies?.find(
      (c: any) => c.name === companyName
    );

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// New POST endpoint for creating API keys
export async function POST(request: Request) {
  try {
    const userId = 'user_id_from_request'; // Implement proper auth
    const client = await pool.connect();
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    await client.query(
      'INSERT INTO api_keys (user_id, key) VALUES ($1, $2)',
      [userId, apiKey]
    );
    
    client.release();
    return NextResponse.json({ key: apiKey });
  } catch (error) {
    console.error('API Key Creation Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}