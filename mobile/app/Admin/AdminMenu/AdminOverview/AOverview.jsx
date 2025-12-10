import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, TextInput, Modal, Image, Platform, Alert, ActivityIndicator } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../config/supabase';
import { notifyRespondersOnStatusChange, notifyRespondersOnAlarmChange, fetchReportData } from '../../../services/responderNotificationService';
import { notifyAllUsersOnStatusChange, notifyAllUsersOnAlarmChange } from '../../../services/universalNotificationService';
import { checkStationIsBusy, findNearestStations, findNearestStationsToStation, calculateDistance } from '../../../utils/assignmentHelpers';

const API_URL = 'https://fire-detection-api-production-f55b.up.railway.app';

export default function AOverview() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // All | On Going | Under Control
  const [aiChatSuggestions, setAiChatSuggestions] = useState([]);
  const [chatAlarmByReport, setChatAlarmByReport] = useState({});
  const [timeRangeFilter, setTimeRangeFilter] = useState('all'); // all | today | week | month
  const [selectedReport, setSelectedReport] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editReport, setEditReport] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReport, setCancelReport] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [stations, setStations] = useState([]);
  const [assignStationId, setAssignStationId] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignedResponders, setAssignedResponders] = useState([]);
  const [isLoadingAssigned, setIsLoadingAssigned] = useState(false);
  const [currentStationAssignment, setCurrentStationAssignment] = useState(null); // { stationId, stationName, status, role }
  const [allAssignedStations, setAllAssignedStations] = useState([]); // Array of all assigned stations (primary + backups)
  const [backupStationId, setBackupStationId] = useState(null); // For backup assignment dropdown
  const [showWaitingBackupModal, setShowWaitingBackupModal] = useState(false);
  const [pendingBackupAssignment, setPendingBackupAssignment] = useState(null);
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
  const [showAlarmConfirmModal, setShowAlarmConfirmModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [pendingAlarmChange, setPendingAlarmChange] = useState(null);
  const [assignedStationReportIds, setAssignedStationReportIds] = useState(new Set()); // Set of report_id strings with station assigned
  
  // Reroute modal state
  const [showRerouteModal, setShowRerouteModal] = useState(false);
  const [nearestStations, setNearestStations] = useState([]);
  const [pendingAssignment, setPendingAssignment] = useState(null);
  const [selectedRerouteStation, setSelectedRerouteStation] = useState('');
  const [stationActiveCounts, setStationActiveCounts] = useState({});
  // Fire-out summary/PDF
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryDownloading, setSummaryDownloading] = useState(false);
  
  // Waiting for station approval modal state
  const [showWaitingApprovalModal, setShowWaitingApprovalModal] = useState(false);
  
  // Tab state for viewing different report categories
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'invalidated'
  
  // Invalidation state
  const [isInvalidating, setIsInvalidating] = useState(false);
  
  // Restore/Invalidate modal states
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [reportToRestore, setReportToRestore] = useState(null);
  const [showRestoreSuccessModal, setShowRestoreSuccessModal] = useState(false);
  const [showReInvalidateModal, setShowReInvalidateModal] = useState(false);
  const [reportToReInvalidate, setReportToReInvalidate] = useState(null);
  const [invalidateConfirmText, setInvalidateConfirmText] = useState('');
  const [showInvalidateSuccessModal, setShowInvalidateSuccessModal] = useState(false);

  // Helper function to check if report is "No Fire" + "No Smoke" - defined early
  const isNoFireNoSmoke = useCallback((report) => {
    const pred = (report?.prediction || '').toLowerCase().trim();
    const smoke = (report?.smoke_detection || report?.smokeDetection || '').toLowerCase().trim();
    return (pred.includes('no fire') || pred.includes('no_fire')) && 
           (smoke.includes('no smoke') || smoke.includes('no_smoke'));
  }, []);

  // Helper function to format alarm level display
  const formatAlarmLevel = useCallback((alarmLevel) => {
    if (!alarmLevel) return 'Unknown';
    const level = String(alarmLevel).toLowerCase().trim();
    
    // Handle "Unknown - structure count not provided" and similar
    if (level.includes('unknown')) return 'Unknown';
    
    // Convert underscore format to proper display format
    const alarmMap = {
      'first_alarm': '1st Alarm',
      '1st_alarm': '1st Alarm',
      'second_alarm': '2nd Alarm',
      '2nd_alarm': '2nd Alarm',
      'third_alarm': '3rd Alarm',
      '3rd_alarm': '3rd Alarm',
      'fourth_alarm': '4th Alarm',
      '4th_alarm': '4th Alarm',
      'fifth_alarm': '5th Alarm',
      '5th_alarm': '5th Alarm',
      'task_force_alpha': 'TASK FORCE ALPHA',
      'task_force_bravo': 'TASK FORCE BRAVO',
      'task_force_charlie': 'TASK FORCE CHARLIE',
      'task_force_delta': 'TASK FORCE DELTA',
      'general_alarm': 'GENERAL ALARM'
    };
    
    return alarmMap[level] || alarmLevel;
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      // 1) Try Railway API first (has reporter names and addresses populated)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${API_URL}/get_reports`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const data = await res.json();
          console.log('[AOverview] Railway API get_reports length:', Array.isArray(data) ? data.length : 'non-array');
          
          if (Array.isArray(data) && data.length > 0) {
            // Auto-invalidate No Fire/No Smoke reports
            data.forEach(report => {
              const shouldAutoInvalidate = isNoFireNoSmoke(report) && 
                                           report.invalidated !== true && 
                                           report.validated !== true;
              
              if (shouldAutoInvalidate) {
                supabase
                  .from('fire_reports')
                  .update({ 
                    invalidated: true,
                    invalidated_at: new Date().toISOString()
                  })
                  .eq('id', report.id)
                  .then(({ error }) => {
                    if (error) console.error('Error auto-invalidating report:', error);
                    else console.log('✅ Auto-invalidated No Fire/No Smoke report:', report.id);
                  });
                // Update local data immediately
                report.invalidated = true;
                report.invalidated_at = new Date().toISOString();
              }
            });
            
            setReports(data);
            // Load station assignments for these reports
            const ids = data.map(r => String(r.id));
            if (ids.length) {
              const { data: assigns } = await supabase
                .from('report_assignments')
                .select('report_id')
                .in('report_id', ids)
                .eq('assignee_type', 'station');
              setAssignedStationReportIds(new Set((assigns || []).map(a => String(a.report_id))));
            } else {
              setAssignedStationReportIds(new Set());
            }
            return;
          }
        }
        console.warn('[AOverview] Railway API failed or returned no data, falling back to Supabase');
      } catch (apiErr) {
        console.warn('[AOverview] Railway API error:', apiErr?.message || apiErr);
      }

      // 2) Fallback to Supabase with user join for reporter names
      try {
        const { data: sbData, error: sbErr } = await supabase
          .from('fire_reports')
          .select(`
            *,
            users:user_id (
              first_name,
              last_name,
              email
            )
          `)
          .order('created_at', { ascending: false });
          
        if (!sbErr && Array.isArray(sbData) && sbData.length > 0) {
          console.log('[AOverview] Supabase fire_reports rows:', sbData.length);
          
          // Transform data to match Railway API format
          const transformedData = sbData.map(report => {
            // Build reporter name from joined user data
            let reporter = 'Anonymous Reporter';
            if (report.users) {
              const firstName = report.users.first_name || '';
              const lastName = report.users.last_name || '';
              if (firstName || lastName) {
                reporter = `${firstName} ${lastName}`.trim();
              } else if (report.users.email) {
                reporter = report.users.email;
              }
            } else if (report.reporter) {
              reporter = report.reporter;
            } else if (report.user_name) {
              reporter = report.user_name;
            }
            
            return {
              ...report,
              reporter: reporter,
              // Ensure address is properly mapped
              address: report.address || report.geotag_location || null
            };
          });
          
          // Auto-invalidate No Fire/No Smoke reports
          transformedData.forEach(report => {
            const shouldAutoInvalidate = isNoFireNoSmoke(report) && 
                                         report.invalidated !== true && 
                                         report.validated !== true;
            
            if (shouldAutoInvalidate) {
              supabase
                .from('fire_reports')
                .update({ 
                  invalidated: true,
                  invalidated_at: new Date().toISOString()
                })
                .eq('id', report.id)
                .then(({ error }) => {
                  if (error) console.error('Error auto-invalidating report:', error);
                  else console.log('✅ Auto-invalidated No Fire/No Smoke report:', report.id);
                });
              // Update local data immediately
              report.invalidated = true;
              report.invalidated_at = new Date().toISOString();
            }
          });
          
          setReports(transformedData);
          // Load station assignments for these reports
          const ids = transformedData.map(r => String(r.id));
          if (ids.length) {
            const { data: assigns } = await supabase
              .from('report_assignments')
              .select('report_id')
              .in('report_id', ids)
              .eq('assignee_type', 'station');
            setAssignedStationReportIds(new Set((assigns || []).map(a => String(a.report_id))));
          } else {
            setAssignedStationReportIds(new Set());
          }
          return;
        }
        if (sbErr) console.warn('[AOverview] Supabase fire_reports error:', sbErr?.message || sbErr);
      } catch (sbCatch) {
        console.warn('[AOverview] Supabase fire_reports catch:', sbCatch?.message || sbCatch);
      }
    } catch (e) {
      console.error('Error fetching reports:', e);
      if (e.name === 'AbortError') {
        console.error('Request timed out');
      }
      // Keep previous reports on error
    } finally {
      setLoading(false);
    }
  }, [isNoFireNoSmoke]);

  // Build printable HTML for summary (lightweight vs web version)
  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return 'N/A';
    }
  };

  const buildSummaryHtml = (data) => {
    const report = data?.report || {};
    const station = data?.station || {};
    const statusHistory = data?.statusHistory || [];
    const alarmLevelHistory = data?.alarmLevelHistory || [];
    
    const submittedAt = report.created_at || report.timestamp || report.time;
    const underControlTime = statusHistory.find(s => s.status === 'Under Control')?.timestamp;
    const fireOutTime = report.updated_at || data?.fireOutTime;
    const location = report.address || report.geotag_location || report.resolved_address || 'Location unavailable';
    const reporter = report.reporter || report.reporter_name || report.user_name || 'Anonymous';
    const alarm = report.final_fire_alarm_level || report.final_alarm_level || report.recommended_alarm_level || report.alarm_level || '1st Alarm';
    const stationName = station.station_name || 'Unassigned';
    const stationAssignedAt = station.assigned_at;
    const cause = report.cause_of_fire || 'Not specified';
    const structures = report.number_of_structures_on_fire || 'Not specified';
    const structureType = report.structure || '';
    const confidence = report.confidence ? (parseFloat(report.confidence) * 100).toFixed(2) + '%' : '';
    const smokeDetection = report.smoke_detection || report.smokeDetection || 'N/A';
    const smokeConfidence = report.smoke_confidence ? (parseFloat(report.smoke_confidence) * 100).toFixed(2) + '%' : '';
    const prediction = report.prediction || 'Unknown';
    const coordinates = (report.latitude && report.longitude) 
      ? `${parseFloat(report.latitude).toFixed(6)}, ${parseFloat(report.longitude).toFixed(6)}`
      : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 32px; color: #111827; background: #fff; }
            .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #d1d5db; }
            .logo { background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; display: inline-block; margin-bottom: 16px; }
            .logo h1 { font-size: 24px; font-weight: bold; }
            .logo p { font-size: 12px; margin-top: 4px; }
            .title { font-size: 20px; font-weight: bold; color: #111827; margin-top: 16px; }
            .subtitle { color: #6b7280; margin-top: 8px; }
            .section { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
            .section-title { font-size: 18px; font-weight: bold; color: #111827; margin-bottom: 16px; display: flex; align-items: center; }
            .section-title::before { content: '📋'; margin-right: 8px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .field { margin-bottom: 12px; }
            .field-label { font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }
            .field-value { font-size: 16px; font-weight: 600; color: #111827; }
            .field-value.alarm { color: #dc2626; }
            .field-value.status { color: #16a34a; }
            .timeline-item { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; margin-bottom: 12px; }
            .timeline-label { font-weight: 600; color: #374151; }
            .timeline-value { color: #111827; }
            .alarm-history-item { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; margin-bottom: 8px; }
            .alarm-level { font-weight: 600; color: #dc2626; }
            .footer { margin-top: 32px; padding-top: 24px; border-top: 2px solid #d1d5db; text-align: center; }
            .footer-text { font-size: 12px; color: #6b7280; }
            .footer-date { font-size: 10px; color: #9ca3af; margin-top: 8px; }
            .full-width { grid-column: 1 / -1; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">
              <h1>PROJECT FIRA</h1>
              <p>Fire Incident Response & Analysis</p>
            </div>
            <h2 class="title">FIRE INCIDENT SUMMARY REPORT</h2>
            <p class="subtitle">Official Government Document</p>
          </div>

          <div class="section">
            <h3 class="section-title">Incident Information</h3>
            <div class="grid">
              <div class="field">
                <div class="field-label">Final Alarm Level</div>
                <div class="field-value alarm">${alarm}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h3 class="section-title">Incident Timeline</h3>
            <div class="timeline-item">
              <span class="timeline-label">Report Submitted:</span>
              <span class="timeline-value">${formatDateTime(submittedAt)}</span>
            </div>
            ${underControlTime ? `
            <div class="timeline-item">
              <span class="timeline-label">Response Time (Under Control):</span>
              <span class="timeline-value">${formatDateTime(underControlTime)}</span>
            </div>
            ` : ''}
            ${fireOutTime ? `
            <div class="timeline-item">
              <span class="timeline-label">Resolution Time (Fire Out):</span>
              <span class="timeline-value">${formatDateTime(fireOutTime)}</span>
            </div>
            ` : ''}
          </div>

          ${stationName !== 'Unassigned' ? `
          <div class="section">
            <h3 class="section-title">Responding Station</h3>
            <div class="grid">
              <div class="field">
                <div class="field-label">Station Name</div>
                <div class="field-value">${stationName}</div>
              </div>
              ${stationAssignedAt ? `
              <div class="field">
                <div class="field-label">Assigned At</div>
                <div class="field-value">${formatDateTime(stationAssignedAt)}</div>
              </div>
              ` : ''}
            </div>
          </div>
          ` : ''}

          <div class="section">
            <h3 class="section-title">Reporter Information</h3>
            <div class="grid">
              <div class="field">
                <div class="field-label">Reporter Name</div>
                <div class="field-value">${reporter}</div>
              </div>
              <div class="field">
                <div class="field-label">Cause of Fire</div>
                <div class="field-value">${cause}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h3 class="section-title">Incident Location</h3>
            <div class="field">
              <div class="field-value">${location}</div>
              ${coordinates ? `<div class="field-label" style="margin-top: 8px;">Coordinates: ${coordinates}</div>` : ''}
            </div>
          </div>

          ${alarmLevelHistory.length > 0 ? `
          <div class="section">
            <h3 class="section-title">Alarm Level Changes</h3>
            ${alarmLevelHistory.map(change => `
              <div class="alarm-history-item">
                <span class="alarm-level">${change.level || 'N/A'}</span>
                <span class="timeline-value">${formatDateTime(change.timestamp)}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}

          <div class="section">
            <h3 class="section-title">Additional Details</h3>
            <div class="grid">
              ${structures !== 'Not specified' ? `
              <div class="field">
                <div class="field-label">Structures Affected</div>
                <div class="field-value">${structures}</div>
              </div>
              ` : ''}
              ${structureType ? `
              <div class="field">
                <div class="field-label">Structure Type</div>
                <div class="field-value">${structureType}</div>
              </div>
              ` : ''}
              ${confidence ? `
              <div class="field">
                <div class="field-label">Detection Confidence</div>
                <div class="field-value">${confidence}</div>
              </div>
              ` : ''}
              <div class="field">
                <div class="field-label">Prediction</div>
                <div class="field-value">${prediction}${confidence ? ` (${confidence})` : ''}</div>
              </div>
              <div class="field">
                <div class="field-label">Smoke Detection</div>
                <div class="field-value">${smokeDetection}${smokeConfidence ? ` (${smokeConfidence})` : ''}</div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p class="footer-text">This is an official government document generated by Project FIRA</p>
            <p class="footer-date">Generated on ${new Date().toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}</p>
          </div>
        </body>
      </html>
    `;
  };

  const loadSummaryData = async (reportId) => {
    try {
      setSummaryLoading(true);
      setSummaryData(null);
      const res = await fetch(`${API_URL}/get_reports`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const all = await res.json();
      const report = Array.isArray(all) ? all.find(r => String(r.id) === String(reportId)) : null;
      if (!report) throw new Error('Report not found');

      // Fetch station assignment (latest accepted/pending)
      let station = null;
      const { data: assignment } = await supabase
        .from('report_assignments')
        .select('assignee_id, assigned_at, status')
        .eq('report_id', String(reportId))
        .eq('assignee_type', 'station')
        .in('status', ['accepted', 'pending'])
        .order('assigned_at', { ascending: false })
        .limit(1)
        .single();
      if (assignment?.assignee_id) {
        const { data: stationData } = await supabase
          .from('station_users')
          .select('station_name, address, email, phone')
          .eq('id', assignment.assignee_id)
          .single();
        if (stationData) {
          station = { ...stationData, assigned_at: assignment.assigned_at };
        }
      }

      // Fetch status change notifications
      const { data: statusNotifications } = await supabase
        .from('notifications')
        .select('created_at, message, title')
        .or(`related_report_id.eq.${reportId},fire_report_id.eq.${reportId}`)
        .or('type.eq.fire_alert,type.eq.assignment')
        .order('created_at', { ascending: true });

      const statusHistory = [];
      if (statusNotifications) {
        statusNotifications.forEach(notif => {
          const message = notif.message || notif.title || '';
          if (message.includes('Status Changed')) {
            const statusMatch = message.match(/Status Changed.*?to\s+([^:]+)/i);
            if (statusMatch) {
              statusHistory.push({
                status: statusMatch[1].trim(),
                timestamp: notif.created_at
              });
            }
          }
        });
      }

      // Fetch alarm level change notifications
      const { data: alarmNotifications } = await supabase
        .from('notifications')
        .select('created_at, message, title')
        .or(`related_report_id.eq.${reportId},fire_report_id.eq.${reportId}`)
        .or('type.eq.fire_alert,type.eq.alarm_level_change')
        .order('created_at', { ascending: true });

      let alarmLevelHistory = [];
      if (alarmNotifications && alarmNotifications.length > 0) {
        alarmLevelHistory = alarmNotifications
          .map(notif => {
            const message = notif.message || notif.title || '';
            const alarmMatch = message.match(/(\d+(?:st|nd|rd|th)?\s*Alarm|General Alarm|TASK FORCE \w+)/i);
            return {
              level: alarmMatch ? alarmMatch[1] : null,
              timestamp: notif.created_at
            };
          })
          .filter(change => change.level !== null);
      }

      // If no alarm level history found, use report's final fire alarm level
      if (alarmLevelHistory.length === 0) {
        alarmLevelHistory = [{
          level: report.final_fire_alarm_level || report.final_alarm_level || '1st Alarm',
          timestamp: report.created_at || report.timestamp
        }];
      }

      setSummaryData({ report, station, fireOutTime: report.updated_at, statusHistory, alarmLevelHistory });
      setShowSummaryModal(true);
    } catch (err) {
      console.error('Summary load error:', err);
      Alert.alert('Error', err.message || 'Failed to load summary.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const downloadSummaryPdf = async (action = 'share') => {
    if (!summaryData) {
      Alert.alert('Error', 'No summary data available.');
      return;
    }
    
    try {
      setSummaryDownloading(true);
      
      // Build HTML content with error handling
      let html;
      try {
        html = buildSummaryHtml(summaryData);
        if (!html || html.trim().length === 0) {
          throw new Error('HTML content is empty');
        }
        console.log('✅ HTML generated, length:', html.length);
      } catch (htmlError) {
        console.error('❌ HTML generation error:', htmlError);
        throw new Error(`Failed to generate HTML: ${htmlError.message}`);
      }
      
      console.log('📄 Generating PDF from HTML...');
      
      // Generate PDF - use minimal options for better compatibility
      let result;
      try {
        result = await Print.printToFileAsync({ html });
      } catch (printError) {
        console.error('❌ Print error:', printError);
        throw new Error(`PDF generation failed: ${printError.message || 'Unknown error'}`);
      }
      
      if (!result || !result.uri) {
        throw new Error('PDF generation returned no URI');
      }
      
      const uri = result.uri;
      console.log('✅ PDF generated successfully:', uri);
      
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable && Platform.OS !== 'web') {
        Alert.alert('Error', 'Sharing is not available on this device.');
        setSummaryDownloading(false);
        return;
      }
      
      // For both download and share, use the native share dialog
      // This allows users to save to Downloads or share via other apps
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        try {
          // Use simple share - Android will show "Save" option in share dialog
          if (Platform.OS === 'android') {
            await Sharing.shareAsync(uri, {
              dialogTitle: action === 'download' ? 'Save PDF to Downloads' : 'Share PDF'
            });
          } else {
            // iOS
            await Sharing.shareAsync(uri);
          }
          console.log('✅ PDF shared successfully');
        } catch (shareError) {
          console.error('❌ Sharing error:', shareError);
          // Try without options as fallback
          await Sharing.shareAsync(uri);
        }
      } else {
        Alert.alert('PDF Ready', `PDF saved to: ${uri}`);
      }
    } catch (err) {
      console.error('❌ Summary PDF error:', err);
      console.error('❌ Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      
      // More user-friendly error message
      let errorMessage = 'Failed to generate PDF. Please try again.';
      if (err.message) {
        errorMessage = err.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setSummaryDownloading(false);
    }
  };

  // Load AI suggestions from messages table
  // Optimized: Only query messages that have a report_id (fire report context)
  useEffect(() => {
    const loadAiSuggestions = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id, ai_suggested_alarm, suggested_alarm_level, created_at, report_id')
          .not('ai_suggested_alarm', 'is', null)
          .not('report_id', 'is', null)  // Only get messages linked to fire reports
          .order('created_at', { ascending: false })
          .limit(150);  // Reduced from 200 since we're filtering more
        
        if (!error) {
          console.log(`📱 Admin AI Suggestions: Loaded ${data?.length || 0} report-linked suggestions`);
          setAiChatSuggestions(data || []);
        }
      } catch (err) {
        console.error('📱 Error loading AI suggestions:', err);
      }
    };
    loadAiSuggestions();
    
    // Fast polling - every 2 seconds for real-time operations
    const interval = setInterval(loadAiSuggestions, 2000);
    
    // Real-time subscription for instant updates - only report-linked messages
    const subscription = supabase
      .channel('ai_suggestions_mobile_admin')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: 'ai_suggested_alarm=not.is.null'
      }, (payload) => {
        // Only reload if the message has a report_id
        if (payload.new?.report_id) {
          console.log('🔔 Real-time: Report-linked AI suggestion detected, reloading...');
          loadAiSuggestions();
        }
      })
      .subscribe();
    
    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  // Compute strongest AI alarm per report
  useEffect(() => {
    const toStrength = (label) => {
      const map = {
        'Under Control': 0, '1st Alarm': 1, '2nd Alarm': 2, '3rd Alarm': 3,
        '4th Alarm': 4, '5th Alarm': 5, 'TASK FORCE ALPHA': 6,
        'TASK FORCE BRAVO': 7, 'TASK FORCE CHARLIE': 8,
        'TASK FORCE DELTA': 9, 'GENERAL ALARM': 10
      };
      return map[label] ?? 0;
    };
    
    const normalizeAiLabel = (aiValue, suggestedAlarmLevel) => {
      if (suggestedAlarmLevel && suggestedAlarmLevel !== 'NONE') {
        const normalized = suggestedAlarmLevel.toLowerCase().trim();
        const map = {
          'none': 'Under Control', 'first': '1st Alarm', 'first_alarm': '1st Alarm',
          '1st alarm': '1st Alarm', 'second': '2nd Alarm', 'second_alarm': '2nd Alarm',
          '2nd alarm': '2nd Alarm', 'third': '3rd Alarm', 'third_alarm': '3rd Alarm',
          '3rd alarm': '3rd Alarm', 'fourth': '4th Alarm', 'fourth_alarm': '4th Alarm',
          '4th alarm': '4th Alarm', 'fifth': '5th Alarm', 'fifth_alarm': '5th Alarm',
          '5th alarm': '5th Alarm', 'task_force_alpha': 'TASK FORCE ALPHA',
          'task_force_bravo': 'TASK FORCE BRAVO', 'task_force_charlie': 'TASK FORCE CHARLIE',
          'task_force_delta': 'TASK FORCE DELTA', 'general': 'GENERAL ALARM',
          'general_alarm': 'GENERAL ALARM'
        };
        return map[normalized] || suggestedAlarmLevel;
      }
      return null;
    };

    // Use MOST RECENT suggestion per report (not strongest) to match real-time chat context
    const bestByReport = {};
    const messageTimestamps = {};
    (aiChatSuggestions || []).forEach((m) => {
      const reportId = m.report_id;
      if (!reportId) return;
      const reportIdStr = String(reportId);
      const label = normalizeAiLabel(m.ai_suggested_alarm, m.suggested_alarm_level);
      if (!label) return;
      
      const currentTimestamp = messageTimestamps[reportIdStr];
      const newTimestamp = new Date(m.created_at).getTime();
      
      // Keep the most recent message (highest timestamp)
      if (!currentTimestamp || newTimestamp > currentTimestamp) {
        bestByReport[reportIdStr] = label;
        messageTimestamps[reportIdStr] = newTimestamp;
      }
    });
    setChatAlarmByReport(bestByReport);
  }, [aiChatSuggestions]);

  // When AI overrides change, update suggestedAlarmLevel in current list
  useEffect(() => {
    if (!reports || reports.length === 0 || Object.keys(chatAlarmByReport).length === 0) return;
    setReports(prev => prev.map(r => ({
      ...r,
      recommended_alarm_level: chatAlarmByReport[String(r.id)] || r.recommended_alarm_level
    })));
  }, [chatAlarmByReport]);

  useEffect(() => {
    fetchReports();
  }, []); // Remove fetchReports dependency to prevent infinite re-renders

  // Removed auto-polling: rely on manual Refresh button only

  // Load stations for assignment when screen mounts
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('station_users')
          .select('id, station_name, email')
          .order('station_name', { ascending: true });
        if (!error) setStations(data || []);
      } catch (_) {}
    })();
  }, []);

  // Load assigned responders and station assignment when a report is selected
  useEffect(() => {
    const loadAssignedResponders = async (reportId) => {
      try {
        setIsLoadingAssigned(true);
        setAssignedResponders([]);

        if (!reportId) return;

        const { data: assignments, error } = await supabase
          .from('report_assignments')
          .select('assignee_type, assignee_id, assigned_at')
          .eq('report_id', reportId)
          .eq('assignee_type', 'responder');

        if (error) {
          console.error('Error fetching report assignments:', error);
          return;
        }

        const responderIds = (assignments || []).map(a => a.assignee_id).filter(Boolean);
        if (responderIds.length === 0) {
          setAssignedResponders([]);
          return;
        }

        const { data: responders, error: respErr } = await supabase
          .from('responders')
          .select('id, first_name, last_name, email, phone')
          .in('id', responderIds);

        if (respErr) {
          console.error('Error fetching responder profiles:', respErr);
          setAssignedResponders([]);
          return;
        }

        setAssignedResponders(responders || []);
      } catch (e) {
        console.error('Failed loading assigned responders:', e);
      } finally {
        setIsLoadingAssigned(false);
      }
    };

    const loadStationAssignment = async (reportId) => {
      try {
        setCurrentStationAssignment(null);
        setAllAssignedStations([]);
        setAssignStationId(null);

        if (!reportId) return;

        // Fetch ALL station assignments (primary + backups)
        const { data: assignments, error } = await supabase
          .from('report_assignments')
          .select('assignee_id, status, assignment_role, assigned_at')
          .eq('report_id', reportId)
          .eq('assignee_type', 'station')
          .in('status', ['accepted', 'pending'])
          .order('assignment_role', { ascending: true }) // primary first
          .order('assigned_at', { ascending: false });

        if (error) {
          if (error.code !== 'PGRST116') {
            console.error('Error fetching station assignments:', error);
          }
          setCurrentStationAssignment(null);
          setAllAssignedStations([]);
          return;
        }

        if (assignments && assignments.length > 0) {
          // Fetch all station names
          const stationIds = assignments.map(a => a.assignee_id);
          const { data: stationsData } = await supabase
            .from('station_users')
            .select('id, station_name')
            .in('id', stationIds);

          const stationMap = {};
          (stationsData || []).forEach(s => {
            stationMap[s.id] = s.station_name;
          });

          const allStations = assignments.map(a => ({
            id: a.assignee_id,
            name: stationMap[a.assignee_id] || 'Unknown Station',
            status: a.status,
            role: a.assignment_role || 'primary'
          }));

          setAllAssignedStations(allStations);

          // Set primary station as current
          const primary = allStations.find(s => s.role === 'primary');
          if (primary) {
            setCurrentStationAssignment({
              stationId: primary.id,
              stationName: primary.name,
              status: primary.status,
              role: 'primary'
            });
          } else if (allStations.length > 0) {
            // Fallback to first station if no primary found
            setCurrentStationAssignment({
              stationId: allStations[0].id,
              stationName: allStations[0].name,
              status: allStations[0].status,
              role: allStations[0].role
            });
          }
        } else {
          setCurrentStationAssignment(null);
          setAllAssignedStations([]);
        }
      } catch (e) {
        console.error('Failed loading station assignments:', e);
        setCurrentStationAssignment(null);
        setAllAssignedStations([]);
      }
    };

    if (selectedReport?.id) {
      loadAssignedResponders(selectedReport.id);
      loadStationAssignment(selectedReport.id);
    } else {
      setAssignedResponders([]);
      setIsLoadingAssigned(false);
      setCurrentStationAssignment(null);
      setAssignStationId(null);
    }
  }, [selectedReport?.id]);

  // Resolve the best available alarm level
  const resolveAlarmLevel = (report) => {
    const normalize = (value) => {
      if (!value) return null;
      const cleaned = formatAlarmLevel(String(value).trim());
      if (!cleaned || cleaned === 'Unknown') return null;
      return cleaned;
    };

    const candidates = [
      normalize(report?.final_fire_alarm_level),
      normalize(report?.recommended_alarm_level),
      normalize(report?.suggested_alarm_level),
      normalize(report?.ai_suggested_alarm),
      normalize(report?.alarm_level)
    ].filter(Boolean);

    return candidates.length > 0 ? candidates[0] : '1st Alarm';
  };

  // Handle backup station assignment
  const handleAssignBackup = async () => {
    if (!selectedReport || !backupStationId) {
      Alert.alert('Error', 'Please select a backup station');
      return;
    }

    try {
      // Validate alarm level - must be 2 or higher
      const alarmLevel = resolveAlarmLevel(selectedReport);
      const alarmLevelLower = alarmLevel.toLowerCase();
      const isAlarmLevel2Plus = alarmLevel && (
        alarmLevelLower.includes('second alarm') ||
        alarmLevelLower.includes('2nd alarm') ||
        alarmLevelLower.includes('third alarm') ||
        alarmLevelLower.includes('3rd alarm') ||
        alarmLevelLower.includes('fourth alarm') ||
        alarmLevelLower.includes('4th alarm') ||
        alarmLevelLower.includes('fifth alarm') ||
        alarmLevelLower.includes('5th alarm') ||
        alarmLevelLower.includes('task force alpha') ||
        alarmLevelLower.includes('task force bravo') ||
        alarmLevelLower.includes('task force charlie') ||
        alarmLevelLower.includes('task force delta') ||
        alarmLevelLower.includes('general alarm')
      );

      if (!isAlarmLevel2Plus) {
        Alert.alert('Cannot Assign Backup', `Backup stations can only be assigned to incidents with Alarm Level 2 or higher.\n\nCurrent alarm level: ${alarmLevel}`);
        return;
      }

      // Check if station is already assigned
      const { data: existingAssignments } = await supabase
        .from('report_assignments')
        .select('assignment_role, status')
        .eq('report_id', selectedReport.id)
        .eq('assignee_type', 'station')
        .eq('assignee_id', backupStationId)
        .in('status', ['pending', 'accepted']);

      if (existingAssignments && existingAssignments.length > 0) {
        const role = existingAssignments[0].assignment_role === 'primary' ? 'primary station' : 'backup station';
        Alert.alert('Already Assigned', `This station is already assigned as ${role} for this incident.`);
        return;
      }

      // Delete old declined assignments
      await supabase
        .from('report_assignments')
        .delete()
        .eq('report_id', selectedReport.id)
        .eq('assignee_type', 'station')
        .eq('assignee_id', backupStationId)
        .neq('status', 'pending')
        .neq('status', 'accepted');

      // Check if station is busy
      const busyCheck = await checkStationIsBusy(backupStationId);
      
      const backupAssignment = {
        report_id: selectedReport.id,
        assignee_type: 'station',
        assignee_id: backupStationId,
        assigned_at: new Date().toISOString(),
        status: busyCheck.isBusy ? 'pending' : 'accepted',
        assignment_source: 'manual',
        assignment_role: 'backup',
        note: `Backup for ${alarmLevel} incident`
      };

      const { error } = await supabase
        .from('report_assignments')
        .upsert(backupAssignment, { 
          onConflict: 'report_id,assignee_type,assignee_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Backup assignment error:', error);
        Alert.alert('Error', 'Failed to assign backup station: ' + error.message);
        return;
      }

      // Get station name
      const { data: stationData } = await supabase
        .from('station_users')
        .select('station_name')
        .eq('id', backupStationId)
        .single();

      const stationName = stationData?.station_name || 'Station';

      if (busyCheck.isBusy) {
        // Show waiting modal
        setPendingBackupAssignment({
          reportId: selectedReport.id,
          stationId: backupStationId,
          stationName
        });
        setShowWaitingBackupModal(true);

        // Send notification
        const locationInfo = selectedReport.address || selectedReport.geotag_location || 'Location unavailable';
        const reporterName = selectedReport.reporter_name || selectedReport.reporter || 'Unknown Reporter';
        
        await supabase
          .from('notifications')
          .insert({
            user_id: backupStationId,
            user_type: 'station',
            type: 'assignment',
            related_report_id: String(selectedReport.id),
            title: `🚨 Backup Assistance Request - ${alarmLevel}`,
            message: `Command Center is requesting your station as BACKUP for a ${alarmLevel} incident.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}\n\nNote: You will provide support but cannot change the fire status. Only the primary station can update the incident status.\n\nWill you accept this backup assignment?`,
            priority: 'urgent',
            is_read: false
          });
      } else {
        Alert.alert('Success', `✅ ${stationName} has been assigned as backup station.`);
      }

      // Reload assignments
      if (selectedReport?.id) {
        const { data: assignments } = await supabase
          .from('report_assignments')
          .select('assignee_id, status, assignment_role, assigned_at')
          .eq('report_id', selectedReport.id)
          .eq('assignee_type', 'station')
          .in('status', ['accepted', 'pending'])
          .order('assignment_role', { ascending: true })
          .order('assigned_at', { ascending: false });

        if (assignments && assignments.length > 0) {
          const stationIds = assignments.map(a => a.assignee_id);
          const { data: stationsData } = await supabase
            .from('station_users')
            .select('id, station_name')
            .in('id', stationIds);

          const stationMap = {};
          (stationsData || []).forEach(s => {
            stationMap[s.id] = s.station_name;
          });

          const allStations = assignments.map(a => ({
            id: a.assignee_id,
            name: stationMap[a.assignee_id] || 'Unknown Station',
            status: a.status,
            role: a.assignment_role || 'primary'
          }));

          setAllAssignedStations(allStations);
        }
      }

      setBackupStationId(null);
    } catch (error) {
      console.error('Error assigning backup:', error);
      Alert.alert('Error', 'Failed to assign backup station');
    }
  };

  // Invalidate No Fire/No Smoke report - marks it as invalid so admins can review
  const handleInvalidateReport = async (reportId) => {
    try {
      setIsInvalidating(true);
      
      // Update report with invalidated flag
      const { error } = await supabase
        .from('fire_reports')
        .update({ 
          invalidated: true,
          invalidated_at: new Date().toISOString(),
          invalidated_by: 'Admin User',
          invalidation_reason: 'AI misclassification - manual review required'
        })
        .eq('id', reportId);

      if (error) throw error;

      // Update local state
      setReports(prev => prev.map(report => 
        report.id === reportId ? { 
          ...report, 
          invalidated: true,
          invalidated_at: new Date().toISOString(),
          invalidated_by: 'Admin User',
          invalidation_reason: 'AI misclassification - manual review required'
        } : report
      ));
      
      Alert.alert('Success', 'Report marked as invalid and moved to Invalidated Reports tab for review.');
    } catch (error) {
      console.error('Error invalidating report:', error);
      Alert.alert('Error', `Failed to invalidate report: ${error.message}`);
    } finally {
      setIsInvalidating(false);
    }
  };

  // Restore invalidated report
  const handleRestoreReport = (reportId) => {
    setReportToRestore(reportId);
    setShowRestoreModal(true);
  };

  const confirmRestoreReport = async () => {
    if (!reportToRestore) return;
    
    try {
      setIsInvalidating(true);
      
      const { data, error } = await supabase
        .from('fire_reports')
        .update({ 
          invalidated: false,
          invalidated_at: null,
          validated: true,
          validated_at: new Date().toISOString()
        })
        .eq('id', reportToRestore)
        .select();

      if (error) throw error;

      // Update local state
      setReports(prev => prev.map(report => 
        report.id === reportToRestore ? { 
          ...report, 
          invalidated: false,
          invalidated_at: null,
          validated: true,
          validated_at: new Date().toISOString()
        } : report
      ));

      setShowRestoreModal(false);
      setReportToRestore(null);
      setShowRestoreSuccessModal(true);
      
      setTimeout(() => {
        setShowRestoreSuccessModal(false);
        setActiveTab('active');
      }, 3000);
    } catch (error) {
      console.error('Error restoring report:', error);
      Alert.alert('Error', `Failed to restore report: ${error.message}`);
    } finally {
      setIsInvalidating(false);
    }
  };

  // Re-invalidate a previously restored report
  const handleReInvalidateReport = (reportId) => {
    setReportToReInvalidate(reportId);
    setShowReInvalidateModal(true);
  };

  const confirmReInvalidateReport = async () => {
    if (!reportToReInvalidate) return;
    
    if (invalidateConfirmText.toUpperCase() !== 'INVALIDATE') {
      Alert.alert('Error', 'Please type "INVALIDATE" to confirm.');
      return;
    }
    
    try {
      setIsInvalidating(true);
      
      const { data, error } = await supabase
        .from('fire_reports')
        .update({ 
          invalidated: true,
          invalidated_at: new Date().toISOString(),
          validated: false,
          validated_at: null
        })
        .eq('id', reportToReInvalidate)
        .select();

      if (error) throw error;

      // Update local state
      setReports(prev => prev.map(report => 
        report.id === reportToReInvalidate ? { 
          ...report, 
          invalidated: true,
          invalidated_at: new Date().toISOString(),
          validated: false,
          validated_at: null
        } : report
      ));

      setShowReInvalidateModal(false);
      setReportToReInvalidate(null);
      setInvalidateConfirmText('');
      setShowInvalidateSuccessModal(true);
      
      setTimeout(() => {
        setShowInvalidateSuccessModal(false);
        setActiveTab('invalidated');
      }, 3000);
    } catch (error) {
      console.error('Error re-invalidating report:', error);
      Alert.alert('Error', `Failed to re-invalidate report: ${error.message}`);
    } finally {
      setIsInvalidating(false);
    }
  };

  // Restore invalidated report - moves it back to validation
  const handleRestoreReportLegacy = async (reportId) => {
    try {
      setIsInvalidating(true);
      
      // Remove invalidated flag
      const { error} = await supabase
        .from('fire_reports')
        .update({ 
          invalidated: false,
          invalidated_at: null,
          invalidated_by: null,
          invalidation_reason: null
        })
        .eq('id', reportId);

      if (error) throw error;

      // Update local state
      setReports(prev => prev.map(report => 
        report.id === reportId ? { 
          ...report, 
          invalidated: false,
          invalidated_at: null,
          invalidated_by: null,
          invalidation_reason: null
        } : report
      ));
      
      Alert.alert('Success', 'Report has been restored successfully.');
    } catch (error) {
      console.error('Error restoring report:', error);
      Alert.alert('Error', `Failed to restore report: ${error.message}`);
    } finally {
      setIsInvalidating(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Prefer Supabase, fallback to API
      try {
        const { data: sbData, error: sbErr } = await supabase
          .from('fire_reports')
          .select('*')
          .order('created_at', { ascending: false });
        if (!sbErr && Array.isArray(sbData) && sbData.length > 0) {
          setReports(sbData);
          const ids = sbData.map(r => String(r.id));
          if (ids.length) {
            const { data: assigns } = await supabase
              .from('report_assignments')
              .select('report_id')
              .in('report_id', ids)
              .eq('assignee_type', 'station');
            setAssignedStationReportIds(new Set((assigns || []).map(a => String(a.report_id))));
          } else {
            setAssignedStationReportIds(new Set());
          }
          return;
        }
      } catch (_) {}
      const res = await fetch(`${API_URL}/get_reports`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setReports(data);
        const ids = data.map(r => String(r.id));
        if (ids.length) {
          const { data: assigns } = await supabase
            .from('report_assignments')
            .select('report_id')
            .in('report_id', ids)
            .eq('assignee_type', 'station');
          setAssignedStationReportIds(new Set((assigns || []).map(a => String(a.report_id))));
        } else {
          setAssignedStationReportIds(new Set());
        }
      }
    } catch (e) {
      console.error('Error refreshing reports:', e);
      // Keep previous reports on error
    } finally {
      setRefreshing(false);
    }
  }, []); // Remove fetchReports dependency

  // Update report status
  const updateReportStatus = async (reportId, newStatus, reason = null) => {
    try {
      setIsUpdating(true);
      console.log('[updateReportStatus] Sending status update', { reportId, newStatus, reason });
      
      const payload = {
        report_id: reportId,
        status: newStatus
      };
      
      // Add reason and cancelled_by if status is Cancelled
      if (newStatus === 'Cancelled') {
        if (!reason || !reason.trim()) {
          Alert.alert('Error', 'Please provide a reason for cancellation.');
          setIsUpdating(false);
          return;
        }
        payload.reason = reason.trim();
        payload.cancelled_by = 'Admin User';
        payload.cancelled_by_role = 'admin';
      }
      
      console.log('[updateReportStatus] Payload being sent:', payload);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(`${API_URL}/update_report_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        // Get old status before updating
        const oldStatus = reports.find(r => r.id === reportId)?.status;
        
        // Update local state
        setReports(prev => prev.map(report => 
          report.id === reportId ? { ...report, status: newStatus } : report
        ));
        
        // Update editReport state if it's the same report
        if (editReport && editReport.id === reportId) {
          setEditReport(prev => ({ ...prev, status: newStatus }));
        }
        
        console.log(`Status updated for report ${reportId}: ${newStatus}`);
        
        // Notify responders of status change
        try {
          const report = reports.find(r => r.id === reportId);
          const reportData = await fetchReportData(reportId);
          const reportForNotification = reportData || {
            ...report,
            status: newStatus,
            latitude: report?.latitude,
            longitude: report?.longitude,
            address: report?.location || report?.geotag_location
          };
          
          // Notify responders (existing service)
          await notifyRespondersOnStatusChange(
            reportId,
            newStatus,
            oldStatus,
            reportForNotification
          );
          console.log('✅ Responder notifications sent for status change');
          
          // Notify all users (admin, station, citizen)
          await notifyAllUsersOnStatusChange(
            reportId,
            newStatus,
            oldStatus,
            reportForNotification
          );
          console.log('✅ Universal notifications sent for status change');
        } catch (notifError) {
          console.error('⚠️ Error sending notifications:', notifError);
          // Don't fail the status update if notification fails
        }
        
        Alert.alert('Success', 'Report status updated successfully.');

        // If report is finished/cancelled, clear responder assignments so they can be reassigned elsewhere
        try {
          if (newStatus === 'Fire Out' || newStatus === 'Cancelled') {
            await supabase
              .from('report_assignments')
              .delete()
              .eq('report_id', String(reportId))
              .eq('assignee_type', 'responder');
          }
        } catch (_) {}
      } else {
        // If cancelling and primary endpoint failed, try dedicated cancel endpoint
        if (newStatus === 'Cancelled') {
          console.log('Primary endpoint failed for cancellation, trying dedicated cancel endpoint...');
          try {
            const cancelResponse = await fetch(`${API_URL}/cancel_report/${reportId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({
                reason: reason,
                cancellation_reason: reason,
                cancelled_by: 'Admin User',
                cancelled_by_role: 'admin',
                cancellation_timestamp: new Date().toLocaleString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric', 
                  hour: 'numeric', 
                  minute: '2-digit' 
                }).replace('AM', 'am').replace('PM', 'pm')
              })
            });
            
            if (cancelResponse.ok) {
              // Update local state
              setReports(prev => prev.map(report => 
                report.id === reportId ? { 
                  ...report, 
                  status: newStatus,
                  cancelled_by: 'Admin User',
                  cancellation_reason: reason,
                  cancellation_timestamp: new Date().toLocaleString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric', 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  }).replace('AM', 'am').replace('PM', 'pm')
                } : report
              ));
              console.log(`Report cancelled via dedicated endpoint for report ${reportId}`);
              Alert.alert('Success', 'Report cancelled successfully.');
              // Close edit modal after successful cancellation
              setShowEditModal(false);
              return;
            } else {
              console.error('Dedicated cancel endpoint also failed:', cancelResponse.status);
            }
          } catch (cancelError) {
            console.error('Error with dedicated cancel endpoint:', cancelError);
          }
        }
        
        let errorText = '';
        try {
          const errJson = await response.clone().json();
          errorText = errJson?.error || errJson?.message || JSON.stringify(errJson);
        } catch (_) {
          try {
            errorText = await response.text();
          } catch (_) {
            errorText = `HTTP ${response.status} ${response.statusText}`;
          }
        }
        console.error('[updateReportStatus] Backend error:', response.status, response.statusText, errorText);
        Alert.alert('Error', `Failed to update status (HTTP ${response.status}).\n${errorText || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('[updateReportStatus] Network/JS error:', error);
      if (error.name === 'AbortError') {
        Alert.alert('Error', 'Request timed out. Please check your internet connection and try again.');
      } else {
        Alert.alert('Error', `Error updating status: ${error?.message || 'Unknown error'}`);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Update final alarm level
  const updateFinalAlarmLevel = async (reportId, newAlarmLevel) => {
    try {
      setIsUpdating(true);
      console.log('[updateFinalAlarmLevel] Updating alarm level', { reportId, newAlarmLevel });
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(`${API_URL}/update_final_alarm_level`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          report_id: reportId,
          final_alarm_level: newAlarmLevel
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        // Get old alarm level BEFORE updating - check both editReport and reports
        const currentReport = editReport?.id === reportId ? editReport : reports.find(r => r.id === reportId);
        const oldAlarmLevel = currentReport?.final_alarm_level || 
                             currentReport?.recommended_alarm_level ||
                             currentReport?.alarm_level ||
                             'Unknown';
        
        console.log('[updateFinalAlarmLevel] Alarm level change:', { 
          reportId, 
          oldAlarmLevel, 
          newAlarmLevel,
          currentReport: currentReport ? 'found' : 'not found'
        });
        
        // Update local state
        setReports(prev => prev.map(report => 
          report.id === reportId ? { ...report, final_alarm_level: newAlarmLevel } : report
        ));
        
        // Update editReport state if it's the same report
        if (editReport && editReport.id === reportId) {
          setEditReport(prev => ({ ...prev, final_alarm_level: newAlarmLevel }));
        }
        
        console.log(`Final alarm level updated for report ${reportId}: ${newAlarmLevel}`);
        
        // Notify responders of alarm level change - ALWAYS notify if there's a change
        try {
          const report = currentReport || reports.find(r => r.id === reportId);
          
          // Try to fetch fresh report data from API
          let reportData = null;
          try {
            reportData = await fetchReportData(reportId);
            console.log('[updateFinalAlarmLevel] Fetched report data from API:', reportData ? 'success' : 'not found');
          } catch (fetchError) {
            console.log('[updateFinalAlarmLevel] Could not fetch from API, using local data:', fetchError.message);
          }
          
          const reportForNotification = reportData || {
            ...report,
            final_alarm_level: newAlarmLevel,
            recommended_alarm_level: newAlarmLevel,
            alarm_level: newAlarmLevel,
            latitude: report?.latitude || reportData?.latitude,
            longitude: report?.longitude || reportData?.longitude,
            address: report?.location || report?.geotag_location || reportData?.address || reportData?.geotag_location
          };
          
          console.log('[updateFinalAlarmLevel] Calling notifyRespondersOnAlarmChange with:', {
            reportId,
            newAlarmLevel,
            oldAlarmLevel,
            hasReportData: !!reportForNotification
          });
          
          // Notify responders (existing service)
          const notifResult = await notifyRespondersOnAlarmChange(
            reportId,
            newAlarmLevel,
            oldAlarmLevel,
            reportForNotification
          );
          
          if (notifResult.success) {
            console.log('✅ Responder notifications sent for alarm level change:', notifResult);
          } else {
            console.warn('⚠️ Responder notification service returned:', notifResult);
          }
          
          // Notify all users (admin, station, citizen)
          const universalResult = await notifyAllUsersOnAlarmChange(
            reportId,
            newAlarmLevel,
            oldAlarmLevel,
            reportForNotification
          );
          
          if (universalResult.success) {
            console.log('✅ Universal notifications sent for alarm level change:', universalResult);
          } else {
            console.warn('⚠️ Universal notification service returned:', universalResult);
          }
        } catch (notifError) {
          console.error('⚠️ Error sending responder notifications:', notifError);
          console.error('⚠️ Error stack:', notifError.stack);
          // Don't fail the alarm update if notification fails
        }
        
        Alert.alert('Success', 'Final alarm level updated successfully.');
      } else {
        let errorText = '';
        try {
          const errJson = await response.clone().json();
          errorText = errJson?.error || errJson?.message || JSON.stringify(errJson);
        } catch (_) {
          try {
            errorText = await response.text();
          } catch (_) {
            errorText = `HTTP ${response.status} ${response.statusText}`;
          }
        }
        console.error('Failed to update final alarm level:', response.status, errorText);
        Alert.alert('Error', `Failed to update final alarm level: ${errorText || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Error updating final alarm level:', error);
      if (error.name === 'AbortError') {
        Alert.alert('Error', 'Request timed out. Please check your internet connection and try again.');
      } else {
        Alert.alert('Error', `Error updating final alarm level: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle status change
  const handleStatusChange = (reportId, newStatus) => {
    console.log('[handleStatusChange] Called with:', { reportId, newStatus });
    
    // If cancelling, show the cancel modal instead of direct update
    if (newStatus === 'Cancelled') {
      const report = reports.find(r => r.id === reportId);
      setSelectedReport(report);
      setCancelReason('');
      setShowCancelModal(true);
    } else {
      // Update status without closing modal
      updateReportStatus(reportId, newStatus);
    }
  };

  // Handle status change click with custom modal
  const handleStatusChangeClick = (status) => {
    const currentStatus = editReport.status || 'Unknown';
    setPendingStatusChange({ status, currentStatus });
    setShowStatusConfirmModal(true);
  };

  // Handle alarm change click with custom modal
  const handleAlarmChangeClick = (alarm) => {
    const currentAlarm = editReport.final_alarm_level || editReport.recommended_alarm_level || 'Unknown';
    setPendingAlarmChange({ alarm, currentAlarm });
    setShowAlarmConfirmModal(true);
  };

  // Confirm status change
  const confirmStatusChange = () => {
    if (pendingStatusChange) {
      handleStatusChange(editReport.id, pendingStatusChange.status);
      setShowStatusConfirmModal(false);
      setPendingStatusChange(null);
    }
  };

  // Confirm alarm change
  const confirmAlarmChange = () => {
    if (pendingAlarmChange) {
      updateFinalAlarmLevel(editReport.id, pendingAlarmChange.alarm);
      setShowAlarmConfirmModal(false);
      setPendingAlarmChange(null);
    }
  };

  // Fetch active incident counts for stations in reroute modal
  useEffect(() => {
    if (nearestStations.length > 0 && showRerouteModal) {
      const fetchActiveCounts = async () => {
        const counts = {};
        await Promise.all(
          nearestStations.map(async (station) => {
            try {
              const busyCheck = await checkStationIsBusy(station.id);
              counts[station.id] = busyCheck.busyCount || 0;
            } catch (error) {
              console.error(`Error fetching active count for station ${station.id}:`, error);
              counts[station.id] = 0;
            }
          })
        );
        setStationActiveCounts(counts);
      };
      fetchActiveCounts();
    } else {
      setStationActiveCounts({});
    }
  }, [nearestStations, showRerouteModal]);

  // Handle reroute to selected station
  const handleReroute = async () => {
    if (!selectedRerouteStation || !pendingAssignment) {
      Alert.alert('Error', 'Please select a station to reroute to.');
      return;
    }

    try {
      // Remove the declined assignment
      await supabase
        .from('report_assignments')
        .delete()
        .eq('report_id', pendingAssignment.reportId)
        .eq('assignee_type', 'station')
        .eq('assignee_id', pendingAssignment.stationId);

      // Ensure any other existing assignments for this report are also removed
      await supabase
        .from('report_assignments')
        .delete()
        .eq('report_id', pendingAssignment.reportId)
        .neq('assignee_id', pendingAssignment.stationId);

      // Get new station name
      const { data: newStationData } = await supabase
        .from('station_users')
        .select('station_name')
        .eq('id', selectedRerouteStation)
        .single();

      const newStationName = newStationData?.station_name || 'Station';

      // Create new assignment to the selected station (always pending for reroutes)
      const payload = {
        report_id: pendingAssignment.reportId,
        assignee_type: 'station',
        assignee_id: selectedRerouteStation,
        assigned_at: new Date().toISOString(),
        status: 'pending',
        assignment_source: 'manual',
        note: `Rerouted from ${pendingAssignment.stationName}`
      };

      const { error } = await supabase
        .from('report_assignments')
        .insert(payload);

      if (error) {
        if (error.message && (error.message.includes('column') && error.message.includes('does not exist'))) {
          Alert.alert('Database Migration Required', 'Please run the migration SQL file (assignment-status-migration.sql) in your Supabase SQL Editor first.');
          return;
        }
        throw error;
      }

      // Create notification for new station
      if (selectedReport) {
        const locationInfo = selectedReport.address || selectedReport.geotag_location || 'Location unavailable';
        const reporterName = selectedReport.reporter_name || selectedReport.reporter || 'Unknown Reporter';
        const title = `🚨 Fire Report Rerouted to Your Station - Action Required`;
        const message = `Command Center is rerouting a fire report to your station.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}\nPrevious station: ${pendingAssignment.stationName}\n\nWill you accept this assignment?`;
        
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: selectedRerouteStation,
            user_type: 'station',
            type: 'assignment',
            related_report_id: String(pendingAssignment.reportId),
            title: title,
            message: message,
            priority: 'urgent',
            is_read: false
          });

        if (notifError) {
          console.error('❌ Error creating reroute notification:', notifError);
        }
      }

      const reroutedStation = nearestStations.find(s => s.id === selectedRerouteStation);
      Alert.alert('✅ Rerouted', `Report rerouted to ${reroutedStation?.station_name || 'selected station'}. The station will be notified and must approve the assignment.`);
      setShowRerouteModal(false);
      setSelectedRerouteStation('');
      setPendingAssignment(null);
      setStationActiveCounts({});
    } catch (e) {
      console.error('❌ Reroute failed:', e);
      Alert.alert('Error', 'Failed to reroute report. Check console.');
    }
  };

  // Cancel report with reason
  const handleCancelReport = async () => {
    console.log('[handleCancelReport] cancelReport:', cancelReport);
    console.log('[handleCancelReport] cancelReason:', cancelReason);
    if (!cancelReport || !cancelReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for cancellation.');
      return;
    }

    try {
      setIsCancelling(true);
      console.log('Admin cancelling report:', cancelReport.id, 'Reason:', cancelReason);
      
      // Use the updateReportStatus function which handles the reason requirement
      await updateReportStatus(cancelReport.id, 'Cancelled', cancelReason);
      
      // Update local state with additional cancellation details
      setReports(prev => prev.map(report => 
        report.id === cancelReport.id ? { 
          ...report, 
          status: 'Cancelled',
          cancelled_by: 'Admin User',
          cancellation_reason: cancelReason,
          cancellation_timestamp: new Date().toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit' 
          }).replace('AM', 'am').replace('PM', 'pm')
        } : report
      ));
      
      Alert.alert('Success', 'Report cancelled successfully.');
      setShowCancelModal(false);
      setCancelReason('');
      setCancelReport(null);
    } catch (error) {
      console.error('Error cancelling report:', error);
      Alert.alert('Error', `Failed to cancel report: ${error.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const filtered = useMemo(() => {
    const result = reports.filter((r) => {
      // Exclude invalidated reports from main overview
      if (r.invalidated) {
        return false;
      }
      
      // Exclude unvalidated "No Fire/No Smoke" reports from main overview  
      if (isNoFireNoSmoke(r) && !r.validated) {
        return false;
      }
      
      const statusText = (r.status || '').toString().toLowerCase();
      // Do NOT hide any statuses by default. Only apply explicit status filter below.
      if (statusFilter !== 'All') {
        if ((r.status || '') !== statusFilter) return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const location = (r.address || r.geotag_location || '').toLowerCase();
        const reporter = (r.reporter || '').toLowerCase();
        const cause = (r.cause_of_fire || '').toLowerCase();
        const structure = (r.structure || '').toLowerCase();
        if (!(location.includes(q) || reporter.includes(q) || cause.includes(q) || structure.includes(q))) return false;
      }

      // No additional status gating here when statusFilter is All

      if (timeRangeFilter !== 'all') {
        const ts = r.created_at || r.timestamp;
        if (!ts) return false;
        const d = new Date(ts);
        const now = new Date();
        if (timeRangeFilter === 'today') {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (d < start) return false;
        } else if (timeRangeFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (d < weekAgo) return false;
        } else if (timeRangeFilter === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (d < monthAgo) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Sort by most recent first (descending order)
      const timestampA = a.created_at || a.timestamp || a.time;
      const timestampB = b.created_at || b.timestamp || b.time;
      
      if (!timestampA && !timestampB) return 0;
      if (!timestampA) return 1; // Put items without timestamp at the end
      if (!timestampB) return -1; // Put items without timestamp at the end
      
      try {
        const dateA = new Date(timestampA);
        const dateB = new Date(timestampB);
        
        // If either date is invalid, put it at the end
        if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        
        // Sort by most recent first (newest to oldest)
        return dateB.getTime() - dateA.getTime();
      } catch (error) {
        console.warn('Error sorting reports by date:', error);
        return 0;
      }
    });
    // Safety: if filtering produced zero results but we actually have reports, log and return original
    if (result.length === 0 && reports.length > 0) {
      console.log('[AOverview] filter returned 0 but reports length =', reports.length, {
        statusFilter,
        timeRangeFilter,
        searchQuery
      });
    }
    return result;
  }, [reports, searchQuery, statusFilter, timeRangeFilter, isNoFireNoSmoke]);

  // Separate list for invalidated "No Fire/No Smoke" reports
  const invalidatedReports = useMemo(() => {
    return reports.filter((r) => {
      // Only show invalidated reports
      if (!r.invalidated) {
        return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const location = (r.address || r.geotag_location || '').toLowerCase();
        const reporter = (r.reporter || '').toLowerCase();
        if (!(location.includes(q) || reporter.includes(q))) return false;
      }

      return true;
    }).sort((a, b) => {
      const timestampA = a.invalidated_at || a.created_at || a.timestamp || a.time;
      const timestampB = b.invalidated_at || b.created_at || b.timestamp || b.time;
      
      if (!timestampA && !timestampB) return 0;
      if (!timestampA) return 1;
      if (!timestampB) return -1;
      
      try {
        const dateA = new Date(timestampA);
        const dateB = new Date(timestampB);
        
        if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        
        return dateB.getTime() - dateA.getTime();
      } catch (error) {
        return 0;
      }
    });
  }, [reports, searchQuery]);

  const stats = useMemo(() => {
    const normalizePred = (p) => {
      const s = String(p || '').toLowerCase().trim().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!s) return 'unknown';
      if (s.includes('no') && s.includes('fire')) return 'no fire';
      if (s.includes('fire')) return 'fire';
      return s;
    };
    // Count from ALL reports, not just filtered ones
    const activeReportsOnly = reports.filter((r) => !r.invalidated);
    const active = activeReportsOnly.filter((r) => {
      const st = String(r.status || '').toLowerCase();
      return st.includes('on going') || st.includes('ongoing') || st.includes('under control');
    }).length;
    const fire = activeReportsOnly.filter((r) => normalizePred(r.prediction) === 'fire').length;
    const noFire = activeReportsOnly.filter((r) => normalizePred(r.prediction) === 'no fire').length;
    return { active, fire, noFire };
  }, [reports]);

  const getSafeImageUri = (uri) => {
    if (!uri || typeof uri !== 'string') return null;
    // iOS blocks http by default; try to upgrade to https if possible
    if (Platform.OS === 'ios' && uri.startsWith('http://')) {
      return uri.replace('http://', 'https://');
    }
    return uri;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 16 }}>Emergency Reports Overview</Text>

        <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <View style={{
            backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 0,
            shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3
          }}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search reports by location, reporter, cause, or structure type..."
              placeholderTextColor="#94a3b8"
              style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a' }}
            />
          </View>

          {/* Status Filter Chips (match Stations UI) */}
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            {['All', 'On Going', 'Under Control', 'Fire Out'].map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatusFilter(s)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  marginRight: 8,
                  backgroundColor: statusFilter === s ? '#fee2e2' : '#f1f5f9'
                }}
              >
                <Text style={{ color: statusFilter === s ? '#b91c1c' : '#334155', fontWeight: '600' }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#ef4444' }}>{stats.active}</Text>
            <Text style={{ color: '#64748b', marginTop: 4 }}>Active Reports</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#ef4444' }}>{stats.fire}</Text>
            <Text style={{ color: '#64748b', marginTop: 4 }}>Fire Detected</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#ef4444' }}>{stats.noFire}</Text>
            <Text style={{ color: '#64748b', marginTop: 4 }}>No Fire</Text>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: '#e2e8f0', marginBottom: 12 }} />

        {/* Tab Navigation - Improved 2-Tab Design */}
        <View style={{ 
          backgroundColor: 'white', 
          borderRadius: 16, 
          padding: 6, 
          marginBottom: 20,
          flexDirection: 'row',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3
        }}>
          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: 16,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: activeTab === 'active' ? '#dc2626' : 'transparent',
              alignItems: 'center',
              marginRight: 4,
            }}
            onPress={() => setActiveTab('active')}
          >
            <Text style={{
              color: activeTab === 'active' ? 'white' : '#64748b',
              fontWeight: '800',
              fontSize: 15,
              letterSpacing: 0.5,
            }}>
              Active Reports
            </Text>
            <Text style={{
              color: activeTab === 'active' ? 'white' : '#9ca3af',
              fontWeight: '700',
              fontSize: 18,
              marginTop: 4,
            }}>
              {reports.filter(r => !r.invalidated).length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: 16,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: activeTab === 'invalidated' ? '#f97316' : 'transparent',
              alignItems: 'center',
              marginLeft: 4,
            }}
            onPress={() => setActiveTab('invalidated')}
          >
            <Text style={{
              color: activeTab === 'invalidated' ? 'white' : '#64748b',
              fontWeight: '800',
              fontSize: 15,
              letterSpacing: 0.5,
            }}>
              Invalidated
            </Text>
            <Text style={{
              color: activeTab === 'invalidated' ? 'white' : '#9ca3af',
              fontWeight: '700',
              fontSize: 18,
              marginTop: 4,
            }}>
              {invalidatedReports.length}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Reports Tab Content */}
        {activeTab === 'active' && (
          <>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8 }}>Active Fire Reports</Text>
            
            {/* Mobile-Friendly Report Cards */}
            {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#6b7280' }}>Loading reports...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center' }}>No active fire reports</Text>
          </View>
        ) : (
          filtered.slice(0, 10).map((r) => (
            <View
              key={r.id}
              style={{
                backgroundColor: 'white',
                borderRadius: 12,
                marginBottom: 12,
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
                position: 'relative',
              }}
            >
              {/* Content Area */}
              <View style={{ padding: 16 }}>
                {/* Header Row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>
                      {r.reporter || r.user_name || 'Anonymous Reporter'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>
                      {(() => {
                        const timestamp = r.created_at || r.timestamp || r.time;
                        if (!timestamp) return 'Unknown time';
                        try {
                          const date = new Date(timestamp);
                          if (isNaN(date.getTime())) return 'Unknown time';
                          return date.toLocaleString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', hour12: true
                          });
                        } catch {
                          return 'Unknown time';
                        }
                      })()}
                    </Text>
                  </View>
                  <View style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: r.status === 'On Going' ? '#fef2f2' : r.status === 'Under Control' ? '#fef3c7' : r.status === 'Fire Out' ? '#d1fae5' : '#f3f4f6',
                  }}>
                    <Text style={{
                      color: r.status === 'On Going' ? '#dc2626' : r.status === 'Under Control' ? '#d97706' : r.status === 'Fire Out' ? '#059669' : '#6b7280',
                      fontWeight: '600',
                      fontSize: 12
                    }}>
                      {r.status || 'Unknown'}
                    </Text>
                  </View>
                </View>

                {/* No Station Assigned badge */}
                {!assignedStationReportIds.has(String(r.id)) && (
                  <View style={{
                    backgroundColor: '#fef3c7',
                    borderWidth: 1,
                    borderColor: '#fde68a',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    alignSelf: 'flex-start',
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <MaterialIcons name="warning-amber" size={14} color="#d97706" />
                    <Text style={{ marginLeft: 6, color: '#92400e', fontWeight: '700', fontSize: 12 }}>No station assigned</Text>
                  </View>
                )}

                {/* Location */}
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 12 }} numberOfLines={2}>
                  📍 {r.address || 'No address'}
                </Text>

                {/* Alarm Levels Row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Suggested Alarm:</Text>
                    <View style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: '#f3f4f6',
                      alignSelf: 'flex-start'
                    }}>
                      <Text style={{
                        color: '#6b7280',
                        fontWeight: '500',
                        fontSize: 12
                      }}>
                        {(() => {
                          const aiOverride = chatAlarmByReport[String(r.id)];
                          const level = aiOverride || r.recommended_alarm_level || r.alarm_level || 'Unknown';
                          return formatAlarmLevel(level);
                        })()}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Final Alarm:</Text>
                    <View style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: '#dbeafe',
                      alignSelf: 'flex-start'
                    }}>
                      <Text style={{
                        color: '#1d4ed8',
                        fontWeight: '600',
                        fontSize: 12
                      }}>
                        {r.final_alarm_level || '1st Alarm'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Actions Row - consistent button design */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingBottom: 16,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: '#f3f4f6',
                gap: 8
              }}>
                <TouchableOpacity
                  onPress={() => setSelectedReport(r)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: '#6b7280',
                    alignItems: 'center',
                    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>Details</Text>
                </TouchableOpacity>
                {String(r.status || '').toLowerCase().includes('fire out') && (
                  <TouchableOpacity
                    onPress={() => loadSummaryData(r.id)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: '#10b981',
                      alignItems: 'center',
                      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>PDF</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    console.log('[Edit Button] Setting editReport to:', r);
                    setEditReport(r);
                    setShowEditModal(true);
                    console.log('[Edit Button] showEditModal set to true');
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: '#ef4444',
                    alignItems: 'center',
                    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
          </>
        )}

        {/* Invalidated Tab Content */}
        {activeTab === 'invalidated' && (
          <>
            <View style={{ 
              backgroundColor: '#fee2e2', 
              borderRadius: 12, 
              padding: 16, 
              marginBottom: 16,
              borderWidth: 2,
              borderColor: '#fecaca'
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <MaterialIcons name="error-outline" size={24} color="#dc2626" />
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#7f1d1d', marginLeft: 8 }}>
                  Invalidated Reports
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: '#7f1d1d', marginBottom: 12 }}>
                These reports were flagged as AI misclassifications. Review the images to confirm if they should remain invalid or be restored.
              </Text>
              
              {invalidatedReports.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center', backgroundColor: 'white', borderRadius: 12 }}>
                  <Text style={{ fontSize: 16, color: '#7f1d1d', textAlign: 'center' }}>No invalidated reports</Text>
                </View>
              ) : (
                invalidatedReports.map((r) => (
                  <View
                    key={r.id}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: 12,
                      marginBottom: 12,
                      shadowColor: '#000',
                      shadowOpacity: 0.05,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 2,
                    }}
                  >
                    <View style={{ padding: 16 }}>
                      {/* Header Row */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>
                            {r.reporter || r.user_name || 'Anonymous Reporter'}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#6b7280' }}>
                            Invalidated: {(() => {
                              const timestamp = r.invalidated_at;
                              if (!timestamp) return 'Unknown';
                              try {
                                const date = new Date(timestamp);
                                if (isNaN(date.getTime())) return 'Unknown';
                                return date.toLocaleString('en-US', {
                                  year: 'numeric', month: 'short', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit', hour12: true
                                });
                              } catch {
                                return 'Unknown';
                              }
                            })()}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                            By: {r.invalidated_by || 'Unknown'}
                          </Text>
                        </View>
                        <View style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 16,
                          backgroundColor: '#fee2e2',
                        }}>
                          <Text style={{
                            color: '#dc2626',
                            fontWeight: '600',
                            fontSize: 12
                          }}>
                            Invalid
                          </Text>
                        </View>
                      </View>

                      {/* Location */}
                      <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 12 }} numberOfLines={2}>
                        📍 {r.address || 'No address'}
                      </Text>

                      {/* Invalidation Reason */}
                      {r.invalidation_reason && (
                        <View style={{ 
                          backgroundColor: '#fff7ed', 
                          borderRadius: 8, 
                          padding: 10, 
                          marginBottom: 12,
                          borderWidth: 1,
                          borderColor: '#fed7aa'
                        }}>
                          <Text style={{ fontSize: 11, color: '#9a3412', fontWeight: '600', marginBottom: 4 }}>
                            Invalidation Reason:
                          </Text>
                          <Text style={{ fontSize: 12, color: '#7c2d12' }}>
                            {r.invalidation_reason}
                          </Text>
                        </View>
                      )}

                      {/* Image Preview */}
                      {r.image_url && (
                        <View style={{ marginBottom: 12 }}>
                          <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: '600', marginBottom: 6 }}>
                            Review Image:
                          </Text>
                          <Image
                            source={{ uri: getSafeImageUri(r.image_url) }}
                            style={{ width: '100%', height: 200, borderRadius: 8 }}
                            resizeMode="cover"
                            onError={() => { /* swallow image errors */ }}
                          />
                        </View>
                      )}

                      {/* AI Analysis */}
                      {(r.prediction || r.smoke_detection) && (
                        <View style={{ 
                          backgroundColor: '#f0f9ff', 
                          borderRadius: 8, 
                          padding: 10, 
                          borderWidth: 1,
                          borderColor: '#bfdbfe'
                        }}>
                          <Text style={{ fontSize: 11, color: '#1e40af', fontWeight: '600', marginBottom: 6 }}>
                            AI Analysis Results (Review Required)
                          </Text>
                          {r.prediction && (
                            <Text style={{ fontSize: 12, color: '#374151', marginBottom: 2 }}>
                              🔥 Fire Detection: {r.prediction} {r.confidence ? `(${(parseFloat(r.confidence) * 100).toFixed(1)}%)` : ''}
                            </Text>
                          )}
                          {r.smoke_detection && (
                            <Text style={{ fontSize: 12, color: '#374151' }}>
                              💨 Smoke Detection: {r.smoke_detection} {r.smoke_confidence ? `(${(parseFloat(r.smoke_confidence) * 100).toFixed(1)}%)` : ''}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Actions Row */}
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingBottom: 16,
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: '#f3f4f6',
                      gap: 8
                    }}>
                      <TouchableOpacity
                        onPress={() => setSelectedReport(r)}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 10,
                          backgroundColor: '#6b7280',
                          alignItems: 'center',
                          shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2
                        }}
                      >
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>View Details</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRestoreReport(r.id)}
                        disabled={isInvalidating}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 10,
                          backgroundColor: isInvalidating ? '#9ca3af' : '#10b981',
                          alignItems: 'center',
                          shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2
                        }}
                      >
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>
                          {isInvalidating ? 'Restoring...' : 'Restore Report'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={!!selectedReport} transparent animationType="fade" onRequestClose={() => setSelectedReport(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, maxWidth: 600, width: '100%', maxHeight: '90%' }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: 16, paddingBottom: 12 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a' }}>Emergency Report Details</Text>
                <TouchableOpacity onPress={() => setSelectedReport(null)} style={{ padding: 6 }}>
                  <Text style={{ fontWeight: '800', color: '#334155', fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {selectedReport && (
                <View style={{ paddingHorizontal: 16 }}>
                  {/* Picture */}
                  {getSafeImageUri(selectedReport.image_url) && (
                    <View style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 20, alignItems: 'center' }}>
                      <Image
                        source={{ uri: getSafeImageUri(selectedReport.image_url) }}
                        style={{ width: '100%', height: 200, borderRadius: 8 }}
                        resizeMode="cover"
                        onError={() => { /* swallow image errors */ }}
                      />
                    </View>
                  )}

                  {/* Basic Information */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Reporter:</Text>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a' }}>
                        {selectedReport.reporter || selectedReport.user_name || 'Anonymous Reporter'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Reported:</Text>
                      <Text style={{ fontSize: 16, color: '#6b7280' }}>
                        {(() => {
                          const timestamp = selectedReport.created_at || selectedReport.timestamp;
                          if (!timestamp) return 'Unknown';
                          try {
                            const date = new Date(timestamp);
                            if (isNaN(date.getTime())) return String(timestamp);
                            return date.toLocaleString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit', hour12: true
                            });
                          } catch {
                            return String(timestamp);
                          }
                        })()}
                      </Text>
                    </View>
                  </View>

                  {/* Location */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Location:</Text>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 }}>
                      {selectedReport.address || selectedReport.geotag_location || 'No address'}
                    </Text>
                    {selectedReport.latitude && selectedReport.longitude && (
                      <Text style={{ fontSize: 14, color: '#6b7280' }}>
                        Coordinates: {parseFloat(selectedReport.latitude).toFixed(6)}, {parseFloat(selectedReport.longitude).toFixed(6)}
                      </Text>
                    )}
                  </View>

                  {/* Cause of Fire */}
                  {selectedReport.cause_of_fire && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Cause of Fire:</Text>
                      <Text style={{ fontSize: 16, color: '#0f172a', lineHeight: 24 }}>
                        {selectedReport.cause_of_fire}
                      </Text>
                    </View>
                  )}

                  {/* AI Analysis Results */}
                  <View style={{ backgroundColor: '#eff6ff', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e40af', marginBottom: 16 }}>AI Analysis Results</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                      <View style={{ width: '48%', marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e40af', marginBottom: 4 }}>Fire Detection:</Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e40af' }}>
                          {selectedReport.prediction || 'Unknown'} {selectedReport.confidence ? `(${selectedReport.confidence})` : ''}
                        </Text>
                      </View>
                      <View style={{ width: '48%', marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e40af', marginBottom: 4 }}>Structure Type:</Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e40af' }}>
                          {selectedReport.structure || 'Unknown'} {selectedReport.structure_confidence ? `(${selectedReport.structure_confidence})` : ''}
                        </Text>
                      </View>
                      <View style={{ width: '48%', marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e40af', marginBottom: 4 }}>Smoke Intensity:</Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e40af' }}>
                          {selectedReport.smoke_detection || 'Unknown'} {selectedReport.smoke_confidence ? `(${selectedReport.smoke_confidence})` : ''}
                        </Text>
                      </View>
                      <View style={{ width: '48%', marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e40af', marginBottom: 4 }}>Structures Affected:</Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e40af' }}>
                          {selectedReport.number_of_structures_on_fire || 'Not specified'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Status and Alarm Levels */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Current Status:</Text>
                      <View style={{ 
                        backgroundColor: selectedReport.status === 'On Going' ? '#fef2f2' : '#f0f9ff',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: selectedReport.status === 'On Going' ? '#fecaca' : '#bae6fd'
                      }}>
                        <Text style={{ 
                          fontSize: 16, 
                          fontWeight: '600', 
                          color: selectedReport.status === 'On Going' ? '#dc2626' : '#0369a1'
                        }}>
                          {selectedReport.status || 'Unknown'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Alarm Level:</Text>
                      <View style={{ 
                        backgroundColor: '#fef3c7',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#fde68a'
                      }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#d97706' }}>
                          {selectedReport.recommended_alarm_level || selectedReport.alarm_level || 'Unknown'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Assign/Forward to Station */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                      {currentStationAssignment ? 'Forward to Station:' : 'Assign to Station:'}
                    </Text>
                    
                    {/* Show currently assigned station if exists */}
                    {currentStationAssignment && (
                      <View style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e40af', marginBottom: 4 }}>
                          Currently Assigned To:
                        </Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e3a8a' }}>
                          {currentStationAssignment.stationName}
                        </Text>
                        {currentStationAssignment.status === 'pending' && (
                          <Text style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>
                            ⏳ Awaiting Station Confirmation
                          </Text>
                        )}
                        {currentStationAssignment.status === 'accepted' && (
                          <Text style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>
                            ✅ Station Accepted
                          </Text>
                        )}
                      </View>
                    )}
                    
                    <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, overflow: 'hidden' }}>
                      <ScrollView 
                        style={{ maxHeight: 180 }} 
                        nestedScrollEnabled={true}
                        showsVerticalScrollIndicator={true}
                      >
                        {(stations || []).map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            onPress={() => setAssignStationId(s.id)}
                            style={{ paddingVertical: 10, paddingHorizontal: 12, backgroundColor: assignStationId === s.id ? '#dbeafe' : 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}
                          >
                            <Text style={{ color: '#0f172a', fontWeight: assignStationId === s.id ? '700' : '500' }}>
                              {s.station_name || 'Station'}
                            </Text>
                            {s.email ? (
                              <Text style={{ color: '#6b7280', fontSize: 12 }}>{s.email}</Text>
                            ) : null}
                          </TouchableOpacity>
                        ))}
                        {(!stations || stations.length === 0) && (
                          <View style={{ padding: 12 }}>
                            <Text style={{ color: '#6b7280' }}>No stations found.</Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                    <TouchableOpacity
                      onPress={async () => {
                        if (!assignStationId || !selectedReport?.id) return;
                        try {
                          setIsAssigning(true);
                          
                          // Check if station is busy
                          const busyCheck = await checkStationIsBusy(assignStationId);
                          
                          if (busyCheck.isBusy) {
                            // Station is busy - set assignment to pending and show waiting modal
                            // First, delete any existing assignment for this report to avoid conflicts
                            await supabase
                              .from('report_assignments')
                              .delete()
                              .eq('report_id', String(selectedReport.id))
                              .eq('assignee_type', 'station');
                            
                            const payload = {
                              report_id: String(selectedReport.id),
                              assignee_type: 'station',
                              assignee_id: assignStationId,
                              assigned_at: new Date().toISOString(),
                              status: 'pending',
                              assignment_source: 'manual',
                              note: currentStationAssignment ? `Forwarded from ${currentStationAssignment.stationName}` : null
                            };
                            
                            // Use insert instead of upsert to ensure INSERT listener is triggered
                            const { error } = await supabase
                              .from('report_assignments')
                              .insert(payload);
                            
                            if (error) {
                              // Check if error is due to missing columns (migration not run)
                              if (error.message && (error.message.includes('column') && error.message.includes('does not exist'))) {
                                Alert.alert('Database Migration Required', 'Please run the migration SQL file (assignment-status-migration.sql) in your Supabase SQL Editor first.');
                                setIsAssigning(false);
                                return;
                              }
                              throw error;
                            }

                            // Get station name for modal
                            const { data: stationData } = await supabase
                              .from('station_users')
                              .select('station_name')
                              .eq('id', assignStationId)
                              .single();

                            setPendingAssignment({
                              reportId: String(selectedReport.id),
                              stationId: assignStationId,
                              stationName: stationData?.station_name || 'Station'
                            });
                            setShowWaitingApprovalModal(true);

                            // Create notification for the assigned station
                            const locationInfo = selectedReport.address || selectedReport.geotag_location || 'Location unavailable';
                            const reporterName = selectedReport.reporter_name || selectedReport.reporter || 'Unknown Reporter';
                            const title = `🚨 New Fire Report Assignment - Action Required`;
                            const message = `Command Center is ${currentStationAssignment ? 'forwarding' : 'assigning'} you a report.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}\n\nWill you accept this assignment?`;
                            
                            await supabase
                              .from('notifications')
                              .insert({
                                user_id: assignStationId,
                                user_type: 'station',
                                type: 'assignment',
                                related_report_id: String(selectedReport.id),
                                title: title,
                                message: message,
                                priority: 'urgent',
                                is_read: false
                              });

                            // Mark this report as assigned locally for the badge
                            setAssignedStationReportIds(prev => {
                              const next = new Set(prev);
                              next.add(String(selectedReport.id));
                              return next;
                            });
                            
                            // Refresh the current assignment
                            const { data: newAssignment } = await supabase
                              .from('report_assignments')
                              .select('assignee_id, status')
                              .eq('report_id', String(selectedReport.id))
                              .eq('assignee_type', 'station')
                              .in('status', ['accepted', 'pending'])
                              .order('assigned_at', { ascending: false })
                              .limit(1)
                              .single();
                            
                            if (newAssignment) {
                              const { data: newStationData } = await supabase
                                .from('station_users')
                                .select('station_name')
                                .eq('id', newAssignment.assignee_id)
                                .single();
                              
                              setCurrentStationAssignment({
                                stationId: newAssignment.assignee_id,
                                stationName: newStationData?.station_name || 'Unknown Station',
                                status: newAssignment.status
                              });
                            }
                            
                            setAssignStationId(null);
                            setIsAssigning(false);
                            return; // Don't show success alert, modal will handle it
                          }
                          
                          // Station is not busy - auto-accept assignment
                          // First, delete any existing assignment for this report
                          await supabase
                            .from('report_assignments')
                            .delete()
                            .eq('report_id', String(selectedReport.id))
                            .eq('assignee_type', 'station');
                          
                          const payload = {
                            report_id: String(selectedReport.id),
                            assignee_type: 'station',
                            assignee_id: assignStationId,
                            assigned_at: new Date().toISOString(),
                            status: 'accepted',
                            assignment_source: 'manual',
                            note: currentStationAssignment ? `Forwarded from ${currentStationAssignment.stationName}` : null
                          };
                          
                          const { error } = await supabase
                            .from('report_assignments')
                            .insert(payload);
                          
                          if (error) {
                            // Check if error is due to missing columns (migration not run)
                            if (error.message && (error.message.includes('column') && error.message.includes('does not exist'))) {
                              Alert.alert('Database Migration Required', 'Please run the migration SQL file (assignment-status-migration.sql) in your Supabase SQL Editor first.');
                              setIsAssigning(false);
                              return;
                            }
                            throw error;
                          }
                          
                          // Get station name for success message
                          const { data: stationData } = await supabase
                            .from('station_users')
                            .select('station_name')
                            .eq('id', assignStationId)
                            .single();

                          const stationName = stationData?.station_name || 'Station';
                          
                          // Create notification for the assigned station (even though auto-accepted, still notify)
                          const locationInfo = selectedReport.address || selectedReport.geotag_location || 'Location unavailable';
                          const reporterName = selectedReport.reporter_name || selectedReport.reporter || 'Unknown Reporter';
                          const title = `🚨 New Fire Report Assignment`;
                          const message = `You have been assigned a new fire report.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}`;
                          
                          await supabase
                            .from('notifications')
                            .insert({
                              user_id: assignStationId,
                              user_type: 'station',
                              type: 'assignment',
                              related_report_id: String(selectedReport.id),
                              title: title,
                              message: message,
                              priority: 'urgent',
                              is_read: false
                            });
                          
                          // Refresh the current assignment
                          const { data: newAssignment } = await supabase
                            .from('report_assignments')
                            .select('assignee_id, status')
                            .eq('report_id', String(selectedReport.id))
                            .eq('assignee_type', 'station')
                            .in('status', ['accepted', 'pending'])
                            .order('assigned_at', { ascending: false })
                            .limit(1)
                            .single();
                          
                          if (newAssignment) {
                            const { data: newStationData } = await supabase
                              .from('station_users')
                              .select('station_name')
                              .eq('id', newAssignment.assignee_id)
                              .single();
                            
                            setCurrentStationAssignment({
                              stationId: newAssignment.assignee_id,
                              stationName: newStationData?.station_name || 'Unknown Station',
                              status: newAssignment.status
                            });
                          }
                          
                          Alert.alert('✅ Assignment Successful', `Assignment successfully assigned to ${stationName}.`);
                          // Mark this report as assigned locally for the badge
                          setAssignedStationReportIds(prev => {
                            const next = new Set(prev);
                            next.add(String(selectedReport.id));
                            return next;
                          });
                          
                          setAssignStationId(null);
                        } catch (e) {
                          Alert.alert('Error', e.message || `Failed to ${currentStationAssignment ? 'forward' : 'assign'} station`);
                        } finally {
                          setIsAssigning(false);
                        }
                      }}
                      disabled={!assignStationId || isAssigning}
                      style={{ marginTop: 10, backgroundColor: !assignStationId || isAssigning ? '#9ca3af' : '#ef4444', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                    >
                      <Text style={{ color: 'white', fontWeight: '700' }}>
                        {isAssigning ? (currentStationAssignment ? 'Forwarding...' : 'Assigning...') : (currentStationAssignment ? 'Forward Station' : 'Assign Station')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Backup Station Assignment - Only show if alarm level 2+ and primary station exists */}
                  {currentStationAssignment && (() => {
                    const alarmLevel = resolveAlarmLevel(selectedReport);
                    const alarmLevelLower = alarmLevel.toLowerCase();
                    const isAlarmLevel2Plus = alarmLevel && (
                      alarmLevelLower.includes('second alarm') ||
                      alarmLevelLower.includes('2nd alarm') ||
                      alarmLevelLower.includes('third alarm') ||
                      alarmLevelLower.includes('3rd alarm') ||
                      alarmLevelLower.includes('fourth alarm') ||
                      alarmLevelLower.includes('4th alarm') ||
                      alarmLevelLower.includes('fifth alarm') ||
                      alarmLevelLower.includes('5th alarm') ||
                      alarmLevelLower.includes('task force alpha') ||
                      alarmLevelLower.includes('task force bravo') ||
                      alarmLevelLower.includes('task force charlie') ||
                      alarmLevelLower.includes('task force delta') ||
                      alarmLevelLower.includes('general alarm')
                    );

                    return isAlarmLevel2Plus && (
                      <View style={{ marginBottom: 20, backgroundColor: '#faf5ff', borderLeftWidth: 4, borderLeftColor: '#a855f7', borderRadius: 8, padding: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#7e22ce', marginBottom: 4 }}>
                          🚨 {alarmLevel} - Assign Backup Station
                        </Text>
                        <Text style={{ fontSize: 12, color: '#6b21a8', marginBottom: 12 }}>
                          This incident requires backup support. Backup stations can view and support but cannot change the fire status.
                        </Text>

                        {/* Show all assigned stations */}
                        {allAssignedStations.length > 0 && (
                          <View style={{ backgroundColor: '#f3e8ff', borderRadius: 6, padding: 10, marginBottom: 12 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#7e22ce', marginBottom: 6 }}>
                              All Assigned Stations:
                            </Text>
                            {allAssignedStations.map((station, idx) => (
                              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: idx > 0 ? 8 : 0, paddingTop: idx > 0 ? 8 : 0, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#e9d5ff' }}>
                                <Text style={{ fontSize: 14, color: '#581c87', fontWeight: '600' }}>
                                  {station.name}
                                </Text>
                                <View style={{ backgroundColor: station.role === 'primary' ? '#3b82f6' : '#a855f7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                  <Text style={{ fontSize: 10, color: 'white', fontWeight: '700' }}>
                                    {station.role === 'primary' ? 'PRIMARY' : 'BACKUP'}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        <View style={{ borderWidth: 1, borderColor: '#d8b4fe', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                          <ScrollView 
                            style={{ maxHeight: 120 }} 
                            nestedScrollEnabled={true}
                            showsVerticalScrollIndicator={true}
                          >
                            {(stations || [])
                              .filter(s => !allAssignedStations.some(assigned => assigned.id === s.id))
                              .map((s) => (
                              <TouchableOpacity
                                key={s.id}
                                onPress={() => setBackupStationId(s.id)}
                                style={{ 
                                  paddingVertical: 10, 
                                  paddingHorizontal: 12, 
                                  backgroundColor: backupStationId === s.id ? '#e9d5ff' : 'white', 
                                  borderBottomWidth: 1, 
                                  borderBottomColor: '#e9d5ff' 
                                }}
                              >
                                <Text style={{ color: '#581c87', fontWeight: backupStationId === s.id ? '700' : '500' }}>
                                  {s.station_name || 'Station'}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>

                        <TouchableOpacity
                          onPress={handleAssignBackup}
                          disabled={!backupStationId}
                          style={{ 
                            backgroundColor: !backupStationId ? '#9ca3af' : '#a855f7', 
                            paddingVertical: 10, 
                            borderRadius: 8, 
                            alignItems: 'center' 
                          }}
                        >
                          <Text style={{ color: 'white', fontWeight: '700' }}>
                            Assign Backup Station
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })()}

                  {/* Full Timestamp */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Full Timestamp:</Text>
                    <Text style={{ fontSize: 16, color: '#0f172a' }}>
                      {(() => {
                        const timestamp = selectedReport.created_at || selectedReport.timestamp;
                        if (!timestamp) return 'Unknown';
                        try {
                          const date = new Date(timestamp);
                          if (isNaN(date.getTime())) return String(timestamp);
                          return date.toLocaleString('en-US', {
                            year: 'numeric', month: 'long', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                          });
                        } catch {
                          return String(timestamp);
                        }
                      })()}
                    </Text>
                  </View>

                  {/* Assigned Responder(s) */}
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Assigned Responder(s):</Text>
                    <View style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, padding: 12 }}>
                      {isLoadingAssigned ? (
                        <Text style={{ fontSize: 16, color: '#6b7280' }}>Loading...</Text>
                      ) : assignedResponders.length > 0 ? (
                        assignedResponders.map(r => (
                          <View key={r.id} style={{ paddingVertical: 6 }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e3a8a' }}>
                              {(r.first_name || '') + (r.last_name ? ` ${r.last_name}` : '') || 'Responder'}
                            </Text>
                            {!!r.email && (
                              <Text style={{ fontSize: 12, color: '#1e40af' }}>{r.email}</Text>
                            )}
                            {!!r.phone && (
                              <Text style={{ fontSize: 12, color: '#1e40af' }}>{r.phone}</Text>
                            )}
                          </View>
                        ))
                      ) : (
                        <Text style={{ fontSize: 14, color: '#1e40af' }}>No responder assigned yet.</Text>
                      )}
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => setSelectedReport(null)}
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        borderRadius: 10,
                        backgroundColor: '#6b7280',
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOpacity: 0.06,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 2
                      }}
                    >
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        handleReInvalidateReport(selectedReport.id);
                        setSelectedReport(null);
                      }}
                      disabled={isInvalidating}
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        borderRadius: 10,
                        backgroundColor: isInvalidating ? '#9ca3af' : '#ef4444',
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOpacity: 0.06,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 2
                      }}
                    >
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                        {isInvalidating ? 'Processing...' : 'Invalidate'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
            
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => {
        console.log('[Edit Modal] onRequestClose called');
        setShowEditModal(false);
        setEditReport(null);
      }}>
        {console.log('[Edit Modal] Modal visible:', showEditModal, 'selectedReport:', selectedReport)}
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, width: '100%', maxWidth: 400, minHeight: 300 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Edit Report</Text>
              <TouchableOpacity onPress={() => {
                console.log('[Edit Modal] Close button pressed');
                setShowEditModal(false);
                setEditReport(null);
              }} style={{ padding: 4 }}>
                <Text style={{ fontWeight: '800', color: '#334155', fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            
            
            {editReport ? (
              <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                {console.log('[Edit Modal] Rendering with editReport:', editReport.id, editReport)}
                
                {/* Test Content */}
                <View style={{ marginBottom: 20, padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Report ID:</Text>
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>{editReport.id}</Text>
                </View>

                {/* Final Alarm Level Selection */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Final Alarm Level:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginRight: 8, marginBottom: 8, gap: 8 }}>
                    {['1st Alarm', '2nd Alarm', '3rd Alarm', '4th Alarm', '5th Alarm', 'TASK FORCE ALPHA', 'TASK FORCE BRAVO', 'TASK FORCE CHARLIE', 'TASK FORCE DELTA', 'GENERAL ALARM'].map((alarm) => (
                      <TouchableOpacity
                        key={alarm}
                        onPress={() => {
                          console.log('[Alarm Button] Pressed:', alarm);
                          handleAlarmChangeClick(alarm);
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 6,
                          backgroundColor: (editReport.final_alarm_level || editReport.recommended_alarm_level) === alarm ? '#f59e0b' : '#f3f4f6',
                          borderWidth: 1,
                          borderColor: (editReport.final_alarm_level || editReport.recommended_alarm_level) === alarm ? '#f59e0b' : '#d1d5db',
                          marginRight: 8,
                          marginBottom: 8
                        }}
                        disabled={isUpdating}
                      >
                        <Text style={{
                          color: (editReport.final_alarm_level || editReport.recommended_alarm_level) === alarm ? 'white' : '#374151',
                          fontWeight: '600',
                          fontSize: 12
                        }}>
                          {alarm}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {isUpdating && (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <Text style={{ color: '#6b7280', fontSize: 14 }}>Updating...</Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, color: '#6b7280' }}>No report selected for editing</Text>
                {console.log('[Edit Modal] editReport is null or undefined')}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Cancel Modal */}
      <Modal visible={showCancelModal} transparent animationType="fade" onRequestClose={() => {
        setShowCancelModal(false);
        setCancelReport(null);
        setCancelReason('');
      }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, width: '100%', maxWidth: 400 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Cancel Report</Text>
              <TouchableOpacity onPress={() => {
                setShowCancelModal(false);
                setCancelReport(null);
                setCancelReason('');
              }} style={{ padding: 4 }}>
                <Text style={{ fontWeight: '800', color: '#334155', fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Reason for Cancellation:</Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  color: '#374151',
                  minHeight: 100,
                  textAlignVertical: 'top'
                }}
                placeholder="Please provide a reason for cancelling this report..."
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
                numberOfLines={4}
              />
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowCancelModal(false);
                    setCancelReport(null);
                    setCancelReason('');
                  }}
                  style={{
                    backgroundColor: '#6b7280',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    flex: 1,
                    marginRight: 8
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Final Confirmation',
                      `Are you absolutely sure you want to cancel this report?\n\nReason: "${cancelReason}"\n\nThis action cannot be undone.`,
                      [
                        { text: 'Back', style: 'cancel' },
                        { 
                          text: 'Cancel Report', 
                          style: 'destructive',
                          onPress: handleCancelReport
                        }
                      ]
                    );
                  }}
                  disabled={!cancelReason.trim() || isCancelling}
                  style={{
                    backgroundColor: !cancelReason.trim() || isCancelling ? '#9ca3af' : '#ef4444',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    flex: 1,
                    marginLeft: 8
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                    {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Status Change Confirmation Modal */}
      <Modal visible={showStatusConfirmModal} transparent animationType="fade" onRequestClose={() => setShowStatusConfirmModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24, width: '85%', maxWidth: 400 }}>
            {/* Icon */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24, color: 'white' }}>⚠️</Text>
              </View>
            </View>
            
            {/* Title */}
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', textAlign: 'center', marginBottom: 8 }}>
              Confirm Status Change
            </Text>
            
            {/* Message */}
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              Are you sure you want to change the status from{' '}
              <Text style={{ fontWeight: '600', color: '#374151' }}>"{pendingStatusChange?.currentStatus}"</Text> to{' '}
              <Text style={{ fontWeight: '600', color: '#3b82f6' }}>"{pendingStatusChange?.status}"</Text>?
            </Text>
            
            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#f3f4f6',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
                onPress={() => setShowStatusConfirmModal(false)}
              >
                <Text style={{ color: '#374151', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#3b82f6',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
                onPress={confirmStatusChange}
              >
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alarm Level Change Confirmation Modal */}
      <Modal visible={showAlarmConfirmModal} transparent animationType="fade" onRequestClose={() => setShowAlarmConfirmModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24, width: '85%', maxWidth: 400 }}>
            {/* Icon */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24, color: 'white' }}>🚨</Text>
              </View>
            </View>
            
            {/* Title */}
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', textAlign: 'center', marginBottom: 8 }}>
              Confirm Alarm Level Change
            </Text>
            
            {/* Message */}
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              Are you sure you want to change the final alarm level from{' '}
              <Text style={{ fontWeight: '600', color: '#374151' }}>"{pendingAlarmChange?.currentAlarm}"</Text> to{' '}
              <Text style={{ fontWeight: '600', color: '#f59e0b' }}>"{pendingAlarmChange?.alarm}"</Text>?
            </Text>
            
            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#f3f4f6',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
                onPress={() => setShowAlarmConfirmModal(false)}
              >
                <Text style={{ color: '#374151', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#f59e0b',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
                onPress={confirmAlarmChange}
              >
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reroute Modal - Station Too Busy */}
      <Modal
        visible={showRerouteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowRerouteModal(false);
          setSelectedRerouteStation('');
          setPendingAssignment(null);
          setStationActiveCounts({});
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500, maxHeight: '80%' }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ backgroundColor: '#fed7aa', borderRadius: 50, padding: 12 }}>
                <MaterialIcons name="warning" size={32} color="#ea580c" />
              </View>
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
              Station Declined Assignment
            </Text>
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>
              <Text style={{ fontWeight: '600' }}>{pendingAssignment?.stationName}</Text> has declined this assignment and is unable to handle this report. 
              Please reroute the incident to one of the nearest stations:
            </Text>
            {selectedReport && (
              <View style={{ backgroundColor: '#dbeafe', borderLeftWidth: 4, borderLeftColor: '#2563eb', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <Text style={{ fontSize: 14, color: '#1e40af', fontWeight: '600', marginBottom: 4 }}>Report Location:</Text>
                <Text style={{ fontSize: 14, color: '#1e3a8a' }}>
                  {selectedReport.address || selectedReport.geotag_location || 'Location unavailable'}
                </Text>
              </View>
            )}
            
            <ScrollView style={{ maxHeight: 300, marginBottom: 24 }}>
              {nearestStations.length > 0 ? (
                nearestStations.map((station) => (
                  <TouchableOpacity
                    key={station.id}
                    onPress={() => setSelectedRerouteStation(station.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 8,
                      borderWidth: 2,
                      borderColor: selectedRerouteStation === station.id ? '#2563eb' : '#e5e7eb',
                      backgroundColor: selectedRerouteStation === station.id ? '#eff6ff' : '#f9fafb'
                    }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selectedRerouteStation === station.id ? '#2563eb' : '#9ca3af', backgroundColor: selectedRerouteStation === station.id ? '#2563eb' : 'transparent', marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontWeight: '600', color: '#111827', fontSize: 16 }}>
                          {station.station_name || 'Station'}
                        </Text>
                        {stationActiveCounts[station.id] > 0 && (
                          <View style={{ marginLeft: 8, backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, minWidth: 28, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff' }}>
                              {stationActiveCounts[station.id]}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: '#6b7280', fontSize: 14 }}>
                        {station.distanceToIncidentKm 
                          ? `${station.distanceToIncidentKm} km from incident` 
                          : station.distanceKm 
                            ? `${station.distanceKm} km away` 
                            : 'Distance unavailable (no coordinates)'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>No stations available.</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={handleReroute}
              disabled={!selectedRerouteStation}
              style={{ 
                width: '100%',
                backgroundColor: selectedRerouteStation ? '#ea580c' : '#d1d5db', 
                paddingVertical: 12, 
                borderRadius: 8, 
                alignItems: 'center' 
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Reroute</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Waiting for Station Approval Modal */}
      <Modal
        visible={showWaitingApprovalModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowWaitingApprovalModal(false);
          setPendingAssignment(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ backgroundColor: '#dbeafe', borderRadius: 50, padding: 12 }}>
                <MaterialIcons name="schedule" size={32} color="#2563eb" />
              </View>
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
              Waiting for Station Approval
            </Text>
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
              The assignment has been sent to <Text style={{ fontWeight: '600' }}>{pendingAssignment?.stationName}</Text>. 
              Please wait for their response.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowWaitingApprovalModal(false);
                setPendingAssignment(null);
              }}
              style={{ backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Okay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Waiting for Backup Station Approval Modal */}
      <Modal
        visible={showWaitingBackupModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowWaitingBackupModal(false);
          setPendingBackupAssignment(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ backgroundColor: '#f3e8ff', borderRadius: 50, padding: 12 }}>
                <MaterialIcons name="schedule" size={32} color="#a855f7" />
              </View>
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
              Waiting for Backup Approval
            </Text>
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 8 }}>
              Backup request sent to <Text style={{ fontWeight: '600', color: '#7e22ce' }}>{pendingBackupAssignment?.stationName}</Text>.
            </Text>
            <Text style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginBottom: 24, fontStyle: 'italic' }}>
              Backup stations provide support but cannot change fire status
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowWaitingBackupModal(false);
                setPendingBackupAssignment(null);
              }}
              style={{ backgroundColor: '#a855f7', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Okay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Fire-Out Summary Modal */}
      <Modal
        visible={showSummaryModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSummaryModal(false);
          setSummaryData(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Fire Out Summary</Text>
              <TouchableOpacity onPress={() => { setShowSummaryModal(false); setSummaryData(null); }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#334155' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {summaryLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#ef4444" />
                <Text style={{ marginTop: 8, color: '#6b7280' }}>Loading summary…</Text>
              </View>
            ) : summaryData ? (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
                <View style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>📋 Incident Information</Text>
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Final Alarm Level</Text>
                    <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 16 }}>
                      {summaryData.report?.final_fire_alarm_level || summaryData.report?.final_alarm_level || summaryData.report?.recommended_alarm_level || summaryData.report?.alarm_level || '1st Alarm'}
                    </Text>
                  </View>
                </View>

                <View style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>⏰ Incident Timeline</Text>
                  <View style={{ marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
                    <Text style={{ fontWeight: '600', color: '#374151', marginBottom: 4 }}>Report Submitted:</Text>
                    <Text style={{ color: '#111827' }}>{formatDateTime(summaryData.report?.created_at || summaryData.report?.timestamp)}</Text>
                  </View>
                  {summaryData.statusHistory?.find(s => s.status === 'Under Control') && (
                    <View style={{ marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
                      <Text style={{ fontWeight: '600', color: '#374151', marginBottom: 4 }}>Response Time (Under Control):</Text>
                      <Text style={{ color: '#111827' }}>{formatDateTime(summaryData.statusHistory.find(s => s.status === 'Under Control').timestamp)}</Text>
                    </View>
                  )}
                  {summaryData.fireOutTime && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontWeight: '600', color: '#374151', marginBottom: 4 }}>Resolution Time (Fire Out):</Text>
                      <Text style={{ color: '#111827' }}>{formatDateTime(summaryData.fireOutTime)}</Text>
                    </View>
                  )}
                </View>

                {summaryData.station?.station_name && summaryData.station.station_name !== 'Unassigned' && (
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>🏠 Responding Station</Text>
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Station Name</Text>
                      <Text style={{ color: '#111827', fontWeight: '700', fontSize: 16 }}>{summaryData.station.station_name}</Text>
                    </View>
                    {summaryData.station.assigned_at && (
                      <View style={{ marginBottom: 8 }}>
                        <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Assigned At</Text>
                        <Text style={{ color: '#111827' }}>{formatDateTime(summaryData.station.assigned_at)}</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>👤 Reporter Information</Text>
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Reporter Name</Text>
                    <Text style={{ color: '#111827', fontWeight: '700', fontSize: 16 }}>
                      {summaryData.report?.reporter || summaryData.report?.reporter_name || summaryData.report?.user_name || 'Anonymous'}
                    </Text>
                  </View>
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Cause of Fire</Text>
                    <Text style={{ color: '#111827' }}>{summaryData.report?.cause_of_fire || 'Not specified'}</Text>
                  </View>
                </View>

                <View style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>📍 Incident Location</Text>
                  <Text style={{ color: '#111827', fontSize: 16 }}>
                    {summaryData.report?.address || summaryData.report?.geotag_location || summaryData.report?.resolved_address || 'Location unavailable'}
                  </Text>
                  {(summaryData.report?.latitude && summaryData.report?.longitude) && (
                    <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
                      Coordinates: {parseFloat(summaryData.report.latitude).toFixed(6)}, {parseFloat(summaryData.report.longitude).toFixed(6)}
                    </Text>
                  )}
                </View>

                {summaryData.alarmLevelHistory && summaryData.alarmLevelHistory.length > 0 && (
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>🚨 Alarm Level Changes</Text>
                    {summaryData.alarmLevelHistory.map((change, index) => (
                      <View key={index} style={{ marginBottom: 8, paddingBottom: 8, borderBottomWidth: index < summaryData.alarmLevelHistory.length - 1 ? 1 : 0, borderBottomColor: '#e5e7eb' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontWeight: '600', color: '#dc2626' }}>{change.level || 'N/A'}</Text>
                          <Text style={{ color: '#111827' }}>{formatDateTime(change.timestamp)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => downloadSummaryPdf('download')}
                    disabled={summaryDownloading}
                    style={{
                      flex: 1,
                      backgroundColor: summaryDownloading ? '#9ca3af' : '#10b981',
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: 'center'
                    }}
                  >
                    {summaryDownloading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Generating…</Text>
                      </View>
                    ) : (
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Download PDF</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => downloadSummaryPdf('share')}
                    disabled={summaryDownloading}
                    style={{
                      flex: 1,
                      backgroundColor: summaryDownloading ? '#9ca3af' : '#2563eb',
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: 'center'
                    }}
                  >
                    {summaryDownloading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Generating…</Text>
                      </View>
                    ) : (
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Share PDF</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <Text style={{ color: '#ef4444', textAlign: 'center', paddingVertical: 12 }}>No summary data.</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Restore Confirmation Modal */}
      <Modal visible={showRestoreModal} transparent animationType="fade" onRequestClose={() => {
        setShowRestoreModal(false);
        setReportToRestore(null);
      }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <MaterialIcons name="warning" size={32} color="#f59e0b" />
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1f2937', marginLeft: 12 }}>
                Restore Report?
              </Text>
            </View>
            
            <View style={{ backgroundColor: '#dbeafe', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <Text style={{ fontSize: 14, color: '#1e40af', marginBottom: 8, fontWeight: '600' }}>
                ⚠️ Confirm Restoration
              </Text>
              <Text style={{ fontSize: 14, color: '#1e3a8a' }}>
                This incident will be moved to Active Reports and will appear on the map for responders.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowRestoreModal(false);
                  setReportToRestore(null);
                }}
                disabled={isInvalidating}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#e5e7eb', alignItems: 'center' }}
              >
                <Text style={{ color: '#374151', fontWeight: '700', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmRestoreReport}
                disabled={isInvalidating}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: isInvalidating ? '#9ca3af' : '#10b981', alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                  {isInvalidating ? 'Restoring...' : 'Confirm Restore'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Restore Success Modal */}
      <Modal visible={showRestoreSuccessModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24, borderWidth: 4, borderColor: '#10b981' }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ backgroundColor: '#10b981', borderRadius: 50, padding: 16, marginBottom: 16 }}>
                <MaterialIcons name="check" size={48} color="white" />
              </View>
              
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#1f2937', textAlign: 'center', marginBottom: 16 }}>
                Report Successfully Restored!
              </Text>
              
              <View style={{ backgroundColor: '#d1fae5', borderRadius: 12, padding: 16, width: '100%', marginBottom: 20 }}>
                <Text style={{ fontSize: 13, color: '#065f46', textAlign: 'center', marginBottom: 8, fontWeight: '600' }}>✅ Moved to Active Reports</Text>
                <Text style={{ fontSize: 13, color: '#065f46', textAlign: 'center', marginBottom: 8, fontWeight: '600' }}>🗺️ Now visible on all maps</Text>
                <Text style={{ fontSize: 13, color: '#065f46', textAlign: 'center', fontWeight: '600' }}>🚒 Available for station assignment</Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setShowRestoreSuccessModal(false);
                  setActiveTab('active');
                }}
                style={{ width: '100%', paddingVertical: 14, borderRadius: 10, backgroundColor: '#10b981', alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>View in Active Reports</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Re-Invalidate Warning Modal */}
      <Modal visible={showReInvalidateModal} transparent animationType="fade" onRequestClose={() => {
        setShowReInvalidateModal(false);
        setReportToReInvalidate(null);
        setInvalidateConfirmText('');
      }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }}>
            <View style={{ backgroundColor: 'white', borderRadius: 16, width: '100%', maxWidth: 450, borderWidth: 4, borderColor: '#dc2626' }}>
              {/* Header */}
              <View style={{ backgroundColor: '#dc2626', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 30, padding: 12, marginRight: 12 }}>
                      <MaterialIcons name="warning" size={32} color="white" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: 'white' }}>⚠️ CONFIRM INVALIDATION</Text>
                      <Text style={{ fontSize: 12, color: '#fecaca', marginTop: 4, fontWeight: '600' }}>Critical Action Required</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setShowReInvalidateModal(false);
                      setReportToReInvalidate(null);
                      setInvalidateConfirmText('');
                    }}
                    disabled={isInvalidating}
                  >
                    <MaterialIcons name="close" size={28} color="rgba(255,255,255,0.8)" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Content */}
              <View style={{ padding: 20 }}>
                {/* Critical Warning */}
                <View style={{ backgroundColor: '#fee2e2', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#fca5a5' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                    <MaterialIcons name="error" size={24} color="#dc2626" style={{ marginRight: 8, marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#7f1d1d', marginBottom: 8 }}>CRITICAL WARNING</Text>
                      <Text style={{ fontSize: 13, color: '#991b1b', lineHeight: 20 }}>
                        You are about to <Text style={{ fontWeight: '800' }}>INVALIDATE</Text> this emergency report. This action will have <Text style={{ fontWeight: '800' }}>IMMEDIATE and SERIOUS consequences</Text>:
                      </Text>
                    </View>
                  </View>
                  
                  <View style={{ marginLeft: 32 }}>
                    <Text style={{ fontSize: 13, color: '#991b1b', marginBottom: 6 }}>❌ <Text style={{ fontWeight: '700' }}>Report will DISAPPEAR from ALL maps</Text></Text>
                    <Text style={{ fontSize: 13, color: '#991b1b', marginBottom: 6 }}>❌ <Text style={{ fontWeight: '700' }}>Fire stations will NO LONGER see this incident</Text></Text>
                    <Text style={{ fontSize: 13, color: '#991b1b', marginBottom: 6 }}>❌ <Text style={{ fontWeight: '700' }}>Responders will be UNABLE to respond</Text></Text>
                    <Text style={{ fontSize: 13, color: '#991b1b' }}>⚠️ <Text style={{ fontWeight: '700' }}>If this is a REAL EMERGENCY, people could be in DANGER</Text></Text>
                  </View>
                </View>

                {/* Important Notice */}
                <View style={{ backgroundColor: '#fef3c7', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#fde68a' }}>
                  <Text style={{ fontSize: 13, color: '#78350f', fontWeight: '700' }}>
                    ⚡ Only invalidate if you are ABSOLUTELY CERTAIN this is a FALSE REPORT (No Fire + No Smoke)
                  </Text>
                </View>

                {/* Confirmation Input */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: '#1f2937', fontWeight: '700', marginBottom: 8 }}>
                    Type <Text style={{ fontSize: 15, color: '#dc2626', fontWeight: '800' }}>INVALIDATE</Text> to confirm:
                  </Text>
                  <TextInput
                    value={invalidateConfirmText}
                    onChangeText={setInvalidateConfirmText}
                    placeholder="Type INVALIDATE here"
                    placeholderTextColor="#9ca3af"
                    editable={!isInvalidating}
                    autoCapitalize="characters"
                    style={{
                      borderWidth: 2,
                      borderColor: '#d1d5db',
                      borderRadius: 10,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      textAlign: 'center',
                      fontSize: 16,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: 2,
                      color: '#1f2937',
                      backgroundColor: isInvalidating ? '#f3f4f6' : 'white'
                    }}
                  />
                  <Text style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 8 }}>
                    This action cannot be easily undone. The report will need to be manually restored.
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowReInvalidateModal(false);
                      setReportToReInvalidate(null);
                      setInvalidateConfirmText('');
                    }}
                    disabled={isInvalidating}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#e5e7eb', alignItems: 'center' }}
                  >
                    <Text style={{ color: '#374151', fontWeight: '700', fontSize: 14 }}>Cancel - Keep Report Active</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={confirmReInvalidateReport}
                    disabled={isInvalidating || invalidateConfirmText.toUpperCase() !== 'INVALIDATE'}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 10,
                      backgroundColor: (isInvalidating || invalidateConfirmText.toUpperCase() !== 'INVALIDATE') ? '#d1d5db' : '#dc2626',
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                      {isInvalidating ? 'Invalidating...' : 'Yes, Invalidate Report'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Invalidation Success Modal */}
      <Modal visible={showInvalidateSuccessModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24, borderWidth: 4, borderColor: '#f97316' }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ backgroundColor: '#f97316', borderRadius: 50, padding: 16, marginBottom: 16 }}>
                <MaterialIcons name="block" size={48} color="white" />
              </View>
              
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#1f2937', textAlign: 'center', marginBottom: 16 }}>
                Report Invalidated Successfully
              </Text>
              
              <View style={{ backgroundColor: '#ffedd5', borderRadius: 12, padding: 16, width: '100%', marginBottom: 20 }}>
                <Text style={{ fontSize: 13, color: '#9a3412', textAlign: 'center', marginBottom: 8, fontWeight: '600' }}>✅ Moved to Invalidated Reports</Text>
                <Text style={{ fontSize: 13, color: '#9a3412', textAlign: 'center', marginBottom: 8, fontWeight: '600' }}>🗺️ Removed from all maps</Text>
                <Text style={{ fontSize: 13, color: '#9a3412', textAlign: 'center', fontWeight: '600' }}>🚫 Hidden from responders</Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setShowInvalidateSuccessModal(false);
                  setActiveTab('invalidated');
                }}
                style={{ width: '100%', paddingVertical: 14, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>View in Invalidated Reports</Text>
              </TouchableOpacity>
              
              <Text style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 12 }}>
                Auto-switching to Invalidated tab in 3 seconds...
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

