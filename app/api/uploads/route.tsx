// app/api/uploads/route.ts
import { NextResponse } from 'next/server';
import pool from '@/utils/db';
import { FileNode } from '@/components/FileTree';

export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = await pool.connect();
    // 1) Fetch all uploads for this user:
    const uploadsResult = await client.query(`
      SELECT upload_id, upload_name, created_at
      FROM uploads
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    const uploads = uploadsResult.rows;
    client.release();
    return NextResponse.json({ uploads });
  } catch (error) {
    console.error('Error fetching uploads:', error);
    return NextResponse.json({ error: 'Error fetching uploads' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let client;
  try {
    client = await pool.connect();
    const body = await request.json();
    const { uploadName, fileTree, extractedTexts, summaries, chatHistory } = body;

    // 1) Validate user ID from headers
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2) Validate required fields
    if (!uploadName) {
      return NextResponse.json({ error: 'uploadName is required' }, { status: 400 });
    }

    // 3) Create a new "upload" row
    const insertUploadRes = await client.query(
      `INSERT INTO uploads (user_id, upload_name)
       VALUES ($1, $2)
       RETURNING upload_id`,
      [userId, uploadName]
    );
    const newUploadId = insertUploadRes.rows[0].upload_id;

    // 4) Gather all files from the fileTree
    const filesToInsert: Array<{
      fullPath: string;
      fileName: string;
      fileDataBase64?: string;
      mimeType: string;
    }> = [];

    function traverseTree(nodes: FileNode[]) {
      for (const node of nodes) {
        if (node.type === 'file') {
          filesToInsert.push({
            fullPath: node.fullPath || '',
            fileName: node.name,
            fileDataBase64: node.base64Data, // base64 string from the frontend
            mimeType: node.mimeType || 'application/octet-stream'
          });
        }
        if (node.children?.length) {
          traverseTree(node.children);
        }
      }
    }
    traverseTree(fileTree || []);

    // 5) Insert each file row + extraction if applicable
    for (const file of filesToInsert) {
      const fileDataBuffer = file.fileDataBase64
        ? Buffer.from(file.fileDataBase64, 'base64')
        : null;

      // Insert a row in "files"
      const insertFileRes = await client.query(
        `INSERT INTO files (upload_id, file_name, file_path, mime_type, file_data, is_extracted)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING file_id`,
        [
          newUploadId,
          file.fileName,
          file.fullPath,
          file.mimeType,
          fileDataBuffer,
          false
        ]
      );

      const fileId = insertFileRes.rows[0].file_id;

      // If there's text or summary, insert into "extractions"
      const extractedText = extractedTexts?.[file.fullPath];
      const summary = summaries?.[file.fullPath];
      if (extractedText || summary) {
        // Mark file as extracted
        await client.query(
          `UPDATE files SET is_extracted = TRUE WHERE file_id = $1`,
          [fileId]
        );

        // Insert into "extractions"
        await client.query(
          `INSERT INTO extractions (file_id, extracted_text, summarized_text)
           VALUES ($1, $2, $3)`,
          [fileId, extractedText || null, summary || null]
        );
      }
    }

    client.release();

    // Return the upload_id and chatHistory (if any)
    return NextResponse.json(
      { upload_id: newUploadId, chatHistory },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating new upload:', error);
    if (client) client.release();
    return NextResponse.json(
      { error: 'Error creating new upload' },
      { status: 500 }
    );
  }
}
