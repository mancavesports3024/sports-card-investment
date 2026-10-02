import React, { useState, useEffect } from 'react';

const AdminReleases = ({ user }) => {
  const [releases, setReleases] = useState([]);
  const [unverified, setUnverified] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('add');
  const [formData, setFormData] = useState({
    title: '',
    brand: '',
    sport: '',
    releaseDate: '',
    year: new Date().getFullYear(),
    description: '',
    retailPrice: '',
    hobbyPrice: '',
    sourceUrl: '',
    dateStatus: 'estimated',
    verificationNotes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load unverified releases
      const unverifiedRes = await fetch('/api/releases/unverified', {
        credentials: 'include'
      });
      
      if (unverifiedRes.ok) {
        const unverifiedData = await unverifiedRes.json();
        setUnverified(unverifiedData.releases || []);
      } else if (unverifiedRes.status === 403) {
        setError('Admin access required. Contact site administrator.');
        return;
      }

      // Load all releases
      const releasesRes = await fetch('/api/releases');
      if (releasesRes.ok) {
        const releasesData = await releasesRes.json();
        setReleases(releasesData.releases || []);
      }
    } catch (err) {
      setError(`Failed to load releases: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      title: '',
      brand: '',
      sport: '',
      releaseDate: '',
      year: new Date().getFullYear(),
      description: '',
      retailPrice: '',
      hobbyPrice: '',
      sourceUrl: '',
      dateStatus: 'estimated',
      verificationNotes: ''
    });
  };

  const handleAddRelease = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!formData.title || !formData.releaseDate) {
      setError('Title and release date are required');
      return;
    }

    // Check for potential duplicates
    const duplicate = releases.find(r => 
      r.title?.toLowerCase() === formData.title.toLowerCase() &&
      r.release_date === formData.releaseDate
    );
    
    if (duplicate) {
      if (!window.confirm('A release with this title and date already exists. Add anyway?')) {
        return;
      }
    }

    try {
      const response = await fetch('/api/releases/manual-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          brand: formData.brand,
          sport: formData.sport,
          releaseDate: formData.releaseDate,
          year: formData.year,
          description: formData.description,
          retailPrice: formData.retailPrice || 'TBD',
          hobbyPrice: formData.hobbyPrice || 'TBD',
          sourceUrl: formData.sourceUrl,
          dateStatus: formData.dateStatus,
          verificationNotes: formData.verificationNotes,
          verifiedBy: user?.email || user?.name || 'admin'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Release "${formData.title}" added successfully!`);
        resetForm();
        loadData();
      } else {
        setError(data.error || data.message || 'Failed to add release');
      }
    } catch (err) {
      setError(`Error adding release: ${err.message}`);
    }
  };

  const handleVerifyRelease = async (releaseId, currentTitle) => {
    const sourceUrl = window.prompt('Enter source URL for verification:');
    if (!sourceUrl) return;

    const dateStatus = window.prompt('Date status (confirmed/estimated/tbd):', 'confirmed');
    if (!['confirmed', 'estimated', 'tbd'].includes(dateStatus?.toLowerCase())) {
      setError('Invalid date status. Must be: confirmed, estimated, or tbd');
      return;
    }

    const notes = window.prompt('Verification notes (optional):');

    try {
      const response = await fetch(`/api/releases/${releaseId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceUrl,
          dateStatus: dateStatus.toLowerCase(),
          verificationNotes: notes || '',
          verifiedBy: user?.email || user?.name || 'admin'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Release "${currentTitle}" verified successfully!`);
        loadData();
      } else {
        setError(data.error || data.message || 'Failed to verify release');
      }
    } catch (err) {
      setError(`Error verifying release: ${err.message}`);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return '#27ae60';
      case 'estimated': return '#f39c12';
      case 'tbd': return '#95a5a6';
      default: return '#666';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#d1d5db' }}>
        Loading admin panel...
      </div>
    );
  }

  if (error && error.includes('Admin access required')) {
    return (
      <div style={{ 
        padding: '2rem', 
        maxWidth: '600px', 
        margin: '0 auto',
        background: '#1f2937',
        borderRadius: 12,
        border: '2px solid #ef4444'
      }}>
        <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Access Denied</h2>
        <p style={{ color: '#d1d5db', marginBottom: '1rem' }}>{error}</p>
        <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
          Your account ({user?.email || 'not signed in'}) is not authorized to access this page.
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '2rem', 
      maxWidth: '1200px', 
      margin: '0 auto',
      color: '#d1d5db'
    }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: '#ffd700', fontSize: '2rem', marginBottom: '0.5rem' }}>
          Release Management
        </h1>
        <p style={{ color: '#9ca3af' }}>
          Signed in as: <strong>{user?.email || user?.name || 'Unknown'}</strong>
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: '#065f46',
          border: '2px solid #10b981',
          borderRadius: 8,
          color: '#d1fae5'
        }}>
          ✓ {success}
        </div>
      )}

      {error && !error.includes('Admin access required') && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: '#7f1d1d',
          border: '2px solid #ef4444',
          borderRadius: 8,
          color: '#fecaca'
        }}>
          ✗ {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '2rem',
        borderBottom: '2px solid #374151'
      }}>
        {['add', 'unverified', 'all'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1.5rem',
              background: activeTab === tab ? '#ffd700' : 'transparent',
              color: activeTab === tab ? '#000' : '#d1d5db',
              border: 'none',
              borderBottom: activeTab === tab ? '3px solid #ffd700' : 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '1rem',
              textTransform: 'capitalize',
              transition: 'all 0.2s'
            }}
          >
            {tab === 'add' ? 'Add New' : tab === 'unverified' ? `Unverified (${unverified.length})` : `All Releases (${releases.length})`}
          </button>
        ))}
      </div>

      {/* Add Release Form */}
      {activeTab === 'add' && (
        <form onSubmit={handleAddRelease} style={{ 
          background: '#1f2937',
          padding: '2rem',
          borderRadius: 12,
          border: '2px solid #374151'
        }}>
          <h2 style={{ color: '#ffd700', marginBottom: '1.5rem' }}>Add New Release</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Title <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#111827',
                  border: '2px solid #374151',
                  borderRadius: 6,
                  color: '#d1d5db',
                  fontSize: '1rem'
                }}
                placeholder="e.g., 2027 Topps Series 1"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Release Date <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="date"
                name="releaseDate"
                value={formData.releaseDate}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#111827',
                  border: '2px solid #374151',
                  borderRadius: 6,
                  color: '#d1d5db',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Brand
              </label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleInputChange}
                list="brands"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#111827',
                  border: '2px solid #374151',
                  borderRadius: 6,
                  color: '#d1d5db',
                  fontSize: '1rem'
                }}
                placeholder="e.g., Topps, Panini, Upper Deck"
              />
              <datalist id="brands">
                <option value="Topps" />
                <option value="Panini" />
                <option value="Upper Deck" />
                <option value="Bowman" />
                <option value="Leaf" />
              </datalist>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Sport
              </label>
              <input
                type="text"
                name="sport"
                value={formData.sport}
                onChange={handleInputChange}
                list="sports"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#111827',
                  border: '2px solid #374151',
                  borderRadius: 6,
                  color: '#d1d5db',
                  fontSize: '1rem'
                }}
                placeholder="e.g., Baseball, Basketball"
              />
              <datalist id="sports">
                <option value="Baseball" />
                <option value="Basketball" />
                <option value="Football" />
                <option value="Hockey" />
                <option value="Soccer" />
                <option value="Multi-Sport" />
              </datalist>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Source URL
              </label>
              <input
                type="url"
                name="sourceUrl"
                value={formData.sourceUrl}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#111827',
                  border: '2px solid #374151',
                  borderRadius: 6,
                  color: '#d1d5db',
                  fontSize: '1rem'
                }}
                placeholder="https://..."
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Date Status
              </label>
              <select
                name="dateStatus"
                value={formData.dateStatus}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#111827',
                  border: '2px solid #374151',
                  borderRadius: 6,
                  color: '#d1d5db',
                  fontSize: '1rem'
                }}
              >
                <option value="estimated">Estimated (aggregator source)</option>
                <option value="confirmed">Confirmed (manufacturer verified)</option>
                <option value="tbd">TBD (no date set)</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Verification Notes
            </label>
            <textarea
              name="verificationNotes"
              value={formData.verificationNotes}
              onChange={handleInputChange}
              rows="2"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#111827',
                border: '2px solid #374151',
                borderRadius: 6,
                color: '#d1d5db',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
              placeholder="Optional notes about where/how you verified this date..."
            />
          </div>

          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            marginTop: '1.5rem' 
          }}>
            <button
              type="submit"
              style={{
                padding: '0.75rem 2rem',
                background: '#ffd700',
                color: '#000',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              Add Release
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: '0.75rem 2rem',
                background: '#374151',
                color: '#d1d5db',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              Clear Form
            </button>
          </div>
        </form>
      )}

      {/* Unverified Releases */}
      {activeTab === 'unverified' && (
        <div style={{ 
          background: '#1f2937',
          padding: '2rem',
          borderRadius: 12,
          border: '2px solid #374151'
        }}>
          <h2 style={{ color: '#ffd700', marginBottom: '1.5rem' }}>
            Releases Needing Verification ({unverified.length})
          </h2>

          {unverified.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
              All releases are verified! 🎉
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {unverified.map(release => (
                <div
                  key={release.id}
                  style={{
                    background: '#111827',
                    padding: '1.5rem',
                    borderRadius: 8,
                    border: '2px solid #374151'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ color: '#ffd700', marginBottom: '0.5rem' }}>
                        {release.title}
                      </h3>
                      <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                        <div>Date: {formatDate(release.release_date)}</div>
                        <div>Brand: {release.brand || 'N/A'} | Sport: {release.sport || 'N/A'}</div>
                        <div>
                          Status: <span style={{ color: getStatusColor(release.date_status) }}>
                            {release.date_status || 'estimated'}
                          </span>
                        </div>
                        {release.last_verified_at && (
                          <div>Last verified: {formatDate(release.last_verified_at)} by {release.last_verified_by}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleVerifyRelease(release.id, release.title)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Verify
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Releases */}
      {activeTab === 'all' && (
        <div style={{ 
          background: '#1f2937',
          padding: '2rem',
          borderRadius: 12,
          border: '2px solid #374151'
        }}>
          <h2 style={{ color: '#ffd700', marginBottom: '1.5rem' }}>
            All Releases ({releases.length})
          </h2>

          {releases.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
              No releases yet. Add your first release!
            </p>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1rem' 
            }}>
              {releases
                .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))
                .slice(0, 50)
                .map(release => (
                  <div
                    key={release.id}
                    style={{
                      background: '#111827',
                      padding: '1rem',
                      borderRadius: 8,
                      border: '2px solid #374151'
                    }}
                  >
                    <h4 style={{ 
                      color: '#ffd700', 
                      marginBottom: '0.5rem',
                      fontSize: '0.95rem'
                    }}>
                      {release.title}
                    </h4>
                    <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                      <div>{formatDate(release.release_date)}</div>
                      <div>{release.brand} • {release.sport}</div>
                      <div style={{ 
                        marginTop: '0.5rem',
                        color: getStatusColor(release.date_status)
                      }}>
                        {release.date_status || 'estimated'}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
          {releases.length > 50 && (
            <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: '1rem' }}>
              Showing first 50 releases
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminReleases;
