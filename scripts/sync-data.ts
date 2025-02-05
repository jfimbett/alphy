import { Pool } from 'pg';
import fetch from 'node-fetch';

// Hardcoded values
const API_BASE_URL = 'https://0d28-194-214-160-21.ngrok-free.app';
const API_TOKEN = 't3stt@ken';
const DB_CONFIG = {
  user: 'postgres',
  password: '1234',
  host: 'localhost',
  port: 5432,
  database: 'sec_financial_data', // Ensure correct database
  ssl: false
};

// Utility to normalize CIK format
function normalizeCik(cik: string): string {
  // Remove leading zeros and ensure string type
  return String(parseInt(cik, 10));
}

async function fetchPaginatedData<T>(endpoint: string): Promise<T> {
  const url = new URL(`${API_BASE_URL}/${endpoint}`);
  url.searchParams.set('api_token', API_TOKEN);
  
  const response = await fetch(url.toString(), {
    headers: { 
      'ngrok-skip-browser-warning': 'true',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
  return response.json() as Promise<T>;
}

async function syncDatabase() {
  const pool = new Pool(DB_CONFIG);
  const client = await pool.connect();

  try {
    const [cikNames, cikTickers] = await Promise.all([
      fetchPaginatedData<Record<string, string>>('cik_names'),
      fetchPaginatedData<Record<string, string[]>>('cik_tickers')
    ]);

    // Normalize and merge all CIKs
    const allCiks = new Set<string>([
      ...Object.keys(cikNames).map(normalizeCik),
      ...Object.keys(cikTickers).map(normalizeCik)
    ]);

    // Create company entries
    const companies = Array.from(allCiks).map(cik => ({
      cik: cik.padStart(10, '0'), // Store as 10-digit string
      name: cikNames[cik] || 'Unknown Company'
    }));

    // Upsert companies
    for (const { cik, name } of companies) {
      await client.query(`
        INSERT INTO companies (cik, name)
        VALUES ($1, $2)
        ON CONFLICT (cik) DO UPDATE SET name = EXCLUDED.name
      `, [cik, name]);
    }

    // Process tickers with normalized CIKs
    const tickerInserts = Object.entries(cikTickers).flatMap(([rawCik, tickers]) => {
      const normalizedCik = normalizeCik(rawCik);
      return tickers.map(ticker => ({
        cik: normalizedCik.padStart(10, '0'),
        ticker: ticker.toUpperCase().trim()
      }));
    });

    await client.query('TRUNCATE tickers CASCADE');
    
    for (const { cik, ticker } of tickerInserts) {
      await client.query(`
        INSERT INTO tickers (cik, ticker)
        VALUES ($1, $2)
        ON CONFLICT (cik, ticker) DO NOTHING
      `, [cik, ticker]);
    }

    console.log(`Synced ${companies.length} companies and ${tickerInserts.length} tickers`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Sync failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

syncDatabase();