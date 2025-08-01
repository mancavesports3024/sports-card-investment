import React, { useEffect, useRef, useState } from 'react';

const AdSense = ({ 
  adSlot, 
  adFormat = 'auto', 
  style = {}, 
  className = '',
  responsive = true,
  fullWidthResponsive = false,
  requireContent = true,
  minContentLength = 500, // Minimum content length required to show ads
  fixedHeight = null // Optional fixed height to prevent layout shifts
}) => {
  const adRef = useRef(null);
  const [shouldShowAd, setShouldShowAd] = useState(false);
  const [isAdLoaded, setIsAdLoaded] = useState(false);

  useEffect(() => {
    // Check if we should show the ad based on content requirements
    if (requireContent) {
      const hasSufficientContent = checkContentRequirements(minContentLength);
      setShouldShowAd(hasSufficientContent);
    } else {
      setShouldShowAd(true);
    }
  }, [requireContent, minContentLength]);

  useEffect(() => {
    if (!shouldShowAd) return;

    try {
      // Check if AdSense is loaded
      if (window.adsbygoogle && adRef.current) {
        // Push the ad to AdSense
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        
        // Set a timeout to mark ad as loaded (prevents infinite loading state)
        setTimeout(() => {
          setIsAdLoaded(true);
        }, 3000);
      }
    } catch (error) {
      console.log('AdSense error:', error);
      setIsAdLoaded(true); // Mark as loaded even if there's an error
    }
  }, [adSlot, shouldShowAd]);

  // Function to check if page has sufficient content
  const checkContentRequirements = (minLength) => {
    try {
      // Get the main content area
      const mainContent = document.querySelector('main') || 
                         document.querySelector('.main-content') || 
                         document.querySelector('#root');
      
      if (!mainContent) return false;

      // Get text content and remove extra whitespace
      const textContent = mainContent.textContent || mainContent.innerText || '';
      const cleanContent = textContent.replace(/\s+/g, ' ').trim();
      
      // Check if content meets minimum length requirement
      const hasSufficientContent = cleanContent.length >= minLength;
      
      // Additional checks for quality content
      const hasSearchResults = document.querySelector('.search-results') || 
                              document.querySelector('.card-section') ||
                              document.querySelector('.price-analysis');
      
      const hasUserInteraction = document.querySelector('.search-form') ||
                                document.querySelector('.search-input');
      
      // Only show ads if we have sufficient content AND either search results or user interaction
      return hasSufficientContent && (hasSearchResults || hasUserInteraction);
    } catch (error) {
      console.log('Content check error:', error);
      return false; // Default to not showing ads if there's an error
    }
  };

  const getAdStyle = () => {
    const baseStyle = {
      display: 'block',
      textAlign: 'center',
      margin: '20px auto',
      ...style
    };

    if (responsive) {
      baseStyle.overflow = 'hidden';
    }

    // Add fixed height if specified to prevent layout shifts
    if (fixedHeight) {
      baseStyle.height = fixedHeight;
      baseStyle.minHeight = fixedHeight;
      baseStyle.maxHeight = fixedHeight;
    }

    return baseStyle;
  };

  // Don't render anything if we shouldn't show the ad
  if (!shouldShowAd) {
    return null;
  }

  return (
    <div 
      ref={adRef}
      className={`adsense-container ${className}`}
      style={getAdStyle()}
    >
      {!isAdLoaded && (
        <div style={{
          height: fixedHeight || '90px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '4px',
          color: '#6c757d',
          fontSize: '0.875rem'
        }}>
          Loading advertisement...
        </div>
      )}
      <ins
        className="adsbygoogle"
        style={{
          display: 'block',
          opacity: isAdLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
        data-ad-client="ca-pub-5981606678113994"
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive}
      />
    </div>
  );
};

// Predefined ad components for different placements with content requirements
export const HeaderAd = () => (
  <AdSense 
    adSlot="1234567890" 
    adFormat="auto"
    style={{ 
      margin: '10px auto',
      maxWidth: '728px'
    }}
    className="header-ad"
    requireContent={true}
    minContentLength={300}
    fixedHeight="90px"
  />
);

export const SidebarAd = () => (
  <AdSense 
    adSlot="0987654321" 
    adFormat="auto"
    style={{ 
      margin: '20px auto',
      maxWidth: '300px'
    }}
    className="sidebar-ad"
    requireContent={true}
    minContentLength={500}
    fixedHeight="250px"
  />
);

export const InContentAd = () => (
  <AdSense 
    adSlot="1122334455" 
    adFormat="auto"
    style={{ 
      margin: '30px auto',
      maxWidth: '728px'
    }}
    className="in-content-ad"
    requireContent={true}
    minContentLength={800} // Higher requirement for in-content ads
    fixedHeight="90px"
  />
);

export const FooterAd = () => (
  <AdSense 
    adSlot="5566778899" 
    adFormat="auto"
    style={{ 
      margin: '20px auto',
      maxWidth: '728px'
    }}
    className="footer-ad"
    requireContent={true}
    minContentLength={500}
    fixedHeight="90px"
  />
);

export const MobileAd = () => (
  <AdSense 
    adSlot="9988776655" 
    adFormat="auto"
    style={{ 
      margin: '15px auto',
      maxWidth: '320px'
    }}
    className="mobile-ad"
    requireContent={true}
    minContentLength={400}
    fixedHeight="100px"
  />
);

export const SearchResultsAd = () => (
  <AdSense 
    adSlot="4433221100" 
    adFormat="auto"
    style={{ 
      margin: '25px auto',
      maxWidth: '728px'
    }}
    className="search-results-ad"
    requireContent={true}
    minContentLength={1000} // High requirement for search results pages
    fixedHeight="90px"
  />
);

export default AdSense; 