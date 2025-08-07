import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import tokenService from '../services/tokenService';

const AuthSuccess = ({ onAuthSuccess }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    const next = params.get('next') || '/search';
    
    if (token) {
      // Store both tokens using the token service
      tokenService.setTokens(token, refreshToken);
      
      if (onAuthSuccess) {
        onAuthSuccess();
      }
      navigate(next, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate, onAuthSuccess]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: '#000',
      color: '#ffd700'
    }}>
      <Helmet>
        <title>Authentication Success - Scorecard</title>
      </Helmet>
      <div style={{ textAlign: 'center' }}>
        <h2>Authentication Successful!</h2>
        <p>Redirecting you to the application...</p>
      </div>
    </div>
  );
};

export default AuthSuccess; 