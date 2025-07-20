import React, { useEffect, useState } from 'react';

const SavedSearches = ({ onSearchAgain }) => {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('authToken'));

  const handleLogin = () => {
    window.location.href = 'https://web-production-9efa.up.railway.app/api/auth/google';
  };

  useEffect(() => {
    const fetchSearches = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');
      setIsLoggedIn(!!token);
      if (!token) {
        setError('You must be logged in to view saved searches.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/search-history', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          cache: 'no-store'
        });
        if (res.status === 304) {
          setError('No new saved searches (304 Not Modified).');
          setSearches([]);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!data.success) {
          setError(data.error || 'Failed to load saved searches.');
        } else {
          setSearches(data.searches || []);
        }
      } catch (err) {
        setError('Failed to load saved searches: ' + (err.message || err.toString()));
      }
      setLoading(false);
    };
    fetchSearches();
  }, []);

  const handleDelete = async (searchId) => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    try {
      const res = await fetch(`/api/search-history/${searchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setSearches(searches.filter(s => (s.id || s._id) !== searchId));
      }
    } catch (err) {
      // Optionally show error
    }
  };

  if (loading) return <div style={{ color: '#ffd700', textAlign: 'center', margin: '2rem' }}>Loading saved searches...</div>;
  if (!isLoggedIn) return <div style={{ color: '#fff', textAlign: 'center', margin: '2rem' }}><div style={{ color: 'red', marginBottom: 12 }}>{error}</div><button onClick={handleLogin} style={{ background: '#ffd700', color: '#000', border: 'none', borderRadius: 4, padding: '0.5rem 1.2rem', fontWeight: 'bold', cursor: 'pointer' }}>Log in to view saved searches</button></div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', margin: '2rem' }}>{error}</div>;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto 0 auto', background: '#222', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '2rem', border: '1.5px solid #ffd700', color: '#fff' }}>
      <h2 style={{ color: '#ffd700', marginBottom: 24 }}>My Saved Searches</h2>
      {searches.length === 0 ? (
        <div style={{ color: '#fff', textAlign: 'center' }}>No saved searches found.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {searches.map((search) => (
            <li key={search.id || search._id} style={{ marginBottom: 18, background: '#333', borderRadius: 6, padding: '1rem 1.5rem', border: '1px solid #ffd700' }}>
              <div style={{ fontWeight: 'bold', color: '#ffd700' }}>{search.searchQuery}</div>
              <div style={{ fontSize: '0.95rem', color: '#bbb' }}>Saved: {search.createdAt ? new Date(search.createdAt).toLocaleString() : 'Unknown date'}</div>
              <div style={{ marginTop: 10, display: 'flex', gap: '1rem' }}>
                <button onClick={() => onSearchAgain(search)} style={{ background: '#ffd700', color: '#000', border: 'none', borderRadius: 4, padding: '0.3rem 1rem', fontWeight: 'bold', cursor: 'pointer' }}>Search Again</button>
                <button onClick={() => handleDelete(search.id || search._id)} style={{ background: '#b00', color: '#fff', border: 'none', borderRadius: 4, padding: '0.3rem 1rem', fontWeight: 'bold', cursor: 'pointer' }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SavedSearches; 