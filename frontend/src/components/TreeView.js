import React, { useState, useEffect, useRef } from 'react';
import { sessionService } from '../utils/gameService';
import './TreeView.css';

function TreeView({ session, onBackToGame }) {
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDealIndex, setSelectedDealIndex] = useState(1);
  const [availableDeals, setAvailableDeals] = useState([]);
  const [comments, setComments] = useState({});
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    // Load current user from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);

    // Load available deals for the session
    if (session && session.id) {
      loadAvailableDeals();
    }
  }, [session]);

  const loadAvailableDeals = async () => {
    try {
      const response = await sessionService.getAllDeals(session.id);
      if (response && response.deals) {
        // Filter deals that have tree data (has_tree_data flag from backend)
        const availableDeals = response.deals.filter(deal => deal.has_tree_data);
        setAvailableDeals(availableDeals);
        if (availableDeals.length > 0 && !selectedDealIndex) {
          setSelectedDealIndex(availableDeals[0].deal_number);
        }
      }
    } catch (err) {
      console.error('Failed to load deals:', err);
    }
  };

  const renderTree = (data) => {
    if (!data || !data.nodes || !svgRef.current) return;

    const svg = svgRef.current;
    const svgWidth = 1600;
    const svgHeight = 900;
    const nodeRadius = 20;
    const levelHeight = 100;
    const minNodeSpacing = 70;

    // Clear existing content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Build adjacency map for tree structure
    const childrenMap = {};
    data.edges.forEach(edge => {
      if (!childrenMap[edge.from]) {
        childrenMap[edge.from] = [];
      }
      childrenMap[edge.from].push(edge.to);
    });

    // Calculate subtree width for each node (number of leaf nodes in subtree)
    const subtreeWidths = {};
    const calculateSubtreeWidth = (nodeId) => {
      if (subtreeWidths[nodeId] !== undefined) {
        return subtreeWidths[nodeId];
      }

      const children = childrenMap[nodeId] || [];
      if (children.length === 0) {
        // Leaf node
        subtreeWidths[nodeId] = 1;
        return 1;
      }

      // Sum of all children's subtree widths
      let totalWidth = 0;
      children.forEach(childId => {
        totalWidth += calculateSubtreeWidth(childId);
      });
      subtreeWidths[nodeId] = totalWidth;
      return totalWidth;
    };

    if (data.root) {
      calculateSubtreeWidth(data.root);
    }

    // Calculate node positions using subtree widths
    const nodePositions = {};
    const processedNodes = new Set();

    const layoutTree = (nodeId, leftBound, rightBound, level) => {
      if (processedNodes.has(nodeId)) return;
      processedNodes.add(nodeId);

      // Position this node in the center of its allocated space
      const x = (leftBound + rightBound) / 2;
      const y = 50 + level * levelHeight;
      nodePositions[nodeId] = { x, y, level };

      const children = childrenMap[nodeId] || [];
      if (children.length === 0) return;

      // Allocate horizontal space to children based on their subtree widths
      let currentX = leftBound;
      children.forEach(childId => {
        const childWidth = subtreeWidths[childId];
        const totalWidth = subtreeWidths[nodeId];
        const allocatedWidth = (rightBound - leftBound) * (childWidth / totalWidth);

        layoutTree(childId, currentX, currentX + allocatedWidth, level + 1);
        currentX += allocatedWidth;
      });
    };

    if (data.root) {
      const totalWidth = subtreeWidths[data.root] * minNodeSpacing;
      const startX = (svgWidth - totalWidth) / 2;
      layoutTree(data.root, startX, startX + totalWidth, 0);
    }

    // Draw edges
    const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgeGroup.setAttribute('class', 'edges');

    data.edges.forEach(edge => {
      const fromPos = nodePositions[edge.from];
      const toPos = nodePositions[edge.to];

      if (fromPos && toPos) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromPos.x);
        line.setAttribute('y1', fromPos.y);
        line.setAttribute('x2', toPos.x);
        line.setAttribute('y2', toPos.y);

        // Determine edge color based on by_set
        let bySetClass = '';
        if (edge.by_set) {
          if (edge.by_set.length === 2) {
            bySetClass = 'by-both'; // black
          } else if (edge.by_set.includes('creator')) {
            bySetClass = 'by-creator'; // red
          } else if (edge.by_set.includes('partner')) {
            bySetClass = 'by-partner'; // blue
          }
        }

        const statusClass = data.nodes[edge.to]?.status === 'closed' ? 'closed' : '';
        line.setAttribute('class', `edge ${bySetClass} ${statusClass}`);
        edgeGroup.appendChild(line);

        // Add call label centered on edge
        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        // Position label at center of edge
        const labelX = (fromPos.x + toPos.x) / 2;
        const labelY = (fromPos.y + toPos.y) / 2;

        // Background rect for label
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', labelX - 32);
        rect.setAttribute('y', labelY - 16);
        rect.setAttribute('width', 64);
        rect.setAttribute('height', 32);
        rect.setAttribute('class', 'label-bg');
        rect.setAttribute('rx', 4);
        labelGroup.appendChild(rect);

        // Call text
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', labelX);
        text.setAttribute('y', labelY - 3);
        text.setAttribute('class', 'edge-label');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');

        // Format the call text with suit symbols
        const callText = formatCall(edge.call);
        text.innerHTML = callText;
        labelGroup.appendChild(text);

        // Who chose this call (smaller text below)
        const byText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        byText.setAttribute('x', labelX);
        byText.setAttribute('y', labelY + 9);
        byText.setAttribute('class', 'edge-by');
        byText.setAttribute('text-anchor', 'middle');
        byText.textContent = `(${edge.by.join(',')})`;
        labelGroup.appendChild(byText);

        edgeGroup.appendChild(labelGroup);
      }
    });

    svg.appendChild(edgeGroup);

    // Draw nodes
    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeGroup.setAttribute('class', 'nodes');

    Object.entries(nodePositions).forEach(([nodeId, pos]) => {
      const node = data.nodes[nodeId];
      if (!node) return;

      // Skip closed nodes - they represent ended branches
      if (node.status === 'closed') return;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      // Node circle with who_needs color
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', nodeRadius);

      // Determine who_needs class based on current user perspective
      // Pink = current user needs, Light-blue = partner needs
      let whoNeedsClass = '';
      if (node.who_needs === 'both') {
        whoNeedsClass = 'who-needs-both'; // yellow
      } else if (node.who_needs === 'none') {
        whoNeedsClass = 'who-needs-none'; // grey
      } else if (node.who_needs === 'creator') {
        // If creator needs to answer
        whoNeedsClass = currentUser?.id === session?.creator?.id ? 'who-needs-me' : 'who-needs-partner-user';
      } else if (node.who_needs === 'partner') {
        // If partner needs to answer
        whoNeedsClass = currentUser?.id === session?.partner?.id ? 'who-needs-me' : 'who-needs-partner-user';
      }
      circle.setAttribute('class', `node ${node.divergence ? 'divergence' : ''} ${node.status} ${whoNeedsClass}`);

      // Make divergence nodes clickable
      if (node.divergence) {
        circle.style.cursor = 'pointer';
        circle.addEventListener('click', () => handleNodeClick(nodeId, node));
      }

      g.appendChild(circle);

      // Node label (seat to act)
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', pos.x);
      text.setAttribute('y', pos.y);
      text.setAttribute('class', 'node-label');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.textContent = node.seat;
      g.appendChild(text);

      // Comment indicator for divergence nodes
      if (node.divergence && node.db_id && comments[node.db_id] && comments[node.db_id].length > 0) {
        const commentIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        commentIcon.setAttribute('x', pos.x + nodeRadius + 5);
        commentIcon.setAttribute('y', pos.y - nodeRadius);
        commentIcon.setAttribute('class', 'comment-indicator');
        commentIcon.textContent = '💬';
        commentIcon.style.fontSize = '14px';
        g.appendChild(commentIcon);
      }

      // Tooltip with history
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      const tooltipText = `History: ${node.history || 'Start'}\nSeat: ${node.seat}\nStatus: ${node.status}`;
      title.textContent = node.divergence ? `${tooltipText}\n\nClick to add/view comments` : tooltipText;
      g.appendChild(title);

      nodeGroup.appendChild(g);
    });

    svg.appendChild(nodeGroup);
  };

  // Auto-load tree and comments when deal changes
  useEffect(() => {
    if (!session?.id || !selectedDealIndex) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load tree and comments in parallel
        const [treeResponse, commentsResponse] = await Promise.all([
          sessionService.fetchAuctionTree(session.id, selectedDealIndex),
          sessionService.fetchNodeComments(session.id, selectedDealIndex)
        ]);

        setTreeData(treeResponse);

        if (commentsResponse.comments) {
          const commentsMap = {};
          commentsResponse.comments.forEach(comment => {
            if (!commentsMap[comment.node_id]) {
              commentsMap[comment.node_id] = [];
            }
            commentsMap[comment.node_id].push(comment);
          });
          setComments(commentsMap);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load auction tree');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session?.id, selectedDealIndex]);

  // Render tree when treeData or comments change
  useEffect(() => {
    if (treeData && !loading) {
      renderTree(treeData);
    }
  }, [treeData, comments, currentUser, session, loading]);

  const handleNodeClick = (nodeId, nodeData) => {
    // Only allow comments on divergence nodes
    if (!nodeData.divergence) return;

    // Use db_id from nodeData for backend operations
    setSelectedNode({ id: nodeId, db_id: nodeData.db_id, data: nodeData });

    // Find existing comment for current user using db_id
    const nodeComments = comments[nodeData.db_id] || [];
    const userComment = nodeComments.find(c => c.user.id === currentUser.id);
    setCommentText(userComment ? userComment.comment_text : '');
    setShowCommentModal(true);
  };

  const handleSaveComment = async () => {
    if (!selectedNode) return;

    try {
      const response = await sessionService.saveNodeComment(
        session.id,
        selectedDealIndex,
        selectedNode.db_id,  // Use database ID instead of string ID
        commentText
      );

      if (response.ok) {
        // Reload comments only
        const commentsResponse = await sessionService.fetchNodeComments(session.id, selectedDealIndex);
        if (commentsResponse.comments) {
          const commentsMap = {};
          commentsResponse.comments.forEach(comment => {
            if (!commentsMap[comment.node_id]) {
              commentsMap[comment.node_id] = [];
            }
            commentsMap[comment.node_id].push(comment);
          });
          setComments(commentsMap);
        }
        setShowCommentModal(false);
        setSelectedNode(null);
        setCommentText('');
      }
    } catch (err) {
      console.error('Failed to save comment:', err);
      alert('Failed to save comment. Please try again.');
    }
  };

  const handleRefresh = async () => {
    if (!session?.id || !selectedDealIndex) return;

    try {
      setRefreshing(true);
      setError(null);

      // Load tree and comments in parallel
      const [treeResponse, commentsResponse] = await Promise.all([
        sessionService.fetchAuctionTree(session.id, selectedDealIndex),
        sessionService.fetchNodeComments(session.id, selectedDealIndex)
      ]);

      setTreeData(treeResponse);

      if (commentsResponse.comments) {
        const commentsMap = {};
        commentsResponse.comments.forEach(comment => {
          if (!commentsMap[comment.node_id]) {
            commentsMap[comment.node_id] = [];
          }
          commentsMap[comment.node_id].push(comment);
        });
        setComments(commentsMap);
      }
    } catch (err) {
      console.error('Failed to refresh data:', err);
      setError('Failed to refresh auction tree');
    } finally {
      setRefreshing(false);
    }
  };

  const formatCall = (call) => {
    if (!call) return '';

    // Map suits to symbols
    const suitSymbols = {
      'S': '♠',
      'H': '♥',
      'D': '♦',
      'C': '♣',
      'NT': 'NT'
    };

    // Handle special calls
    if (call === 'P') return 'Pass';
    if (call === 'X') return 'X';
    if (call === 'XX') return 'XX';

    // Handle bid calls (e.g., "1H", "2NT")
    const match = call.match(/^(\d)([SHDCNT]+)$/);
    if (match) {
      const level = match[1];
      const suit = match[2];
      return level + (suitSymbols[suit] || suit);
    }

    return call;
  };

  if (loading) {
    return (
      <div className="tree-view">
        <div className="tree-header">
          <button className="back-btn" onClick={onBackToGame}>
            ← Back to Sessions
          </button>
          <h2>Auction Tree - {session?.name}</h2>
        </div>
        <div className="tree-container">
          <p>Loading tree...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tree-view">
        <div className="tree-header">
          <button className="back-btn" onClick={onBackToGame}>
            ← Back to Sessions
          </button>
          <h2>Auction Tree - {session?.name}</h2>
        </div>
        <div className="tree-container">
          <p className="error">{error}</p>
          <button onClick={handleRefresh} className="refresh-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (availableDeals.length === 0) {
    return (
      <div className="tree-view">
        <div className="tree-header">
          <button className="back-btn" onClick={onBackToGame}>
            ← Back to Sessions
          </button>
          <h2>Auction Tree - {session?.name}</h2>
        </div>
        <div className="tree-container">
          <p className="info-message">No deals with auction data yet. Make some bids to generate the auction tree.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tree-view">
      <div className="tree-header">
        <button className="back-btn" onClick={onBackToGame}>
          ← Back to Sessions
        </button>
        <h2>Auction Tree - {session?.name}</h2>

        <div className="deal-selector">
          <label>Deal: </label>
          <select
            value={selectedDealIndex}
            onChange={(e) => setSelectedDealIndex(parseInt(e.target.value))}
            className="deal-select"
          >
            {availableDeals.map(deal => (
              <option key={deal.id} value={deal.deal_number}>
                Deal {deal.deal_number}
              </option>
            ))}
          </select>
        </div>

        <div className="tree-info">
          <span>Dealer: {treeData?.dealer}</span>
          <span>Vulnerability: {treeData?.vul}</span>
        </div>
        <button onClick={handleRefresh} className="refresh-btn" disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="tree-container">
        <svg
          ref={svgRef}
          className="auction-tree-svg"
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Tree will be rendered here */}
        </svg>
      </div>

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="modal-overlay" onClick={() => setShowCommentModal(false)}>
          <div className="modal-content comment-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Divergence Node Comment</h2>
            <p className="modal-hint">
              If your partner chose this call, what would you do? Discuss your strategy here.
            </p>

            <div className="comments-section">
              <div className="your-comment">
                <h3>Your Comment:</h3>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Enter your strategy or thoughts about this divergence..."
                  rows="5"
                  className="comment-textarea"
                />
              </div>

              {selectedNode && comments[selectedNode.db_id] && comments[selectedNode.db_id].length > 0 && (
                <div className="existing-comments">
                  <h3>All Comments:</h3>
                  {comments[selectedNode.db_id]
                    .map(comment => (
                      <div key={comment.id} className="comment-item">
                        <div className="comment-header">
                          <strong>
                            {comment.user.username}
                            {comment.user.id === currentUser?.id && ' (You)'}
                          </strong>
                          <span className="comment-time">
                            {new Date(comment.updated_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="comment-text">{comment.comment_text}</div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowCommentModal(false)}
                className="modal-btn cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveComment}
                className="modal-btn confirm-btn"
              >
                Save Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TreeView;