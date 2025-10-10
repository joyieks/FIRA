import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

// Google OAuth configuration
const clientId = '745177862698-t17reuimg7bmj6lurbe1de56nhddbueu.apps.googleusercontent.com';
const redirectUri = 'https://auth.expo.io/@anonymous/fira-mobile';

export const googleSignInConfig = {
  clientId,
  redirectUri,
  scopes: ['openid', 'profile', 'email'],
};

export { WebBrowser, Crypto }; 