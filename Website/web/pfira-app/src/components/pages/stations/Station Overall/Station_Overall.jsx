import React, { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiX, FiChevronDown, FiUserPlus } from 'react-icons/fi';
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
  const [openAssignDropdown, setOpenAssignDropdown] = useState(null);
  const [assigning, setAssigning] = useState({}); // reportId->boolean
  const [responders, setResponders] = useState([]);
  const [currentStationId, setCurrentStationId] = useState(null);
  const [assignedResponders, setAssignedResponders] = useState([]);
  const [showAssignedDropdown, setShowAssignedDropdown] = useState(false);
  const [responderSelection, setResponderSelection] = useState({}); // reportId -> Set of responderIds
  const [responderExisting, setResponderExisting] = useState({}); // reportId -> Set of responderIds
  const [aiChatSuggestions, setAiChatSuggestions] = useState([]); // recent AI suggestions from messages
  const [chatAlarmByReport, setChatAlarmByReport] = useState({}); // reportId -> normalized label

  const API_URL = 'https://fire-detection-api-production-f8a3.up.railway.app';

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
        setCurrentStationId(stationId || null);
        if (!stationId) { setReports([]); return; }
        
        // Fetch assigned reports for this station directly
        const { data: stationAssignments, error: stationErr } = await supabase
          .from('report_assignments')
          .select('report_id')
          .eq('assignee_type', 'station')
          .eq('assignee_id', stationId);
        if (stationErr) throw stationErr;

        // Fetch responders for this station, then their assigned reports
        const { data: stationResponders, error: respErr } = await supabase
          .from('responders')
          .select('id')
          .eq('station_id', stationId);
        if (respErr) throw respErr;
        const responderIds = (stationResponders || []).map(r => r.id);

        let responderAssignments = [];
        if (responderIds.length > 0) {
          const { data: respAssigns, error: respAssignErr } = await supabase
            .from('report_assignments')
            .select('report_id')
            .eq('assignee_type', 'responder')
            .in('assignee_id', responderIds);
          if (respAssignErr) throw respAssignErr;
          responderAssignments = respAssigns || [];
        }
        
        const { data: forwarded, error: forwardError } = await supabase
          .from('report_routes')
          .select('report_id, note, forwarded_at')
          .eq('target', `station:${stationId}`);
        if (forwardError) console.error('Error fetching forwarded reports:', forwardError);
        
        // Get original assignee info for forwarded reports
        const forwardedReportIds = (forwarded||[]).map(f => String(f.report_id));
        let originalAssignees = new Map();
        
        if (forwardedReportIds.length > 0) {
          const { data: assignmentData } = await supabase
            .from('report_assignments')
            .select('report_id, assignee_type, assignee_id')
            .in('report_id', forwardedReportIds);
          
          if (assignmentData) {
            const stationAssignees = assignmentData.filter(a => a.assignee_type === 'station');
            if (stationAssignees.length > 0) {
              const stationIds = stationAssignees.map(a => a.assignee_id);
              const { data: stationNames } = await supabase
                .from('station_users')
                .select('id, station_name')
                .in('id', stationIds);
              
              if (stationNames) {
                const stationNameMap = new Map(stationNames.map(s => [s.id, s.station_name]));
                assignmentData.forEach(a => {
                  if (a.assignee_type === 'station') {
                    originalAssignees.set(String(a.report_id), {
                      type: 'station',
                      name: stationNameMap.get(a.assignee_id) || 'Unknown Station'
                    });
                  } else {
                    originalAssignees.set(String(a.report_id), {
                      type: 'responder',
                      name: 'Responder'
                    });
                  }
                });
              }
            }
          }
        }
        
        // Create map of forwarded metadata
        const forwardedMetadata = new Map();
        (forwarded||[]).forEach(f => {
          const originalAssignee = originalAssignees.get(String(f.report_id));
          forwardedMetadata.set(String(f.report_id), {
            note: f.note,
            forwarded_at: f.forwarded_at,
            original_assignee: originalAssignee
          });
        });
        
        // Combine both
        const assignedIds = new Set([
          ...((stationAssignments || []).map(a => String(a.report_id))),
          ...((responderAssignments || []).map(a => String(a.report_id)))
        ]);
        const forwardedIds = new Set((forwarded||[]).map(f=>String(f.report_id)));
        const ids = new Set([...assignedIds, ...forwardedIds]);
        
        console.log(`Station Overall: ${assignedIds.size} assigned, ${forwardedIds.size} forwarded`);
        
        if (!ids.size) { setReports([]); return; }
        const resp = await fetch(`${API_URL}/get_reports`);
        const data = resp.ok ? await resp.json() : [];
        const filtered = (data||[]).filter(r=>ids.has(String(r.id)));
        const mapped = filtered.map(r=>{
          const aiOverride = chatAlarmByReport[String(r.id)];
          const forwardingInfo = forwardedMetadata.get(String(r.id));
          return {
            id: r.id,
            time: formatTime(r.formatted_timestamp || r.created_at),
            reporter: r.reporter || 'Unknown Reporter',
            location: r.address || r.geotag_location || 'Location unavailable',
            status: r.status || 'On Going',
            suggestedAlarmLevel: aiOverride || r.recommended_alarm_level || r.alarm_level || 'Under Control',
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
            geotag_location: r.geotag_location,
            // Attach forwarding metadata
            is_forwarded: !!forwardingInfo,
            forwarding_note: forwardingInfo?.note,
            forwarded_at: forwardingInfo?.forwarded_at,
            original_assignee: forwardingInfo?.original_assignee
          };
        });
        setReports(mapped.sort((a,b)=> new Date(b.timestamp||0)-new Date(a.timestamp||0)));
      } catch (e) {
        console.error('Station Overall load error:', e);
        setReports([]);
      } finally { setIsLoading(false); }
    };
    load();
  }, []);

  // Load AI suggestions from messages table to override suggested alarm level
  useEffect(() => {
    const loadAiSuggestions = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id, ai_suggested_alarm, created_at, report_id')
          .not('ai_suggested_alarm', 'is', null)
          .order('created_at', { ascending: false })
          .limit(300);
        if (!error) setAiChatSuggestions(data || []);
      } catch (_) {}
    };
    loadAiSuggestions();
    const interval = setInterval(loadAiSuggestions, 30000);
    return () => clearInterval(interval);
  }, []);

  // Normalize and keep strongest AI suggested alarm per report
  useEffect(() => {
    const toStrength = (label) => {
      const map = {
        'Under Control': 0,
        '1st Alarm': 1,
        '2nd Alarm': 2,
        '3rd Alarm': 3,
        '4th Alarm': 4,
        '5th Alarm': 5,
        'TASK FORCE ALPHA': 6,
        'TASK FORCE BRAVO': 7,
        'TASK FORCE CHARLIE': 8,
        'TASK FORCE DELTA': 9,
        'GENERAL ALARM': 10
      };
      return map[label] ?? 0;
    };
    const normalizeAiLabel = (aiValue) => {
      if (!aiValue) return null;
      let suggested = null;
      if (typeof aiValue === 'string') {
        const trimmed = aiValue.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try { return normalizeAiLabel(JSON.parse(trimmed)); } catch (_) {}
        }
        suggested = aiValue;
      } else if (aiValue?.suggested_alarm) {
        suggested = aiValue.suggested_alarm;
      } else if (aiValue?.original_response?.alarm_level) {
        suggested = aiValue.original_response.alarm_level.toLowerCase().replace(/\s+/g, '_');
      }
      if (!suggested) return null;
      const map = {
        none: 'Under Control',
        first: '1st Alarm', first_alarm: '1st Alarm',
        second: '2nd Alarm', second_alarm: '2nd Alarm',
        third: '3rd Alarm', third_alarm: '3rd Alarm',
        fourth: '4th Alarm', fourth_alarm: '4th Alarm',
        fifth: '5th Alarm', fifth_alarm: '5th Alarm',
        task_force_alpha: 'TASK FORCE ALPHA',
        task_force_bravo: 'TASK FORCE BRAVO',
        task_force_charlie: 'TASK FORCE CHARLIE',
        task_force_delta_echo_hotel_india: 'TASK FORCE DELTA',
        general: 'GENERAL ALARM'
      };
      return map[suggested] || suggested;
    };

    const bestByReport = {};
    (aiChatSuggestions || []).forEach((m) => {
      const reportId = m.report_id;
      if (!reportId) return;
      const label = normalizeAiLabel(m.ai_suggested_alarm);
      if (!label) return;
      const current = bestByReport[reportId];
      if (!current || toStrength(label) > toStrength(current)) {
        bestByReport[reportId] = label;
      }
    });
    setChatAlarmByReport(bestByReport);
  }, [aiChatSuggestions]);

  // When AI overrides change, update suggestedAlarmLevel in current list
  useEffect(() => {
    if (!reports || Object.keys(chatAlarmByReport).length === 0) return;
    setReports(prev => prev.map(r => ({
      ...r,
      suggestedAlarmLevel: chatAlarmByReport[String(r.id)] || r.suggestedAlarmLevel
    })));
  }, [chatAlarmByReport]);

  // Load responders for this station (active contacts)
  useEffect(() => {
    const loadResponders = async () => {
      try {
        if (!currentStationId) return;
        const { data, error } = await supabase
          .from('responders')
          .select('id, first_name, last_name, email')
          .eq('station_id', currentStationId);
        if (!error) setResponders(data || []);
      } catch (_) {}
    };
    loadResponders();
  }, [currentStationId]);

  const toggleStatusDropdown = (reportId) => {
    setOpenStatusDropdown(openStatusDropdown === reportId ? null : reportId);
    setOpenAlarmDropdown(null);
  };

  const toggleAlarmDropdown = (reportId) => {
    setOpenAlarmDropdown(openAlarmDropdown === reportId ? null : reportId);
    setOpenStatusDropdown(null);
  };

  const toggleAssignDropdown = async (reportId) => {
    const nextOpen = openAssignDropdown === reportId ? null : reportId;
    setOpenAssignDropdown(nextOpen);
    if (nextOpen) {
      try {
        const rid = String(reportId);
        const { data, error } = await supabase
          .from('report_assignments')
          .select('assignee_id')
          .eq('report_id', rid)
          .eq('assignee_type', 'responder');
        if (!error) {
          const ids = new Set((data || []).map(r => r.assignee_id));
          setResponderExisting(prev => ({ ...prev, [rid]: ids }));
          setResponderSelection(prev => ({ ...prev, [rid]: new Set(ids) }));
        }
      } catch (_) {}
    }
  };

  const handleStatusChange = (reportId, newStatus) => {
    setReports(prev => prev.map(report => 
      report.id === reportId ? { ...report, status: newStatus } : report
    ));
    setOpenStatusDropdown(null);
  };

  const handleAlarmLevelChange = (reportId, newLevel) => {
    setReports(prev => prev.map(report => 
      report.id === reportId ? { ...report, finalAlarmLevel: newLevel } : report
    ));
    setOpenAlarmDropdown(null);
  };

  const closeAllDropdowns = () => {
    setOpenStatusDropdown(null);
    setOpenAlarmDropdown(null);
    setOpenAssignDropdown(null);
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

  // Load assigned responders for the selected report when modal opens
  useEffect(() => {
    const loadAssigned = async () => {
      try {
        if (!showReportModal || !selectedReport?.id) { setAssignedResponders([]); return; }
        const rid = String(selectedReport.id);
        const { data: assigns, error } = await supabase
          .from('report_assignments')
          .select('assignee_id')
          .eq('report_id', rid)
          .eq('assignee_type', 'responder');
        if (error) { setAssignedResponders([]); return; }
        const responderIds = (assigns || []).map(a => a.assignee_id);
        if (responderIds.length === 0) { setAssignedResponders([]); return; }
        const { data: respData } = await supabase
          .from('responders')
          .select('id, first_name, last_name, email')
          .in('id', responderIds);
        setAssignedResponders(respData || []);
      } catch (_) {
        setAssignedResponders([]);
      }
    };
    loadAssigned();
  }, [showReportModal, selectedReport?.id]);

  // Commit responder assignments for a report (adds/removes to match current selection)
  const commitResponderAssignments = async (reportId) => {
    const rid = String(reportId);
    const selected = responderSelection[rid] || new Set();
    const existing = responderExisting[rid] || new Set();
    const toAdd = [...selected].filter(id => !existing.has(id));
    const toRemove = [...existing].filter(id => !selected.has(id));
    try {
      setAssigning(prev => ({ ...prev, [rid]: true }));
      // Add new (robust to older schemas without composite unique index)
      if (toAdd.length > 0) {
        try {
          // Re-fetch to avoid stale existing set and filter duplicates manually
          const { data: existingRows } = await supabase
            .from('report_assignments')
            .select('assignee_id')
            .eq('report_id', rid)
            .eq('assignee_type', 'responder');
          const latest = new Set((existingRows || []).map(r => r.assignee_id));
          const uniqueAdds = toAdd.filter(id => !latest.has(id));
          if (uniqueAdds.length > 0) {
            const rows = uniqueAdds.map(id => ({ report_id: rid, assignee_type: 'responder', assignee_id: id }));
            const { error: addErr } = await supabase.from('report_assignments').insert(rows);
            if (addErr) {
              // If the backend still has a unique constraint on report_id, inserting multiple will fail
              // Surface a friendly guidance
              if ((addErr.message || '').toLowerCase().includes('unique') || (addErr.code === '23505')) {
                console.error('Assignment insert constraint issue:', addErr);
                alert('Your database schema prevents multiple responders per report. Please run the provided migration to allow multi-assign.');
              } else {
                alert(`Failed to add responder(s): ${addErr.message}`);
              }
            }
          }
        } catch (err) {
          alert(`Failed to add responder(s): ${err.message}`);
        }
      }
      // Remove unchecked
      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from('report_assignments')
          .delete()
          .eq('report_id', rid)
          .eq('assignee_type', 'responder')
          .in('assignee_id', toRemove);
        if (delErr) {
          alert(`Failed to remove responder(s): ${delErr.message}`);
        }
      }
      // Update baselines and close
      const newExisting = new Set(selected);
      setResponderExisting(prev => ({ ...prev, [rid]: newExisting }));
      setOpenAssignDropdown(null);
      // Refresh assigned responders in modal if open on this report
      if (showReportModal && selectedReport?.id && String(selectedReport.id) === rid) {
        try {
          const { data: assigns2 } = await supabase
            .from('report_assignments')
            .select('assignee_id')
            .eq('report_id', rid)
            .eq('assignee_type', 'responder');
          const ids2 = (assigns2 || []).map(a => a.assignee_id);
          if (ids2.length > 0) {
            const { data: respData2 } = await supabase
              .from('responders')
              .select('id, first_name, last_name, email')
              .in('id', ids2);
            setAssignedResponders(respData2 || []);
          } else {
            setAssignedResponders([]);
          }
        } catch (_) {}
      }
    } catch (e) {
      alert(`Failed to update assignments: ${e.message}`);
    } finally {
      setAssigning(prev => ({ ...prev, [rid]: false }));
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
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Assign</th>
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
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleAssignDropdown(report.id); }}
                            className="px-3 py-1 rounded-md text-xs font-medium border bg-white hover:bg-gray-50 flex items-center gap-1"
                            title="Assign responders"
                          >
                            <FiUserPlus className="inline" />
                            Assign
                            <FiChevronDown className="inline" />
                          </button>
                          {openAssignDropdown === report.id && (
                            <div className="absolute z-20 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg p-2">
                              <div className="max-h-56 overflow-auto">
                                {responders.length === 0 ? (
                                  <div className="text-xs text-gray-500 px-2 py-2">No responders for this station.</div>
                                ) : (
                                  responders.map((r) => {
                                    const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Responder';
                                    const rid = String(report.id);
                                    const selectedSet = responderSelection[rid] || new Set();
                                    const checked = selectedSet.has(r.id);
                                    const alreadyAssigned = (responderExisting[rid] || new Set()).has(r.id);
                                    return (
                                      <label key={r.id} className="flex items-center justify-between gap-2 px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer" onClick={(e)=>e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            setResponderSelection(prev => {
                                              const next = new Set(prev[rid] || []);
                                              if (e.target.checked) next.add(r.id); else next.delete(r.id);
                                              return { ...prev, [rid]: next };
                                            });
                                          }}
                                        />
                                        <span className="flex-1">{name}</span>
                                        {alreadyAssigned && (
                                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">Assigned</span>
                                        )}
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                              <div className="pt-2 text-right">
                                <button
                                  className={`px-3 py-1 text-xs rounded ${assigning[String(report.id)] ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                  disabled={!!assigning[String(report.id)]}
                                  onClick={(e) => { e.stopPropagation(); commitResponderAssignments(report.id); }}
                                >
                                  {assigning[String(report.id)] ? 'Saving...' : 'Done'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
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
                      {/* Manual Fire Alarm Level (final) */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAlarmDropdown(report.id);
                            }}
                            className={`px-3 py-1 rounded-md text-xs font-medium border ${getAlarmLevelColor(report.finalAlarmLevel)} hover:bg-gray-50 transition-colors`}
                          >
                            {report.finalAlarmLevel}
                          </button>
                          {openAlarmDropdown === report.id && (
                            <div className="absolute z-10 mt-1 w-40 bg-white border border-gray-300 rounded-md shadow-lg">
                              <div className="py-1">
                                {['1st Alarm', '2nd Alarm', '3rd Alarm', '4th Alarm', '5th Alarm', 'TASK FORCE', 'General Alarm'].map((level) => (
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
                      {/* AI Suggested Fire Alarm (display only) */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-md text-xs font-medium border ${getAlarmLevelColor(report.suggestedAlarmLevel)}`}>
                          {report.suggestedAlarmLevel}
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

                    {/* Show forwarding information if this report was forwarded */}
                    {selectedReport.is_forwarded && (
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <span className="text-2xl">📨</span>
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-amber-900 mb-2">Forwarded Report</h4>
                            {selectedReport.original_assignee && (
                              <p className="text-base text-amber-800 mb-2">
                                <strong>Originally assigned to:</strong> {selectedReport.original_assignee.name}
                              </p>
                            )}
                            {selectedReport.forwarding_note && (
                              <p className="text-base text-amber-800 mb-2">
                                <strong>Note:</strong> {selectedReport.forwarding_note}
                              </p>
                            )}
                            {selectedReport.forwarded_at && (
                              <p className="text-sm text-amber-700">
                                Forwarded: {new Date(selectedReport.forwarded_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Location and Time with Assigned Responders Dropdown */}
                    <div className="flex justify-between items-center">
                      <div>
                        <label className="block text-lg font-medium text-gray-700 mb-2">Location:</label>
                        <span className="text-xl font-semibold text-gray-900">{selectedReport.location}</span>
                      </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <button
                          onClick={() => setShowAssignedDropdown(v => !v)}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                          title="View assigned responders"
                        >
                          Assigned Responders ({assignedResponders.length})
                        </button>
                        {showAssignedDropdown && (
                          <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-[99999]">
                            <div className="max-h-56 overflow-auto py-2">
                              {assignedResponders.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-gray-500">No responders assigned</div>
                              ) : assignedResponders.map(r => (
                                <div key={r.id} className="px-3 py-2 text-sm text-gray-800 hover:bg-gray-50">
                                  {`${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Responder'}
                                  <div className="text-xs text-gray-500">{r.email}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-lg text-gray-500">{selectedReport.minutesAgo} min ago</span>
                    </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-3">Description:</label>
                      <p className="text-gray-900 leading-relaxed text-lg">{selectedReport.description}</p>
                    </div>

                    {/* Status and Alarm Levels (match admin view) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div>
                        <label className="block text-lg font-medium text-gray-700 mb-3">Current Status:</label>
                        <span className={`px-4 py-3 rounded-md text-base font-medium border ${getStatusColor(selectedReport.status)}`}>
                          {selectedReport.status}
                        </span>
                      </div>
                      <div>
                        <label className="block text-lg font-medium text-gray-700 mb-3">Suggested Alarm Level:</label>
                        <span className={`px-3 py-3 rounded-md text-base font-medium border ${getAlarmLevelColor(selectedReport.suggestedAlarmLevel)}`}>
                          {selectedReport.suggestedAlarmLevel}
                        </span>
                      </div>
                      <div>
                        <label className="block text-lg font-medium text-gray-700 mb-3">Final Alarm Level:</label>
                        <span className={`px-3 py-3 rounded-md text-base font-medium border ${getAlarmLevelColor(selectedReport.finalAlarmLevel)}`}>
                          {selectedReport.finalAlarmLevel}
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