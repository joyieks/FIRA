import React from 'react'
import Navbar from './components/pages/landingpage/navbar.jsx'
import Hero from './components/pages/landingpage/hero.jsx'
import Login from './components/pages/authentication/login.jsx'
import AdminLayout from './components/pages/admin/Alayout/AdminLayout.jsx'
import Register from './components/pages/authentication/Register.jsx'
import Adashboard from './components/pages/admin/Adashboard/Adashboard.jsx'
import Overall from './components/pages/admin/Overall/Overall.jsx'
import Notification from './components/pages/admin/Notification/Notification.jsx'
import Auser_management from './components/pages/admin/AdminUserManagment/Auser_management.jsx'
import Afira_chat from './components/pages/admin/AdminChat/Afira_chat.jsx'
import Admin_Profile from './components/pages/admin/Account/Admin_Profile.jsx'
import Settings from './components/pages/admin/Account/Settings.jsx';
import StationLayout from './components/pages/stations/Slayout/StationLayout.jsx'
import Sdashboard from './components/pages/stations/Sdashboard/Sdashboard.jsx'
import Station_Overall from './components/pages/stations/Station Overall/Station_Overall.jsx'
import Station_Notification from './components/pages/stations/Snotification/Station_Notification.jsx'
import Suser_Management from './components/pages/stations/StationUserManagement/Suser_Management.jsx'
import Station_Profile from './components/pages/stations/SAccount/Station_Profile.jsx';
import Station_Setting from './components/pages/stations/SAccount/Station_Setting.jsx';
import Station_ChangePass from './components/pages/stations/SAccount/Station_ChangePass.jsx';
import Sfira_chat from './components/pages/stations/Station Chat/Sfira_chat.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import ForgotPassword from './components/pages/Forgot Password/forgotpassword.jsx';
import { Routes, Route } from 'react-router-dom'

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/admin-dashboard" element={
        <ProtectedRoute requiredUserType="admin">
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Adashboard />} />
        <Route path="overall" element={<Overall />} />
        <Route path="notification" element={<Notification />} />
        <Route path="user-management" element={<Auser_management />} />
        <Route path="fira-chat" element={<Afira_chat />} />
        <Route path="profile" element={<Admin_Profile />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/station-dashboard" element={
        <ProtectedRoute requiredUserType="station">
          <StationLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Sdashboard />} />
        <Route path="overall" element={<Station_Overall />} />
        <Route path="notification" element={<Station_Notification />} />
        <Route path="fira-chat" element={<Sfira_chat />} />
        <Route path="user-management" element={<Suser_Management />} />
        <Route path="profile" element={<Station_Profile />} />
        <Route path="settings" element={<Station_Setting />} />
        <Route path="change-password" element={<Station_ChangePass isOpen={true} onClose={() => {}} />} />
      </Route>
      <Route path="/register" element={<Register />} />
      <Route
        path="*"
        element={
          <>
            <Navbar />
            <Hero />
          </>
        }
      />
    </Routes>
  )
}

export default App