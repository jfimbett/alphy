
import { NextResponse } from 'next/server';
import pool from '@/utils/db';
import { FileNode } from '@/components/FileTree';


export async function DELETE(request: Request,{ params }: { params: { uploadId: string } }) {
  let client;
  try {
    client = await pool.connect();
    const uploadId = parseInt(params.uploadId,10);
    if(isNaN(uploadId)) {
      return NextResponse.json({ error:'Invalid upload ID'},{ status:400 });
    }
    //1) Find all files for this upload
    const fileRes = await client.query(
      'SELECT file_id FROM files WHERE upload_id=$1',[uploadId]
    );
    const fileIds = fileRes.rows.map(r=>r.file_id);
    //2) Delete extractions for these files
    if(fileIds.length>0) {
      await client.query(
        'DELETE FROM extractions WHERE file_id=ANY($1)',
        [fileIds]
      );
    }
    //3) Delete files themselves
    await client.query('DELETE FROM files WHERE upload_id=$1',[uploadId]);
    //4) Finally delete the upload
    await client.query('DELETE FROM uploads WHERE upload_id=$1',[uploadId]);
    client.release();
    return NextResponse.json({ success:true },{ status:200 });
  } catch(error) {
    console.error('Error deleting entire upload:',error);
    if(client) client.release();
    return NextResponse.json({ error:'Error deleting upload'},{ status:500 });
  }
}


export async function PATCH(request: Request,{ params }: { params: { uploadId: string } }) {
  let client;
  try {
    client = await pool.connect();
    const uploadId = parseInt(params.uploadId, 10);
    if (isNaN(uploadId)) {
      return NextResponse.json({ error: 'Invalid upload ID' }, { status: 400 });
    }

    const body = await request.json();
    const { fileTree, extractedTexts, summaries } = body;
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
            fileDataBase64: node.base64Data, // from front end
            mimeType: node.mimeType || 'application/octet-stream'
          });
        }
        if (node.children?.length) traverseTree(node.children);
      }
    }
    traverseTree(fileTree);

    // For each file, either insert or update
    for (const file of filesToInsert) {
      const existingFileRes = await client.query(
        `SELECT file_id FROM files WHERE upload_id = $1 AND file_path = $2`,
        [uploadId, file.fullPath]
      );
      let fileId: number;
      if (existingFileRes.rowCount && existingFileRes.rowCount > 0) {
        fileId = existingFileRes.rows[0].file_id;
        // Potentially update file_data if new base64 data is provided
        if (file.fileDataBase64) {
          const fileDataBuffer = Buffer.from(file.fileDataBase64, 'base64');
          await client.query(
            `UPDATE files
                SET file_data = $2, mime_type=$3
              WHERE file_id = $1`,
            [fileId, fileDataBuffer, file.mimeType]
          );
        }
      } else {
        // Insert new file row
        const fileDataBuffer = file.fileDataBase64
          ? Buffer.from(file.fileDataBase64, 'base64')
          : null;
        const insertRes = await client.query(
          `INSERT INTO files (upload_id, file_name, file_path, mime_type, file_data, is_extracted)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING file_id`,
          [
            uploadId,
            file.fileName,
            file.fullPath,
            file.mimeType,
            fileDataBuffer,
            false
          ]
        );
        fileId = insertRes.rows[0].file_id;
      }

      // Check if we have extraction for that path
      const extractedText = extractedTexts[file.fullPath];
      const summary = summaries[file.fullPath];
      if (extractedText || summary) {
        // Mark file as extracted
        await client.query(`UPDATE files SET is_extracted = TRUE WHERE file_id = $1`, [fileId]);
        // Upsert extraction
        const existingExtractRes = await client.query(
          `SELECT extraction_id FROM extractions WHERE file_id=$1`,
          [fileId]
        );
        if (existingExtractRes.rowCount && existingExtractRes.rowCount > 0) {
          await client.query(
            `UPDATE extractions
                SET extracted_text=$2,
                    summarized_text=$3,
                    updated_at=NOW()
              WHERE file_id=$1`,
            [fileId, extractedText || null, summary || null]
          );
        } else {
          await client.query(
            `INSERT INTO extractions (file_id, extracted_text, summarized_text)
             VALUES ($1,$2,$3)`,
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
