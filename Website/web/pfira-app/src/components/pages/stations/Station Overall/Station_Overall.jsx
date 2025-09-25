import React, { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiX } from 'react-icons/fi';
import { supabase } from '../../../../config/supabase';

const Station_Overview = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openStatusDropdown, setOpenStatusDropdown] = useState(null);
  const [openAlarmDropdown, setOpenAlarmDropdown] = useState(null);

  const API_URL = 'https://fire-detection-api-production-f543.up.railway.app';

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      if (typeof timestamp === 'string' && !timestamp.includes('T') && !timestamp.includes('Z')) return timestamp;
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return 'Unknown'; }
  };
  const minutesAgo = (timestamp) => {
    try { const d = new Date(timestamp); return Math.floor((Date.now()-d)/60000); } catch { return 0; }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
        const stationId = userData?.id;
        if (!stationId) { setReports([]); return; }
        const { data: assignments, error } = await supabase
          .from('report_assignments')
          .select('report_id')
          .eq('assignee_type','station')
          .eq('assignee_id', stationId);
        if (error) throw error;
        const ids = new Set((assignments||[]).map(a=>String(a.report_id)));
        if (!ids.size) { setReports([]); return; }
        const resp = await fetch(`${API_URL}/get_reports`);
        const data = resp.ok ? await resp.json() : [];
        const filtered = (data||[]).filter(r=>ids.has(String(r.id)));
        const mapped = filtered.map(r=>({
          id: r.id,
          time: formatTime(r.formatted_timestamp || r.created_at),
          reporter: r.reporter || 'Unknown Reporter',
          location: r.address || r.geotag_location || 'Location unavailable',
          status: r.status || 'On Going',
          suggestedAlarmLevel: r.recommended_alarm_level || r.alarm_level || 'Unknown',
          finalAlarmLevel: r.final_fire_alarm_level || '1st Alarm',
          description: r.cause_of_fire || 'No cause specified',
          picture: r.image_url,
          minutesAgo: minutesAgo(r.created_at || r.timestamp),
          prediction: r.prediction,
          confidence: r.confidence,
          structure: r.structure,
          smokeIntensity: r.smoke_intensity,
          smokeConfidence: r.smoke_confidence,
          numberOfStructures: r.number_of_structures_on_fire,
          timestamp: r.created_at || r.timestamp,
          latitude: r.latitude,
          longitude: r.longitude,
          address: r.address,
          geotag_location: r.geotag_location
        }));
        setReports(mapped.sort((a,b)=> new Date(b.timestamp||0)-new Date(a.timestamp||0)));
      } catch (e) {
        console.error('Station Overall load error:', e);
        setReports([]);
      } finally { setIsLoading(false); }
    };
    load();
  }, []);

  const toggleStatusDropdown = (reportId) => {
    setOpenStatusDropdown(openStatusDropdown === reportId ? null : reportId);
    setOpenAlarmDropdown(null);
  };

  const toggleAlarmDropdown = (reportId) => {
    setOpenAlarmDropdown(openAlarmDropdown === reportId ? null : reportId);
    setOpenStatusDropdown(null);
  };

  const handleStatusChange = (reportId, newStatus) => {
    setActiveReports(prev => prev.map(report => 
      report.id === reportId ? { ...report, status: newStatus } : report
    ));
    setOpenStatusDropdown(null);
  };

  const handleAlarmLevelChange = (reportId, newLevel) => {
    setActiveReports(prev => prev.map(report => 
      report.id === reportId ? { ...report, fireAlarmLevel: newLevel } : report
    ));
    setOpenAlarmDropdown(null);
  };

  const closeAllDropdowns = () => {
    setOpenStatusDropdown(null);
    setOpenAlarmDropdown(null);
  };

  // Filter reports based on search
  const filteredReports = reports.filter(report => {
    return report.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
           report.description.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleReportClick = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'On Going': return 'bg-red-100 text-red-800 border-red-200';
      case 'Under Control': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Fire Out': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAlarmLevelColor = (level) => {
    switch (level) {
      case '1st Alarm': return 'bg-blue-100 text-blue-800 border-blue-200';
      case '2nd Alarm': return 'bg-orange-100 text-orange-800 border-orange-200';
      case '3rd Alarm': return 'bg-red-100 text-red-800 border-red-200';
      case '4th Alarm': return 'bg-purple-100 text-purple-800 border-purple-200';
      case '5th Alarm': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'TASK FORCE': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'General Alarm': return 'bg-red-600 text-white border-red-700';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEquipmentStatusColor = (status) => {
    switch (status) {
      case 'Available': return 'bg-green-100 text-green-800 border-green-200';
      case 'Deployed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Maintenance': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getResponderStatusColor = (status) => {
    switch (status) {
      case 'On Scene': return 'bg-red-100 text-red-800 border-red-200';
      case 'En Route': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Standby': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" onClick={closeAllDropdowns}>
      <div className="max-w-none mx-auto">
        <div className="w-full">
          {/* Header */}
          

          {/* Search and Reports Table */}
          <div className="bg-white rounded-xl shadow-sm p-12 mb-6 w-full">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                <input
                  type="text"
                  placeholder="Search emergency reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

              {/* Assigned Reports Table */}
            <div className="w-full">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Time</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Reporter</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Location</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Status</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Fire Alarm Level</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Suggested Fire Alarm</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReports.map((report) => (
                    <tr 
                      key={report.id} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleReportClick(report)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {report.time}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.reporter || 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.location}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatusDropdown(report.id);
                            }}
                            className={`px-3 py-1 rounded-md text-xs font-medium border ${getStatusColor(report.status)} hover:bg-gray-50 transition-colors`}
                          >
                            {report.status}
                          </button>
                          {openStatusDropdown === report.id && (
                            <div className="absolute z-10 mt-1 w-32 bg-white border border-gray-300 rounded-md shadow-lg">
                              <div className="py-1">
                                {['On Going', 'Under Control', 'Fire Out'].map((status) => (
                                  <button
                                    key={status}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(report.id, status);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    {status}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAlarmDropdown(report.id);
                            }}
                            className={`px-3 py-1 rounded-md text-xs font-medium border ${getAlarmLevelColor(report.suggestedAlarmLevel)} hover:bg-gray-50 transition-colors`}
                          >
                            {report.suggestedAlarmLevel}
                          </button>
                          {openAlarmDropdown === report.id && (
                            <div className="absolute z-10 mt-1 w-32 bg-white border border-gray-300 rounded-md shadow-lg">
                              <div className="py-1">
                                {['1st Alarm', '2nd Alarm', '3rd Alarm', 'General Alarm'].map((level) => (
                                  <button
                                    key={level}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAlarmLevelChange(report.id, level);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    {level}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-md text-xs font-medium border ${getAlarmLevelColor(report.finalAlarmLevel)}`}>
                          {report.finalAlarmLevel}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button
                          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReportClick(report);
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Report Modal */}
          {showReportModal && selectedReport && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
              <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-8">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-bold text-gray-900">Emergency Report Details</h3>
                    <button
                      onClick={() => setShowReportModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <FiX size={28} />
                    </button>
                  </div>

                  <div className="space-y-8">
                    {/* Picture */}
                    <div className="bg-gray-100 rounded-lg p-6 text-center">
                      <img 
                        src={selectedReport.picture} 
                        alt="Emergency Scene" 
                        className="w-full h-64 object-cover rounded-lg"
                      />
                    </div>

                    {/* Location and Time */}
                    <div className="flex justify-between items-center">
                      <div>
                        <label className="block text-lg font-medium text-gray-700 mb-2">Location:</label>
                        <span className="text-xl font-semibold text-gray-900">{selectedReport.location}</span>
                      </div>
                      <span className="text-lg text-gray-500">{selectedReport.minutesAgo} min ago</span>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-3">Description:</label>
                      <p className="text-gray-900 leading-relaxed text-lg">{selectedReport.description}</p>
                    </div>

                    {/* Status and Fire Alarm Level */}
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <label className="block text-lg font-medium text-gray-700 mb-3">Status:</label>
                        <span className={`px-4 py-3 rounded-md text-base font-medium border ${getStatusColor(selectedReport.status)}`}>
                          {selectedReport.status}
                        </span>
                      </div>
                      <div>
                        <label className="block text-lg font-medium text-gray-700 mb-3">Fire Alarm Level:</label>
                        <span className={`px-4 py-3 rounded-md text-base font-medium border ${getAlarmLevelColor(selectedReport.fireAlarmLevel)}`}>
                          {selectedReport.fireAlarmLevel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                    <button
                      onClick={() => setShowReportModal(false)}
                      className="px-8 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-lg"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Station_Overview;