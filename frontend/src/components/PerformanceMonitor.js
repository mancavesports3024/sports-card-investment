import React, { useState, useEffect } from 'react';

function isAdminUser() {
  try {
    const token = localStorage.getItem('jwt');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email === 'mancavesportscardsllc@gmail.com';
  } catch {
    return false;
  }
}

const PerformanceMonitor = () => {
  // Only show for admin
  if (!isAdminUser()) return null;

  const [performanceData, setPerformanceData] = useState({
    apiResponseTimes: [],
    cacheHitRate: 0,
    averageResponseTime: 0,
    totalRequests: 0,
    cachedRequests: 0
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Monitor API response times
    const originalFetch = window.fetch;
    const responseTimes = [];

    window.fetch = async (...args) => {
      const startTime = performance.now();
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        responseTimes.push({
          url: args[0],
          time: responseTime,
          timestamp: new Date().toISOString(),
          cached: response.headers.get('X-Cache') === 'HIT'
        });

        // Keep only last 50 requests
        if (responseTimes.length > 50) {
          responseTimes.shift();
        }

        setPerformanceData(prev => {
          const totalRequests = prev.totalRequests + 1;
          const cachedRequests = prev.cachedRequests + (response.headers.get('X-Cache') === 'HIT' ? 1 : 0);
          const averageResponseTime = responseTimes.reduce((sum, req) => sum + req.time, 0) / responseTimes.length;
          const cacheHitRate = totalRequests > 0 ? (cachedRequests / totalRequests) * 100 : 0;

          return {
            apiResponseTimes: responseTimes,
            cacheHitRate: Math.round(cacheHitRate * 100) / 100,
            averageResponseTime: Math.round(averageResponseTime * 100) / 100,
            totalRequests,
            cachedRequests
          };
        });

        return response;
      } catch (error) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        responseTimes.push({
          url: args[0],
          time: responseTime,
          timestamp: new Date().toISOString(),
          error: true
        });

        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const getPerformanceColor = (time) => {
    if (time < 500) return '#10B981'; // Green
    if (time < 1000) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const getCacheHitColor = (rate) => {
    if (rate > 80) return '#10B981'; // Green
    if (rate > 50) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#ffd700',
          border: '2px solid #000',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          cursor: 'pointer',
          zIndex: 1000,
          fontSize: '20px'
        }}
        title="Performance Monitor"
      >
        📊
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: '#ffffff',
      border: '2px solid #ffd700',
      borderRadius: '10px',
      padding: '15px',
      width: '300px',
      maxHeight: '400px',
      overflow: 'auto',
      zIndex: 1000,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ margin: 0, color: '#000' }}>📊 Performance Monitor</h4>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>Cache Hit Rate:</span>
          <span style={{ color: getCacheHitColor(performanceData.cacheHitRate), fontWeight: 'bold' }}>
            {performanceData.cacheHitRate}%
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>Avg Response Time:</span>
          <span style={{ color: getPerformanceColor(performanceData.averageResponseTime), fontWeight: 'bold' }}>
            {performanceData.averageResponseTime}ms
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>Total Requests:</span>
          <span>{performanceData.totalRequests}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Cached Requests:</span>
          <span>{performanceData.cachedRequests}</span>
        </div>
      </div>

      <div>
        <h5 style={{ margin: '0 0 10px 0', color: '#000' }}>Recent API Calls:</h5>
        <div style={{ maxHeight: '200px', overflow: 'auto' }}>
          {performanceData.apiResponseTimes.slice(-10).reverse().map((req, index) => (
            <div key={index} style={{
              padding: '5px',
              marginBottom: '5px',
              background: req.error ? '#FEE2E2' : '#F0F9FF',
              borderRadius: '5px',
              fontSize: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ 
                  color: getPerformanceColor(req.time), 
                  fontWeight: 'bold' 
                }}>
                  {req.time.toFixed(0)}ms
                </span>
                <span style={{ 
                  color: req.cached ? '#10B981' : '#6B7280',
                  fontSize: '10px'
                }}>
                  {req.cached ? 'CACHED' : 'FRESH'}
                </span>
              </div>
              <div style={{ 
                color: '#666', 
                fontSize: '10px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {req.url}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor; 