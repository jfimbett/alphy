'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';

interface FileData {
  file_id: number;
  file_name: string;
  file_path: string;
  mime_type: string;
  is_extracted: boolean;
  created_at: string;
  extracted_text?: string;
  summarized_text?: string;
}

interface UploadData {
  upload_id: number;
  upload_name: string;
  upload_path: string;
  created_at: string;
  files: FileData[];
}

export default function HistoryPage() {
  const [uploads, setUploads] = useState<UploadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For expand/collapse each upload
  const [expandedUploadId, setExpandedUploadId] = useState<number | null>(null);

  // For toggling "Show More" on a per-file basis
  // We'll store a map: { [fileId]: boolean }, indicating if it's expanded
  const [expandedFiles, setExpandedFiles] = useState<{ [fileId: number]: boolean }>({});

  useEffect(() => {
    const fetchUploads = async () => {
      try {
        const res = await fetch('/api/uploads');
        if (!res.ok) throw new Error('Failed to fetch uploads');
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setUploads(data.uploads || []);
        }
      } catch (err) {
        console.error(err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchUploads();
  }, []);

  // Toggle entire upload (folder) details
  const toggleExpand = (uploadId: number) => {
    setExpandedUploadId((prev) => (prev === uploadId ? null : uploadId));
  };

  // Toggle "show more" for an individual file's extracted text or summary
  const toggleFileExpansion = (fileId: number) => {
    setExpandedFiles((prev) => ({
      ...prev,
      [fileId]: !prev[fileId],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <p>Loading uploads...</p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-red-600">Error: {error}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-700">My Uploaded Documents</h1>

        {uploads.length === 0 && (
          <p className="text-gray-600">No uploads yet. Go to Dashboard and upload some files!</p>
        )}

        <div className="space-y-4">
          {uploads.map((upload) => (
            <div key={upload.upload_id} className="bg-white rounded-lg shadow p-4">
              {/* Upload Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {upload.upload_name || 'Untitled Upload'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Uploaded At: {new Date(upload.created_at).toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={() => toggleExpand(upload.upload_id)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {expandedUploadId === upload.upload_id ? 'Hide' : 'Show'} Details
                </button>
              </div>

              {/* Upload Details */}
              {expandedUploadId === upload.upload_id && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">
                    ZIP Path: {upload.upload_path}
                  </p>

                  {upload.files.length === 0 ? (
                    <p className="text-gray-500">No files found for this upload.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {upload.files.map((file) => {
                        // We'll do show/hide logic for extracted_text & summarized_text
                        const isExpanded = !!expandedFiles[file.file_id]; // default false
                        
                        // If we have text, let's define a "short" and "long" version:
                        const fullExtracted = file.extracted_text || '';
                        const shortExtracted = fullExtracted.slice(0, 200) + '...';

                        const fullSummary = file.summarized_text || '';
                        const shortSummary = fullSummary.slice(0, 200) + '...';

                        return (
                          <div
                            key={file.file_id}
                            className="border rounded-lg p-3 bg-gray-50"
                          >
                            <h3 className="font-medium text-gray-700 mb-1">
                              {file.file_name}
                            </h3>
                            <p className="text-xs text-gray-500 mb-2">
                              {file.mime_type} | Created at:{' '}
                              {new Date(file.created_at).toLocaleString()}
                            </p>

                            {/* Extracted Text */}
                            {file.is_extracted && file.extracted_text ? (
                              <div className="text-sm text-gray-700 mb-2">
                                <p className="font-semibold">Extracted Text:</p>
                                <p className="whitespace-pre-line mt-1">
                                  {/* If text is long and not expanded, show short version */}
                                  {fullExtracted.length > 200 && !isExpanded
                                    ? shortExtracted
                                    : fullExtracted}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">
                                No extracted text yet.
                              </p>
                            )}

                            {/* Summary */}
                            {file.summarized_text ? (
                              <div className="text-sm text-gray-700">
                                <p className="font-semibold">Summary:</p>
                                <p className="whitespace-pre-line mt-1">
                                  {fullSummary.length > 200 && !isExpanded
                                    ? shortSummary
                                    : fullSummary}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">
                                No summary yet.
                              </p>
                            )}

                            {/* Show More / Show Less button (only if text or summary is > 200 chars) */}
                            {(fullExtracted.length > 200 || fullSummary.length > 200) && (
                              <button
                                onClick={() => toggleFileExpansion(file.file_id)}
                                className="text-xs text-blue-600 hover:text-blue-800 mt-2 underline"
                              >
                                {isExpanded ? 'Show Less' : 'Show More'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
