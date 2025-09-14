import { apiCall } from './api';

// Session API calls
export const sessionService = {
  // Get all sessions for the current user
  getSessions: async () => {
    const response = await apiCall('/game/sessions/', {
      method: 'GET',
    });
    return response.json();
  },

  // Create a new session
  createSession: async (data) => {
    const response = await apiCall('/game/sessions/', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        partner_email: data.partnerEmail,
        creator_position: data.creatorPosition || 'N',
        partner_position: data.partnerPosition || 'S',
        dealer: data.dealer || 'N',
        vulnerability: data.vulnerability || 'None',
        hands: data.hands || {}
      }),
    });
    return response.json();
  },

  // Get a specific session
  getSession: async (sessionId) => {
    const response = await apiCall(`/game/sessions/${sessionId}/`, {
      method: 'GET',
    });
    return response.json();
  },

  // Update session hands
  updateHands: async (sessionId, hands) => {
    const response = await apiCall(`/game/sessions/${sessionId}/update_hands/`, {
      method: 'POST',
      body: JSON.stringify({ hands }),
    });
    return response.json();
  },

  // Make a bid in a session
  makeBid: async (sessionId, bidAction) => {
    const response = await apiCall(`/game/sessions/${sessionId}/make_bid/`, {
      method: 'POST',
      body: JSON.stringify({ bid_action: bidAction }),
    });
    return response.json();
  },

  // Get bidding history for a session
  getBiddingHistory: async (sessionId) => {
    const response = await apiCall(`/game/sessions/${sessionId}/bidding_history/`, {
      method: 'GET',
    });
    return response.json();
  },

  // Delete a session
  deleteSession: async (sessionId) => {
    const response = await apiCall(`/game/sessions/${sessionId}/`, {
      method: 'DELETE',
    });
    return response.ok;
  },

  // Create a new deal
  createDeal: async (sessionId) => {
    const response = await apiCall(`/game/sessions/${sessionId}/create_deal/`, {
      method: 'POST',
    });
    return response.json();
  },

  // Get current deal
  getCurrentDeal: async (sessionId) => {
    const response = await apiCall(`/game/sessions/${sessionId}/current_deal/`, {
      method: 'GET',
    });
    return response.json();
  },

  // Make a call (bid/pass/double/redouble)
  makeCall: async (sessionId, dealId, call, alert = '') => {
    const response = await apiCall('/game/sessions/make_call/', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        deal_id: dealId,
        call: call,
        alert: alert
      }),
    });
    return response.json();
  },
};

// PlayerGame API calls
export const playerGameService = {
  // Get all player games for the current user
  getPlayerGames: async () => {
    const response = await apiCall('/game/player-games/', {
      method: 'GET',
    });
    return response.json();
  },

  // Get a specific player game
  getPlayerGame: async (playerGameId) => {
    const response = await apiCall(`/game/player-games/${playerGameId}/`, {
      method: 'GET',
    });
    return response.json();
  },
};