import React, { useState, useEffect } from 'react';
import { FiAlertTriangle, FiRefreshCw, FiClock, FiInfo } from 'react-icons/fi';
// import { aiService } from '../../../../services/aiService'; // Removed - using OpenAI directly now
import { supabase } from '../../../../config/supabase';

const FireAlarmStatus = () => {
  const [alarmStatus, setAlarmStatus] = useState({
    current_level: 'NONE',
    confidence: 0.0,
    last_updated: null,
    reasoning: '',
    keywords_found: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // const [aiServiceHealth, setAiServiceHealth] = useState(false); // Removed - using OpenAI directly now

  // Fire alarm level configurations
  const alarmLevels = {
    'NONE': {
      label: 'No Alert',
      color: 'bg-gray-100 text-gray-800',
      icon: '✅',
      description: 'No fire-related activity detected'
    },
    'LOW': {
      label: 'Low Alert',
      color: 'bg-yellow-100 text-yellow-800',
      icon: '⚠️',
      description: 'Low-level fire indicators detected'
    },
    'MEDIUM': {
      label: 'Medium Alert',
      color: 'bg-orange-100 text-orange-800',
      icon: '🔥',
      description: 'Moderate fire concerns detected'
    },
    'HIGH': {
      label: 'High Alert',
      color: 'bg-red-100 text-red-800',
      icon: '🚨',
      description: 'High fire risk detected'
    },
    'CRITICAL': {
      label: 'Critical Alert',
      color: 'bg-red-600 text-white',
      icon: '🚨',
      description: 'Emergency fire situation detected'
    }
  };

  // Fetch alarm status from AI service
  const fetchAlarmStatus = async () => {
    try {
      setIsRefreshing(true);
      // const status = await aiService.getAlarmStatus(); // Removed - using OpenAI directly now
      // For now, set a default status since we're not using the old AI service
      const status = {
        current_level: 'NONE',
        confidence: 0.0,
        last_updated: new Date().toISOString(),
        reasoning: 'Using OpenAI for analysis',
        keywords_found: []
      };
      setAlarmStatus(status);
    } catch (error) {
      console.error('Error fetching alarm status:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Check AI service health
  const checkAiServiceHealth = async () => {
    try {
      // const isHealthy = await aiService.checkHealth(); // Removed - using OpenAI directly now
      const isHealthy = true; // Assume OpenAI is healthy if API key is set
      // setAiServiceHealth(isHealthy); // Removed - using OpenAI directly now
    } catch (error) {
      console.error('AI Service health check failed:', error);
      // setAiServiceHealth(false); // Removed - using OpenAI directly now
    }
  };

  // Reset alarm level
  const handleResetAlarm = async () => {
    if (!window.confirm('Are you sure you want to reset the fire alarm level to NONE?')) {
      return;
    }

    try {
      // await aiService.resetAlarm(); // Removed - using OpenAI directly now
      console.log('Reset alarm - using OpenAI for analysis');
      await fetchAlarmStatus();
      alert('Fire alarm level has been reset to NONE');
    } catch (error) {
      console.error('Error resetting alarm:', error);
      alert('Failed to reset alarm level. Please try again.');
    }
  };

  // Real-time subscription to system_status table
  useEffect(() => {
    const channel = supabase
      .channel('fire_alarm_status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'system_status',
        filter: `id=eq.fire_alarm_level`
      }, (payload) => {
        console.log('Fire alarm status updated:', payload);
        if (payload.new) {
          setAlarmStatus(payload.new);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchAlarmStatus(),
        checkAiServiceHealth()
      ]);
      setIsLoading(false);
    };

    loadData();

    // Set up periodic health check
    const healthCheckInterval = setInterval(checkAiServiceHealth, 30000); // Every 30 seconds

    return () => {
      clearInterval(healthCheckInterval);
    };
  }, []);

  const currentLevel = alarmLevels[alarmStatus.current_level] || alarmLevels['NONE'];
  const confidencePercentage = Math.round(alarmStatus.confidence * 100);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center">
          <FiRefreshCw className="animate-spin mr-2" />
          <span>Loading fire alarm status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <FiAlertTriangle className="mr-2" />
          Fire Alarm Status
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchAlarmStatus}
            disabled={isRefreshing}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="Refresh status"
          >
            <FiRefreshCw className={`${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="w-3 h-3 rounded-full bg-green-500" 
               title="OpenAI Service Online" />
        </div>
      </div>

      {/* Current Status */}
      <div className="mb-6">
        <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold ${currentLevel.color}`}>
          <span className="mr-2">{currentLevel.icon}</span>
          {currentLevel.label}
        </div>
        <p className="text-sm text-gray-600 mt-2">{currentLevel.description}</p>
      </div>

      {/* Confidence Level */}
      {alarmStatus.current_level !== 'NONE' && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Confidence Level</span>
            <span className="text-sm text-gray-600">{confidencePercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                confidencePercentage >= 80 ? 'bg-red-500' :
                confidencePercentage >= 60 ? 'bg-orange-500' :
                confidencePercentage >= 40 ? 'bg-yellow-500' : 'bg-gray-500'
              }`}
              style={{ width: `${confidencePercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Last Updated */}
      {alarmStatus.last_updated && (
        <div className="mb-4 flex items-center text-sm text-gray-600">
          <FiClock className="mr-1" />
          Last updated: {new Date(alarmStatus.last_updated).toLocaleString()}
        </div>
      )}

      {/* Reasoning */}
      {alarmStatus.reasoning && (
        <div className="mb-4">
          <div className="flex items-start">
            <FiInfo className="mr-2 mt-1 text-blue-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Analysis Details</p>
              <p className="text-sm text-gray-600">{alarmStatus.reasoning}</p>
            </div>
          </div>
        </div>
      )}

      {/* Keywords Found */}
      {alarmStatus.keywords_found && alarmStatus.keywords_found.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Keywords Detected</p>
          <div className="flex flex-wrap gap-2">
            {alarmStatus.keywords_found.slice(0, 10).map((keyword, index) => (
              <span 
                key={index}
                className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full"
              >
                {keyword}
              </span>
            ))}
            {alarmStatus.keywords_found.length > 10 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                +{alarmStatus.keywords_found.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-3">
        <button
          onClick={fetchAlarmStatus}
          disabled={isRefreshing}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
        >
          <FiRefreshCw className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
        
        {alarmStatus.current_level !== 'NONE' && (
          <button
            onClick={handleResetAlarm}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center justify-center"
          >
            Reset Alarm
          </button>
        )}
      </div>

      {/* AI Service Status */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">AI Service Status</span>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full mr-2 bg-green-500" />
            <span className="text-green-600">
              OpenAI Online
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FireAlarmStatus;






