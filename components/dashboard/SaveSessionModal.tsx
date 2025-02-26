import React from 'react';

interface SaveModalProps {
  showSaveModal: boolean;
  newUploadName: string;
  setNewUploadName: (name: string) => void;
  closeSaveModal: () => void;
  handleSaveConfirm: () => void;
}

const SaveModal: React.FC<SaveModalProps> = ({
  showSaveModal,
  newUploadName,
  setNewUploadName,
  closeSaveModal,
  handleSaveConfirm
}) => {
  if (!showSaveModal) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Save Session</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session Name:
            </label>
            <input
              type="text"
              className="border border-gray-300 rounded w-full p-2 text-gray-800"
              value={newUploadName}
              onChange={(e) => setNewUploadName(e.target.value)}
              placeholder="Enter a session name..."
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-2">
          <button
            onClick={closeSaveModal}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveConfirm}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Save Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveModal;