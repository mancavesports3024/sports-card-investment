import React, { useState, useEffect, useRef } from 'react';

const FeaturedEbayRotator = ({ apiUrl = '/api/featured-ebay-items', interval = 5000 }) => {
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
      marginLeft: 'auto',
      marginRight: 'auto',
      position: 'relative'
    }}>
      {item.image && (
        <img src={item.image} alt={item.title} style={{ maxWidth: 180, borderRadius: 8, marginBottom: 10 }} />
      )}
      <div style={{ fontWeight: 600, fontSize: '1.1em', marginBottom: 6 }}>{item.title}</div>
      <a href={item.affiliateLink} target="_blank" rel="noopener noreferrer"
         style={{ background: '#ffd700', color: '#000', fontWeight: 700, padding: '0.5em 1.2em', borderRadius: 6, textDecoration: 'none', border: '2px solid #000', fontSize: '1em', display: 'inline-block', marginBottom: 8 }}>
        View on eBay
      </a>
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button onClick={() => goTo((current - 1 + items.length) % items.length)} style={{ fontSize: 18, border: 'none', background: 'none', cursor: 'pointer' }}>&lt;</button>
        <span style={{ fontSize: 14 }}>{current + 1} / {items.length}</span>
        <button onClick={() => goTo((current + 1) % items.length)} style={{ fontSize: 18, border: 'none', background: 'none', cursor: 'pointer' }}>&gt;</button>
      </div>
    </div>
  );
};

export default FeaturedEbayRotator; 