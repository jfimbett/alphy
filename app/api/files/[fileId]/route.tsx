import { NextResponse } from 'next/server';
import pool from '@/utils/db';

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
