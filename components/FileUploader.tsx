'use client';

import { useCallback } from 'react';

export default function FileUploader({
  onUpload
}: {
  onUpload: (files: File[]) => void;
}) {
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        onUpload(files);
      }
    },
    [onUpload]
  );

  return (
    <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg">
      <input
        type="file"
        multiple
        onChange={handleFileChange}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100"
      />
      <p className="mt-2 text-sm text-gray-600">
        Supported formats: PDF, Excel, Word
      </p>
    </div>
  );
}