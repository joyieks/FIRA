import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../config/supabase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { FiX, FiDownload, FiClock, FiMapPin, FiUser, FiAlertTriangle, FiHome } from 'react-icons/fi';

const SummaryReport = ({ reportId, isOpen, onClose, reportQueue = [], currentIndex = 0, onNext, onPrev, onCloseAll }) => {
  const [reportData, setReportData] = useState(null);
  const [stationData, setStationData] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [alarmLevelHistory, setAlarmLevelHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const hasMultipleReports = reportQueue && reportQueue.length > 1;

  useEffect(() => {
    if (isOpen && reportId) {
      setLoading(true);
      fetchReportData();
    }
  }, [isOpen, reportId]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Fetch report from API
      const API_URL = 'https://new-fira-backend.onrender.com';
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
        alert('Report content not found. Please try again.');
        setDownloading(false);
        return;
      }
      
      // Clone the element to avoid modifying the original
      const clone = element.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = element.offsetWidth + 'px';
      document.body.appendChild(clone);
      
      // Remove all Tailwind classes and force RGB colors
      const allElements = [clone, ...clone.querySelectorAll('*')];
      allElements.forEach(el => {
        // Get computed styles BEFORE removing classes
        const computedStyle = window.getComputedStyle(el);
        const color = computedStyle.color;
        const bgColor = computedStyle.backgroundColor;
        const borderColor = computedStyle.borderColor;
        const fontSize = computedStyle.fontSize;
        const fontWeight = computedStyle.fontWeight;
        const padding = computedStyle.padding;
        const margin = computedStyle.margin;
        const display = computedStyle.display;
        const flexDirection = computedStyle.flexDirection;
        const alignItems = computedStyle.alignItems;
        const justifyContent = computedStyle.justifyContent;
        const gap = computedStyle.gap;
        const borderRadius = computedStyle.borderRadius;
        const borderWidth = computedStyle.borderWidth;
        
        // Remove all classes to avoid oklch (handle SVG elements differently)
        if (el instanceof SVGElement) {
          el.setAttribute('class', '');
        } else {
          el.className = '';
        }
        
        // Apply inline styles with RGB
        el.style.color = color.includes('oklch') || color.includes('oklab') ? 'rgb(17, 24, 39)' : color;
        el.style.backgroundColor = bgColor.includes('oklch') || bgColor.includes('oklab') ? 'rgb(255, 255, 255)' : bgColor;
        el.style.borderColor = borderColor.includes('oklch') || borderColor.includes('oklab') ? 'rgb(229, 231, 235)' : borderColor;
        el.style.fontSize = fontSize;
        el.style.fontWeight = fontWeight;
        el.style.padding = padding;
        el.style.margin = margin;
        el.style.display = display;
        el.style.flexDirection = flexDirection;
        el.style.alignItems = alignItems;
        el.style.justifyContent = justifyContent;
        el.style.gap = gap;
        el.style.borderRadius = borderRadius;
        el.style.borderWidth = borderWidth;
        el.style.backgroundImage = 'none';
        
        // Hide buttons
        if (el.tagName === 'BUTTON') {
          el.style.display = 'none';
        }
      });

      // Generate canvas with higher quality
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight,
      });
      
      // Remove clone
      document.body.removeChild(clone);

      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Create PDF with proper A4 sizing and margins
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
      
      // Set margins (15mm on all sides)
      const margin = 15;
      const contentWidth = pdfWidth - (margin * 2); // 180mm
      const contentHeight = pdfHeight - (margin * 2); // 267mm
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calculate scaling to fit content area
      const ratio = contentWidth / imgWidth;
      const scaledWidth = contentWidth;
      const scaledHeight = imgHeight * ratio;
      
      // Add pages if content is longer than one page
      let yPosition = 0;
      let pageNumber = 1;
      
      while (yPosition < scaledHeight) {
        if (pageNumber > 1) {
          pdf.addPage();
        }
        
        // Calculate source position in canvas
        const sourceY = yPosition / ratio;
        const sourceHeight = Math.min(contentHeight / ratio, imgHeight - sourceY);
        const targetHeight = sourceHeight * ratio;
        
        // Create canvas section for this page
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = sourceHeight;
        const pageCtx = pageCanvas.getContext('2d');
        
        // Draw the section of the original canvas
        pageCtx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);
        const pageImgData = pageCanvas.toDataURL('image/png', 1.0);
        
        // Add to PDF
        pdf.addImage(pageImgData, 'PNG', margin, margin, scaledWidth, targetHeight);
        
        yPosition += contentHeight;
        pageNumber++;
      }
      
      // Generate filename
      const reportNumber = reportId ? String(reportId).substring(0, 8).toUpperCase() : 'REPORT';
      const filename = `FIRA_Summary_Report_${reportNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Save PDF
      pdf.save(filename);
      
      setDownloading(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Error: ' + error.message);
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl w-full my-4 relative border border-gray-300" style={{ maxWidth: '210mm', minHeight: '297mm' }}>
        {/* Header - Sticky */}
        <div className="sticky top-0 bg-white px-8 py-4 flex justify-between items-center border-b-2 border-gray-900 z-20">
          <div className="flex items-center space-x-3">
            <FiAlertTriangle className="w-6 h-6 text-gray-900" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Fire Incident Summary Report</h2>
              <p className="text-gray-600 text-sm">Official Document</p>
              {hasMultipleReports && (
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">
                    Report {currentIndex + 1} of {reportQueue.length}
                  </span>
                  <span className="text-xs text-gray-500">(Cluster Summary)</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {hasMultipleReports && (
              <div className="flex items-center space-x-1 bg-red-50 px-2 py-1 rounded border border-red-200 mr-2">
                <button
                  onClick={onPrev}
                  disabled={currentIndex === 0}
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    currentIndex === 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  ← Prev
                </button>
                <span className="text-xs font-semibold text-red-700 px-2">
                  {currentIndex + 1}/{reportQueue.length}
                </span>
                <button
                  onClick={onNext}
                  disabled={currentIndex >= reportQueue.length - 1}
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    currentIndex >= reportQueue.length - 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  Next →
                </button>
              </div>
            )}
            <button
              onClick={downloadPDF}
              disabled={downloading}
              style={{ backgroundColor: '#000', color: '#fff' }}
              className="flex items-center space-x-2 px-4 py-2 rounded hover:opacity-80 transition-opacity disabled:opacity-50 font-semibold text-sm"
            >
              <FiDownload className="w-4 h-4" />
              <span>{downloading ? 'Generating...' : 'Download PDF'}</span>
            </button>
            <button
              onClick={onCloseAll || onClose}
              className="text-gray-600 hover:text-gray-900 transition-colors p-2"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Report Content - A4 Bond Paper Size */}
        <div id="summary-report-content" className="p-6 bg-white" style={{ width: '210mm', minHeight: '297mm' }}>
          {/* Header */}
          <div className="text-center mb-4 pb-3 border-b-2 border-gray-900">
            <div className="mb-2">
              <h1 className="text-2xl font-bold text-gray-900">PROJECT FIRA</h1>
              <p className="text-xs text-gray-600">Fire Incident Response & Analysis System</p>
            </div>
            <div className="border-2 border-gray-900 rounded py-1 px-4 inline-block">
              <h2 className="text-xl font-bold text-gray-900">FIRE INCIDENT SUMMARY REPORT</h2>
              <p className="text-gray-600 font-semibold text-xs uppercase">Official Documentation</p>
            </div>
            <p className="text-gray-600 mt-1 font-medium text-xs">Report No. <span className="font-bold text-gray-900">{String(reportId).substring(0, 8).toUpperCase()}</span></p>
          </div>

          {/* Report Information - 2 Column Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Left Column */}
            <div className="space-y-3">
              {/* Incident Information */}
              <div className="border-2 border-gray-900 p-3 rounded">
                <div className="flex items-center mb-2">
                  <FiAlertTriangle className="w-4 h-4 text-gray-900 mr-2" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase">Incident Information</h3>
                </div>
                <div className="space-y-2">
                  <div className="border border-gray-300 p-2 rounded">
                    <p className="text-xs font-bold text-gray-600 uppercase">Report ID</p>
                    <p className="text-sm font-bold text-gray-900">{String(reportId).substring(0, 8).toUpperCase()}</p>
                  </div>
                  <div className="border border-gray-300 p-2 rounded">
                    <p className="text-xs font-bold text-gray-600 uppercase">Final Alarm Level</p>
                    <p className="text-sm font-bold text-gray-900">{reportData.final_fire_alarm_level || '1st Alarm'}</p>
                  </div>
                  <div className="border border-gray-300 p-2 rounded">
                    <p className="text-xs font-bold text-gray-600 uppercase">Status</p>
                    <p className="text-sm font-bold text-gray-900">Fire Out - Resolved</p>
                  </div>
                  <div className="border border-gray-300 p-2 rounded">
                    <p className="text-xs font-bold text-gray-600 uppercase">Report Date</p>
                    <p className="text-xs font-bold text-gray-900">{new Date(reportSubmittedTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="border-2 border-gray-900 p-3 rounded">
                <div className="flex items-center mb-2">
                  <FiClock className="w-4 h-4 text-gray-900 mr-2" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase">Incident Timeline</h3>
                </div>
                <div className="border border-gray-300 p-2 rounded space-y-1">
                  <div className="pb-1 border-b border-gray-300">
                    <p className="text-xs font-bold text-gray-600 uppercase">Report Submitted</p>
                    <p className="text-xs font-semibold text-gray-900">{formatDateTime(reportSubmittedTime)}</p>
                  </div>
                  {underControlTime && (
                    <div className="pb-1 border-b border-gray-300">
                      <p className="text-xs font-bold text-gray-600 uppercase">Under Control</p>
                      <p className="text-xs font-semibold text-gray-900">{formatDateTime(underControlTime)}</p>
                    </div>
                  )}
                  {fireOutTime && (
                    <div>
                      <p className="text-xs font-bold text-gray-600 uppercase">Fire Out (Resolved)</p>
                      <p className="text-xs font-bold text-gray-900">{formatDateTime(fireOutTime)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Reporter Information */}
              <div className="border-2 border-gray-900 p-3 rounded">
                <div className="flex items-center mb-2">
                  <FiUser className="w-4 h-4 text-gray-900 mr-2" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase">Reporter Information</h3>
                </div>
                <div className="border border-gray-300 p-2 rounded space-y-1">
                  <div>
                    <p className="text-xs font-bold text-gray-600 uppercase">Reporter Name</p>
                    <p className="text-xs font-bold text-gray-900">{reportData.reporter || reportData.reporter_name || 'Anonymous'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-600 uppercase">Cause of Fire</p>
                    <p className="text-xs font-semibold text-gray-900">{reportData.cause_of_fire || 'Not specified'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {/* Station Information */}
              {stationData && (
                <div className="border-2 border-gray-900 p-3 rounded">
                  <div className="flex items-center mb-2">
                    <FiHome className="w-4 h-4 text-gray-900 mr-2" />
                    <h3 className="text-sm font-bold text-gray-900 uppercase">Responding Fire Station</h3>
                  </div>
                  <div className="border border-gray-300 p-2 rounded space-y-1">
                    <div>
                      <p className="text-xs font-bold text-gray-600 uppercase">Station Name</p>
                      <p className="text-xs font-bold text-gray-900">{stationData.station_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-600 uppercase">Assignment Time</p>
                      <p className="text-xs font-semibold text-gray-900">{formatDateTime(stationData.assigned_at)}</p>
                    </div>
                    {stationData.address && (
                      <div>
                        <p className="text-xs font-bold text-gray-600 uppercase">Station Address</p>
                        <p className="text-xs text-gray-900">{stationData.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Location Information */}
              <div className="border-2 border-gray-900 p-3 rounded">
                <div className="flex items-center mb-2">
                  <FiMapPin className="w-4 h-4 text-gray-900 mr-2" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase">Incident Location</h3>
                </div>
                <div className="border border-gray-300 p-2 rounded">
                  <p className="text-xs font-semibold text-gray-900 mb-1">
                    {reportData.address || reportData.geotag_location || reportData.resolved_address || 'Location unavailable'}
                  </p>
                  {(reportData.latitude && reportData.longitude) && (
                    <div className="border-t border-gray-300 pt-1 mt-1">
                      <p className="text-xs font-bold text-gray-600 uppercase">GPS Coordinates</p>
                      <p className="text-xs font-mono font-semibold text-gray-900">
                        {parseFloat(reportData.latitude).toFixed(6)}, {parseFloat(reportData.longitude).toFixed(6)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Technical Analysis */}
              <div className="border-2 border-gray-900 p-3 rounded">
                <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase">Technical Analysis</h3>
                <div className="grid grid-cols-2 gap-2">
                  {reportData.number_of_structures_on_fire && (
                    <div className="border border-gray-300 p-2 rounded text-center">
                      <p className="text-xs font-bold text-gray-600 uppercase">Structures</p>
                      <p className="text-xl font-bold text-gray-900">{reportData.number_of_structures_on_fire}</p>
                    </div>
                  )}
                  {reportData.structure && (
                    <div className="border border-gray-300 p-2 rounded text-center">
                      <p className="text-xs font-bold text-gray-600 uppercase">Type</p>
                      <p className="text-xs font-bold text-gray-900">{reportData.structure}</p>
                    </div>
                  )}
                  {reportData.confidence && (
                    <div className="border border-gray-300 p-2 rounded text-center col-span-2">
                      <p className="text-xs font-bold text-gray-600 uppercase">AI Confidence</p>
                      <p className="text-xl font-bold text-gray-900">{(parseFloat(reportData.confidence) * 100).toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Alarm Level History */}
              {alarmLevelHistory.length > 0 && (
                <div className="border-2 border-gray-900 p-3 rounded">
                  <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase">Alarm Level Changes</h3>
                  <div className="border border-gray-300 p-2 rounded space-y-1">
                    {alarmLevelHistory.map((change, index) => (
                      <div key={index} className="pb-1 border-b border-gray-300 last:border-b-0">
                        <p className="text-xs font-bold text-gray-600 uppercase">{change.level}</p>
                        <p className="text-xs font-semibold text-gray-900">{formatDateTime(change.timestamp)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fire Image - Full Width */}
          {reportData.image_url && (
            <div className="border-2 border-gray-900 p-3 rounded mb-4">
              <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase text-center">Incident Photograph</h3>
              <div className="flex justify-center border border-gray-300 p-2 rounded">
                <img
                  src={reportData.image_url}
                  alt="Fire incident"
                  className="max-w-full h-auto rounded"
                  style={{ maxHeight: '200px' }}
                />
              </div>
              <p className="text-center text-xs text-gray-600 mt-1">Official incident documentation photograph</p>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t-2 border-gray-900">
            <div className="border-2 border-gray-900 p-3 rounded text-center">
              <div className="inline-block bg-gray-900 text-white px-3 py-1 rounded mb-2">
                <p className="font-bold text-xs uppercase">Official Government Document</p>
              </div>
              <p className="text-xs text-gray-700 font-semibold mb-1">
                This is an authenticated fire incident report generated by Project FIRA
              </p>
              <p className="text-xs text-gray-700 mb-2">
                Bureau of Fire Protection - Fire Incident Response & Analysis System
              </p>
              <p className="text-xs text-gray-600 font-semibold uppercase border-t border-gray-300 pt-2">
                Generated: {new Date().toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </p>
              <p className="text-xs text-gray-500 italic mt-1">
                Document ID: FIRA-{String(reportId).substring(0, 8).toUpperCase()}-{new Date().getFullYear()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryReport;

