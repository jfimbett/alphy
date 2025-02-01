import { NextResponse } from 'next/server';
import pool from '@/utils/db';


export async function GET(
  request: Request,
  { params }: { params: { fileId: string } }
) {
  const client = await pool.connect();
  try {
    const fileId = parseInt(params.fileId);
    if (isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const result = await client.query(
      `SELECT file_name, file_type, file_data 
       FROM files 
       WHERE file_id = $1`,
      [fileId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const file = result.rows[0];
    return new NextResponse(file.file_data, {
      headers: {
        'Content-Type': file.file_type,
        'Content-Disposition': `attachment; filename="${file.file_name}"`
      }
    });
  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json({ error: 'File download failed' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { fileId: string } }
) {
  let client;
  try {
    client = await pool.connect();
    const fileId = parseInt(params.fileId, 10);
    if (isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    // Remove any extractions for this file, then remove the file itself
    await client.query('DELETE FROM extractions WHERE file_id = $1', [fileId]);
    await client.query('DELETE FROM files WHERE file_id = $1', [fileId]);

    client.release();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting file:', error);
    if (client) client.release();
    return NextResponse.json({ error: 'Error deleting file' }, { status: 500 });
  }
}
