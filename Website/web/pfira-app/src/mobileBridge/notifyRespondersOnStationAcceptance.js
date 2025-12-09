import { notifyRespondersOnStationAcceptance as serviceNotify } from '../../../mobile/app/services/responderNotificationService';

// Thin wrapper so web code can trigger mobile responder notifications
export const notifyRespondersOnStationAcceptance = async (stationId, reportId) => {
  return serviceNotify(stationId, reportId);
};

