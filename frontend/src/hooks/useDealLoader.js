import { useCallback } from 'react';
import { sessionService } from '../utils/gameService';

/**
 * Custom hook to handle deal loading logic
 * Separates loading concerns from UI logic
 */
export const useDealLoader = (session, state, onDealChange) => {
  const {
    setIsLoading,
    setError,
    setCurrentDeal,
    setCurrentDealNumber,
    setUserSequence,
    setCurrentBiddingPosition,
    setTotalDeals,
    setTaskReason,
    setIsAllCompleted,
    setCurrentHistory,
    setAlertText,
    setDealHistory,
    setCurrentHistoryIndex,
    setViewMode
  } = state;

  /**
   * Load next practice task from scheduler
   */
  const loadNextPractice = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const taskResponse = await sessionService.getNextTask(session.id);

      // If no task found (all caught up)
      if (!taskResponse.node_id) {
        setIsAllCompleted(true);
        setError('INFO:All deals in this session are completed. Showing completed deal for review.');

        // Load last deal for review
        const deals = await sessionService.getAllDeals(session.id);
        if (deals && deals.length > 0) {
          const lastDeal = deals[deals.length - 1];
          const seqResponse = await sessionService.getUserSequences(session.id, lastDeal.deal_number);

          const currentUserSequence = seqResponse.user_sequences?.find(
            seq => seq.user_id === JSON.parse(localStorage.getItem('user') || '{}').id
          );

          setCurrentDeal(lastDeal);
          setCurrentDealNumber(lastDeal.deal_number);
          if (onDealChange) onDealChange(lastDeal.deal_number);
          setTotalDeals(deals.length);
          setUserSequence(currentUserSequence?.sequence || []);

          // Set bidding position to last position in sequence
          if (currentUserSequence?.sequence && currentUserSequence.sequence.length > 0) {
            const lastCall = currentUserSequence.sequence[currentUserSequence.sequence.length - 1];
            const positions = ['N', 'E', 'S', 'W'];
            const lastPosIdx = positions.indexOf(lastCall.position);
            const nextPosIdx = (lastPosIdx + 1) % 4;
            setCurrentBiddingPosition(positions[nextPosIdx]);
          } else {
            setCurrentBiddingPosition(lastDeal.dealer);
          }

          setTaskReason('ALL_CAUGHT_UP');
        }
        return;
      }

      // Task found
      setCurrentDeal(taskResponse.deal);
      setCurrentDealNumber(taskResponse.deal_index);
      if (onDealChange) onDealChange(taskResponse.deal_index);
      setCurrentBiddingPosition(taskResponse.seat);
      setUserSequence(taskResponse.user_sequence || []);
      setCurrentHistory(taskResponse.history || '');

      const allDeals = await sessionService.getAllDeals(session.id);
      setTotalDeals(allDeals.length);
      setAlertText('');
      setTaskReason(taskResponse.reason || '');
      setIsAllCompleted(false);
    } catch (err) {
      setError('Failed to load next practice. Please try again.');
      console.error('Practice loading error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session.id, onDealChange, setIsLoading, setError, setCurrentDeal, setCurrentDealNumber,
      setUserSequence, setCurrentBiddingPosition, setTotalDeals, setTaskReason,
      setIsAllCompleted, setCurrentHistory, setAlertText]);

  /**
   * Load a specific deal by number
   */
  const loadSpecificDeal = useCallback(async (dealNumber) => {
    setIsLoading(true);
    setError('');
    setTaskReason('');

    try {
      const dealResponse = await sessionService.getDeal(session.id, dealNumber);
      if (dealResponse.error) {
        setError(dealResponse.error);
        return;
      }

      const seqResponse = await sessionService.getUserSequences(session.id, dealNumber);
      if (seqResponse.error) {
        setError(seqResponse.error);
        return;
      }

      const currentUserSequence = seqResponse.user_sequences?.find(
        seq => seq.user_id === JSON.parse(localStorage.getItem('user') || '{}').id
      );

      setCurrentDeal(dealResponse);
      setCurrentDealNumber(dealNumber);
      if (onDealChange) onDealChange(dealNumber);
      setUserSequence(currentUserSequence?.sequence || []);

      // Determine next position to act
      if (currentUserSequence?.sequence && currentUserSequence.sequence.length > 0) {
        const lastCall = currentUserSequence.sequence[currentUserSequence.sequence.length - 1];
        const positions = ['N', 'E', 'S', 'W'];
        const lastPosIdx = positions.indexOf(lastCall.position);
        const nextPosIdx = (lastPosIdx + 1) % 4;
        setCurrentBiddingPosition(positions[nextPosIdx]);
      } else {
        setCurrentBiddingPosition(dealResponse.dealer);
      }

      setAlertText('');
    } catch (err) {
      setError('Failed to load deal. Please try again.');
      console.error('Deal loading error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session.id, onDealChange, setIsLoading, setError, setTaskReason, setCurrentDeal,
      setCurrentDealNumber, setUserSequence, setCurrentBiddingPosition, setAlertText]);

  /**
   * Reload current deal
   */
  const reloadCurrentDeal = useCallback(async (currentDealNumber) => {
    if (!currentDealNumber) return;

    setIsLoading(true);
    setError('');

    try {
      const dealResponse = await sessionService.getDeal(session.id, currentDealNumber);
      if (dealResponse.error) {
        setError(dealResponse.error);
        return;
      }

      const seqResponse = await sessionService.getUserSequences(session.id, currentDealNumber);
      if (seqResponse.error) {
        setError(seqResponse.error);
        return;
      }

      const currentUserSequence = seqResponse.user_sequences?.find(
        seq => seq.user_id === JSON.parse(localStorage.getItem('user') || '{}').id
      );

      setCurrentDeal(dealResponse);
      setUserSequence(currentUserSequence?.sequence || []);

      if (currentUserSequence?.sequence && currentUserSequence.sequence.length > 0) {
        const lastCall = currentUserSequence.sequence[currentUserSequence.sequence.length - 1];
        const positions = ['N', 'E', 'S', 'W'];
        const lastPosIdx = positions.indexOf(lastCall.position);
        const nextPosIdx = (lastPosIdx + 1) % 4;
        setCurrentBiddingPosition(positions[nextPosIdx]);
      } else {
        setCurrentBiddingPosition(dealResponse.dealer);
      }

      setAlertText('');
    } catch (err) {
      setError('Failed to reload deal. Please try again.');
      console.error('Deal reload error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session.id, setIsLoading, setError, setCurrentDeal, setUserSequence,
      setCurrentBiddingPosition, setAlertText]);

  /**
   * Load deal history for review
   */
  const loadDealHistory = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setTaskReason('');

    try {
      const response = await sessionService.getDealHistory(session.id);

      if (response.error) {
        setError(response.error);
        return;
      }

      if (response.history && response.history.length > 0) {
        setDealHistory(response.history);
        setCurrentHistoryIndex(0);

        const firstDeal = response.history[0];
        setCurrentDeal(firstDeal);
        setCurrentDealNumber(firstDeal.deal_number);
        setUserSequence(firstDeal.sequence);
        setViewMode('history');
      } else {
        setError('No completed deals to review yet.');
      }
    } catch (err) {
      setError('Failed to load history. Please try again.');
      console.error('History loading error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session.id, setIsLoading, setError, setTaskReason, setDealHistory,
      setCurrentHistoryIndex, setCurrentDeal, setCurrentDealNumber,
      setUserSequence, setViewMode]);

  return {
    loadNextPractice,
    loadSpecificDeal,
    reloadCurrentDeal,
    loadDealHistory
  };
};
