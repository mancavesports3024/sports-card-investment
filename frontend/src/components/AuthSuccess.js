import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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

  return <div>Logging you in...</div>;
};

export default AuthSuccess; 