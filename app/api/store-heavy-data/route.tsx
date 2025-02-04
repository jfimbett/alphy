// app/api/store-heavy-data/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { FileNode } from '@/components/FileTree';

export async function POST(request: Request) {
  try {
    const { sessionId, heavyData } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // 1) Create the directory structure: data/sessionId/files
    const dataDir = path.join(process.cwd(), 'data', sessionId.toString());
    const filesDir = path.join(dataDir, 'files');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir);
    }

    // 2) For each file node in fileTree, decode base64 -> raw file
    function storeFilesRecursively(nodes: FileNode[]): FileNode[] {
      return nodes.map((node, idx) => {
        if (node.type === 'folder' && node.children) {
          return { ...node, children: storeFilesRecursively(node.children) };
        }
        if (node.type === 'file' && node.base64Data) {
          // decode base64
          const buffer = Buffer.from(node.base64Data, 'base64');
          // create a unique filename. You can also keep the original name if you prefer
          // but we add idx or a timestamp to avoid collisions:
          const safeName = node.name.replace(/[^\w\d.]+/g, '_');
          const fileName = `file_${Date.now()}_${idx}_${safeName}`;
          const filePath = path.join(filesDir, fileName);

          // 3) Write the file to data/sessionId/files/
          fs.writeFileSync(filePath, buffer);

          // 4) Remove base64Data from the node, and add localPath
          return {
            ...node,
            base64Data: undefined,
            rawData: undefined,
            localPath: `files/${fileName}`
          };
        }
        return node;
      });
    }

    // If there's a fileTree, store each file on disk
    let updatedFileTree: FileNode[] = [];
    if (heavyData.fileTree) {
      updatedFileTree = storeFilesRecursively(heavyData.fileTree);
    }

    // 5) Overwrite heavyData.fileTree with the updated one
    const finalHeavyData = {
      ...heavyData,
      fileTree: updatedFileTree
    };

    // 6) Write everything to heavyData.json
    const filePath = path.join(dataDir, 'heavyData.json');
    fs.writeFileSync(filePath, JSON.stringify(finalHeavyData, null, 2));

    return NextResponse.json({ success: true, filePath });
  } catch (error) {

    return NextResponse.json(
      { error: 'Failed to save heavy data' + error },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const dataDir = path.join(process.cwd(), 'data', sessionId);
    const filePath = path.join(dataDir, 'heavyData.json');
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'No heavyData found' }, { status: 404 });
    }

    const data = fs.readFileSync(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading heavy data:', error);
    return NextResponse.json({ error: 'Heavy data not found' }, { status: 404 });
  }
}
