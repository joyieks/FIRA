import React, { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiClock, FiMapPin, FiUser, FiAlertTriangle, FiBell, FiTrendingUp, FiX, FiRefreshCw } from 'react-icons/fi';

const Overview = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reports, setReports] = useState([]);
  const [generalAlarmStates, setGeneralAlarmStates] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // API endpoint for fetching reports
  const API_URL = 'https://fire-predictor-api-production.up.railway.app';

  // Fetch reports from Firebase via Flask API
  const fetchReports = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching reports from:', `${API_URL}/get_reports`);
      
      const response = await fetch(`${API_URL}/get_reports`);
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('API Response data:', data);
        console.log('Total reports received:', data.length);
        
        // Transform API data to match the expected format
        const transformedReports = data.map(report => ({
          id: report.id,
          time: formatTime(report.timestamp),
          reporter: report.reporter || 'Unknown Reporter',
          location: report.geotag_location || 'Location unavailable',
          status: determineStatus(report.prediction),
          fireAlarmLevel: report.alarm_level || 'Unknown',
          suggestedAlarm: determineSuggestedAlarm(report.number_of_structures_on_fire),
          description: report.cause_of_fire || 'No cause specified',
          picture: report.photo_url || '/burnhouse.jpg',
          minutesAgo: calculateMinutesAgo(report.timestamp),
          // Additional fields from API
          prediction: report.prediction,
          confidence: report.confidence,
          structure: report.structure,
          smokeIntensity: report.smoke_intensity,
          smokeConfidence: report.smoke_confidence,
          numberOfStructures: report.number_of_structures_on_fire,
          reporterId: report.reporterId,
          timestamp: report.timestamp
        }));
        
        console.log('Transformed reports:', transformedReports);
        setReports(transformedReports);
        setLastRefresh(new Date());
      } else {
        console.log('API returned error status:', response.status);
        const errorData = await response.text();
        console.log('Error response:', errorData);
        setReports([]);
      }
    } catch (error) {
      console.log('Error loading reports:', error);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };  

  // Format timestamp to readable time
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (e) {
      return 'Unknown';
    }
  };

  // Calculate minutes ago
  const calculateMinutesAgo = (timestamp) => {
    if (!timestamp) return 0;
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      return Math.floor(diffMs / (1000 * 60));
    } catch (e) {
      return 0;
    }
  };

  // Determine status based on prediction
  const determineStatus = (prediction) => {
    if (!prediction) return 'Unknown';
    switch ((prediction || '').toLowerCase()) {
      case 'fire': return 'On Going';
      case 'no fire': return 'Under Control';
      default: return 'Unknown';
    }
  };

  // Determine suggested alarm based on number of structures
  const determineSuggestedAlarm = (numStructures) => {
    if (!numStructures || numStructures === 0) return '1st Alarm';
    if (numStructures >= 80) return 'GENERAL ALARM';
    if (numStructures >= 36) return 'TASK FORCE DELTA';
    if (numStructures >= 32) return 'TASK FORCE CHARLIE';
    if (numStructures >= 28) return 'TASK FORCE BRAVO';
    if (numStructures >= 24) return 'TASK FORCE ALPHA';
    if (numStructures >= 20) return '5th Alarm';
    if (numStructures >= 16) return '4th Alarm';
    if (numStructures >= 12) return '3rd Alarm';
    if (numStructures >= 8) return '2nd Alarm';
    if (numStructures >= 4) return '1st Alarm';
    return 'Under Control';
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchReports(); // Initial fetch
    
    const interval = setInterval(() => {
      fetchReports();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Filter reports based on search
  const filteredReports = reports.filter(report => {
    return report.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
           report.reporter.toLowerCase().includes(searchQuery.toLowerCase()) ||
           report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
           report.structure?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleReportClick = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  const handleGeneralAlarm = (reportId) => {
    setGeneralAlarmStates(prev => ({
      ...prev,
      [reportId]: !prev[reportId]
    }));
    
    const isActive = !generalAlarmStates[reportId];
    if (isActive) {
      alert(`GENERAL ALARM ACTIVATED for Report ${reportId}! Emergency units alerted.`);
    } else {
      alert(`GENERAL ALARM DEACTIVATED for Report ${reportId}.`);
    }
  };

  const handleManualRefresh = () => {
    fetchReports();
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

  return (
    <div className="min-h-screen bg-gray-50 p-4" onClick={() => {}}>
      <div className="w-full">
        {/* Header with refresh info */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Emergency Reports Overview</h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => {
                console.log('Testing API connection...');
                fetch(`${API_URL}/get_reports`)
                  .then(response => {
                    console.log('Test response status:', response.status);
                    return response.json();
                  })
                  .then(data => {
                    console.log('Test API data:', data);
                    alert(`API Test: Found ${data.length} reports`);
                  })
                  .catch(error => {
                    console.error('Test API error:', error);
                    alert('API Test failed: ' + error.message);
                  });
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Test API
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                <input
                  type="text"
                  placeholder="Search report by location, reporter, cause, or structure type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-3 px-8 py-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-lg"
            >
              <FiFilter className="w-6 h-6" />
              <span>FILTERS</span>
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Status</label>
                  <select className="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500">
                    <option value="all">All Statuses</option>
                    <option value="On Going">On Going</option>
                    <option value="Under Control">Under Control</option>
                    <option value="Fire Out">Fire Out</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Fire Alarm Level</label>
                  <select className="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500">
                    <option value="all">All Levels</option>
                    <option value="1st Alarm">1st Alarm</option>
                    <option value="2nd Alarm">2nd Alarm</option>
                    <option value="3rd Alarm">3rd Alarm</option>
                    <option value="4th Alarm">4th Alarm</option>
                    <option value="5th Alarm">5th Alarm</option>
                    <option value="TASK FORCE">TASK FORCE</option>
                    <option value="General Alarm">General Alarm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Time Range</label>
                  <select className="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500">
                    <option value="all">All Times</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => setSearchQuery('')}
                    className="w-full px-6 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-lg font-medium"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-xl shadow-sm p-8 mb-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading reports...</p>
          </div>
        )}

        {/* Reports Table */}
        {!isLoading && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w[X]1200px]">
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
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                        {searchQuery ? 'No reports match your search criteria' : 'No reports available'}
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((report) => (
                      <tr 
                        key={report.id} 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReportClick(report);
                        }}
                      >
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {report.time}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.reporter}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.location}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-md text-xs font-medium border ${getStatusColor(report.status)}`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-md text-xs font-medium border ${getAlarmLevelColor(report.fireAlarmLevel)}`}>
                            {report.fireAlarmLevel}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {report.suggestedAlarm === 'GENERAL ALARM' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGeneralAlarm(report.id);
                              }}
                              className={`px-3 py-1 rounded-md text-xs font-medium text-white transition-all duration-300 transform hover:scale-105 ${
                                generalAlarmStates[report.id] 
                                  ? 'bg-red-600 animate-pulse shadow-red-500/50 ring-4 ring-red-400 ring-opacity-75 animate-bounce' 
                                  : 'bg-red-500 hover:bg-red-600 shadow-red-400/50 hover:ring-2 hover:ring-red-300 hover:ring-opacity-50'
                              }`}
                            >
                              {generalAlarmStates[report.id] ? '🚨 GENERAL ALARM ACTIVE 🚨' : 'GENERAL ALARM'}
                            </button>
                          ) : (
                           <span className={`px-3 py-1 rounded-md text-xs font-medium border ${getAlarmLevelColor(report.suggestedAlarm)}`}>
                             {report.suggestedAlarm}
                           </span>
                         )}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
                      alt="Fire Scene" 
                      className="w-full h-64 object-cover rounded-lg"
                      onError={(e) => {
                        e.target.src = '/burnhouse.jpg';
                      }}
                    />
                  </div>

                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-2">Reporter:</label>
                      <span className="text-xl font-semibold text-gray-900">{selectedReport.reporter}</span>
                    </div>
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-2">Reported:</label>
                      <span className="text-lg text-gray-500">{selectedReport.minutesAgo} min ago</span>
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-2">Location:</label>
                    <span className="text-xl font-semibold text-gray-900">{selectedReport.location}</span>
                  </div>

                  {/* Cause of Fire */}
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-3">Cause of Fire:</label>
                    <p className="text-gray-900 leading-relaxed text-lg">{selectedReport.description}</p>
                  </div>

                  {/* AI Analysis Results */}
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-blue-900 mb-4">AI Analysis Results</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Fire Detection:</label>
                        <span className="text-lg font-semibold text-blue-900">
                          {selectedReport.prediction} ({selectedReport.confidence})
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Structure Type:</label>
                        <span className="text-lg font-semibold text-blue-900">{selectedReport.structure}</span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Smoke Intensity:</label>
                        <span className="text-lg font-semibold text-blue-900">
                          {selectedReport.smokeIntensity} ({selectedReport.smokeConfidence})
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Structures Affected:</label>
                        <span className="text-lg font-semibold text-blue-900">
                          {selectedReport.numberOfStructures || 'Not specified'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status and Fire Alarm Level */}
                  <div className="grid grid-cols-1 md-grid-cols-2 gap-8">
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-3">Current Status:</label>
                      <span className={`px-4 py-3 rounded-md text-base font-medium border ${getStatusColor(selectedReport.status)}`}>
                        {selectedReport.status}
                      </span>
                    </div>
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-3">Fire Alarm Level:</label>
                      <span className={`px-3 py-3 rounded-md text-base font-medium border ${getAlarmLevelColor(selectedReport.fireAlarmLevel)}`}>
                        {selectedReport.fireAlarmLevel}
                      </span>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-2">Full Timestamp:</label>
                    <span className="text-lg text-gray-900">
                      {selectedReport.timestamp ? new Date(selectedReport.timestamp).toLocaleString() : 'Unknown'}
                    </span>
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
  );
};

export default Overview;