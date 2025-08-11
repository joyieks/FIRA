import React, { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiClock, FiMapPin, FiUser, FiAlertTriangle, FiBell, FiTrendingUp, FiX } from 'react-icons/fi';

const Overview = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reports, setReports] = useState([]);
  const [generalAlarmStates, setGeneralAlarmStates] = useState({});

  // Sample reports data
  useEffect(() => {
    const sampleReports = [
      {
        id: 1,
        time: '14:32',
        reporter: 'Eijay',
        location: 'Cebu',
        status: 'On Going',
        fireAlarmLevel: '1st Alarm',
        suggestedAlarm: 'GENERAL ALARM',
        description: 'Fire outbreak in residential building with multiple units affected. Smoke visible from 3rd floor. Multiple calls received.',
        picture: '/burnhouse.jpg',
        minutesAgo: 5
      },
      {
        id: 2,
        time: '14:25',
        reporter: 'Sarah',
        location: 'Manila',
        status: 'Under Control',
        fireAlarmLevel: '2nd Alarm',
        suggestedAlarm: 'GENERAL ALARM',
        description: 'Kitchen fire in restaurant. Fire department on scene. Situation contained.',
        picture: '/burnhouse.jpg',
        minutesAgo: 12
      },
      {
        id: 3,
        time: '14:18',
        reporter: 'Mike',
        location: 'Davao',
        status: 'Fire Out',
        fireAlarmLevel: '3rd Alarm',
        suggestedAlarm: 'GENERAL ALARM',
        description: 'Industrial fire in warehouse. Extinguished after 2 hours. No casualties reported.',
        picture: '/burnhouse.jpg',
        minutesAgo: 25
      }
    ];
    setReports(sampleReports);
  }, []);

  // Filter reports based on search
  const filteredReports = reports.filter(report => {
    return report.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
           report.reporter.toLowerCase().includes(searchQuery.toLowerCase()) ||
           report.description.toLowerCase().includes(searchQuery.toLowerCase());
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
                 {/* Header */}
         

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                <input
                  type="text"
                  placeholder="Search report..."
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

        {/* Reports Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
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
                  <h3 className="text-2xl font-bold text-gray-900">Report Details</h3>
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
                      <span className="text-lg text-gray-500 ml-3">{selectedReport.minutesAgo} min ago</span>
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
  );
};

export default Overview;