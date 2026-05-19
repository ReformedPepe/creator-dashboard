// SparklineChart — mini-wykres liniowy (sparkline) wizualizujący trend wyświetleń
// eslint-disable-next-line no-unused-vars
import React, { useRef, useEffect, useState, useId, forwardRef, useImperativeHandle } from 'react';
import { formatViewCount } from '../utils/formatters.js';

const VIEWBOX_WIDTH = 200;
const VIEWBOX_HEIGHT = 32;
const PADDING = 4;

/**
 * Maps trend direction to CSS variable name
 */
function getTrendColor(trend) {
  switch (trend) {
    case 'up': return 'var(--color-trend-up)';
    case 'down': return 'var(--color-trend-down)';
    default: return 'var(--color-trend-neutral)';
  }
}

/**
 * Computes Y-coordinate scaling with 10% margin
 * @param {number[]} values - array of viewCount values
 * @returns {{ min: number, max: number, adjustedMin: number, adjustedMax: number }}
 */
export function computeYScale(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const adjustedMin = min - range * 0.1;
  const adjustedMax = max + range * 0.1;
  return { min, max, adjustedMin, adjustedMax };
}

/**
 * Computes Y position for a given value
 * @param {number} value
 * @param {number} adjustedMin
 * @param {number} adjustedMax
 * @param {boolean} allIdentical - whether all values are the same
 * @returns {number} Y coordinate in SVG space
 */
export function computeY(value, adjustedMin, adjustedMax, allIdentical) {
  if (allIdentical) {
    return VIEWBOX_HEIGHT / 2;
  }
  const ratio = (value - adjustedMin) / (adjustedMax - adjustedMin);
  return PADDING + (1 - ratio) * (VIEWBOX_HEIGHT - 2 * PADDING);
}

/**
 * Computes X position for a point at given index
 * @param {number} index
 * @param {number} total - total number of points
 * @returns {number} X coordinate in SVG space
 */
function computeX(index, total) {
  if (total <= 1) return VIEWBOX_WIDTH / 2;
  return PADDING + (index / (total - 1)) * (VIEWBOX_WIDTH - 2 * PADDING);
}

/**
 * Finds the nearest data point to the cursor X position.
 * @param {number} cursorX - cursor X position in SVG coordinate space
 * @param {Array<{x: number, y: number, dataPoint: {timestamp: number, viewCount: number}}>} points - rendered points with positions and data
 * @returns {{x: number, y: number, dataPoint: {timestamp: number, viewCount: number}}|null} nearest point or null if empty
 */
export function findNearestPoint(cursorX, points) {
  if (!points || points.length === 0) return null;

  let nearest = points[0];
  let minDist = Math.abs(cursorX - points[0].x);

  for (let i = 1; i < points.length; i++) {
    const dist = Math.abs(cursorX - points[i].x);
    if (dist < minDist) {
      minDist = dist;
      nearest = points[i];
    }
  }

  return nearest;
}

/**
 * Computes tooltip X position ensuring it stays within container bounds.
 * @param {number} cursorX - cursor X position relative to container
 * @param {number} containerWidth - width of the container
 * @param {number} tooltipWidth - width of the tooltip element
 * @returns {number} computed left position for tooltip
 */
export function computeTooltipPosition(cursorX, containerWidth, tooltipWidth) {
  const OFFSET = 8;
  // Try positioning to the right of cursor
  const rightPos = cursorX + OFFSET;
  if (rightPos + tooltipWidth <= containerWidth) {
    return rightPos;
  }
  // Flip to left side
  const leftPos = cursorX - OFFSET - tooltipWidth;
  return Math.max(0, leftPos);
}

/**
 * Formats a timestamp as DD.MM.YYYY HH:mm
 * @param {number} timestamp - Unix ms timestamp
 * @returns {string}
 */
function formatTooltipDate(timestamp) {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Inner component for the animated polyline
 */
const SparklinePath = forwardRef(function SparklinePath({ points, color }, ref) {
  const innerRef = useRef(null);
  const [pathLength, setPathLength] = useState(0);

  useImperativeHandle(ref, () => innerRef.current);

  useEffect(() => {
    if (innerRef.current && typeof innerRef.current.getTotalLength === 'function') {
      const length = innerRef.current.getTotalLength();
      setPathLength(length);
    }
  }, [points]);

  return (
    <polyline
      ref={innerRef}
      points={points}
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={pathLength > 0 ? {
        '--sparkline-length': pathLength,
        strokeDasharray: pathLength,
        strokeDashoffset: 0,
        animation: 'sparkline-draw 300ms ease-out forwards',
      } : undefined}
    />
  );
});

/**
 * SparklineChart component
 * @param {{ dataPoints: Array<{timestamp: number, viewCount: number}>, trend: 'up'|'down'|'neutral' }} props
 */
export default function SparklineChart({ dataPoints, trend }) {
  const pathRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const fadeTimeoutRef = useRef(null);
  const gradientId = useId();

  const [hoverState, setHoverState] = useState(null); // { nearestPoint, cursorX }
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipWidth, setTooltipWidth] = useState(120);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, []);

  // Measure tooltip width after render
  useEffect(() => {
    if (tooltipRef.current) {
      const measured = tooltipRef.current.offsetWidth;
      if (measured > 0 && measured !== tooltipWidth) {
        setTooltipWidth(measured);
      }
    }
  }, [hoverState, tooltipWidth]);

  // 0 or 1 points → subtle info message (collecting data)
  if (!dataPoints || dataPoints.length < 2) {
    return (
      <div
        style={{
          marginTop: '8px',
          padding: '6px 10px',
          borderRadius: 'var(--radius-video)',
          backgroundColor: 'var(--color-bg-card)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-trend-neutral)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Zbieranie danych trendu…
        </span>
      </div>
    );
  }

  // 2+ points → full sparkline
  const color = getTrendColor(trend);
  const values = dataPoints.map(dp => dp.viewCount);
  const { adjustedMin, adjustedMax, min, max } = computeYScale(values);
  const allIdentical = min === max;

  // Compute polyline points with associated data
  const renderedPoints = dataPoints.map((dp, i) => {
    const x = computeX(i, dataPoints.length);
    const y = computeY(dp.viewCount, adjustedMin, adjustedMax, allIdentical);
    return { x, y, dataPoint: dp };
  });

  const polylinePoints = renderedPoints.map(p => `${p.x},${p.y}`).join(' ');

  // Build area path for gradient fill (closed polygon under the line)
  const areaPath = [
    `M ${renderedPoints[0].x},${VIEWBOX_HEIGHT}`,
    `L ${renderedPoints[0].x},${renderedPoints[0].y}`,
    ...renderedPoints.slice(1).map(p => `L ${p.x},${p.y}`),
    `L ${renderedPoints[renderedPoints.length - 1].x},${VIEWBOX_HEIGHT}`,
    'Z',
  ].join(' ');

  const handleMouseMove = (e) => {
    const container = containerRef.current;
    if (!container) return;

    // Clear any pending fade-out
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }

    const rect = container.getBoundingClientRect();
    // Convert pixel position to SVG coordinate space
    const relativeX = e.clientX - rect.left;
    const svgX = (relativeX / rect.width) * VIEWBOX_WIDTH;

    const nearest = findNearestPoint(svgX, renderedPoints);
    if (nearest) {
      setHoverState({ nearestPoint: nearest, cursorX: relativeX, containerWidth: rect.width });
      setTooltipVisible(true);
    }
  };

  const handleMouseLeave = () => {
    // Fade out with 150ms transition
    setTooltipVisible(false);
    fadeTimeoutRef.current = setTimeout(() => {
      setHoverState(null);
    }, 150);
  };

  // Indicator line X position in SVG space
  const indicatorX = hoverState ? hoverState.nearestPoint.x : null;

  return (
    <div
      ref={containerRef}
      style={{
        borderRadius: 'var(--radius-video)',
        marginTop: '8px',
        position: 'relative',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        className="overflow-hidden rounded-[var(--radius-video)]"
        width="100%"
        height="32"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Wykres trendu wyświetleń"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gradient fill under line */}
        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
        />

        {/* Main polyline with stroke-dashoffset animation */}
        <SparklinePath
          ref={pathRef}
          points={polylinePoints}
          color={color}
        />

        {/* Vertical indicator line on hover */}
        {hoverState && (
          <line
            x1={indicatorX}
            y1={0}
            x2={indicatorX}
            y2={VIEWBOX_HEIGHT}
            stroke={color}
            strokeWidth="0.5"
            strokeOpacity={tooltipVisible ? 0.5 : 0}
            style={{ transition: 'stroke-opacity 150ms ease' }}
            data-testid="sparkline-indicator"
          />
        )}
      </svg>

      {/* Tooltip below chart */}
      <div
        ref={tooltipRef}
        style={{
          fontSize: '10px',
          padding: '2px 0',
          color: 'var(--color-text-muted)',
          height: '16px',
          opacity: hoverState && tooltipVisible ? 1 : 0,
          transition: 'opacity 150ms ease',
          textAlign: 'center',
        }}
        data-testid="sparkline-tooltip"
      >
        {hoverState && (
          <>
            {formatViewCount(hoverState.nearestPoint.dataPoint.viewCount)} — {formatTooltipDate(hoverState.nearestPoint.dataPoint.timestamp)}
          </>
        )}
      </div>
    </div>
  );
}
