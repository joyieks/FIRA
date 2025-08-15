import { Stack } from "expo-router";
import "./global.css";
import { MaterialIcons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { AuthProvider } from './config/AuthContext';
import BackButtonHandler from './components/BackButtonHandler';

export default function RootLayout() {
  return (
    <AuthProvider>
      <BackButtonHandler />
      <Stack screenOptions={{ headerShown: false }}>
      {/* ...existing code for Stack.Screen definitions... */}
      <Stack.Screen name="index" />
      <Stack.Screen name="get-started/getstarted" />
      <Stack.Screen name="Authentication/login" />
      <Stack.Screen name="Authentication/registration" />
      {/* ✅ Direct match for index.jsx under Screens/CitizenScreen */}
      <Stack.Screen name="Screens/CitizenScreen" />
      {/* Optional wildcard for other subroutes under CitizenScreen */}
      <Stack.Screen name="Screens/CitizenScreen/*" />
      <Stack.Screen name="Screens/RespondersScreen" />
      <Stack.Screen name="Screens/AdminScreen" />
      <Stack.Screen name="Screens/StationScreen" />
      <Stack.Screen name="Screens/*" />
      <Stack.Screen name="Citizens/CNavBarMenu/CNavbarMenu" />
      </Stack>
    </AuthProvider>
  );
}

