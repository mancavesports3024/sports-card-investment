import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';

const NewsPage = () => {
  const [activeTab, setActiveTab] = useState('releases');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [releases, setReleases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch release data from API
  useEffect(() => {
    const fetchReleases = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/news/releases');
        const data = await response.json();
        
        if (data.success) {
          setReleases(data.releases);
        } else {
          setError(data.error || 'Failed to fetch releases');
        }
      } catch (err) {
        setError('Failed to connect to server');
        console.error('Error fetching releases:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReleases();
  }, []);

  // Sample release data - fallback if API fails
  const releaseData = {
    '2025': {
      'January': [
        {
          date: '2025-01-15',
          title: '2025 Topps Series One Baseball',
          brand: 'Topps',
          sport: 'Baseball',
          type: 'Base Set',
          description: 'The flagship baseball card set featuring current MLB players and rookies',
          retailPrice: '$4.99',
          hobbyPrice: '$89.99',
          status: 'Released'
        },
        {
          date: '2025-01-22',
          title: '2024-25 Panini Prizm Basketball',
          brand: 'Panini',
          sport: 'Basketball',
          type: 'Premium Set',
          description: 'Premium basketball cards with stunning Prizm technology',
          retailPrice: '$9.99',
          hobbyPrice: '$299.99',
          status: 'Released'
        }
      ],
      'February': [
        {
          date: '2025-02-05',
          title: '2025 Bowman Chrome Baseball',
          brand: 'Bowman',
          sport: 'Baseball',
          type: 'Prospect Set',
          description: 'Chrome prospect cards featuring future MLB stars',
          retailPrice: '$7.99',
          hobbyPrice: '$199.99',
          status: 'Upcoming'
        },
        {
          date: '2025-02-12',
          title: '2024-25 Upper Deck Young Guns Hockey',
          brand: 'Upper Deck',
          sport: 'Hockey',
          type: 'Rookie Set',
          description: 'Premier rookie cards for NHL prospects',
          retailPrice: '$5.99',
          hobbyPrice: '$149.99',
          status: 'Upcoming'
        }
      ],
      'March': [
        {
          date: '2025-03-01',
          title: '2025 Topps Chrome Baseball',
          brand: 'Topps',
          sport: 'Baseball',
          type: 'Chrome Set',
          description: 'Chrome version of the flagship baseball set',
          retailPrice: '$6.99',
          hobbyPrice: '$179.99',
          status: 'Upcoming'
        },
        {
          date: '2025-03-15',
          title: '2024-25 Panini Select Basketball',
          brand: 'Panini',
          sport: 'Basketball',
          type: 'Premium Set',
          description: 'Select basketball cards with unique design',
          retailPrice: '$8.99',
          hobbyPrice: '$249.99',
          status: 'Upcoming'
        }
      ],
      'April': [
        {
          date: '2025-04-02',
          title: '2025 Topps Heritage Baseball',
          brand: 'Topps',
          sport: 'Baseball',
          type: 'Retro Set',
          description: 'Retro-style cards inspired by classic Topps designs',
          retailPrice: '$5.99',
          hobbyPrice: '$129.99',
          status: 'Upcoming'
        }
      ],
      'May': [
        {
          date: '2025-05-07',
          title: '2025 Bowman Baseball',
          brand: 'Bowman',
          sport: 'Baseball',
          type: 'Prospect Set',
          description: 'Paper prospect cards featuring future stars',
          retailPrice: '$4.99',
          hobbyPrice: '$89.99',
          status: 'Upcoming'
        }
      ],
      'June': [
        {
          date: '2025-06-11',
          title: '2025 Topps Series Two Baseball',
          brand: 'Topps',
          sport: 'Baseball',
          type: 'Base Set',
          description: 'Second series of the flagship baseball set',
          retailPrice: '$4.99',
          hobbyPrice: '$89.99',
          status: 'Upcoming'
        }
      ]
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Released':
        return '#28a745';
      case 'Upcoming':
        return '#ffc107';
      case 'Delayed':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getBrandColor = (brand) => {
    switch (brand) {
      case 'Topps':
        return '#1e3a8a';
      case 'Panini':
        return '#dc2626';
      case 'Bowman':
        return '#059669';
      case 'Upper Deck':
        return '#7c3aed';
      default:
        return '#6b7280';
    }
  };

  const renderReleaseCard = (release, index) => (
    <div key={index} style={{
      background: '#fff',
      borderRadius: 12,
      padding: '1.5rem',
      marginBottom: '1rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '2px solid #e5e7eb',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            margin: '0 0 0.5rem 0', 
            fontSize: '1.3rem', 
            fontWeight: 700,
            color: '#1f2937'
          }}>
            {release.title}
          </h3>
          <p style={{ 
            margin: '0 0 1rem 0', 
            color: '#6b7280',
            fontSize: '0.95rem',
            lineHeight: '1.5'
          }}>
            {release.description}
          </p>
        </div>
        <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
          <div style={{
            background: getStatusColor(release.status),
            color: '#fff',
            padding: '0.25rem 0.75rem',
            borderRadius: 20,
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase'
          }}>
            {release.status}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <strong style={{ color: '#374151' }}>Release Date:</strong>
          <div style={{ color: '#6b7280' }}>
            {release.releaseDate ? (
              new Date(release.releaseDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })
            ) : (
              'TBD'
            )}
          </div>
        </div>
        <div>
          <strong style={{ color: '#374151' }}>Brand:</strong>
          <div style={{ 
            color: getBrandColor(release.brand),
            fontWeight: 600
          }}>
            {release.brand || 'Unknown'}
          </div>
        </div>
        <div>
          <strong style={{ color: '#374151' }}>Sport:</strong>
          <div style={{ color: '#6b7280' }}>{release.sport || 'Trading Cards'}</div>
        </div>
        <div>
          <strong style={{ color: '#374151' }}>Source:</strong>
          <div style={{ color: '#6b7280' }}>{release.source || 'Unknown'}</div>
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '1rem',
        background: '#f9fafb',
        borderRadius: 8,
        border: '1px solid #e5e7eb'
      }}>
        <div>
          <strong style={{ color: '#374151' }}>Retail Pack:</strong>
          <div style={{ color: '#059669', fontWeight: 600 }}>{release.retailPrice || 'TBD'}</div>
        </div>
        <div>
          <strong style={{ color: '#374151' }}>Hobby Box:</strong>
          <div style={{ color: '#dc2626', fontWeight: 600 }}>{release.hobbyPrice || 'TBD'}</div>
        </div>
      </div>
    </div>
  );

  const renderReleasesTab = () => (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
        padding: '1.5rem',
        borderRadius: 12,
        marginBottom: '2rem',
        border: '2px solid #000'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#000', fontSize: '1.2rem', fontWeight: 700 }}>
          📅 Card Release Calendar
        </h3>
        <p style={{ margin: 0, color: '#333', fontSize: '0.95rem' }}>
          Stay updated on the latest sports card releases from major brands including Topps, Panini, Bowman, and Upper Deck.
          {releases.length > 0 && (
            <span style={{ display: 'block', marginTop: '0.5rem', fontWeight: 600 }}>
              📊 {releases.filter(release => {
                if (!release.releaseDate) return false;
                const releaseYear = new Date(release.releaseDate).getFullYear();
                return releaseYear === currentYear;
              }).length} releases found for {currentYear} from {[...new Set(releases.map(r => r.source))].join(', ')}
            </span>
          )}
        </p>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '1.2rem', color: '#ffd700', marginBottom: '1rem' }}>
            🔄 Loading release information...
          </div>
          <div style={{ color: '#fff' }}>
            Fetching data from Blowout Forums and other sources
          </div>
        </div>
      )}

      {error && (
        <div style={{ 
          background: '#dc3545', 
          color: '#fff', 
          padding: '1rem', 
          borderRadius: 8, 
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          ❌ {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={() => setCurrentYear(prev => prev - 1)}
            style={{
              background: '#000',
              color: '#ffd700',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            ← {currentYear - 1}
          </button>
          <h2 style={{ margin: 0, color: '#ffd700', fontSize: '1.8rem', fontWeight: 700 }}>
            {currentYear} Releases
          </h2>
          <button
            onClick={() => setCurrentYear(prev => prev + 1)}
            style={{
              background: '#000',
              color: '#ffd700',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {currentYear + 1} →
          </button>
        </div>
      </div>

      {!isLoading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {(() => {
            // Filter releases by the selected year
            const filteredReleases = releases.filter(release => {
              if (!release.releaseDate) return false;
              const releaseYear = new Date(release.releaseDate).getFullYear();
              return releaseYear === currentYear;
            });

            if (filteredReleases.length > 0) {
              return filteredReleases.map((release, index) => renderReleaseCard(release, index));
            } else {
              return (
                <div style={{
                  background: '#1f2937',
                  borderRadius: 12,
                  padding: '2rem',
                  textAlign: 'center',
                  border: '2px solid #374151',
                  gridColumn: '1 / -1'
                }}>
                  <div style={{ color: '#ffd700', fontSize: '1.2rem', marginBottom: '1rem' }}>
                    📭 No releases found for {currentYear}
                  </div>
                  <div style={{ color: '#d1d5db' }}>
                    No release information is currently available for {currentYear}. Try selecting a different year.
                  </div>
                </div>
              );
            }
          })()}
        </div>
      )}
    </div>
  );

  const renderNewsTab = () => (
    <div style={{
      background: '#1f2937',
      borderRadius: 12,
      padding: '2rem',
      textAlign: 'center',
      border: '2px solid #374151'
    }}>
      <h3 style={{ color: '#ffd700', fontSize: '1.5rem', marginBottom: '1rem' }}>
        📰 Sports Card News
      </h3>
      <p style={{ color: '#d1d5db', fontSize: '1.1rem', marginBottom: '2rem' }}>
        Coming soon! We're working on bringing you the latest sports card industry news, 
        market updates, and collector insights.
      </p>
      <div style={{
        background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
        color: '#000',
        padding: '1rem',
        borderRadius: 8,
        fontWeight: 600
      }}>
        🚧 News section under development
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      <Helmet>
        <title>Sports Card News & Release Dates - Trading Card Tracker</title>
        <meta name="description" content="Stay updated on the latest sports card releases, news, and industry updates. Track release dates for Topps, Panini, Bowman, and Upper Deck cards." />
      </Helmet>

      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 800, 
          color: '#ffd700', 
          marginBottom: '1rem',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          📰 Sports Card News
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#fff', maxWidth: 600, margin: '0 auto', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
          Stay updated on the latest releases, industry news, and market insights
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        marginBottom: '2rem',
        gap: '1rem'
      }}>
        <button
          onClick={() => setActiveTab('releases')}
          style={{
            background: activeTab === 'releases' ? '#ffd700' : '#374151',
            color: activeTab === 'releases' ? '#000' : '#fff',
            border: '2px solid #ffd700',
            padding: '0.75rem 1.5rem',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '1rem',
            transition: 'all 0.3s ease'
          }}
        >
          📅 Release Calendar
        </button>
        <button
          onClick={() => setActiveTab('news')}
          style={{
            background: activeTab === 'news' ? '#ffd700' : '#374151',
            color: activeTab === 'news' ? '#000' : '#fff',
            border: '2px solid #ffd700',
            padding: '0.75rem 1.5rem',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '1rem',
            transition: 'all 0.3s ease'
          }}
        >
          📰 Industry News
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'releases' ? renderReleasesTab() : renderNewsTab()}
    </div>
  );
};

export default NewsPage; 