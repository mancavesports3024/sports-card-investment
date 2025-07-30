import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';

const AuthSuccess = ({ onAuthSuccess }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const next = params.get('next') || '/search';
    if (token) {
      localStorage.setItem('authToken', token);
      if (onAuthSuccess) {
        onAuthSuccess();
      }
      navigate(next, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate, onAuthSuccess]);

  return (
    <div className="auth-success-page">
      <Helmet>
        <title>Scorecard - Authentication</title>
        <meta name="robots" content="noindex" />
        <link rel="canonical" href="https://www.mancavesportscardsllc.com/" />
      </Helmet>
      <div>Logging you in...</div>
    </div>
  );
};

export default AuthSuccess; 