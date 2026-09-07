import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import config from '../config';
import TrendingPlayers from './TrendingPlayers';
import TrendingSets from './TrendingSets';
import TrendingCards from './TrendingCards';

const API_BASE_URL = config.API_BASE_URL || 'https://web-production-9efa.up.railway.app';

const NewsPage = () => {
  const [activeTab, setActiveTab] = useState('releases');
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

  const renderNewsTab = () => (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
        padding: '1.5rem',
        borderRadius: 12,
        marginBottom: '2rem',
        border: '2px solid #000'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#000', fontSize: '1.2rem', fontWeight: 700 }}>
          📰 Industry News & Analysis
        </h3>
        <p style={{ margin: 0, color: '#333', fontSize: '0.95rem' }}>
          Stay updated with the latest news, trends, and insights from the trading card industry. Expert analysis and market insights for collectors and investors.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '2rem' }}>
        {/* Article: 2026 Bowman Chrome Baseball Budget Collector Guide */}
        <article style={{
          background: '#1f2937',
          borderRadius: 12,
          padding: '2rem',
          border: '2px solid #ffd700',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <header style={{ marginBottom: '1.5rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, #059669, #047857)',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: 6,
              display: 'inline-block',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '1rem'
            }}>
              NEW COLLECTING GUIDE
            </div>
            <h2 style={{
              color: '#ffd700',
              fontSize: '1.8rem',
              fontWeight: 700,
              margin: '0 0 0.5rem 0',
              lineHeight: '1.3'
            }}>
              2026 Bowman Chrome Baseball: A Budget Collector&apos;s Guide
            </h2>
            <div style={{
              color: '#9ca3af',
              fontSize: '0.9rem',
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <span>September 7, 2026</span>
              <span>6 min read</span>
              <span>Collecting Guides, Bowman Chrome, Set Building</span>
            </div>
          </header>

          <div style={{ color: '#d1d5db', lineHeight: '1.7', fontSize: '1rem' }}>
            <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 500 }}>
              2026 Bowman Chrome Baseball arrives on September 9, bringing another wave of rookies,
              prospects, parallels, and 1st Bowman cards into the hobby. It will attract plenty of
              attention from breakers and prospect hunters, but collectors do not have to spend
              hundreds of dollars on boxes to participate.
            </p>

            <p style={{ marginBottom: '1.5rem' }}>
              For budget-conscious collectors and set builders, patience and a clear collecting goal
              will usually produce better results than chasing release-day excitement.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              What Is in 2026 Bowman Chrome?
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              According to the{' '}
              <a
                href="https://www.topps.com/pages/bowman-chrome-baseball"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#93c5fd' }}
              >
                official Topps product information
              </a>
              , the release contains a 100-card base set featuring established MLB players and
              emerging rookies, plus a separate 100-card Bowman Prospect set.
            </p>
            <p style={{ marginBottom: '1.5rem' }}>
              Players receiving their first Bowman card carry the familiar <strong>1st Bowman</strong>{' '}
              logo. The product also includes returning inserts such as Bowman Spotlights,
              Crystallized, and Bowman GPK, along with WBC Flag Variations and Across the Seams cards.
              Short prints, autographs, and colored refractors will generate most of the early
              excitement, but they are not the only worthwhile part of the set.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              Decide What You Are Collecting Before You Buy
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              Bowman Chrome can become confusing quickly. Before spending money, choose one
              manageable goal:
            </p>
            <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
              <li>Complete the 100-card major-league base set</li>
              <li>Build the 100-card prospect set</li>
              <li>Collect one favorite team or player</li>
              <li>Build a smaller group of affordable 1st Bowman cards</li>
              <li>Complete one insert set that fits your budget</li>
            </ul>
            <p style={{ marginBottom: '1.5rem' }}>
              A written target protects you from buying random cards simply because they look
              exciting during release week.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              Why Buying Singles May Be the Better Value
            </h3>
            <p style={{ marginBottom: '1.5rem' }}>
              Opening a new box can be entertaining, but it is not the most dependable way to
              complete a set or obtain a particular player. Much of a hobby box&apos;s price reflects
              the possibility of pulling a scarce autograph or parallel. Collectors primarily
              interested in base cards and ordinary prospects may be paying for odds they do not
              actually care about.
            </p>
            <p style={{ marginBottom: '1.5rem' }}>
              Release week also creates a large amount of supply. Breakers and collectors open boxes
              looking for premium hits, leaving them with duplicates and base cards they may not want.
              Those cards often appear as individual listings, team lots, and bulk lots shortly after
              release. Waiting a few weeks can provide more choices and better pricing.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              Be Careful With Early Prospect Hype
            </h3>
            <p style={{ marginBottom: '1.5rem' }}>
              Prospecting can be fun, but predicting which young players will become established
              major leaguers is extremely difficult. A strong minor-league season, social-media
              attention, or a few large card sales can push prices higher before a player has proven
              anything at the MLB level. A 1st Bowman logo identifies an important early card; it does
              not guarantee that the player will become a star or that the card will increase in value.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              Check Sold Prices, Not Asking Prices
            </h3>
            <p style={{ marginBottom: '1.5rem' }}>
              An active listing only shows what a seller hopes to receive. It does not prove that a
              buyer will pay that amount. eBay&apos;s{' '}
              <a
                href="https://pages.ebay.com/price-guide/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#93c5fd' }}
              >
                Trading Card Price Guide
              </a>{' '}
              uses completed transactions, including accepted Best Offer prices, and provides up to
              two years of sales history when enough data is available. For a brand-new release, wait
              for multiple comparable sales and confirm the exact card, parallel, and condition.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              A Practical Release-Week Plan
            </h3>
            <ol style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
              <li>Download the official checklist and mark the cards you want.</li>
              <li>Watch opening-week sales without feeling pressured to buy immediately.</li>
              <li>Compare completed sales after more copies enter the market.</li>
              <li>Look for team lots, player lots, and pick-your-card listings.</li>
              <li>Buy expensive prospects only when you understand the risk.</li>
              <li>Keep a checklist so you do not purchase duplicates accidentally.</li>
            </ol>
            <p style={{ marginBottom: '1.5rem' }}>
              Topps schedules the hobby release for <strong>September 9 at noon Eastern</strong>,
              although release dates can change. The official product page also provides downloadable
              hobby and Mega Box checklists.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              The Bottom Line
            </h3>
            <p style={{ marginBottom: '1.5rem' }}>
              2026 Bowman Chrome offers several ways to collect, from complete base sets to individual
              prospects and colorful parallels. If you love opening packs and understand the cost, a
              box may be worthwhile as entertainment. If your priority is completing sets or collecting
              specific players, singles and affordable lots will usually give you more control.
            </p>
            <p style={{ marginBottom: 0 }}>
              Be patient, use completed sales, and collect with a plan. Release-day excitement passes
              quickly, but a collection built around cards you genuinely want can remain enjoyable for
              years.
            </p>
          </div>
        </article>

        {/* Article: Data-Driven Sports Card Insights */}
        <article style={{
          background: '#1f2937',
          borderRadius: 12,
          padding: '2rem',
          border: '2px solid #374151',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <header style={{ marginBottom: '1.5rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: 6,
              display: 'inline-block',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '1rem'
            }}>
              📊 FEATURED ARTICLE
            </div>
            <h2 style={{
              color: '#ffd700',
              fontSize: '1.8rem',
              fontWeight: 700,
              margin: '0 0 0.5rem 0',
              lineHeight: '1.3'
            }}>
              The Smarter Way to Collect: Data‑Driven Sports Card Insights for Today's Hobby
            </h2>
            <div style={{
              color: '#9ca3af',
              fontSize: '0.9rem',
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <span>📅 {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              <span>⏱️ 6 min read</span>
              <span>🏷️ Market Analysis, Investment Strategy</span>
            </div>
          </header>

          <div style={{ color: '#d1d5db', lineHeight: '1.7', fontSize: '1rem' }}>
            <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 500 }}>
              The sports card market is evolving faster than ever — and collectors who rely on <strong>real data, not guesswork</strong>, are the ones staying ahead. At <strong>Man Cave Sports Cards</strong>, we combine passion for the hobby with analytics‑driven insights to help collectors make smarter buying, selling, and grading decisions.
            </p>

            <p style={{ marginBottom: '1.5rem' }}>
              Whether you're chasing your favorite players, building long‑term investments, or flipping hot prospects, our goal is simple: <strong>give you the information you need to win in today's market</strong>.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              Real‑Time Market Data That Works for You
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              The days of guessing card values are over. With modern tools and consistent tracking, collectors can now understand:
            </p>
            <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>True market comps</strong> across PSA 10, PSA 9, and raw
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Price trends</strong> over days, weeks, and months
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Population report impact</strong> on long‑term value
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Which players are heating up — and which are cooling off</strong>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>How grading can multiply (or destroy) ROI</strong>
              </li>
            </ul>
            <p style={{ marginBottom: '1.5rem' }}>
              Our platform and insights are built for collectors who want clarity, accuracy, and confidence in every purchase.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              Smarter Buying Starts With Better Information
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              Every card tells a story — but the data behind it tells the truth. We help collectors identify:
            </p>
            <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Undervalued cards</strong> with strong upside
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Overpriced listings</strong> to avoid
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Cards with strong gem‑rate potential</strong>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Market dips</strong> that create buying opportunities
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Long‑term holds vs. short‑term flips</strong>
              </li>
            </ul>
            <p style={{ marginBottom: '1.5rem' }}>
              Whether you're hunting for modern rookies, vintage legends, or Pokémon grails, we break down the numbers so you can focus on the fun.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              Grading Insights That Maximize Your ROI
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              Submitting cards blindly is one of the fastest ways to lose money in the hobby. That's why we emphasize:
            </p>
            <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Pre‑grading evaluation</strong>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>PSA 10 vs. PSA 9 price gaps</strong>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Risk vs. reward</strong> on grading fees
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Surface, centering, and edge analysis</strong>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Historical gem rates</strong> for specific sets
              </li>
            </ul>
            <p style={{ marginBottom: '1.5rem' }}>
              A smart grading strategy can turn a $20 card into a $200 card — or save you from turning a $20 card into a $12 PSA 9.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              Stay Ahead of the Market With Expert Analysis
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              From trending players to set breakdowns, we deliver insights that help collectors stay ahead of the curve. Expect content covering:
            </p>
            <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Weekly market movers</strong>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Player performance impact</strong> on card prices
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Set reviews and investment outlooks</strong>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Pokémon grading trends</strong>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Modern vs. vintage market behavior</strong>
              </li>
            </ul>
            <p style={{ marginBottom: '1.5rem' }}>
              If it matters to collectors, we're tracking it.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              Built for Collectors. Powered by Data.
            </h3>
            <p style={{ marginBottom: '1.5rem' }}>
              At <strong>Man Cave Sports Cards</strong>, we're more than a shop — we're a resource for collectors who want to collect smarter, buy confidently, and enjoy the hobby with real knowledge behind every decision.
            </p>
            <p style={{ marginBottom: '1.5rem' }}>
              Whether you're a seasoned investor or just getting started, we're here to help you navigate the market with clarity and confidence.
            </p>

            <div style={{
              background: 'linear-gradient(135deg, #374151, #4b5563)',
              padding: '1rem',
              borderRadius: 8,
              marginTop: '2rem',
              border: '1px solid #6b7280'
            }}>
              <div style={{ color: '#ffd700', fontWeight: 600, marginBottom: '0.5rem' }}>
                🎯 Key Takeaways:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#d1d5db' }}>
                <li>Data-driven insights help collectors make smarter decisions</li>
                <li>Real-time market data across PSA 10, PSA 9, and raw cards</li>
                <li>Grading strategy can maximize ROI or prevent costly mistakes</li>
                <li>Expert analysis helps collectors stay ahead of market trends</li>
              </ul>
            </div>
          </div>
        </article>

        {/* Featured Article: The National 2025 */}
        <article style={{
          background: '#1f2937',
          borderRadius: 12,
          padding: '2rem',
          border: '2px solid #374151',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <header style={{ marginBottom: '1.5rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: 6,
              display: 'inline-block',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '1rem'
            }}>
              🏆 FEATURED ARTICLE
            </div>
            <h2 style={{
              color: '#ffd700',
              fontSize: '1.8rem',
              fontWeight: 700,
              margin: '0 0 0.5rem 0',
              lineHeight: '1.3'
            }}>
              🏟️ The National 2025: Why Every Collector Should Be Watching
            </h2>
            <div style={{
              color: '#9ca3af',
              fontSize: '0.9rem',
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <span>📅 July 28, 2025</span>
              <span>⏱️ 5 min read</span>
              <span>🏷️ Events, Investment Tips</span>
            </div>
          </header>

          <div style={{ color: '#d1d5db', lineHeight: '1.7', fontSize: '1rem' }}>
            <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 500 }}>
              This week marks the start of the <strong>45th National Sports Collectors Convention</strong>, the largest and most anticipated event in the hobby. Held from <strong>July 30 to August 3</strong> at the <strong>Donald E. Stephens Convention Center in Rosemont, IL</strong>, the National is more than just a card show — it's the Super Bowl of collecting.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              🔥 What Makes the National So Special?
            </h3>
            <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>600+ Dealers</strong> from across the country offering vintage, modern, graded, and raw cards.
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Live Breaks, Giveaways, and Promos</strong> from major companies like Panini, Topps, and Upper Deck.
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Autograph Signings</strong> with legends and current stars — from Hall of Famers to rising rookies.
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Grading Services On-Site</strong> from PSA, BGS, CGC, and SGC — perfect for submitting your best pulls.
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Trade Nights</strong> every evening, where collectors swap cards, stories, and strategies.
              </li>
            </ul>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              💡 Tips for Attendees
            </h3>
            <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Bring Cash</strong> — many dealers prefer it, and it can help you negotiate better deals.
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Pack Smart</strong> — top loaders, sleeves, and a sturdy backpack are must-haves.
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Know Your Targets</strong> — make a list of cards or players you're hunting to stay focused.
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>Network</strong> — this is the place to meet fellow collectors, influencers, and dealers.
              </li>
            </ul>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              📈 Why It Matters for Investors
            </h3>
            <p style={{ marginBottom: '1.5rem' }}>
              Whether you're flipping slabs or building a long-term portfolio, the National is a goldmine for market insights. Watch which players are getting buzz, which sets are moving, and how pricing trends shift in real time. If you're running a resale business like I am, this is the pulse of the hobby.
            </p>

            <h3 style={{ color: '#ffd700', fontSize: '1.3rem', margin: '1.5rem 0 1rem 0' }}>
              🧠 Final Thoughts
            </h3>
            <p style={{ marginBottom: '1.5rem' }}>
              Even if you're not attending in person, follow the action online. Social media will be flooded with highlights, rare pulls, and breaking news. And if you're looking to capitalize on the hype, now's the time to list hot cards, run promotions, or publish your own analysis.
            </p>

            <div style={{
              background: 'linear-gradient(135deg, #374151, #4b5563)',
              padding: '1rem',
              borderRadius: 8,
              marginTop: '2rem',
              border: '1px solid #6b7280'
            }}>
              <div style={{ color: '#ffd700', fontWeight: 600, marginBottom: '0.5rem' }}>
                🎯 Key Takeaways:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#d1d5db' }}>
                <li>The National 2025 runs July 30 - August 3 in Rosemont, IL</li>
                <li>600+ dealers, live breaks, and autograph signings</li>
                <li>Perfect opportunity for market research and networking</li>
                <li>Follow online for real-time industry insights</li>
              </ul>
            </div>
          </div>
        </article>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      <Helmet>
        <title>2026 Bowman Chrome Baseball Budget Collector Guide | Scorecard</title>
        <meta name="description" content="2026 Bowman Chrome Baseball arrives September 9. Learn what budget collectors and set builders should target—and what expensive hype to avoid." />
        <meta name="keywords" content="2026 Bowman Chrome Baseball, Bowman Chrome checklist, budget card collecting, baseball card set building, 1st Bowman cards, sports card news" />
        <meta name="author" content="ManCave Sports Cards LLC" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content="2026 Bowman Chrome Baseball: A Budget Collector's Guide" />
        <meta property="og:description" content="How budget collectors and set builders can approach 2026 Bowman Chrome Baseball without overpaying for release-day hype." />
        <meta property="og:url" content="https://www.mancavesportscardsllc.com/news" />
        <meta property="og:site_name" content="Scorecard" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="2026 Bowman Chrome Baseball: A Budget Collector's Guide" />
        <meta name="twitter:description" content="A practical release-week guide for budget collectors and set builders." />
        
        {/* Article specific meta tags */}
        <meta property="article:published_time" content="2026-09-07T00:00:00.000Z" />
        <meta property="article:section" content="Collecting Guides" />
        <meta property="article:tag" content="2026 Bowman Chrome Baseball, Bowman Chrome, set building, budget collecting, 1st Bowman cards" />
        
        {/* Additional SEO */}
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.mancavesportscardsllc.com/news" />
        
        {/* Structured Data for SEO */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "2026 Bowman Chrome Baseball: A Budget Collector's Guide",
            "description": "How budget collectors and set builders can approach 2026 Bowman Chrome Baseball without overpaying for release-day hype.",
            "image": "https://www.mancavesportscardsllc.com/ManCave.jpg",
            "author": {
              "@type": "Organization",
              "name": "ManCave Sports Cards LLC"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Scorecard",
              "logo": {
                "@type": "ImageObject",
                "url": "https://www.mancavesportscardsllc.com/ManCave.jpg"
              }
            },
            "datePublished": "2026-09-07T00:00:00.000Z",
            "dateModified": "2026-09-07T00:00:00.000Z",
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": "https://www.mancavesportscardsllc.com/news"
            },
            "keywords": "2026 Bowman Chrome Baseball, Bowman Chrome checklist, budget card collecting, baseball card set building, 1st Bowman cards",
            "articleSection": "Collecting Guides",
            "wordCount": "850"
          })}
        </script>
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
      {activeTab === 'news' && renderNewsTab()}
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
