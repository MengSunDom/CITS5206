# CITS5206
## Project Name: Develop a tool to help bridge partnerships discover and resolve misunderstandings in their bidding systems
Bridge is a trick-taking card game in which each deal is played by four players in two competing partnerships, partners sit opposite one another, conventionally the seats at the table are named North, South, East and West, so North and South are one partnership and East and West are the other. Each player is dealt 13 of the standard 52 card deck, and play consists of two phases:

1. The Auction, in which each partnership competes to win a contract, that is an undertaking to win at least a certain number of tricks with a given trump suit (or no trumps).
2. The Play, in which the side that won the auction (the declaring side) attempts to win enough (or more) tricks to fulfill their contract, while their opponents (the defence) attempt to stop them.
The score for the deal depends upon the contract bid, as well as whether or not the contract was met.
In this project, we will mainly be concerned with the Auction: The Auction starts with the player who is designated as the "dealer" and proceeds clockwise with each player either making a call, which can be one+ of:
- a "bid": stating a number of tricks to be made in excess of 6 (there are 13 tricks in total) as well as either a trump suit (clubs, diamonds, hearts, spades) or "no-trumps".
The bids are ordered from lowest to highest: 1C, 1D, 1H, 1S, 1NT, 2C, ..., 7S, 7NT. A bid must be higher than any previous bid in the auction.
- "double": can be made only if the opposing side have the current winning (highest) bid.
- "redouble": only if the player's currently has the winning bid and it has been doubled.
- "pass".
The auction ends once every player has called and there have been three passes in a row. Whichever side (if any) makes the highest bid wins the auction, and their contract becomes that bid, together with whether the bid was doubled or redoubled.
A great deal of the interest of bridge is the fact that the auction is not simply a matter of each player immediately bidding to their best
estimate of the contract that their side could make. Instead, partnerships will usually agree on a "bidding system" which will
usually assign "systematic" (but not secret!) meanings to many of the calls in an auction. These calls are used to allow a partnership to
convey information about their hands thus allowing them to reach a more efficient contract, or of course, obstruct the opponents' attempts to do so.
Sometimes calls will even be given "conventional" or "artificial" meanings, which differ from the more "natural" meaning of the call. For example, if a contract is doubled both the reward for making as well as the penalty for failing to make the contract is increased. When the contract is redoubled, the rewards and penalties are increased even further. Consider for example the beginning calls of an auction:
1NT, double, redouble
1NT, would naturally be an undertaking to make at least 7 tricks without a trump suit --- in most bidding systems the bid would show a "balanced" hand with some fairly tightly defined strength.
The natural and usual meaning of the double bid, would be that the left hand opponent of the opener has a strong enough hand that they do not believe that the opening side can make 7 tricks, and so they would like to increase the stakes if the hand is to be played in 1NT.
One might think that the natural meaning of the redouble bid, would be to express confidence that 7 tricks can in fact be made, so lets increase the stakes even further, however, in most systems it has quite different meanings, for example it might mean one of the following:
- "Partner, we aren't going to make 7 tricks without a trump suit, and I don't have a good suit to bid. You better pick a trump suit."
- "Partner, I don't want to play in notrumps, I do have a good suit, but for now, please just bid 2C and I'll correct that to my suit if necessary."
Which of these meanings the redouble has depends upon the details of the bidding system that the partnership involved has agreed upon
before the start of play.
Most partnerships will agree to play a well-known standard bidding system, for example in Perth, the most common systems would be "Acol",
"Standard American" and perhaps "Precision". However in addition to this partnerships will often add other conventions to handle certain common situations in auctions. For example with some partners I play a "defense to 1NT" called "Capelletti", with others, I play "Multi-Landy". Finally, different partnerships might have different agreements on the "style" in which differents hands should be bid.
Probably more important than choosing a "good" bidding system, is that both players in a partnership actually agree on what system they are playing - misunderstanding one's partner's bid is a common cause for a bad result on a deal.
The standard tool for documenting a partnerships agreement is the "system card" (for example see    https://www.abf.com.au/member-services/system-cards/) in which the partnership records their overall system, conventions, and details about other agreements, however, there is much that is left to the implicit understanding of the partnership.
In this proposal we suggest building a computerised tool, perhaps delivered as a web application, for helping bridge partnerships discover, document and resolve the more implicit misunderstandings about their bidding systems.
The basic idea is to generate a number of random deals and present these to each member of a partnership and ask them to say how the auction should proceed. Differences between how each partner responds may be an indication of a divergence in their understanding of the bidding system. Sampling enough deals should allow the discovery of most important such divergences.
More concretely, I imagine a web application, (or perhaps a phone app), that would work, roughly, as follows:
1. Individual bridge players would register with the application, and then also register as partnerships playing a given system.
2. The application generates a random set of hands.
3. The application will then have each partner bid each hand from every position, ie, in each seat at each point of the auction --- this will be an offline thing, so that partnerships do not have to be available at the same time. (The application would randomize the order that it gives positions and hands, so that the users have reasonable chance to forget what they know about the hands from the other seats.)
4. Finally, the site will detect the positions where the members of the partnership bid differently, and report these so, that the differences can be resolved by the partnership.
Some more points:
- As written above, each member of the partnership would bid the entire auction in isolation from their partners bids. It would likely be helpful to also have them bid also the positions arising from their partner's divergences from their own calls. Thus, instead of simply detecting the first divergence, one would generate the game tree containing all the auctions involving bids that either member of the partnership makes.
- There are different ways that a divergence could be resolved. For example, one or other partner could simply realise they made a
mistake, in which case they can unilaterally correct it, and the game tree would have the appropriate branches pruned. Secondly, the
partnership could agree that either bid is appropriate in the circumstance. Finally, the divergence represents a real disagreement in the partnership that needs to be resolved.
- It would be good if the application provided ways to navigate and annotate the resulting game trees. Perhaps allowing comments to be
attached at certain points, as well as divergences to be tagged as (say) simple errors, appropriate variations, or real disagreements that resolve one way or the other.
- It would also be nice to provide information about how far away the resulting auction for each deal falls from the game-theoretic (perfect information) contract.
Email: devin@27720.net (CITY OF MELVILLE BRIDGE CLUB INCORPORATED)
