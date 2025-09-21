// Lightweight helper to call the external ChatAnalysisAPI without exposing any API keys

const CHAT_ANALYSIS_URL = 'https://ai-alarm-analyzer.onrender.com/analyze-message';

export const analyzeMessageForFireAlarm = async (messageText) => {
  try {
    if (!messageText || messageText.trim() === '') {
      console.log('🤖 AI Analysis: Empty message, skipping analysis');
      return null;
    }

    console.log('🤖 AI Analysis: Analyzing message:', messageText.substring(0, 50) + '...');
    console.log('🤖 AI Analysis: Calling Render endpoint:', CHAT_ANALYSIS_URL);

    const response = await fetch(CHAT_ANALYSIS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messageText })
    });

    console.log('🤖 AI Analysis: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🤖 AI Analysis: Render backend error:', response.status, errorText);
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
// Also updates the fire report's recommended_alarm_level if a report_id is present.
export const updateMessageWithAIAnalysis = async (messageId, analysis, supabaseClient) => {
  try {
    if (!messageId || !analysis || !supabaseClient) {
      console.log('🤖 AI Update: Missing required parameters');
      return;
    }

    console.log('🤖 AI Update: Updating message', messageId, 'with analysis:', analysis);

    const suggestedAlarmLevel = analysis.suggested_alarm || analysis.original_response?.alarm_level;

    // Try to update with the full analysis payload
    const { data: updatedMessage, error } = await supabaseClient
      .from('messages')
      .update({ 
        ai_suggested_alarm: analysis,
        ai_analysis: analysis,
        suggested_alarm_level: suggestedAlarmLevel,
        ai_confidence: analysis.confidence || 0.8,
        analyzed_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .select('report_id');

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
      
      // If message has a report_id, also update the fire report's recommended_alarm_level
      // Check if this report is part of a cluster and update all reports in the cluster
      const reportId = updatedMessage?.[0]?.report_id;
      if (reportId && suggestedAlarmLevel) {
        console.log('🤖 AI Update: Message linked to report', reportId, '- checking for cluster and updating recommended_alarm_level');
        try {
          // Fetch all reports to check for clustering
          const allReportsRes = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
          if (allReportsRes.ok) {
            const allReports = await allReportsRes.json();
            
            // Cluster reports (using the same logic as in the dashboards)
            const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
              const toRad = (value) => (value * Math.PI) / 180;
              const R = 6371000; // meters
              const dLat = toRad(lat2 - lat1);
              const dLon = toRad(lon2 - lon1);
              const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              return R * c;
            };

            const clusterReports = (reports = []) => {
              const consolidated = [];
              const getTimestampMs = (report) => {
                const candidates = [report?.timestamp, report?.created_at, report?.updated_at];
                for (const c of candidates) {
                  if (c) {
                    const t = new Date(c).getTime();
                    if (!isNaN(t)) return t;
                  }
                }
                return null;
              };

              reports.forEach((report) => {
                const lat = parseFloat(report.latitude);
                const lng = parseFloat(report.longitude);
                if (isNaN(lat) || isNaN(lng)) return;

                const tsMs = getTimestampMs(report);
                const reportDate = tsMs ? new Date(tsMs) : null;

                let matchedIndex = -1;
                consolidated.some((cluster, idx) => {
                  const dist = haversineDistanceMeters(
                    lat, lng,
                    parseFloat(cluster.latitude),
                    parseFloat(cluster.longitude)
                  );
                  if (dist > 50) return false;

                  if (reportDate && cluster.latestTimestamp) {
                    const diffMinutes = Math.abs(reportDate.getTime() - cluster.latestTimestamp.getTime()) / 60000;
                    if (diffMinutes <= 10) {
                      matchedIndex = idx;
                      return true;
                    }
                  }
                  return false;
                });

                if (matchedIndex !== -1) {
                  const cluster = consolidated[matchedIndex];
                  cluster.reports.push(report);
                  cluster.reportStrength = (cluster.reportStrength || 1) + 1;
                  const currentLatest = cluster.latestTimestamp;
                  const shouldUpdateRep = reportDate && (!currentLatest || reportDate > currentLatest);
                  if (shouldUpdateRep) {
                    cluster.representativeReport = report;
                    cluster.latitude = report.latitude;
                    cluster.longitude = report.longitude;
                  }
                  if (reportDate && (!currentLatest || reportDate > currentLatest)) {
                    cluster.latestTimestamp = reportDate;
                  }
                } else {
                  consolidated.push({
                    ...report,
                    reports: [report],
                    reportStrength: 1,
                    representativeReport: report,
                    latestTimestamp: reportDate
                  });
                }
              });

              return consolidated;
            };

            const clustered = clusterReports(allReports);
            const cluster = clustered.find(c => {
              if (c.reports && c.reports.length > 0) {
                return c.reports.some(r => String(r.id) === String(reportId));
              }
              return String(c.id) === String(reportId);
            });

            let reportsToUpdate = [reportId];
            if (cluster && cluster.reports && cluster.reports.length > 1) {
              console.log(`🤖 AI Update: Found cluster with ${cluster.reports.length} reports - updating all`);
              reportsToUpdate = cluster.reports.map(r => r.id);
            }

            // Update all reports in the cluster
            const updatePromises = reportsToUpdate.map(id =>
              fetch('https://fire-detection-api-production-f55b.up.railway.app/update_report_alarm_level', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  report_id: id,
                  recommended_alarm_level: suggestedAlarmLevel
                })
              })
            );

            const results = await Promise.all(updatePromises);
            const successCount = results.filter(r => r.ok).length;
            
            if (successCount === reportsToUpdate.length) {
              console.log(`🤖 AI Update: Successfully updated recommended_alarm_level for ${reportsToUpdate.length} report(s)`);
            } else {
              console.error(`🤖 AI Update: Failed to update ${reportsToUpdate.length - successCount} report(s) out of ${reportsToUpdate.length}`);
            }
          } else {
            // Fallback: update single report if clustering check fails
            const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/update_report_alarm_level', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                report_id: reportId,
                recommended_alarm_level: suggestedAlarmLevel
              })
            });

            if (response.ok) {
              console.log('🤖 AI Update: Successfully updated fire report recommended_alarm_level');
            } else {
              console.error('🤖 AI Update: Failed to update fire report:', response.status, await response.text());
            }
          }
        } catch (reportError) {
          console.error('🤖 AI Update: Error updating fire report:', reportError);
        }
      }
    }
  } catch (error) {
    console.error('🤖 AI Update: Unexpected error:', error);
  }
};
// duplicate definitions removed below
