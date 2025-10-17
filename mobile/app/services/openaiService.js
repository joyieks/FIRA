// Expo/React Native-compatible shim that delegates to our Railway-backed analyzer
// This avoids bundling native-openai into the mobile app.

import { 
  analyzeMessageForFireAlarm as analyzeViaRailway,
  updateMessageWithAIAnalysis as updateViaSupabase
} from './aiService';

export const analyzeMessageForFireAlarm = async (messageText) => {
  return await analyzeViaRailway(messageText);
};

export const updateMessageWithAIAnalysis = async (messageId, analysis, supabase) => {
  return await updateViaSupabase(messageId, analysis, supabase);
};











