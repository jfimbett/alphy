import React from 'react';

interface SessionSummary {
  session_id: number;
  session_name: string;
  created_at: string;
}

interface LoadModalProps {
  showLoadModal: boolean;
  availableSessions: SessionSummary[];
  confirmLoadSession: (sessionId: string) => void;
  setShowLoadModal: (show: boolean) => void;
}

const LoadModal: React.FC<LoadModalProps> = ({
  showLoadModal,
  availableSessions,
  confirmLoadSession,
  setShowLoadModal
}) => {
  if (!showLoadModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg max-w-md w-full">
        <h3 className="text-xl font-bold mb-4 text-gray-800">Select Session</h3>
        {availableSessions.map(session => (
          <div 
            key={session.session_id}
            className="p-3 hover:bg-gray-100 cursor-pointer text-gray-600"
            onClick={() => confirmLoadSession(session.session_id.toString())}
          >
            <p>{session.session_name}</p>
            <small>{new Date(session.created_at).toLocaleDateString()}</small>
          </div>
        ))}
        <button onClick={() => setShowLoadModal(false)} className="mt-4 text-gray-800">
          Go Back
        </button>
      </div>
    </div>
  );
};

export default LoadModal;