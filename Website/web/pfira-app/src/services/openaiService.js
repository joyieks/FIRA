import OpenAI from 'openai';

// Initialize OpenAI client for the web app (Vite)
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// System prompt with fire alarm mapping and required JSON schema
const systemPrompt = `You are an AI assistant integrated into a Fire Department communication system. 
Your task is to analyze chat messages between Responders, Stations, and the Command Center. 
Extract structured information about fire incidents and suggest the appropriate Fire Alarm Level.

Rules:
- Focus only on messages that describe the fire situation.
- Identify the number of houses affected, whether high-rise buildings are affected, or if the fire is affecting a significant or major part of the area.
- Always respond in JSON with this schema:
{
  "houses": number or null,
  "high_rise": true/false,
  "area_scale": "none" | "significant" | "major",
  "suggested_alarm": "First Alarm" | "Second Alarm" | "Third Alarm" | "Fourth Alarm" | "Fifth Alarm" | "Task Force Alpha" | "Task Force Bravo" | "Task Force Charlie" | "Task Force Delta Echo Hotel India" | "General Alarm" | null
}

Fire Alarm Mapping:
- First Alarm: 2–3 houses
- Second Alarm: 4–5 houses
- Third Alarm: 6–7 houses OR high-rise affected
- Fourth Alarm: 8–9 houses OR high-rise affected
- Fifth Alarm: 10–11 houses OR high-rise affected
- Task Force Alpha: ~12 houses
- Task Force Bravo: ~15 houses
- Task Force Charlie: fire affecting significant part of area
- Task Force Delta Echo Hotel India: fire affecting significant part of area
- General Alarm: fire affecting major part of area

If the message doesn't contain fire-related information, return null for suggested_alarm.`;

export const analyzeMessageForFireAlarm = async (messageText) => {
  try {
    if (!messageText || messageText.trim() === '') {
      return { houses: null, high_rise: false, area_scale: 'none', suggested_alarm: null };
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this message: "${messageText}"` }
      ],
      temperature: 0,
      max_tokens: 500
    });

    const responseText = completion.choices[0]?.message?.content || '';
    // Try to parse JSON strictly
    try {
      const parsed = JSON.parse(responseText);
      return {
        houses: parsed.houses ?? null,
        high_rise: Boolean(parsed.high_rise),
        area_scale: parsed.area_scale || 'none',
        suggested_alarm: parsed.suggested_alarm || null
      };
    } catch (e) {
      // Fallback: attempt to extract JSON block if wrapped in text
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          return {
            houses: parsed.houses ?? null,
            high_rise: Boolean(parsed.high_rise),
            area_scale: parsed.area_scale || 'none',
            suggested_alarm: parsed.suggested_alarm || null
          };
        } catch (_) {
          // ignore and fall through
        }
      }
      return { houses: null, high_rise: false, area_scale: 'none', suggested_alarm: null };
    }
  } catch (error) {
    console.error('Error analyzing message with OpenAI:', error);
    return { houses: null, high_rise: false, area_scale: 'none', suggested_alarm: null };
  }
};

export const updateMessageWithAIAnalysis = async (messageId, analysis, supabase) => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ ai_suggested_alarm: analysis.suggested_alarm })
      .eq('id', messageId);
    if (error) throw error;
  } catch (error) {
    console.error('Failed to update message with AI analysis:', error);
  }
};


