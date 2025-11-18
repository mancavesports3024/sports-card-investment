import React from 'react';
import TCDBBrowser from './TCDBBrowser';
import './AdminCardDatabase.css';

function isAdminUser() {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email === 'mancavesportscardsllc@gmail.com';
  } catch {
    return false;
  }
}

const AdminCardDatabase = () => {
  // Check if user is admin
  if (!isAdminUser()) {
    return (
      <div className="admin-only-message">
        <h2>🔒 Admin Access Required</h2>
        <p>You must be logged in as an admin to access this page.</p>
      </div>
    );
  }

  // Render the new TCDB Browser
  return <TCDBBrowser />;
};

export default AdminCardDatabase;
