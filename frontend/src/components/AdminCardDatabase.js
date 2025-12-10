import React from 'react';
import TCDBBrowser from './TCDBBrowser';
import './AdminCardDatabase.css';
import { isAdminUser } from '../config/adminEmails';

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
