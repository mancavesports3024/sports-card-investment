import React, { useState, useEffect } from 'react';
import config from '../config';

const API_BASE_URL = config.API_BASE_URL || 'https://web-production-9efa.up.railway.app';

const TrendingCards = () => {
  const [trendingData, setTrendingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    fetchTrendingCards();
  }, [period]);

  const fetchTrendingCards = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`📈 Fetching trending cards (period: ${period})...`);
      const response = await fetch(`${API_BASE_URL}/api/gemrate/trending/cards?period=${period}`);
      const data = await response.json();
      
      console.log('📦 Trending cards API Response:', data);
      
      if (data.success && data.data) {
        console.log(`✅ Loaded trending cards data, count: ${Array.isArray(data.data) ? data.data.length : 'not array'}`);
        setTrendingData(data.data);
      } else {
        console.error('❌ API Error:', data.error);
        setError(data.error || 'Failed to fetch trending cards');
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
  const getCardsList = () => {
    if (!trendingData) return [];
    
    if (Array.isArray(trendingData)) {
      return trendingData;
    }
    
    if (trendingData.cards && Array.isArray(trendingData.cards)) {
      return trendingData.cards;
    }
    
    if (trendingData.data && Array.isArray(trendingData.data)) {
      return trendingData.data;
    }
    
    if (trendingData.results && Array.isArray(trendingData.results)) {
      return trendingData.results;
    }
    
    return [];
  };

  const cards = getCardsList();

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#e0e0e0' }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>📈 Fetching trending cards...</div>
        <div style={{ fontSize: '0.9rem', color: '#888' }}>This may take a moment</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#ff6b6b' }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>❌ Error</div>
        <div style={{ fontSize: '0.9rem' }}>{error}</div>
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#e0e0e0' }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>📊 No Trending Cards Data</div>
        <div style={{ fontSize: '0.9rem', color: '#888' }}>No trending cards data available for {getPeriodLabel(period)}</div>
      </div>
    );
  }

  return (
    <div style={{ color: '#e0e0e0', maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      {/* Period Selector */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>Period:</div>
        {['day', 'week', 'month'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              background: period === p ? '#ffd700' : '#374151',
              color: period === p ? '#000' : '#fff',
              border: '1px solid #ffd700',
              padding: '0.5rem 1rem',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.9rem',
              transition: 'all 0.2s ease'
            }}
          >
            {getPeriodLabel(p)}
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem',
        marginTop: '1rem'
      }}>
        {cards.map((card, index) => {
          const cardName = card.name || card.card_name || card.card || 'Unknown';
          const submissions = card.submissions || card.count || card.total_grades || 0;
          
          return (
            <div
              key={index}
              style={{
                background: '#1f2937',
                border: '1px solid #374151',
                borderRadius: 8,
                padding: '1.25rem',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#ffd700';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#374151';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Rank Badge */}
              <div style={{
                position: 'absolute',
                top: '0.75rem',
                right: '0.75rem',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: index < 3 ? '#ffd700' : '#4b5563',
                color: index < 3 ? '#000' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.9rem'
              }}>
                {index + 1}
              </div>

              {/* Card Name */}
              <div style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                color: '#fff',
                marginBottom: '0.75rem',
                paddingRight: '2.5rem',
                lineHeight: 1.3
              }}>
                {cardName}
              </div>

              {/* Submissions */}
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#ffd700',
                marginBottom: '0.25rem'
              }}>
                {formatNumber(submissions)}
              </div>
              <div style={{
                fontSize: '0.85rem',
                color: '#9ca3af'
              }}>
                submissions
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrendingCards;
