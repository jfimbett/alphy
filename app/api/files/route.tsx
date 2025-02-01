import { NextResponse } from 'next/server';
import pool from '@/utils/db';

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const insertedFiles = [];
    
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await client.query(
        `INSERT INTO files 
         (user_id, file_name, file_type, file_data) 
         VALUES ($1, $2, $3, $4)
         RETURNING file_id`,
        [userId, file.name, file.type, buffer]
      );
      insertedFiles.push(result.rows[0].file_id);
    }

    return NextResponse.json({ success: true, fileIds: insertedFiles });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function GET() {
  try {
    const client = await pool.connect();
    const result = await client.query(`SELECT * FROM files;`);
    client.release();

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error fetching files' }, { status: 500 });
  }
}
