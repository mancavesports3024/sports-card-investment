import React, { useEffect, useState } from 'react';
import './App.css';
import HomePage from './components/HomePage';
import SearchPage from './components/SearchPage';
import AuthSuccess from './components/AuthSuccess';
import SavedSearches from './components/SavedSearches';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  const checkAuthStatus = () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        // Decode JWT token to get user info
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
        setIsLoggedIn(true);
      } catch (error) {
        console.error('Invalid token:', error);
        localStorage.removeItem('authToken');
        setUser(null);
        setIsLoggedIn(false);
      }
    } else {
      setUser(null);
      setIsLoggedIn(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const handleLogin = () => {
    window.location.href = 'https://web-production-9efa.up.railway.app/api/auth/google';
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
    setIsLoggedIn(false);
    window.location.reload();
  };

  return (
    <Router>
      <div className="App">
        {/* Global Header */}
        <header className="global-header responsive-header">
          {/* First row: Scorecard title only, centered and larger */}
          <div className="header-row header-row-top" style={{ justifyContent: 'center' }}>
            <span className="header-title main-title">Scorecard</span>
          </div>
          {/* Second row: social left, login/logout right */}
          <div className="header-row header-row-bottom" style={{ justifyContent: 'space-between' }}>
            <div className="header-social-group">
              <a href="https://x.com/Mancavesportsc1" target="_blank" rel="noopener noreferrer" className="header-social">𝕏</a>
              <a href="https://www.instagram.com/mancavesportscardllc?igsh=NWoxOHJycGdrYzZk&utm_source=qr" target="_blank" rel="noopener noreferrer" className="header-social">📷</a>
              <a href="https://www.facebook.com/profile.php?id=100062665574017" target="_blank" rel="noopener noreferrer" className="header-social">📘</a>
            </div>
            <div className="header-user-actions">
              {!isLoggedIn ? (
                <button onClick={handleLogin} className="header-login-btn">Log in</button>
              ) : (
                <span className="header-username">
                  {user?.displayName || user?.name || ((user?.given_name || user?.givenName) && (user?.family_name || user?.familyName) ? `${user.given_name || user.givenName} ${user.family_name || user.familyName}` : '')}
                </span>
              )}
              {isLoggedIn && (
                <button onClick={handleLogout} className="header-login-btn">Log out</button>
              )}
            </div>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/auth-success" element={<AuthSuccess onAuthSuccess={checkAuthStatus} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
