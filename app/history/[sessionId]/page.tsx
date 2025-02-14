// app/history/[sessionId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ReactJson from 'react-json-view';
import * as XLSX from 'xlsx';
import { FileNode } from '@/components/FileTree';

// Define the structure of the session data stored in the database.
export interface SessionData {
  session_name: string;
  fileTree?: FileNode[];
  // You can add other properties (extractedTexts, summaries, chatHistory, etc.) here
  [key: string]: unknown;
}

// Define the session structure returned by your API.
export interface Session {
  session_data: SessionData;
  created_at: string;
  file_count: number;
}

// A helper function to recursively extract Excel files from the file tree.
const getExcelFiles = (nodes: FileNode[]): FileNode[] => {
  let files: FileNode[] = [];
  nodes.forEach((node) => {
    if (node.type === 'file' && /\.(xlsx|xls)$/i.test(node.name)) {
      files.push(node);
    }
    if (node.children && node.children.length > 0) {
      files = files.concat(getExcelFiles(node.children));
    }
  });
  return files;
};

// Component to preview an Excel file node.
const ExcelPreview: React.FC<{ node: FileNode }> = ({ node }) => {
  const [tableData, setTableData] = useState<string[][]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const parseExcel = async () => {
      if (!node.base64Data) {
        setError('No data available');
        return;
      }
      try {
        // Decode the base64 string into a binary string.
        const binaryStr = atob(node.base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        // Parse the workbook using XLSX.
        const workbook = XLSX.read(bytes, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // Convert the sheet to an array-of-arrays (each row is an array).
        const data: (string | number | boolean | null)[][] = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, { header: 1 });
        const stringData: string[][] = data.map(row => row.map(cell => cell !== null ? cell.toString() : ''));
        setTableData(stringData);
      } catch {
        setError('Error parsing Excel file');
      }
    };

    parseExcel();
  }, [node.base64Data]);

  return (
    <div className="mb-4">
      <h3 className="font-semibold text-gray-800">{node.name}</h3>
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : tableData.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <tbody>
              {tableData.slice(0, 10).map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-gray-200">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-2 py-1 border-r border-gray-200 text-gray-800"
                    >
                      {cell !== undefined ? cell.toString() : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {tableData.length > 10 && (
            <p className="text-sm text-gray-600 mt-2">Showing first 10 rows</p>
          )}
        </div>
      ) : (
        <p className="text-gray-800">No data to preview</p>
      )}
    </div>
  );
};

const SessionDetail: React.FC = () => {
  const { sessionId } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string>('');

// Add this useEffect to fetch heavy data when the component mounts
useEffect(() => {

  const userId = localStorage.getItem('userId');
  if (!userId || !sessionId) return;

  const fetchHeavyData = async () => {
    try {
      const res = await fetch(`/api/store-heavy-data?sessionId=${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch heavy data');
      const heavyData = await res.json();
      // Merge heavy data into session data
      setSession(prev => prev ? {
        ...prev,
        session_data: {
          ...prev.session_data,
          extractedTexts: heavyData.extractedTexts,
          summaries: heavyData.summaries
        }
      } : null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    }
  };

  async function fetchSession() {
    try {
      // 1) Minimal session info from the DB
      const sessRes = await fetch(`/api/sessions/${sessionId}`, {
        headers: { 'x-user-id': userId || '' },
      });
      if (!sessRes.ok) throw new Error('Failed to fetch session');
      const sessJson = await sessRes.json();
      // sessJson is { session: { session_id, session_name, created_at, ... } }

      // 2) Heavy data from local file
      const heavyRes = await fetch(`/api/store-heavy-data?sessionId=${sessionId}`);
      // If heavy data doesn’t exist, it might be 404. You can handle that gracefully.
      if (!heavyRes.ok) {
        console.warn('No heavy data found (maybe not uploaded yet).');
      }
      const heavyJson = heavyRes.ok ? await heavyRes.json() : {};

      // 3) Merge them together
      // Suppose your DB session JSON doesn't store `session_data` by default.
      // You can create a structure that includes fileTree, chatHistory, etc.
      setSession({
        // For example, you can store them like:
        session_data: {
          session_name: sessJson.session.session_name,
          fileTree: heavyJson.extractedTexts ? [] : [], // or reconstruct if you wish
          // Or you can do more advanced merges if you have them
          extractedTexts: heavyJson.extractedTexts || {},
          summaries: heavyJson.summaries || {},
        },
        created_at: sessJson.session.created_at,
        file_count: sessJson.session.file_count || 0,
      });
    } catch (err) {
      console.error('Error fetching session details:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  if (sessionId) {
    fetchSession();
    fetchHeavyData();
  }
}, [sessionId]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8 flex-grow text-gray-800">
          <p className="text-red-600">{error}</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8 flex-grow text-gray-800">
          <p>Loading session details...</p>
        </main>
        <Footer />
      </div>
    );
  }

  // Extract Excel files (if any) from the file tree stored in session_data.
  const excelFiles: FileNode[] = session.session_data.fileTree
    ? getExcelFiles(session.session_data.fileTree)
    : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8 flex-grow text-gray-800">
        <h1 className="text-2xl font-bold mb-6">Session Details</h1>
        <div className="mb-4">
          <p>
            <strong>Name:</strong>{' '}
            {session.session_data.session_name || 'Untitled Session'}
          </p>
          <p>
            <strong>Created:</strong>{' '}
            {new Date(session.created_at).toLocaleString()}
          </p>
          <p>
           {/* <strong>Files Count:</strong> {session.file_count}*/}
          </p>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Session Data</h2>
          {/* A scrollable, collapsible JSON viewer */}
          <div className="max-h-96 overflow-y-auto bg-gray-100 p-4 rounded">
            <ReactJson
              src={session.session_data}
              theme="rjv-default"
              collapsed={2}
              displayDataTypes={false}
              style={{ fontSize: '0.875rem' }}
            />
          </div>
        </div>

        {excelFiles.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Excel Files Preview</h2>
            {excelFiles.map((file, index) => (
              <ExcelPreview key={index} node={file} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default SessionDetail;
