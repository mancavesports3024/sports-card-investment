import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthSuccess = ({ onAuthSuccess }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('authToken', token);
      // Call the callback to update the auth state
      if (onAuthSuccess) {
        onAuthSuccess();
      }
      navigate('/', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate, onAuthSuccess]);

  return <div>Logging you in...</div>;
};

export default AuthSuccess; 