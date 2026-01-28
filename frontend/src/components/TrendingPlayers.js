import React, { useState, useEffect } from 'react';
import config from '../config';

const API_BASE_URL = config.API_BASE_URL || 'https://web-production-9efa.up.railway.app';

const TrendingPlayers = () => {
  const [trendingData, setTrendingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    fetchTrendingPlayers();
  }, [period]);

  const fetchTrendingPlayers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`📈 Fetching trending players (period: ${period})...`);
      const response = await fetch(`${API_BASE_URL}/api/gemrate/trending/players?period=${period}`);
      const data = await response.json();
      
      console.log('📦 Trending players API Response:', data);
      console.log('📦 Trending players data.data:', data.data);
      console.log('📦 Trending players data.data type:', typeof data.data);
      console.log('📦 Trending players data.data isArray:', Array.isArray(data.data));
      if (data.data && data.data.length) {
        console.log('📦 Trending players first item:', data.data[0]);
      }
      
      if (data.success && data.data) {
        console.log(`✅ Loaded trending players data, count: ${Array.isArray(data.data) ? data.data.length : 'not array'}`);
        setTrendingData(data.data);
      } else {
        console.error('❌ API Error:', data.error);
        setError(data.error || 'Failed to fetch trending players');
      }
    } catch (err) {
      console.error('❌ Network Error:', err);
      setError('Failed to connect to server. The GemRate API endpoint may not be publicly available or may require authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num == null || num === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US').format(Number(num));
  };

  const getPeriodLabel = (p) => {
    const labels = {
      day: 'Today',
      week: 'This Week',
      month: 'This Month'
    };
    return labels[p] || p;
  };

  // Handle different possible response structures from GemRate API
  const getPlayersList = () => {
    if (!trendingData) return [];
    
    // Try different possible structures
    if (Array.isArray(trendingData)) {
      return trendingData;
    }
    
    if (trendingData.players && Array.isArray(trendingData.players)) {
      return trendingData.players;
    }
    
    if (trendingData.data && Array.isArray(trendingData.data)) {
      return trendingData.data;
    }
    
    if (trendingData.results && Array.isArray(trendingData.results)) {
      return trendingData.results;
    }
    
    // If it's an object with numeric keys, convert to array
    if (typeof trendingData === 'object' && !Array.isArray(trendingData)) {
      const keys = Object.keys(trendingData);
      if (keys.length > 0 && keys.every(k => !isNaN(k) || k === '0')) {
        return Object.values(trendingData);
      }
    }
    
    return [];
  };

  const players = getPlayersList();

  if (isLoading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem',
        color: '#fff'
      }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>📈 Loading trending players...</div>
        <div style={{ 
          display: 'inline-block',
          width: '40px',
          height: '40px',
          border: '4px solid #ffd700',
          borderTop: '4px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem',
        color: '#ff6b6b',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderRadius: 8,
        border: '1px solid #ff6b6b'
      }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>❌ Error</div>
        <div>{error}</div>
        <button
          onClick={fetchTrendingPlayers}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#ffd700',
            color: '#000',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!players || players.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem',
        color: '#fff'
      }}>
        <div style={{ fontSize: '1.2rem' }}>📊 No trending players data available</div>
        <div style={{ marginTop: '0.5rem', color: '#9ca3af' }}>
          Try selecting a different time period
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
      {/* Period Selector */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '0.5rem',
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        {['day', 'week', 'month'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              background: period === p ? '#ffd700' : '#374151',
              color: period === p ? '#000' : '#fff',
              border: '2px solid #ffd700',
              padding: '0.5rem 1rem',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.3s ease'
            }}
          >
            {getPeriodLabel(p)}
          </button>
        ))}
      </div>

      {/* Header */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '2rem' 
      }}>
        <h2 style={{ 
          fontSize: '2rem', 
          fontWeight: 700, 
          color: '#ffd700',
          marginBottom: '0.5rem',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          🔥 Trending Players
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '1rem' }}>
          Players with the most cards being graded {getPeriodLabel(period).toLowerCase()}
        </p>
      </div>

      {/* Players Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {players.map((player, index) => {
          // Handle different possible field names from API
          const playerName = player.player || player.name || player.player_name || 'Unknown Player';
          const submissions = player.submissions || player.total_submissions || player.count || player.grades || player.total_grades || 0;
          const change = player.change || player.change_percent || player.percent_change || null;
          const rank = index + 1;
          
          // Try to get sport/category if available
          const sport = player.sport || player.category || '';
          
          return (
            <div
              key={index}
              style={{
                background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
                border: '2px solid #374151',
                borderRadius: 12,
                padding: '1.5rem',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#ffd700';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(255, 215, 0, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#374151';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Rank Badge */}
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: rank <= 3 ? '#ffd700' : '#374151',
                color: rank <= 3 ? '#000' : '#fff',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.9rem',
                boxShadow: rank <= 3 ? '0 2px 8px rgba(255, 215, 0, 0.4)' : 'none'
              }}>
                {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
              </div>

              {/* Player Name */}
              <div style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                color: '#fff',
                marginBottom: '0.5rem',
                paddingRight: '2.5rem'
              }}>
                {playerName}
              </div>

              {/* Sport/Category */}
              {sport && (
                <div style={{
                  fontSize: '0.85rem',
                  color: '#9ca3af',
                  marginBottom: '1rem',
                  textTransform: 'capitalize'
                }}>
                  {sport}
                </div>
              )}

              {/* Submissions Count */}
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <span style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#ffd700'
                }}>
                  {formatNumber(submissions)}
                </span>
                <span style={{
                  fontSize: '0.9rem',
                  color: '#9ca3af'
                }}>
                  submissions
                </span>
              </div>

              {/* Change Indicator */}
              {change != null && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.85rem',
                  color: change > 0 ? '#10b981' : change < 0 ? '#ef4444' : '#9ca3af'
                }}>
                  {change > 0 ? '📈' : change < 0 ? '📉' : '➡️'}
                  <span>
                    {change > 0 ? '+' : ''}{typeof change === 'number' ? change.toFixed(1) : change}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Footer */}
      <div style={{
        textAlign: 'center',
        padding: '1rem',
        background: 'rgba(255, 215, 0, 0.1)',
        borderRadius: 8,
        border: '1px solid rgba(255, 215, 0, 0.3)',
        color: '#9ca3af',
        fontSize: '0.85rem'
      }}>
        💡 Data provided by GemRate.com - Shows players with the most card submissions {getPeriodLabel(period).toLowerCase()}
      </div>
    </div>
  );
};

export default TrendingPlayers;
