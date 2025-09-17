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

  // Get a specific deal by number
  getDeal: async (sessionId, dealNumber) => {
    const params = dealNumber ? `?deal_number=${dealNumber}` : '';
    const response = await apiCall(`/game/sessions/${sessionId}/get_deal/${params}`, {
      method: 'GET',
    });
    return response.json();
  },

  // Get all deals for a session
  getAllDeals: async (sessionId) => {
    const response = await apiCall(`/game/sessions/${sessionId}/all_deals/`, {
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

  // Make a user-specific call (for independent bidding)
  makeUserCall: async (sessionId, dealId, position, call, alert = '') => {
    const response = await apiCall('/game/sessions/make_user_call/', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        deal_id: dealId,
        position: position,
        call: call,
        alert: alert
      }),
    });
    return response.json();
  },

  // Get all users' bidding sequences for a deal
  getUserSequences: async (sessionId, dealNumber) => {
    const response = await apiCall(`/game/sessions/${sessionId}/get_user_sequences/?deal_number=${dealNumber}`, {
      method: 'GET',
    });
    return response.json();
  },

  // Reset user's bidding sequence for a deal
  resetUserSequence: async (sessionId, dealId) => {
    const response = await apiCall('/game/sessions/reset_user_sequence/', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        deal_id: dealId
      }),
    });
    return response.json();
  },

  // Get next deal and position for practice
  getNextPractice: async (sessionId) => {
    const response = await apiCall(`/game/sessions/${sessionId}/get_next_practice/`, {
      method: 'GET',
    });
    return response.json();
  },

  // Get deal history for review
  getDealHistory: async (sessionId) => {
    const response = await apiCall(`/game/sessions/${sessionId}/get_deal_history/`, {
      method: 'GET',
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