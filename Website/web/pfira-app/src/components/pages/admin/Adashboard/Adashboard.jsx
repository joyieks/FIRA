import React from 'react';
import { useNavigate } from 'react-router-dom';

const Adashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userType');
    localStorage.removeItem('loginTime');
    navigate('/login');
  };

  return (
    <div>
      <button onClick={handleLogout}></button>
      <h1>Adashboard</h1>
    </div>
  );
};

export default Adashboard;