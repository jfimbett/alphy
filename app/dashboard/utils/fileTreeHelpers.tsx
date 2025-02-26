// app\dashboard\utils\fileTreeHelpers.ts
import { FileNode } from '@/components/FileTree';

export function addBase64ToTree(nodes: FileNode[]): FileNode[] {
  return nodes.map((node) => {
    if (node.type === 'folder' && node.children) {
      return { ...node, children: addBase64ToTree(node.children) };
    }
    if (node.type === 'file' && node.rawData) {
      const uint8 = new Uint8Array(node.rawData);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64Data = btoa(binary);
      return { ...node, base64Data };
    }
    return node;
  });
}

export function convertTree(nodes: FileNode[], sessionId: number | string): FileNode[] {
  return nodes.map((node) => {
    if (node.type === 'folder' && node.children) {
      return { ...node, children: convertTree(node.children, sessionId) };
    }
    if (node.type === 'file') {
      // Convert base64 => rawData if present
      if (node.base64Data) {
        const binaryString = atob(node.base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        node.rawData = bytes.buffer;
        node.base64Data = undefined; // free it up
      }
      // Build the inline content path if localPath is present
      if (node.localPath) {
        node.content = `/api/session-file?sessionId=${sessionId}&filePath=${encodeURIComponent(
          node.localPath || ''
        )}`;
      }
    }
    return node;
  });
}
