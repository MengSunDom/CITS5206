import { useState } from 'react';

/**
 * Custom hook to manage game state
 * Centralizes all state management for the game area
 */
export const useGameState = () => {
  // Deal state
  const [currentDeal, setCurrentDeal] = useState(null);
  const [currentDealNumber, setCurrentDealNumber] = useState(null);
  const [totalDeals, setTotalDeals] = useState(0);

  // Bidding state
  const [currentBiddingPosition, setCurrentBiddingPosition] = useState('');
  const [userPosition, setUserPosition] = useState('S');
  const [userSequence, setUserSequence] = useState([]);
  const [alertText, setAlertText] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // View mode state
  const [viewMode, setViewMode] = useState('practice'); // 'practice' or 'history'
  const [dealHistory, setDealHistory] = useState([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

  // Task state
  const [taskReason, setTaskReason] = useState('');
  const [isAllCompleted, setIsAllCompleted] = useState(false);
  const [currentHistory, setCurrentHistory] = useState('');

  return {
    // Deal state
    currentDeal,
    setCurrentDeal,
    currentDealNumber,
    setCurrentDealNumber,
    totalDeals,
    setTotalDeals,

    // Bidding state
    currentBiddingPosition,
    setCurrentBiddingPosition,
    userPosition,
    setUserPosition,
    userSequence,
    setUserSequence,
    alertText,
    setAlertText,

    // UI state
    isLoading,
    setIsLoading,
    error,
    setError,
    isSyncing,
    setIsSyncing,
    lastSyncTime,
    setLastSyncTime,

    // View mode state
    viewMode,
    setViewMode,
    dealHistory,
    setDealHistory,
    currentHistoryIndex,
    setCurrentHistoryIndex,

    // Task state
    taskReason,
    setTaskReason,
    isAllCompleted,
    setIsAllCompleted,
    currentHistory,
    setCurrentHistory
  };
};
