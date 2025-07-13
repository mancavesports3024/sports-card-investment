import React, { useState, useEffect } from 'react';

const AnalyticsDashboard = () => {
  const [analyticsData, setAnalyticsData] = useState({
    pageViews: 0,
    searches: 0,
    cardViews: 0,
    liveListingsViews: 0,
    errors: 0
  });

  useEffect(() => {
    // This is a simple mock dashboard
    // In a real implementation, you'd fetch this data from Google Analytics API
    const mockData = {
      pageViews: Math.floor(Math.random() * 100) + 50,
      searches: Math.floor(Math.random() * 200) + 100,
      cardViews: Math.floor(Math.random() * 500) + 200,
      liveListingsViews: Math.floor(Math.random() * 150) + 75,
      errors: Math.floor(Math.random() * 10) + 1
    };
    setAnalyticsData(mockData);
  }, []);

  return (
    <div className="analytics-dashboard">
      <h3>📊 Analytics Overview</h3>
      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="analytics-icon">👁️</div>
          <div className="analytics-content">
            <div className="analytics-number">{analyticsData.pageViews}</div>
            <div className="analytics-label">Page Views</div>
          </div>
        </div>
        
        <div className="analytics-card">
          <div className="analytics-icon">🔍</div>
          <div className="analytics-content">
            <div className="analytics-number">{analyticsData.searches}</div>
            <div className="analytics-label">Searches</div>
          </div>
        </div>
        
        <div className="analytics-card">
          <div className="analytics-icon">🃏</div>
          <div className="analytics-content">
            <div className="analytics-number">{analyticsData.cardViews}</div>
            <div className="analytics-label">Card Views</div>
          </div>
        </div>
        
        <div className="analytics-card">
          <div className="analytics-icon">📈</div>
          <div className="analytics-content">
            <div className="analytics-number">{analyticsData.liveListingsViews}</div>
            <div className="analytics-label">Live Listings</div>
          </div>
        </div>
        
        <div className="analytics-card">
          <div className="analytics-icon">⚠️</div>
          <div className="analytics-content">
            <div className="analytics-number">{analyticsData.errors}</div>
            <div className="analytics-label">Errors</div>
          </div>
        </div>
      </div>
      
      <div className="analytics-note">
        <p><strong>Note:</strong> This is a demo dashboard. Real analytics data will be available in Google Analytics after setup.</p>
        <p>To view real data, go to <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer">Google Analytics</a></p>
      </div>
    </div>
  );
};

export default AnalyticsDashboard; 