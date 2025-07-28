import React, { useState, useEffect, useRef } from 'react';

const FeaturedEbayRotator = ({ apiUrl = '/api/live-listings/featured-ebay-items', interval = 5000 }) => {
  const [items, setItems] = useState([]);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef();

  useEffect(() => {
    fetch(apiUrl)
      .then(res => res.json())
      .then(data => setItems(data.items || []));
  }, [apiUrl]);

  useEffect(() => {
    if (!items.length) return;
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % items.length);
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [items, interval]);

  const goTo = idx => {
    setCurrent(idx);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % items.length);
    }, interval);
  };

  if (!items.length) return null;
  const item = items[current];

  return (
    <div className="featured-ebay-listing" style={{
      background: '#fff',
      borderRadius: 10,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      padding: '1.2em',
      margin: '1.5em 0',
      textAlign: 'center',
      maxWidth: 350,
      width: 350,
      minHeight: 450, // Minimum height to prevent jumping
      marginLeft: 'auto',
      marginRight: 'auto',
      position: 'relative'
    }}>
      {/* Fixed-size image container with robust centering */}
      <div style={{
        width: 180,
        height: 180,
        marginBottom: 15,
        background: '#f8f9fa',
        borderRadius: 8,
        border: '1px solid #e0e0e0',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {item.image ? (
          <img 
            src={item.image} 
            alt={item.title} 
            style={{ 
              maxWidth: '160px',
              maxHeight: '160px',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 6,
              display: 'block'
            }} 
            onLoad={(e) => {
              // Ensure consistent sizing after load
              e.target.style.opacity = '1';
            }}
            onError={(e) => {
              // Hide broken images
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div style={{
            color: '#999',
            fontSize: '0.9rem',
            textAlign: 'center',
            width: '100%'
          }}>
            No Image
          </div>
        )}
      </div>
      
      {/* Enhanced Title Section */}
      <div style={{ 
        background: '#000', 
        color: '#ffd700', 
        padding: '0.8em 1em', 
        borderRadius: 8, 
        marginBottom: 12,
        border: '2px solid #ffd700'
      }}>
        <div style={{ 
          fontWeight: 700, 
          fontSize: '1.2em', 
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {item.title}
        </div>
        {item.price && (
          <div style={{ 
            fontSize: '1.1em', 
            fontWeight: 600,
            color: '#fff'
          }}>
            {typeof item.price === 'object' ? `$${Number(item.price.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : item.price}
          </div>
        )}
      </div>
      
      <a href={item.affiliateLink} target="_blank" rel="noopener noreferrer"
         style={{ 
           background: '#ffd700', 
           color: '#000', 
           fontWeight: 700, 
           padding: '0.6em 1.4em', 
           borderRadius: 6, 
           textDecoration: 'none', 
           border: '2px solid #000', 
           fontSize: '1em', 
           display: 'inline-block', 
           marginBottom: 12,
           transition: 'all 0.3s ease'
         }}
         onMouseEnter={(e) => {
           e.target.style.background = '#000';
           e.target.style.color = '#ffd700';
         }}
         onMouseLeave={(e) => {
           e.target.style.background = '#ffd700';
           e.target.style.color = '#000';
         }}>
        View on eBay
      </a>
      
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button 
          onClick={() => goTo((current - 1 + items.length) % items.length)} 
          style={{ 
            fontSize: 18, 
            border: 'none', 
            background: 'none', 
            cursor: 'pointer',
            color: '#666',
            transition: 'color 0.3s ease'
          }}
          onMouseEnter={(e) => e.target.style.color = '#000'}
          onMouseLeave={(e) => e.target.style.color = '#666'}
        >
          &lt;
        </button>
        <span style={{ fontSize: 14, color: '#666', fontWeight: 600 }}>{current + 1} / {items.length}</span>
        <button 
          onClick={() => goTo((current + 1) % items.length)} 
          style={{ 
            fontSize: 18, 
            border: 'none', 
            background: 'none', 
            cursor: 'pointer',
            color: '#666',
            transition: 'color 0.3s ease'
          }}
          onMouseEnter={(e) => e.target.style.color = '#000'}
          onMouseLeave={(e) => e.target.style.color = '#666'}
        >
          &gt;
        </button>
      </div>
    </div>
  );
};

export default FeaturedEbayRotator; 