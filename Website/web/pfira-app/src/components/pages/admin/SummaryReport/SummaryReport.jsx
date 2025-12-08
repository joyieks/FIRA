import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../config/supabase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { FiX, FiDownload, FiClock, FiMapPin, FiUser, FiAlertTriangle, FiHome } from 'react-icons/fi';

const SummaryReport = ({ reportId, isOpen, onClose }) => {
  const [reportData, setReportData] = useState(null);
  const [stationData, setStationData] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [alarmLevelHistory, setAlarmLevelHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (isOpen && reportId) {
      fetchReportData();
    }
  }, [isOpen, reportId]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Fetch report from API
      const API_URL = 'https://fire-detection-api-production-f55b.up.railway.app';
      const reportResponse = await fetch(`${API_URL}/get_reports`);
      const allReports = await reportResponse.json();
      const report = allReports.find(r => String(r.id) === String(reportId));
      
      if (!report) {
        console.error('Report not found');
        setLoading(false);
        return;
      }

      setReportData(report);

      // Fetch station assignment
      const { data: assignmentData } = await supabase
        .from('report_assignments')
        .select('assignee_id, assigned_at, status')
        .eq('report_id', String(reportId))
        .eq('assignee_type', 'station')
        .order('assigned_at', { ascending: false })
        .limit(1)
        .single();

      if (assignmentData) {
        const { data: station } = await supabase
          .from('station_users')
          .select('station_name, address, email, phone')
          .eq('id', assignmentData.assignee_id)
          .single();
        
        setStationData({ ...station, assigned_at: assignmentData.assigned_at });
      }

      // Fetch status change notifications (to track timestamps)
      const { data: statusNotifications } = await supabase
        .from('notifications')
        .select('created_at, message, title')
        .or(`related_report_id.eq.${reportId},fire_report_id.eq.${reportId}`)
        .or('type.eq.fire_alert,type.eq.assignment')
        .order('created_at', { ascending: true });

      // Parse status history from notifications
      const statusTimeline = [];
      if (statusNotifications) {
        statusNotifications.forEach(notif => {
          const message = notif.message || notif.title || '';
          
          // Check for status changes
          if (message.includes('On Going') || message.includes('Under Control') || message.includes('Fire Out')) {
            let status = null;
            if (message.includes('On Going')) status = 'On Going';
            else if (message.includes('Under Control')) status = 'Under Control';
            else if (message.includes('Fire Out')) status = 'Fire Out';
            
            if (status) {
              statusTimeline.push({
                status,
                timestamp: notif.created_at
              });
            }
          }
          
        });
      }

      // Add report creation time
      if (report.created_at || report.timestamp) {
        statusTimeline.unshift({
          status: 'Report Submitted',
          timestamp: report.created_at || report.timestamp
        });
      }

      // Add final status if Fire Out
      if (report.status === 'Fire Out' || (report.status || '').toString().includes('Fire Out')) {
        statusTimeline.push({
          status: 'Fire Out',
          timestamp: report.updated_at || report.timestamp || new Date().toISOString()
        });
      }

      setStatusHistory(statusTimeline);

      // Fetch alarm level changes from notifications
      const { data: alarmNotifications } = await supabase
        .from('notifications')
        .select('created_at, message, title')
        .or(`related_report_id.eq.${reportId},fire_report_id.eq.${reportId}`)
        .ilike('title', '%Alarm Level%')
        .order('created_at', { ascending: true });

      let alarmChanges = [];
      if (alarmNotifications && alarmNotifications.length > 0) {
        alarmChanges = alarmNotifications.map(notif => {
          const message = notif.message || notif.title || '';
          const alarmMatch = message.match(/(\d+(?:st|nd|rd|th)?\s*Alarm|General Alarm|TASK FORCE \w+)/i);
          return {
            level: alarmMatch ? alarmMatch[1] : null,
            timestamp: notif.created_at
          };
        }).filter(change => change.level !== null);
      }

      // If no alarm level history found, use report's final fire alarm level (default to 1st Alarm)
      if (alarmChanges.length === 0) {
        alarmChanges = [{
          level: report.final_fire_alarm_level || '1st Alarm',
          timestamp: report.created_at || report.timestamp
        }];
      }
      
      setAlarmLevelHistory(alarmChanges);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching report data:', error);
      setLoading(false);
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
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
  };

  const downloadPDF = async () => {
    try {
      setDownloading(true);
      const element = document.getElementById('summary-report-content');
      if (!element) {
        throw new Error('Report content element not found');
      }
      
      // Helper function to convert oklch to RGB based on class names
      const getRgbFromClass = (el) => {
        const classList = Array.from(el.classList);
        const rgbMap = {
          // Text colors
          'text-red-600': 'rgb(220, 38, 38)',
          'text-blue-600': 'rgb(37, 99, 235)',
          'text-green-600': 'rgb(22, 163, 74)',
          'text-purple-600': 'rgb(147, 51, 234)',
          'text-orange-600': 'rgb(234, 88, 12)',
          'text-gray-500': 'rgb(107, 114, 128)',
          'text-gray-600': 'rgb(75, 85, 99)',
          'text-gray-700': 'rgb(55, 65, 81)',
          'text-gray-900': 'rgb(17, 24, 39)',
          // Background colors
          'bg-gray-50': 'rgb(249, 250, 251)',
          'bg-white': 'rgb(255, 255, 255)',
          'bg-red-600': 'rgb(220, 38, 38)',
          'bg-blue-600': 'rgb(37, 99, 235)',
          // Border colors
          'border-gray-200': 'rgb(229, 231, 235)',
          'border-gray-300': 'rgb(209, 213, 219)',
        };
        
        // Find matching class
        for (const className of classList) {
          if (rgbMap[className]) {
            return rgbMap[className];
          }
        }
        return null;
      };
      
      // Store original styles and apply inline RGB styles to all elements (including the element itself)
      const allElements = [element, ...element.querySelectorAll('*')];
      const originalStyles = new Map();
      
      allElements.forEach((el) => {
        try {
          const computed = window.getComputedStyle(el);
          const styleObj = {};
          
          // Check color
          if (computed.color && (computed.color.includes('oklch') || computed.color.includes('oklab'))) {
            const rgbColor = getRgbFromClass(el);
            if (rgbColor) {
              styleObj.color = rgbColor;
            } else {
              styleObj.color = 'rgb(17, 24, 39)'; // Default gray-900
            }
          }
          
          // Check background color
          if (computed.backgroundColor && (computed.backgroundColor.includes('oklch') || computed.backgroundColor.includes('oklab'))) {
            const rgbBg = getRgbFromClass(el);
            if (rgbBg) {
              styleObj.backgroundColor = rgbBg;
            } else {
              styleObj.backgroundColor = 'rgb(255, 255, 255)'; // Default white
            }
          }
          
          // Check border color
          if (computed.borderColor && (computed.borderColor.includes('oklch') || computed.borderColor.includes('oklab'))) {
            const rgbBorder = getRgbFromClass(el);
            if (rgbBorder) {
              styleObj.borderColor = rgbBorder;
            } else {
              styleObj.borderColor = 'rgb(229, 231, 235)'; // Default gray-200
            }
          }
          
          // Store original and apply new styles
          if (Object.keys(styleObj).length > 0) {
            originalStyles.set(el, {});
            Object.keys(styleObj).forEach(prop => {
              const camelProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
              originalStyles.get(el)[camelProp] = el.style[camelProp] || '';
              el.style.setProperty(prop, styleObj[prop], 'important');
            });
          }
        } catch (err) {
          console.warn('Error processing element styles:', err);
        }
      });
      
      // Temporarily hide buttons
      const buttons = element.querySelectorAll('button');
      const buttonDisplays = new Map();
      buttons.forEach(btn => {
        buttonDisplays.set(btn, btn.style.display);
        btn.style.display = 'none';
      });
      
      // Create canvas from HTML with onclone to ensure styles are applied
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        foreignObjectRendering: false, // Disable foreignObject rendering which might have issues with oklch
        ignoreElements: (el) => {
          return el.tagName === 'BUTTON';
        },
        onclone: (clonedDoc, clonedElement) => {
          // Add a style sheet to override any remaining oklch colors
          const style = clonedDoc.createElement('style');
          style.textContent = `
            * {
              color: rgb(17, 24, 39) !important;
            }
            .text-red-600, .text-red-600 * { color: rgb(220, 38, 38) !important; }
            .text-blue-600, .text-blue-600 * { color: rgb(37, 99, 235) !important; }
            .text-green-600, .text-green-600 * { color: rgb(22, 163, 74) !important; }
            .text-purple-600, .text-purple-600 * { color: rgb(147, 51, 234) !important; }
            .text-orange-600, .text-orange-600 * { color: rgb(234, 88, 12) !important; }
            .text-gray-500, .text-gray-500 * { color: rgb(107, 114, 128) !important; }
            .text-gray-600, .text-gray-600 * { color: rgb(75, 85, 99) !important; }
            .text-gray-700, .text-gray-700 * { color: rgb(55, 65, 81) !important; }
            .text-gray-900, .text-gray-900 * { color: rgb(17, 24, 39) !important; }
            .bg-gray-50 { background-color: rgb(249, 250, 251) !important; }
            .bg-white { background-color: rgb(255, 255, 255) !important; }
            .bg-red-600 { background-color: rgb(220, 38, 38) !important; }
            .bg-blue-600 { background-color: rgb(37, 99, 235) !important; }
            .border-gray-200 { border-color: rgb(229, 231, 235) !important; }
            .border-gray-300 { border-color: rgb(209, 213, 219) !important; }
          `;
          clonedDoc.head.insertBefore(style, clonedDoc.head.firstChild);
        }
      });
      
      // Restore original styles
      originalStyles.forEach((styles, el) => {
        Object.keys(styles).forEach(prop => {
          el.style[prop] = styles[prop];
        });
      });
      
      // Restore button displays
      buttonDisplays.forEach((display, btn) => {
        btn.style.display = display;
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min((pdfWidth - 20) / imgWidth, (pdfHeight - 20) / imgHeight);
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;
      
      // Add image to PDF
      pdf.addImage(imgData, 'PNG', 10, 10, imgScaledWidth, imgScaledHeight);
      
      // Generate filename
      const reportNumber = reportId ? String(reportId).substring(0, 8) : 'REPORT';
      const filename = `FIRA_Summary_Report_${reportNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Save PDF
      pdf.save(filename);
      
      setDownloading(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report data...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md">
          <p className="text-red-600">Report not found</p>
          <button
            onClick={onClose}
            className="mt-4 w-full bg-red-600 text-white px-4 py-2 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const reportSubmittedTime = reportData.created_at || reportData.timestamp;
  const underControlTime = statusHistory.find(s => s.status === 'Under Control')?.timestamp;
  const fireOutTime = statusHistory.find(s => s.status === 'Fire Out')?.timestamp || reportData.updated_at;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 relative">
        {/* Header with close and download buttons */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-2xl z-10">
          <h2 className="text-2xl font-bold text-gray-900">Fire Incident Summary Report</h2>
          <div className="flex space-x-2">
            <button
              onClick={downloadPDF}
              disabled={downloading}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <FiDownload className="w-5 h-5" />
              <span>{downloading ? 'Generating...' : 'Download PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div id="summary-report-content" className="p-8 bg-white">
          {/* Header with Logo */}
          <div className="text-center mb-8 border-b-2 border-gray-300 pb-6">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-red-600 text-white px-6 py-3 rounded-lg">
                <h1 className="text-3xl font-bold">PROJECT FIRA</h1>
                <p className="text-sm mt-1">Fire Incident Response & Analysis</p>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mt-4">FIRE INCIDENT SUMMARY REPORT</h2>
            <p className="text-gray-600 mt-2">Official Government Document</p>
          </div>

          {/* Report Information */}
          <div className="space-y-6 mb-8">
            {/* Basic Information */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiAlertTriangle className="w-6 h-6 mr-2 text-red-600" />
                Incident Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Report ID</p>
                  <p className="text-lg font-bold text-gray-900">{String(reportId).substring(0, 8)}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Final Alarm Level</p>
                  <p className="text-lg font-bold text-red-600">
                    {reportData.final_fire_alarm_level || '1st Alarm'}
                  </p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiClock className="w-6 h-6 mr-2 text-blue-600" />
                Incident Timeline
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <span className="font-semibold text-gray-700">Report Submitted:</span>
                  <span className="text-gray-900">{formatDateTime(reportSubmittedTime)}</span>
                </div>
                {underControlTime && (
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-semibold text-gray-700">Response Time (Under Control):</span>
                    <span className="text-gray-900">{formatDateTime(underControlTime)}</span>
                  </div>
                )}
                {fireOutTime && (
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-semibold text-gray-700">Resolution Time (Fire Out):</span>
                    <span className="text-gray-900">{formatDateTime(fireOutTime)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Station Information */}
            {stationData && (
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <FiHome className="w-6 h-6 mr-2 text-green-600" />
                  Responding Station
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Station Name</p>
                    <p className="text-lg font-bold text-gray-900">{stationData.station_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Assigned At</p>
                    <p className="text-lg text-gray-900">{formatDateTime(stationData.assigned_at)}</p>
                  </div>
                  {stationData.address && (
                    <div className="col-span-2">
                      <p className="text-sm font-semibold text-gray-600">Station Address</p>
                      <p className="text-lg text-gray-900">{stationData.address}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reporter Information */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiUser className="w-6 h-6 mr-2 text-purple-600" />
                Reporter Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Reporter Name</p>
                  <p className="text-lg font-bold text-gray-900">{reportData.reporter || reportData.reporter_name || 'Anonymous'}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Cause of Fire</p>
                  <p className="text-lg text-gray-900">{reportData.cause_of_fire || 'Not specified'}</p>
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiMapPin className="w-6 h-6 mr-2 text-orange-600" />
                Incident Location
              </h3>
              <p className="text-lg text-gray-900">
                {reportData.address || reportData.geotag_location || reportData.resolved_address || 'Location unavailable'}
              </p>
              {(reportData.latitude && reportData.longitude) && (
                <p className="text-sm text-gray-600 mt-2">
                  Coordinates: {parseFloat(reportData.latitude).toFixed(6)}, {parseFloat(reportData.longitude).toFixed(6)}
                </p>
              )}
            </div>

            {/* Fire Image */}
            {reportData.image_url && (
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Incident Photograph</h3>
                <div className="flex justify-center">
                  <img
                    src={reportData.image_url}
                    alt="Fire incident"
                    className="max-w-full h-auto rounded-lg shadow-md"
                    style={{ maxHeight: '400px' }}
                  />
                </div>
              </div>
            )}

            {/* Alarm Level History */}
            {alarmLevelHistory.length > 0 && (
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Alarm Level Changes</h3>
                <div className="space-y-2">
                  {alarmLevelHistory.map((change, index) => (
                    <div key={index} className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="font-semibold text-red-600">{change.level}</span>
                      <span className="text-gray-900">{formatDateTime(change.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Details */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Additional Details</h3>
              <div className="grid grid-cols-2 gap-4">
                {reportData.number_of_structures_on_fire && (
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Structures Affected</p>
                    <p className="text-lg text-gray-900">{reportData.number_of_structures_on_fire}</p>
                  </div>
                )}
                {reportData.structure && (
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Structure Type</p>
                    <p className="text-lg text-gray-900">{reportData.structure}</p>
                  </div>
                )}
                {reportData.confidence && (
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Detection Confidence</p>
                    <p className="text-lg text-gray-900">{(parseFloat(reportData.confidence) * 100).toFixed(2)}%</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t-2 border-gray-300 text-center">
            <p className="text-sm text-gray-600">
              This is an official government document generated by Project FIRA
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Generated on {new Date().toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryReport;

