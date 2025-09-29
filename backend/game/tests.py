from django.test import TestCase
from .bridge_auction_validator import AuctionState, validate_call, update_auction_state

class BridgeAuctionLogicTests(TestCase):
    def setUp(self):
        self.state = AuctionState(dealer='N')

    def test_valid_bid_sequence(self):
        # 1C by N, Pass by E, Pass by S, Pass by W
        calls = [('N', '1C'), ('E', 'Pass'), ('S', 'Pass'), ('W', 'Pass')]
        for seat, call in calls:
            result = validate_call(self.state, call, seat)
            self.assertTrue(result['ok'], f"Call {call} by {seat} should be valid: {result}")
            update_auction_state(self.state, call, seat)
        self.assertTrue(self.state.auction_ended)
        self.assertEqual(self.state.final_contract, '1C')

    def test_illegal_bid(self):
        # 1C by N, 1C by E (should be illegal, not higher)
        result = validate_call(self.state, '1C', 'N')
        self.assertTrue(result['ok'])
        update_auction_state(self.state, '1C', 'N')
        result = validate_call(self.state, '1C', 'E')
        self.assertFalse(result['ok'])
        self.assertIn('Illegal bid', result['error'])

    def test_double_and_redouble(self):
        # 1C by N, Pass by E, X by S (double), XX by N (redouble)
        calls = [('N', '1C'), ('E', 'Pass'), ('S', 'X'), ('W', 'Pass'), ('N', 'XX')]
        for seat, call in calls:
            result = validate_call(self.state, call, seat)
            update_auction_state(self.state, call, seat) if result['ok'] else None
        self.assertEqual(self.state.dbl_status, 'XX')

    def test_passed_out(self):
        # All pass, no bid
        calls = [('N', 'Pass'), ('E', 'Pass'), ('S', 'Pass'), ('W', 'Pass')]
        for seat, call in calls:
            result = validate_call(self.state, call, seat)
            self.assertTrue(result['ok'])
            update_auction_state(self.state, call, seat)
        self.assertTrue(self.state.auction_ended)
        self.assertEqual(self.state.final_contract, 'Passed Out')

    def test_wrong_turn(self):
        # E tries to bid first, but dealer is N
        result = validate_call(self.state, '1C', 'E')
        self.assertFalse(result['ok'])
        self.assertIn("turn", result['error'])
