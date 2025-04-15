import { NextResponse } from 'next/server';
import pool from '@/utils/db';
import crypto from 'crypto';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = request.headers.get('x-api-key');
  const action = searchParams.get('action');
  const userId = request.headers.get('x-user-id');

  // Handle API key management
  if (action === 'manageKeys') {
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const client = await pool.connect();
      const result = await client.query(
        'SELECT key, created_at FROM api_keys_app WHERE user_id = $1', // Changed table name
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
  const companyName = searchParams.get('name');
  const sessionId = searchParams.get('sessionId');

  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  let client;
  try {
    client = await pool.connect();
    const keyCheck = await client.query(
      'SELECT user_id FROM api_keys_app WHERE key = $1', // Changed table name
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

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = await pool.connect();
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    await client.query(
      'INSERT INTO api_keys_app (user_id, key) VALUES ($1, $2)', // Changed table name
      [userId, apiKey]
    );
    
    client.release();
    return NextResponse.json({ key: apiKey });
  } catch (error) {
    console.error('API Key Creation Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
