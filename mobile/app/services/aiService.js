// Lightweight helper to call the external ChatAnalysisAPI without exposing any API keys

const CHAT_ANALYSIS_URL = 'https://chatanalysisapi-production.up.railway.app/analyze-message';

export const analyzeMessageForFireAlarm = async (messageText) => {
  try {
    if (!messageText || messageText.trim() === '') {
      return null;
    }

    const response = await fetch(CHAT_ANALYSIS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messageText })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    // Transform to unified shape used across apps
    return {
      suggested_alarm: data.alarm_level?.toLowerCase().replace(/\s+/g, '_') || 'none',
      confidence: 0.8,
      keywords_found: [],
      reasoning: data.reason || 'AI analysis completed',
      timestamp: new Date().toISOString(),
      original_response: data
    };
  } catch (_) {
    return null;
  }
};

export const updateMessageWithAIAnalysis = async (messageId, analysis, supabaseClient) => {
  try {
    if (!messageId || !analysis || !supabaseClient) return;

    const { error } = await supabaseClient
      .from('messages')
      .update({
        ai_suggested_alarm: analysis,
        ai_analysis: analysis,
        suggested_alarm_level: analysis.suggested_alarm || analysis.original_response?.alarm_level,
        ai_confidence: analysis.confidence || 0.8,
        analyzed_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (error) throw error;
  } catch (_) {
    // no-op; best-effort enrichment
  }
};


