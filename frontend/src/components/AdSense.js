import React, { useEffect, useRef } from 'react';

const AdSense = ({ 
  adSlot, 
  adFormat = 'auto', 
  style = {}, 
  className = '',
  responsive = true,
  fullWidthResponsive = false 
}) => {
  const adRef = useRef(null);

  useEffect(() => {
    try {
      // Check if AdSense is loaded
      if (window.adsbygoogle && adRef.current) {
        // Push the ad to AdSense
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (error) {
      console.log('AdSense error:', error);
    }
  }, [adSlot]);

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

    return baseStyle;
  };

  return (
    <div 
      ref={adRef}
      className={`adsense-container ${className}`}
      style={getAdStyle()}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-XXXXXXXXXX"
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive}
      />
    </div>
  );
};

// Predefined ad components for different placements
export const HeaderAd = () => (
  <AdSense 
    adSlot="1234567890" 
    adFormat="auto"
    style={{ 
      margin: '10px auto',
      maxWidth: '728px',
      minHeight: '90px'
    }}
    className="header-ad"
  />
);

export const SidebarAd = () => (
  <AdSense 
    adSlot="0987654321" 
    adFormat="auto"
    style={{ 
      margin: '20px auto',
      maxWidth: '300px',
      minHeight: '250px'
    }}
    className="sidebar-ad"
  />
);

export const InContentAd = () => (
  <AdSense 
    adSlot="1122334455" 
    adFormat="auto"
    style={{ 
      margin: '30px auto',
      maxWidth: '728px',
      minHeight: '90px'
    }}
    className="in-content-ad"
  />
);

export const FooterAd = () => (
  <AdSense 
    adSlot="5566778899" 
    adFormat="auto"
    style={{ 
      margin: '20px auto',
      maxWidth: '728px',
      minHeight: '90px'
    }}
    className="footer-ad"
  />
);

export const MobileAd = () => (
  <AdSense 
    adSlot="9988776655" 
    adFormat="auto"
    style={{ 
      margin: '15px auto',
      maxWidth: '320px',
      minHeight: '50px'
    }}
    className="mobile-ad"
  />
);

export default AdSense; 