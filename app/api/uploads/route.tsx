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

    // The frontend (Dashboard) will send these:
    const { fileTree, extractedTexts, summaries, chatHistory, uploadName } = body;

    const uploadPath = '/uploads/temp.zip'; // or some placeholder
    
    const finalName = uploadName || `New Upload - ${new Date().toLocaleString()}`;

    // 1) Insert a new row in `uploads`
    const uploadResult = await client.query(
      `INSERT INTO uploads (user_id, upload_name, upload_path)
       VALUES ($1, $2, $3)
       RETURNING upload_id`,
      [MOCK_USER_ID, finalName, uploadPath]
    );
    const newUploadId = uploadResult.rows[0].upload_id;

    // We'll store data in the DB. Let’s parse the fileTree to get each file node.
    // The fileTree is nested, so we need a recursive helper or a flatten approach.
    const filesToInsert: Array<{
      fullPath: string;
      fileName: string;
      isFolder: boolean;
      rawData?: ArrayBuffer;
    }> = [];

    function traverseTree(nodes: FileNode[]) {
      for (const node of nodes) {
        if (node.type === 'file') {
          filesToInsert.push({
            fullPath: node.fullPath || '',
            fileName: node.name,
            isFolder: false,
          });
        }
        if (node.children?.length) {
          traverseTree(node.children);
        }
      }
    }
    traverseTree(fileTree);

    // 2) Insert each file into `files` table
    //    We won't store the actual binary data in the DB here (just the name/path).
    const insertedFileIdsByFullPath: Record<string, number> = {};

    for (const file of filesToInsert) {
      // We'll store file_name, plus maybe we want a file_path. For the demo, just store fullPath.
      const res = await client.query(
        `INSERT INTO files (upload_id, file_name, file_path, mime_type, is_extracted)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING file_id`,
        [
          newUploadId,
          file.fileName,
          file.fullPath,             // Storing the "fullPath" as the file_path
          'application/octet-stream', // Or guess from extension
          false,                      // We'll set true if we have extraction
        ]
      );
      insertedFileIdsByFullPath[file.fullPath] = res.rows[0].file_id;
    }

    // 3) Insert extractions for the extracted text & summary
    //    We'll loop over your "extractedTexts" and "summaries" objects. 
    //    Each key is a file "fullPath".
    for (const [fullPath, text] of Object.entries(extractedTexts)) {
      // If we inserted this path in the files table, we have a file_id
      const fileId = insertedFileIdsByFullPath[fullPath];
      if (!fileId) continue; // skip if not found

      // Mark the file as extracted
      await client.query(
        `UPDATE files 
            SET is_extracted = TRUE
          WHERE file_id = $1`,
        [fileId]
      );

      const summary = summaries[fullPath] || null; // might be absent

      await client.query(
        `INSERT INTO extractions (file_id, extracted_text, summarized_text)
         VALUES ($1, $2, $3)`,
        [fileId, text, summary]
      );
    }

    // Optionally store chatHistory somewhere if you want. You could create a `chat_sessions` table, etc.
    // For now, we won't do that, or we'll store them in "session_data" if you want.

    client.release();

    return NextResponse.json({
      success: true,
      upload_id: newUploadId,
      message: 'Data saved into uploads/files/extractions!',
    });
  } catch (error) {
    console.error('Error saving to DB:', error);
    if (client) client.release();
    return NextResponse.json({ error: 'Error saving data' }, { status: 500 });
  }
}