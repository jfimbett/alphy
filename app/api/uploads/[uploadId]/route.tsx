// app/api/uploads/[uploadId]/route.ts
import { NextResponse } from 'next/server';
import pool from '@/utils/db';

export async function PATCH(
  request: Request,
  { params }: { params: { uploadId: string } }
) {
  let client;
  try {
    client = await pool.connect();

    const uploadId = parseInt(params.uploadId, 10);
    if (isNaN(uploadId)) {
      return NextResponse.json({ error: 'Invalid upload ID' }, { status: 400 });
    }

    const body = await request.json();
    const { fileTree, extractedTexts, summaries } = body;

    // We'll do almost the same logic as "create", but we won't create a new `uploads` row.
    // Instead, we insert any new files + extractions referencing the existing upload_id.

    // 1) Figure out which new files are in fileTree
    const filesToInsert: Array<{
      fullPath: string;
      fileName: string;
    }> = [];

    function traverseTree(nodes: any[]) {
      for (const node of nodes) {
        if (node.type === 'file') {
          filesToInsert.push({
            fullPath: node.fullPath,
            fileName: node.name,
          });
        }
        if (node.children?.length) traverseTree(node.children);
      }
    }
    traverseTree(fileTree);

    // 2) For each file, check if it already exists in `files` by checking the "file_path" & "upload_id"
    for (const file of filesToInsert) {
      const existingFileRes = await client.query(
        `SELECT file_id 
           FROM files 
          WHERE upload_id = $1
            AND file_path = $2`,
        [uploadId, file.fullPath]
      );

      let fileId: number;
      if (existingFileRes.rowCount > 0) {
        // It's already in DB
        fileId = existingFileRes.rows[0].file_id;
      } else {
        // Insert new row
        const insertRes = await client.query(
          `INSERT INTO files (upload_id, file_name, file_path, mime_type, is_extracted)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING file_id`,
          [
            uploadId,
            file.fileName,
            file.fullPath,
            'application/octet-stream',
            false,
          ]
        );
        fileId = insertRes.rows[0].file_id;
      }

      // 3) If there's extracted text for that path, upsert an extraction
      const extractedText = extractedTexts[file.fullPath];
      const summary = summaries[file.fullPath];

      if (extractedText || summary) {
        // Mark file as extracted
        await client.query(
          `UPDATE files SET is_extracted = TRUE WHERE file_id = $1`,
          [fileId]
        );

        // Check if we have an existing extraction
        const existingExtractRes = await client.query(
          `SELECT extraction_id FROM extractions WHERE file_id = $1`,
          [fileId]
        );
        if (existingExtractRes.rowCount > 0) {
          // Update
          await client.query(
            `UPDATE extractions
                SET extracted_text = $2,
                    summarized_text = $3,
                    updated_at = NOW()
              WHERE file_id = $1`,
            [fileId, extractedText || null, summary || null]
          );
        } else {
          // Insert
          await client.query(
            `INSERT INTO extractions (file_id, extracted_text, summarized_text)
             VALUES ($1, $2, $3)`,
            [fileId, extractedText || null, summary || null]
          );
        }
      }
    }

    client.release();
    return NextResponse.json({ success: true, message: 'Upload updated.' });
  } catch (error) {
    console.error('Error updating upload:', error);
    if (client) client.release();
    return NextResponse.json({ error: 'Error updating upload' }, { status: 500 });
  }
}
