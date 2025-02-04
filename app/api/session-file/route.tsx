import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import mime from 'mime'; // install via `npm install mime` if you want to do more robust MIME detection

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const filePath = searchParams.get('filePath');

    if (!sessionId || !filePath) {
      return NextResponse.json(
        { error: 'Missing sessionId or filePath' },
        { status: 400 }
      );
    }

    // Construct the absolute path on disk
    const absolutePath = path.join(
      process.cwd(),
      'data',
      sessionId,
      decodeURIComponent(filePath) // Add URI decoding
    );

    console.log('Serving file:', absolutePath);

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Read file from disk
    const fileBuffer = fs.readFileSync(absolutePath);

    // Infer MIME type from the filename extension, or fall back to octet-stream
    const mimeType = mime.getType(absolutePath) || 'application/octet-stream';

    const headers = {
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${path.basename(absolutePath)}"`,
    };
    // Add proper PDF content disposition
    if (mimeType === 'application/pdf') {
      headers['Content-Disposition'] = `inline; filename="${path.basename(absolutePath)}"`;
    } else {
      headers['Content-Disposition'] = `attachment; filename="${path.basename(absolutePath)}"`;
    }

    // Return the file bytes in the response
    return new NextResponse(fileBuffer, {
      headers: headers,
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'File serving error' }, { status: 500 });
  }
}
