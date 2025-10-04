// Lightweight helper to call the external ChatAnalysisAPI without exposing any API keys

const CHAT_ANALYSIS_URL = 'https://chatanalysisapi-production.up.railway.app/analyze-message';

export const analyzeMessageForFireAlarm = async (messageText) => {
  try {
    if (!messageText || messageText.trim() === '') {
      console.log('🤖 AI Analysis: Empty message, skipping analysis');
      return null;
    }

    console.log('🤖 AI Analysis: Analyzing message:', messageText.substring(0, 50) + '...');
    console.log('🤖 AI Analysis: Calling Railway endpoint:', CHAT_ANALYSIS_URL);

    const response = await fetch(CHAT_ANALYSIS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messageText })
    });

    console.log('🤖 AI Analysis: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🤖 AI Analysis: Railway backend error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('🤖 AI Analysis: Success! Analysis result:', data);
    
    // Transform the response to match the expected format
    const transformedResponse = {
      suggested_alarm: data.alarm_level?.toLowerCase().replace(/\s+/g, '_') || 'none',
      confidence: 0.8, // Default confidence since the API doesn't provide it
      keywords_found: [],
      reasoning: data.reason || 'AI analysis completed',
      timestamp: new Date().toISOString(),
      original_response: data // Keep the original response for reference
    };
    
    console.log('🤖 AI Analysis: Transformed response:', transformedResponse);
    return transformedResponse;
  } catch (error) {
    console.error('🤖 AI Analysis: Connection error:', error);
    return null;
  }
};

// Update the message row with the AI analysis result. Stores the full analysis object
// into the ai_suggested_alarm field (as JSON if supported by the column, or as text by fallback).
export const updateMessageWithAIAnalysis = async (messageId, analysis, supabaseClient) => {
  try {
    if (!messageId || !analysis || !supabaseClient) {
      console.log('🤖 AI Update: Missing required parameters');
      return;
    }

    console.log('🤖 AI Update: Updating message', messageId, 'with analysis:', analysis);

    // Try to update with the full analysis payload
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

    if (error) {
      console.error('🤖 AI Update: Database error:', error);
      // Try fallback with just the basic field
      const { error: fallbackError } = await supabaseClient
        .from('messages')
        .update({ ai_suggested_alarm: analysis })
        .eq('id', messageId);
      
      if (fallbackError) {
        console.error('🤖 AI Update: Fallback also failed:', fallbackError);
      } else {
        console.log('🤖 AI Update: Fallback update successful');
      }
    } else {
      console.log('🤖 AI Update: Successfully updated message with AI analysis');
    }
  } catch (error) {
    console.error('🤖 AI Update: Unexpected error:', error);
  }
};


