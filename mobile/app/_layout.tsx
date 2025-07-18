import { Stack } from "expo-router";
import "./global.css";
import { MaterialIcons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

export default function RootLayout() {
  return (
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
      <Stack.Screen name="Screens/*" />
      <Stack.Screen name="Citizens/CNavBarMenu/CNavbarMenu" />
    </Stack>
  );
}
