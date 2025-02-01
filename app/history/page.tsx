'use client';
import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { TrashIcon } from '@heroicons/react/24/outline';

interface FileData {
  file_id:number;
  file_name:string;
  file_path:string;
  mime_type:string;
  is_extracted:boolean;
  created_at:string;
  extracted_text?:string;
  summarized_text?:string;
}
interface UploadData {
  upload_id:number;
  upload_name:string;
  upload_path:string;
  created_at:string;
  files:FileData[];
}

export default function HistoryPage(){
  const [uploads,setUploads]=useState<UploadData[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [expandedUploadId,setExpandedUploadId]=useState<number|null>(null);
  const [expandedFiles,setExpandedFiles]=useState<{[fileId:number]:boolean}>({});
  const [fileToDelete,setFileToDelete]=useState<FileData|null>(null);
  const [deleteInput,setDeleteInput]=useState('');
  // For entire project deletion
  const [uploadToDelete,setUploadToDelete]=useState<UploadData|null>(null);
  const [deleteUploadInput,setDeleteUploadInput]=useState('');

  useEffect(()=>{
    const fetchUploads=async()=>{
      try{
        const res=await fetch('/api/uploads');
        if(!res.ok)throw new Error('Failed to fetch uploads');
        const data=await res.json();
        if(data.error){
          setError(data.error);
        } else {
          setUploads(data.uploads||[]);
        }
      }catch(err){
        console.error(err);
        setError((err as Error).message);
      }finally{
        setLoading(false);
      }
    };
    fetchUploads();
  },[]);

  const toggleExpand=(uploadId:number)=>{
    setExpandedUploadId((prev)=>prev===uploadId?null:uploadId);
  };
  const toggleFileExpansion=(fileId:number)=>{
    setExpandedFiles((prev)=>({...prev,[fileId]:!prev[fileId]}));
  };

  // Delete single file
  const handleDeleteClick=(file:FileData)=>{
    setFileToDelete(file);
    setDeleteInput('');
  };
  const handleConfirmDelete=async()=>{
    if(!fileToDelete)return;
    try{
      const res=await fetch(`/api/files/${fileToDelete.file_id}`,{ method:'DELETE' });
      if(!res.ok)throw new Error('Failed to delete file');
      setUploads((prev)=>
        prev.map((upload)=>({
          ...upload,
          files:upload.files.filter((f)=>f.file_id!==fileToDelete.file_id)
        }))
      );
      setFileToDelete(null);
      setDeleteInput('');
    }catch(err){
      console.error('Error deleting file:',err);
      alert((err as Error).message);
    }
  };

  // Delete entire project (upload)
  const handleDeleteProjectClick=(upload:UploadData)=>{
    setUploadToDelete(upload);
    setDeleteUploadInput('');
  };
  const handleConfirmDeleteProject=async()=>{
    if(!uploadToDelete)return;
    try{
      const res=await fetch(`/api/uploads/${uploadToDelete.upload_id}`,{method:'DELETE'});
      if(!res.ok)throw new Error('Failed to delete project');
      setUploads((prev)=>prev.filter((u)=>u.upload_id!==uploadToDelete.upload_id));
      setUploadToDelete(null);
      setDeleteUploadInput('');
    }catch(err){
      console.error('Error deleting project:',err);
      alert((err as Error).message);
    }
  };

  if(loading){
    return(
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar/>
        <main className="max-w-7xl mx-auto px-4 py-8 flex-grow">
          <p>Loading uploads...</p>
        </main>
        <Footer/>
      </div>
    );
  }
  if(error){
    return(
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar/>
        <main className="max-w-7xl mx-auto px-4 py-8 flex-grow">
          <p className="text-red-600">Error: {error}</p>
        </main>
        <Footer/>
      </div>
    );
  }

  return(
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar/>
      <main className="max-w-7xl mx-auto px-4 py-8 flex-grow">
        <h1 className="text-2xl font-bold mb-6 text-gray-700">My Uploaded Documents</h1>
        {uploads.length===0&&(
          <p className="text-gray-600">No uploads yet. Go to Dashboard and upload some files!</p>
        )}
        <div className="space-y-4">
          {uploads.map((upload)=>(
            <div key={upload.upload_id} className="bg-white rounded-lg shadow p-4 relative">
              {/* Delete entire project button */}
              <button
                onClick={()=>handleDeleteProjectClick(upload)}
                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                title="Delete entire project"
              >
                <TrashIcon className="w-5 h-5"/>
              </button>
              <div className="flex items-center justify-between pr-8">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {upload.upload_name||'Untitled Upload'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Uploaded At: {new Date(upload.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={()=>toggleExpand(upload.upload_id)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {expandedUploadId===upload.upload_id?'Hide':'Show'} Details
                </button>
              </div>
              {expandedUploadId===upload.upload_id&&(
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">
                    ZIP Path: {upload.upload_path}
                  </p>
                  {upload.files.length===0?(
                    <p className="text-gray-500">No files found for this upload.</p>
                  ):(
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {upload.files.map((file)=>{
                        const isExpanded=!!expandedFiles[file.file_id];
                        const fullExtracted=file.extracted_text||'';
                        const shortExtracted=fullExtracted.slice(0,200)+'...';
                        const fullSummary=file.summarized_text||'';
                        const shortSummary=fullSummary.slice(0,200)+'...';
                        return(
                          <div key={file.file_id} className="border rounded-lg p-3 bg-gray-50 relative">
                            {/* Single file delete button */}
                            <button
                              onClick={()=>handleDeleteClick(file)}
                              className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                              title="Delete this file"
                            >
                              <TrashIcon className="w-5 h-5"/>
                            </button>
                            <h3 className="font-medium text-gray-700 mb-1">
                              {file.file_name}
                            </h3>
                            <p className="text-xs text-gray-500 mb-2">
                              {file.mime_type} | Created at: {new Date(file.created_at).toLocaleString()}
                            </p>
                            {file.is_extracted&&file.extracted_text?(
                              <div className="text-sm text-gray-700 mb-2">
                                <p className="font-semibold">Extracted Text:</p>
                                <p className="whitespace-pre-line mt-1">
                                  {fullExtracted.length>200&&!isExpanded?shortExtracted:fullExtracted}
                                </p>
                              </div>
                            ):(
                              <p className="text-sm text-gray-500">No extracted text yet.</p>
                            )}
                            {file.summarized_text?(
                              <div className="text-sm text-gray-700">
                                <p className="font-semibold">Summary:</p>
                                <p className="whitespace-pre-line mt-1">
                                  {fullSummary.length>200&&!isExpanded?shortSummary:fullSummary}
                                </p>
                              </div>
                            ):(
                              <p className="text-sm text-gray-500">No summary yet.</p>
                            )}
                            {(fullExtracted.length>200||fullSummary.length>200)&&(
                              <button
                                onClick={()=>toggleFileExpansion(file.file_id)}
                                className="text-xs text-blue-600 hover:text-blue-800 mt-2 underline"
                              >
                                {isExpanded?'Show Less':'Show More'}
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
     
      {/* DELETE SINGLE FILE MODAL */}
      {fileToDelete&&(
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Delete File</h2>
            <p className="text-gray-700">
              Are you sure you want to permanently delete <span className="font-bold">{fileToDelete.file_name}</span>?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Please type <span className="font-semibold">{fileToDelete.file_name}</span> to confirm.
            </p>
            <input
              type="text"
              className="border border-gray-300 rounded w-full p-2 mt-3 text-gray-800"
              placeholder={fileToDelete.file_name}
              value={deleteInput}
              onChange={(e)=>setDeleteInput(e.target.value)}
            />
            <div className="mt-5 flex justify-end space-x-2">
              <button
                onClick={()=>{
                  setFileToDelete(null);
                  setDeleteInput('');
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteInput!==fileToDelete.file_name}
                className={`px-4 py-2 rounded text-white ${
                  deleteInput===fileToDelete.file_name?'bg-red-600 hover:bg-red-700':'bg-red-400 cursor-not-allowed'
                }`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* DELETE ENTIRE PROJECT MODAL */}
      {uploadToDelete&&(
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Delete Entire Project</h2>
            <p className="text-gray-700">
              Are you sure you want to permanently delete the entire project 
              <span className="font-bold"> {uploadToDelete.upload_name}</span>?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Please type <span className="font-semibold">{uploadToDelete.upload_name}</span> to confirm.
            </p>
            <input
              type="text"
              className="border border-gray-300 rounded w-full p-2 mt-3 text-gray-800"
              placeholder={uploadToDelete.upload_name}
              value={deleteUploadInput}
              onChange={(e)=>setDeleteUploadInput(e.target.value)}
            />
            <div className="mt-5 flex justify-end space-x-2">
              <button
                onClick={()=>{
                  setUploadToDelete(null);
                  setDeleteUploadInput('');
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteProject}
                disabled={deleteUploadInput!==uploadToDelete.upload_name}
                className={`px-4 py-2 rounded text-white ${
                  deleteUploadInput===uploadToDelete.upload_name
                    ?'bg-red-600 hover:bg-red-700'
                    :'bg-red-400 cursor-not-allowed'
                }`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
