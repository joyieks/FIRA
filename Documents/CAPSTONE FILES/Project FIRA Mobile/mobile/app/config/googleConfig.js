// Google Sign-In Configuration for Expo
export const GOOGLE_CONFIG = {
  // Client ID from google-services.json
  clientId: '106148803088-8o3qdbhfkh0eqpv1kehsbj0cp2co7c9o.apps.googleusercontent.com',
  redirectUri: 'https://auth.expo.io/@anonymous/fira-mobile', // Simple Expo auth handler
  scopes: ['openid', 'profile', 'email'],
};

// Google Sign-In configuration function for Expo
export const configureGoogleSignIn = () => {
  return GOOGLE_CONFIG;
}; 