import React, { useEffect, useState, Suspense, lazy } from 'react';
import './App.css';
import './SiteRedesign.css';
import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';
import HomePage from './components/HomePage';
import DefaultSeo from './components/DefaultSeo';
import PrivacyChoices from './components/PrivacyChoices';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import tokenService from './services/tokenService';
import { isAdminUser } from './config/adminEmails';

const SearchPage = lazy(() => import('./components/SearchPage'));
const AuthSuccess = lazy(() => import('./components/AuthSuccess'));
const CardSetAnalysis = lazy(() => import('./components/CardSetAnalysis'));
const NewsPage = lazy(() => import('./components/NewsPage'));
const NewsArticlePage = lazy(() => import('./components/NewsArticlePage'));
const EbayInventory = lazy(() => import('./pages/EbayInventory'));
const AdminCardDatabase = lazy(() => import('./components/AdminCardDatabase'));
const AdminCollections = lazy(() => import('./components/AdminCollections'));
const AdminReleases = lazy(() => import('./components/AdminReleases'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const NotFoundPage = lazy(() => import('./components/NotFoundPage'));

const routeFallbackStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '60vh',
  background: '#000',
  color: '#ffd700',
};

function RouteFallback() {
  return (
    <div style={routeFallbackStyle} aria-busy="true">
      <div>Loading...</div>
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const token = tokenService.getAccessToken();
      
      if (!token) {
        setUser(null);
        setIsLoggedIn(false);
        return;
      }

      // Check if token is expired and refresh if needed
      if (tokenService.isTokenExpired(token)) {
        try {
          await tokenService.refreshToken();
        } catch (error) {
          console.error('Token refresh failed:', error);
          tokenService.clearTokens();
          setUser(null);
          setIsLoggedIn(false);
          return;
        }
      }

      // Validate token with backend
      const validation = await tokenService.validateToken();
      if (validation.valid) {
        setUser(validation.user);
        setIsLoggedIn(true);
      } else {
        console.error('Token validation failed:', validation.error);
        tokenService.clearTokens();
        setUser(null);
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      tokenService.clearTokens();
      setUser(null);
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const handleLogin = () => {
    window.location.href = 'https://web-production-9efa.up.railway.app/api/auth/google';
  };

  const handleLogout = () => {
    tokenService.clearTokens();
    setUser(null);
    setIsLoggedIn(false);
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#000',
        color: '#ffd700'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        {/* Site-wide SEO baseline; route-level Helmet blocks override it */}
        <DefaultSeo />
        <SiteHeader isLoggedIn={isLoggedIn} isAdmin={isLoggedIn && isAdminUser()} user={user} onLogin={handleLogin} onLogout={handleLogout} />
        <div id="site-content" tabIndex={-1}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/card-set-analysis" element={<CardSetAnalysis />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/release-calendar" element={<NewsPage />} />
            <Route path="/news/:slug" element={<NewsArticlePage />} />
            <Route path="/ebay-bidding" element={<Navigate to="/" replace />} />
            <Route path="/admin/ebay-inventory" element={<EbayInventory />} />
            <Route path="/admin/cards" element={<AdminCardDatabase />} />
            <Route path="/admin/collections" element={<AdminCollections />} />
            <Route path="/admin/releases" element={<AdminReleases />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/auth-success" element={<AuthSuccess onAuthSuccess={checkAuthStatus} />} />
            {/* Catch-all: a useful page instead of an empty shell, marked
                noindex. Still answers HTTP 200 -- see NotFoundPage.js. */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        </div>
        <SiteFooter />
        <PrivacyChoices />
      </div>
    </Router>
  );
}

export default App;
