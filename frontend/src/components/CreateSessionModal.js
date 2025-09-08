import React, { useState } from 'react';

function CreateSessionModal({ onClose, onCreateSession }) {
  const [sessionName, setSessionName] = useState('');
  const [partnerName, setPartnerName] = useState('');

  // Simple function to handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (sessionName && partnerName) {
      const sessionData = {
        name: sessionName,
        partner: partnerName
      };
      onCreateSession(sessionData);
    } else {
      alert('Please fill in all fields');
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <span className="close" onClick={onClose}>&times;</span>
        <h2>Create New Bidding Session</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="sessionName">Session Name:</label>
            <input
              type="text"
              id="sessionName"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g., John and Jane - ACOL System"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="partnerName">Partner Name:</label>
            <input
              type="text"
              id="partnerName"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="Partner's name"
              required
            />
          </div>
          
          <button type="submit" className="create-session">
            Create Session
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateSessionModal;
