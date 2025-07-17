import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('authToken', token);
      navigate('/', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return <div>Logging you in...</div>;
};

export default AuthSuccess; 