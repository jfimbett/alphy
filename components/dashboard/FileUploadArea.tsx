import { useDropzone } from 'react-dropzone';

export default function FileUploadArea({
  processZip,
  processFolder,
  handleLoadClick,
  isDragActive
}: {
  processZip: (file: File) => Promise<void>;
  processFolder: (files: FileList) => Promise<void>;
  handleLoadClick: () => void;
  isDragActive: boolean;
}) {
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      const zipFile = acceptedFiles.find((file) => file.name.endsWith('.zip'));
      if (zipFile) processZip(zipFile);
    },
    accept: { 'application/zip': ['.zip'] },
    multiple: false
  });

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${
          isDragActive ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-gray-600">
          {isDragActive ? 'Drop ZIP file here' : 'Drag and drop a ZIP file or click to select'}
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex gap-2">
          <input
            type="file"
            id="folder-upload"
            ref={(input) => {
              if (input) input.webkitdirectory = true;
            }}
            onChange={(e) => e.target.files && processFolder(e.target.files)}
            className="hidden"
          />
          <button
            onClick={() => document.getElementById('folder-upload')?.click()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Upload Folder
          </button>
          <button
            onClick={handleLoadClick}
            className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
          >
            Load Progress
          </button>
        </div>
        <small className="text-gray-500">
          Your browser may show a brief warning when uploading a folder. This is normal.
        </small>
      </div>
    </div>
  );
}