import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import config from '../config';
import NewsIndex from './NewsIndex';
import TrendingPlayers from './TrendingPlayers';
import TrendingSets from './TrendingSets';
import TrendingCards from './TrendingCards';
import { getAllArticles } from '../services/newsArticleService';
import { buildNewsIndexSeo } from '../services/newsArticleSeo';

const API_BASE_URL = config.API_BASE_URL || 'https://web-production-9efa.up.railway.app';

const VALID_TABS = ['releases', 'news', 'trending'];

const NewsPage = () => {
  // Published only: getAllArticles() is the public accessor, and drafts are not
  // in the bundle for it to return.
  const seo = buildNewsIndexSeo(getAllArticles());
  const [searchParams] = useSearchParams();
  // Lets article pages link back to a specific tab, e.g. /news?tab=news
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    VALID_TABS.includes(requestedTab) ? requestedTab : 'releases'
  );
  const [trendingSubTab, setTrendingSubTab] = useState('players'); // 'players', 'sets', or 'cards'
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [releases, setReleases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [showReleaseModal, setShowReleaseModal] = useState(false);

  // Fetch release data from API
  useEffect(() => {
    const fetchReleases = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('🔄 Fetching releases from API...');
        const response = await fetch(`${API_BASE_URL}/api/news/releases`);
        const data = await response.json();
        
        console.log('📦 API Response:', data);
        
        if (data.success) {
          console.log(`✅ Loaded ${data.releases.length} releases`);
          console.log('📅 Sample releases:', data.releases.slice(0, 3));
          setReleases(data.releases);
        } else {
          console.error('❌ API Error:', data.error);
          setError(data.error || 'Failed to fetch releases');
        }
      } catch (err) {
        console.error('❌ Network Error:', err);
        setError('Failed to connect to server');
        console.error('Error fetching releases:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReleases();
  }, []);

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

  // Calendar helper functions
  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const getReleasesForDate = (day, month, year) => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const filteredReleases = releases.filter(release => {
      if (!release.releaseDate) return false;
      const releaseDate = new Date(release.releaseDate);
      return releaseDate.getFullYear() === year && 
             releaseDate.getMonth() === month && 
             releaseDate.getDate() === day;
    });
    
    // Debug logging for September 2025
    if (month === 8 && year === 2025 && filteredReleases.length > 0) {
      console.log(`📅 Found ${filteredReleases.length} releases for ${dateString}:`, filteredReleases);
    }
    
    return filteredReleases;
  };

  const handleReleaseClick = (release) => {
    setSelectedRelease(release);
    setShowReleaseModal(true);
  };

  const closeReleaseModal = () => {
    setShowReleaseModal(false);
    setSelectedRelease(null);
  };

  const renderCalendarDay = (day, month, year, isCurrentMonth = true) => {
    const releasesForDay = getReleasesForDate(day, month, year);
    const today = new Date();
    const isToday =
      today.getDate() === day &&
      today.getMonth() === currentMonth &&
      today.getFullYear() === currentYear &&
      month === currentMonth &&
      year === currentYear;
    
    return (
      <div
        key={`${month}-${day}-${year}`}
        style={{
          minHeight: '90px', // Reduced from 140px
          padding: '6px 4px', // Reduced padding
          border: '1px solid #374151',
          backgroundColor: isToday ? '#ffd700' : (isCurrentMonth ? '#1f2937' : '#111827'),
          color: isToday ? '#000' : (isCurrentMonth ? '#fff' : '#6b7280'),
          position: 'relative',
          cursor: releasesForDay.length > 0 ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          fontSize: 'clamp(0.7rem, 2vw, 0.85rem)', // Smaller font size
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start'
        }}
        onClick={() => {
          if (releasesForDay.length > 0) {
            if (releasesForDay.length === 1) {
              handleReleaseClick(releasesForDay[0]);
            } else {
              handleReleaseClick(releasesForDay[0]);
            }
          }
        }}
      >
        <div style={{
          fontSize: 'clamp(0.75rem, 2.5vw, 0.9rem)', // Smaller font size
          fontWeight: isToday ? 700 : 500,
          marginBottom: '3px', // Reduced margin
          textAlign: 'center'
        }}>
          {day}
        </div>
        
        {releasesForDay.map((release, index) => (
          <div
            key={`${release.title}-${index}`}
            style={{
              fontSize: 'clamp(0.5rem, 1.5vw, 0.65rem)', // Smaller font size
              padding: '2px 4px', // Reduced padding
              marginBottom: '2px', // Reduced margin
              borderRadius: '3px',
              backgroundColor: getBrandColor(release.brand),
              color: '#fff',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minHeight: '16px', // Reduced height
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}
            title={`${release.title} - ${release.brand} (${release.status})`}
            onClick={(e) => {
              e.stopPropagation();
              handleReleaseClick(release);
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = 'none';
            }}
          >
            {release.title.length > 12 ? release.title.substring(0, 12) + '...' : release.title}
          </div>
        ))}
        
        {releasesForDay.length > 2 && (
          <div style={{
            fontSize: 'clamp(0.45rem, 1.5vw, 0.6rem)', // Smaller font size
            color: isToday ? '#000' : '#9ca3af',
            textAlign: 'center',
            marginTop: '2px', // Reduced margin
            fontWeight: 500
          }}>
            +{releasesForDay.length - 2} more
          </div>
        )}
      </div>
    );
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDayOfMonth = getFirstDayOfMonth(currentMonth, currentYear);
    const daysInPrevMonth = getDaysInMonth(currentMonth - 1, currentYear);
    
    const calendarDays = [];
    
    // Add days from previous month
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      calendarDays.push(renderCalendarDay(day, currentMonth - 1, currentYear, false));
    }
    
    // Add days from current month
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push(renderCalendarDay(day, currentMonth, currentYear, true));
    }
    
    // Add days from next month to fill the grid
    const remainingDays = 42 - calendarDays.length; // 6 rows * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      calendarDays.push(renderCalendarDay(day, currentMonth + 1, currentYear, false));
    }
    
    return calendarDays;
  };

  // Release Detail Modal
  const renderReleaseModal = () => {
    if (!showReleaseModal || !selectedRelease) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem'
      }}
      onClick={closeReleaseModal}
      >
        <div style={{
          background: '#1f2937',
          borderRadius: 12,
          padding: '2rem',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          border: '2px solid #ffd700',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={closeReleaseModal}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'none',
              border: 'none',
              color: '#ffd700',
              fontSize: '1.5rem',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ×
          </button>

          {/* Release details */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              background: getBrandColor(selectedRelease.brand),
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: 20,
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              display: 'inline-block',
              marginBottom: '1rem'
            }}>
              {selectedRelease.brand}
            </div>
            <h2 style={{
              color: '#ffd700',
              fontSize: '1.8rem',
              fontWeight: 700,
              margin: '0 0 1rem 0',
              lineHeight: '1.3'
            }}>
              {selectedRelease.title}
            </h2>
            <p style={{
              color: '#d1d5db',
              fontSize: '1rem',
              lineHeight: '1.6',
              marginBottom: '1.5rem'
            }}>
              {selectedRelease.description}
            </p>
          </div>

          {/* Release info grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div>
              <strong style={{ color: '#ffd700' }}>Release Date:</strong>
              <div style={{ color: '#d1d5db' }}>
                {selectedRelease.releaseDate ? (
                  new Date(selectedRelease.releaseDate).toLocaleDateString('en-US', { 
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
              <strong style={{ color: '#ffd700' }}>Sport:</strong>
              <div style={{ color: '#d1d5db' }}>{selectedRelease.sport || 'Trading Cards'}</div>
            </div>
            <div>
              <strong style={{ color: '#ffd700' }}>Status:</strong>
              <div style={{
                color: '#fff',
                backgroundColor: getStatusColor(selectedRelease.status),
                padding: '0.25rem 0.75rem',
                borderRadius: 20,
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'inline-block'
              }}>
                {selectedRelease.status}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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

      {/* Calendar Navigation */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem', 
        marginBottom: '2rem',
        alignItems: 'center'
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <button
            onClick={() => setCurrentYear(prev => prev - 1)}
            style={{
              background: '#000',
              color: '#ffd700',
              border: 'none',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 'clamp(0.8rem, 2.5vw, 1rem)',
              minWidth: '60px'
            }}
          >
            ← {currentYear - 1}
          </button>
          <h2 style={{ 
            margin: 0, 
            color: '#ffd700', 
            fontSize: 'clamp(1.2rem, 4vw, 1.8rem)', 
            fontWeight: 700,
            textAlign: 'center'
          }}>
            {currentYear} Releases
          </h2>
          <button
            onClick={() => setCurrentYear(prev => prev + 1)}
            style={{
              background: '#000',
              color: '#ffd700',
              border: 'none',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 'clamp(0.8rem, 2.5vw, 1rem)',
              minWidth: '60px'
            }}
          >
            {currentYear + 1} →
          </button>
        </div>
      </div>

      {/* Month Navigation */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <button
          onClick={() => {
            if (currentMonth === 0) {
              setCurrentMonth(11);
              setCurrentYear(prev => prev - 1);
            } else {
              setCurrentMonth(prev => prev - 1);
            }
          }}
          style={{
            background: '#000',
            color: '#ffd700',
            border: 'none',
            padding: '0.75rem 1rem',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 'clamp(0.7rem, 2.2vw, 0.9rem)',
            minWidth: '50px'
          }}
        >
          ← {months[currentMonth === 0 ? 11 : currentMonth - 1]}
        </button>
        <h3 style={{ 
          margin: 0, 
          color: '#ffd700', 
          fontSize: 'clamp(1rem, 3.5vw, 1.5rem)', 
          fontWeight: 700,
          textAlign: 'center',
          flex: '1'
        }}>
          {months[currentMonth]} {currentYear}
        </h3>
        <button
          onClick={() => {
            if (currentMonth === 11) {
              setCurrentMonth(0);
              setCurrentYear(prev => prev + 1);
            } else {
              setCurrentMonth(prev => prev + 1);
            }
          }}
          style={{
            background: '#000',
            color: '#ffd700',
            border: 'none',
            padding: '0.75rem 1rem',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 'clamp(0.7rem, 2.2vw, 0.9rem)',
            minWidth: '50px'
          }}
        >
          {months[currentMonth === 11 ? 0 : currentMonth + 1]} →
        </button>
      </div>

      {!isLoading && !error && (
        <div>
          {/* Legend */}
          <div style={{
            background: '#1f2937',
            borderRadius: 8,
            padding: 'clamp(0.75rem, 2.5vw, 1rem)',
            border: '2px solid #374151',
            marginBottom: '2rem'
          }}>
            <h4 style={{ 
              color: '#ffd700', 
              margin: '0 0 1rem 0', 
              fontSize: 'clamp(0.9rem, 2.8vw, 1rem)',
              textAlign: 'center'
            }}>Legend</h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '1rem',
              justifyContent: 'center'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: 'clamp(10px, 3vw, 12px)',
                  height: 'clamp(10px, 3vw, 12px)',
                  backgroundColor: '#1e3a8a',
                  borderRadius: '2px'
                }}></div>
                <span style={{ 
                  color: '#fff', 
                  fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)',
                  fontWeight: 500
                }}>Topps</span>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: 'clamp(10px, 3vw, 12px)',
                  height: 'clamp(10px, 3vw, 12px)',
                  backgroundColor: '#dc2626',
                  borderRadius: '2px'
                }}></div>
                <span style={{ 
                  color: '#fff', 
                  fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)',
                  fontWeight: 500
                }}>Panini</span>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: 'clamp(10px, 3vw, 12px)',
                  height: 'clamp(10px, 3vw, 12px)',
                  backgroundColor: '#059669',
                  borderRadius: '2px'
                }}></div>
                <span style={{ 
                  color: '#fff', 
                  fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)',
                  fontWeight: 500
                }}>Bowman</span>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: 'clamp(10px, 3vw, 12px)',
                  height: 'clamp(10px, 3vw, 12px)',
                  backgroundColor: '#7c3aed',
                  borderRadius: '2px'
                }}></div>
                <span style={{ 
                  color: '#fff', 
                  fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)',
                  fontWeight: 500
                }}>Upper Deck</span>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: 'clamp(10px, 3vw, 12px)',
                  height: 'clamp(10px, 3vw, 12px)',
                  backgroundColor: '#ffd700',
                  borderRadius: '2px'
                }}></div>
                <span style={{ 
                  color: '#fff', 
                  fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)',
                  fontWeight: 500
                }}>Today</span>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div style={{
            background: '#1f2937',
            borderRadius: 12,
            padding: 'clamp(0.4rem, 1.5vw, 1rem)', // Reduced padding
            border: '2px solid #374151',
            marginBottom: '2rem',
            overflow: 'auto'
          }}>
            {/* Calendar Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '1px',
              marginBottom: '1px',
              minWidth: '500px' // Reduced minimum width
            }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} style={{
                  padding: 'clamp(0.4rem, 1.5vw, 0.7rem)', // Reduced padding
                  textAlign: 'center',
                  fontWeight: 700,
                  color: '#ffd700',
                  fontSize: 'clamp(0.7rem, 2vw, 0.85rem)', // Smaller font size
                  backgroundColor: '#374151',
                  border: '1px solid #4b5563'
                }}>
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Days */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '1px',
              minWidth: '500px' // Reduced minimum width
            }}>
              {renderCalendar()}
            </div>
          </div>

          {/* Monthly Release List */}
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ 
              color: '#ffd700', 
              marginBottom: '1rem', 
              fontSize: 'clamp(1rem, 3.5vw, 1.3rem)',
              textAlign: 'center'
            }}>
              {months[currentMonth]} {currentYear} Releases
            </h3>
            {(() => {
              const monthlyReleases = releases.filter(release => {
                if (!release.releaseDate) return false;
                const releaseDate = new Date(release.releaseDate);
                return releaseDate.getFullYear() === currentYear && 
                       releaseDate.getMonth() === currentMonth;
              });

              if (monthlyReleases.length > 0) {
                return monthlyReleases.map((release, index) => renderReleaseCard(release, index));
              } else {
                return (
                  <div style={{
                    background: '#1f2937',
                    borderRadius: 12,
                    padding: '2rem',
                    textAlign: 'center',
                    border: '2px solid #374151'
                  }}>
                    <div style={{ color: '#ffd700', fontSize: '1.2rem', marginBottom: '1rem' }}>
                      📭 No releases found for {months[currentMonth]} {currentYear}
                    </div>
                    <div style={{ color: '#d1d5db' }}>
                      No release information is currently available for this month. Try selecting a different month.
                    </div>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      {/* Single source of truth for /news metadata. The static shell written by
          backend/generate-article-pages.js serialises this same descriptor, so a
          raw request to /news and the hydrated DOM cannot disagree. */}
      <Helmet>
        <title>{seo.title}</title>
        {seo.meta.map((tag) => (
          <meta
            key={`${tag.name || tag.property}=${tag.content}`}
            {...(tag.name ? { name: tag.name } : { property: tag.property })}
            content={tag.content}
          />
        ))}
        <link rel="canonical" href={seo.canonical} />
        <script type="application/ld+json">{JSON.stringify(seo.jsonLd)}</script>
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

      {/* Tab Navigation: all three tabs always shown - Release Calendar | Industry News | Trending */}
      <div
        className="news-page-tab-bar"
        role="tablist"
        aria-label="News section tabs"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '2rem',
          width: '100%',
          padding: '0.5rem 0'
        }}
      >
        <button
          role="tab"
          aria-selected={activeTab === 'releases'}
          onClick={() => setActiveTab('releases')}
          style={{
            background: activeTab === 'releases' ? '#ffd700' : '#374151',
            color: activeTab === 'releases' ? '#000' : '#fff',
            border: '2px solid #ffd700',
            padding: '0.75rem 1.25rem',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.95rem',
            transition: 'all 0.3s ease'
          }}
        >
          📅 Release Calendar
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'news'}
          onClick={() => setActiveTab('news')}
          style={{
            background: activeTab === 'news' ? '#ffd700' : '#374151',
            color: activeTab === 'news' ? '#000' : '#fff',
            border: '2px solid #ffd700',
            padding: '0.75rem 1.25rem',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.95rem',
            transition: 'all 0.3s ease'
          }}
        >
          📰 Industry News
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'trending'}
          aria-label="Trending players, sets, and cards"
          onClick={() => setActiveTab('trending')}
          style={{
            background: activeTab === 'trending' ? '#ffd700' : '#374151',
            color: activeTab === 'trending' ? '#000' : '#fff',
            border: '2px solid #ffd700',
            padding: '0.75rem 1.25rem',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.95rem',
            transition: 'all 0.3s ease'
          }}
        >
          🔥 Trending
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'releases' && renderReleasesTab()}
      {activeTab === 'news' && <NewsIndex />}
      {activeTab === 'trending' && (
        <div>
          {/* Trending Sub-Tabs */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '0.5rem',
            marginBottom: '2rem',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setTrendingSubTab('players')}
              style={{
                background: trendingSubTab === 'players' ? '#ffd700' : '#374151',
                color: trendingSubTab === 'players' ? '#000' : '#fff',
                border: '2px solid #ffd700',
                padding: '0.5rem 1rem',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                transition: 'all 0.3s ease'
              }}
            >
              👤 Players
            </button>
            <button
              onClick={() => setTrendingSubTab('sets')}
              style={{
                background: trendingSubTab === 'sets' ? '#ffd700' : '#374151',
                color: trendingSubTab === 'sets' ? '#000' : '#fff',
                border: '2px solid #ffd700',
                padding: '0.5rem 1rem',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                transition: 'all 0.3s ease'
              }}
            >
              📦 Sets
            </button>
            <button
              onClick={() => setTrendingSubTab('cards')}
              style={{
                background: trendingSubTab === 'cards' ? '#ffd700' : '#374151',
                color: trendingSubTab === 'cards' ? '#000' : '#fff',
                border: '2px solid #ffd700',
                padding: '0.5rem 1rem',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                transition: 'all 0.3s ease'
              }}
            >
              🃏 Cards
            </button>
          </div>
          
          {/* Trending Content */}
          {trendingSubTab === 'players' ? <TrendingPlayers /> : trendingSubTab === 'sets' ? <TrendingSets /> : <TrendingCards />}
        </div>
      )}
      {renderReleaseModal()}
    </div>
  );
};

export default NewsPage;
