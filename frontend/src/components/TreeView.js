import React, { useState, useEffect, useRef } from 'react';
import { sessionService } from '../utils/gameService';
import './TreeView.css';

function TreeView({ session, onBackToGame }) {
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDealIndex, setSelectedDealIndex] = useState(1);
  const [availableDeals, setAvailableDeals] = useState([]);
  const svgRef = useRef(null);

  useEffect(() => {
    // Load available deals for the session
    if (session && session.id) {
      loadAvailableDeals();
    }
  }, [session]);

  useEffect(() => {
    if (session && session.id && selectedDealIndex) {
      loadTreeData();
    }
  }, [session, selectedDealIndex]);

  const loadAvailableDeals = async () => {
    try {
      const response = await sessionService.getAllDeals(session.id);
      if (response && response.deals) {
        setAvailableDeals(response.deals);
        if (response.deals.length > 0 && !selectedDealIndex) {
          setSelectedDealIndex(response.deals[0].deal_number);
        }
      }
    } catch (err) {
      console.error('Failed to load deals:', err);
    }
  };

  const loadTreeData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sessionService.fetchAuctionTree(session.id, selectedDealIndex);
      setTreeData(data);
      renderTree(data);
    } catch (err) {
      console.error('Failed to load tree data:', err);
      setError('Failed to load auction tree');
    } finally {
      setLoading(false);
    }
  };

  const renderTree = (data) => {
    if (!data || !data.nodes || !svgRef.current) return;

    const svg = svgRef.current;
    const svgWidth = 800;
    const svgHeight = 600;
    const nodeRadius = 20;
    const levelHeight = 80;
    const branchSpread = 100;

    // Clear existing content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Calculate node positions
    const nodePositions = {};
    const processedNodes = new Set();
    const nodeQueue = [];

    if (data.root) {
      nodeQueue.push({ id: data.root, x: svgWidth / 2, y: 50, level: 0 });
    }

    while (nodeQueue.length > 0) {
      const { id, x, y, level } = nodeQueue.shift();

      if (processedNodes.has(id)) continue;
      processedNodes.add(id);

      nodePositions[id] = { x, y, level };
      const node = data.nodes[id];

      // Find edges from this node
      const childEdges = data.edges.filter(edge => edge.from === id);

      if (childEdges.length === 1 && !node.divergence) {
        // Single path (trunk continues)
        const edge = childEdges[0];
        nodeQueue.push({
          id: edge.to,
          x: x,
          y: y + levelHeight,
          level: level + 1
        });
      } else if (childEdges.length > 1) {
        // Branching (divergence)
        const spreadWidth = branchSpread * (childEdges.length - 1);
        const startX = x - spreadWidth / 2;

        childEdges.forEach((edge, index) => {
          nodeQueue.push({
            id: edge.to,
            x: startX + (branchSpread * index),
            y: y + levelHeight,
            level: level + 1
          });
        });
      }
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
        line.setAttribute('class', data.nodes[edge.to]?.status === 'closed' ? 'edge closed' : 'edge');
        edgeGroup.appendChild(line);

        // Add call label
        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const midX = (fromPos.x + toPos.x) / 2;
        const midY = (fromPos.y + toPos.y) / 2;

        // Background rect for label
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', midX - 30);
        rect.setAttribute('y', midY - 10);
        rect.setAttribute('width', 60);
        rect.setAttribute('height', 20);
        rect.setAttribute('class', 'label-bg');
        rect.setAttribute('rx', 3);
        labelGroup.appendChild(rect);

        // Call text
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', midX);
        text.setAttribute('y', midY);
        text.setAttribute('class', 'edge-label');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');

        // Format the call text with suit symbols
        const callText = formatCall(edge.call);
        text.innerHTML = callText;
        labelGroup.appendChild(text);

        // Who chose this call
        const byText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        byText.setAttribute('x', midX);
        byText.setAttribute('y', midY + 12);
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

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      // Node circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', nodeRadius);
      circle.setAttribute('class', `node ${node.divergence ? 'divergence' : ''} ${node.status}`);
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

      // Tooltip with history
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `History: ${node.history || 'Start'}\nSeat: ${node.seat}\nStatus: ${node.status}`;
      g.appendChild(title);

      nodeGroup.appendChild(g);
    });

    svg.appendChild(nodeGroup);
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

  const handleRefresh = () => {
    loadTreeData();
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
        <button onClick={handleRefresh} className="refresh-btn">
          Refresh
        </button>
      </div>

      <div className="tree-container">
        <svg
          ref={svgRef}
          className="auction-tree-svg"
          width="800"
          height="600"
          viewBox="0 0 800 600"
        >
          {/* Tree will be rendered here */}
        </svg>
      </div>
    </div>
  );
}

export default TreeView;