import React from 'react';

const PageLayout = ({ 
  title, 
  subtitle, 
  icon, 
  children, 
  titleStyle = {}, 
  subtitleStyle = {},
  containerStyle = {}
}) => {
  return (
    <div className="page-layout" style={containerStyle}>
      {/* Standard Page Title Section */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 800, 
          color: '#ffd700', 
          marginBottom: '1rem',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
          ...titleStyle
        }}>
          {icon} {title}
        </h1>
        {subtitle && (
          <p style={{ 
            fontSize: '1.1rem', 
            color: '#fff', 
            maxWidth: 600, 
            margin: '0 auto', 
            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            ...subtitleStyle
          }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Page Content */}
      <div className="page-content">
        {children}
      </div>
    </div>
  );
};

export default PageLayout; 