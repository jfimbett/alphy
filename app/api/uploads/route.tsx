// app/api/uploads/route.ts
import { NextResponse } from 'next/server';
import pool from '@/utils/db';
// import FileNode
import { FileNode } from '@/components/FileTree'

// In production, you'd parse the token/session to get real user ID. 
// Hard-coded user_id = 1 for this demo:
const MOCK_USER_ID = 1;

export async function GET() {
  try {
    const client = await pool.connect();

    // 1) Fetch all uploads for this user:
    const uploadsResult = await client.query(
      `SELECT upload_id, upload_name, upload_path, created_at
         FROM uploads
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [MOCK_USER_ID]
    );
    const uploads = uploadsResult.rows;

    // 2) For each upload, fetch the related files, plus any extraction info
    //    We'll do it in one or two queries. One approach is to do separate queries, 
    //    or use a LEFT JOIN. Let's do a multi-step approach for clarity:

    interface Upload {
      upload_id: number;
      upload_name: string;
      upload_path: string;
      created_at: Date;
    }

    const uploadIds = uploads.map((u: Upload) => u.upload_id);

    // If no uploads, return early
    if (uploadIds.length === 0) {
      client.release();
      return NextResponse.json({ uploads: [] });
    }

    // 3) Fetch files for those uploads
    //    We'll get file_id, file_name, is_extracted, etc. 
    //    Then we can do a second query for extractions if we want that detail.
    const filesResult = await client.query(
      `SELECT f.file_id, f.upload_id, f.file_name, f.file_path, f.mime_type, f.is_extracted, f.created_at,
              e.extracted_text, e.summarized_text
         FROM files f
         LEFT JOIN extractions e ON e.file_id = f.file_id
        WHERE f.upload_id = ANY($1::int[]) 
        ORDER BY f.file_id`,
      [uploadIds]
    );
    const filesRows = filesResult.rows;

    // Now we have something like:
    // [
    //   { file_id: 1, upload_id: 1, file_name: '...', extracted_text: '...', summarized_text: '...' },
    //   ...
    // ]
    // We want to nest them under the "uploads" array

    // 4) Group files by upload_id
    interface File {
      file_id: number;
      upload_id: number;
      file_name: string;
      file_path: string;
      mime_type: string;
      is_extracted: boolean;
      created_at: Date;
      extracted_text: string | null;
      summarized_text: string | null;
    }

    const filesByUpload: Record<number, File[]> = {};
    for (const fileRow of filesRows) {
      const uId = fileRow.upload_id;
      if (!filesByUpload[uId]) {
        filesByUpload[uId] = [];
      }
      filesByUpload[uId].push(fileRow);
    }

    // 5) Merge files into each upload object
    const finalUploads = uploads.map((u: Upload) => {
      return {
        ...u,
        files: filesByUpload[u.upload_id] || []
      };
    });

    client.release();
    return NextResponse.json({ uploads: finalUploads });
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

    if (!uploadName) {
      return NextResponse.json({ error: 'uploadName is required' }, { status: 400 });
    }

    // For now, let's assume user_id=1 or something (you can replace it with the actual user ID).
    const userId = 1;
    const insertUploadRes = await client.query(
      `INSERT INTO uploads (user_id, upload_name) VALUES ($1, $2) RETURNING upload_id`,
      [userId, uploadName]
    );
    const newUploadId = insertUploadRes.rows[0].upload_id;

    // We'll collect all file info from fileTree
    const filesToInsert: Array<{
      fullPath: string;
      fileName: string;
      fileDataBase64?: string;
      mimeType: string;
    }> = [];

    function traverseTree(nodes: FileNode[]) {
      for (const node of nodes) {
        if (node.type === 'file') {
          // We expect base64 in node.base64Data if we added that in the front end
          filesToInsert.push({
            fullPath: node.fullPath || '',
            fileName: node.name,
            fileDataBase64: node.base64Data, // base64 string from the front end
            mimeType: node.mimeType || 'application/octet-stream'
          });
        }
        if (node.children?.length) traverseTree(node.children);
      }
    }
    traverseTree(fileTree);

    for (const file of filesToInsert) {

      
      // Insert new file row
      const fileDataBuffer = file.fileDataBase64
        ? Buffer.from(file.fileDataBase64, 'base64')
        : null;
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

      // If there's extracted text or summary, insert into extractions
      const extractedText = extractedTexts[file.fullPath];
      const summary = summaries[file.fullPath];
      if (extractedText || summary) {
        // Mark file as extracted
        await client.query(`UPDATE files SET is_extracted = TRUE WHERE file_id=$1`, [fileId]);
        // Insert extraction
        await client.query(
          `INSERT INTO extractions (file_id, extracted_text, summarized_text)
           VALUES ($1, $2, $3)`,
          [fileId, extractedText || null, summary || null]
        );
      }
    }

    client.release();
    return NextResponse.json({ upload_id: newUploadId, chatHistory }, { status: 200 });
  } catch (error) {
    console.error('Error creating new upload:', error);
    if (client) client.release();
    return NextResponse.json({ error: 'Error creating new upload' }, { status: 500 });
  }
}