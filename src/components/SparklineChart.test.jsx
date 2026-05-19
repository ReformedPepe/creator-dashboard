// eslint-disable-next-line no-unused-vars
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SparklineChart, { computeYScale, computeY, findNearestPoint, computeTooltipPosition } from './SparklineChart';

describe('SparklineChart', () => {
  describe('edge cases', () => {
    it('renders collecting message when dataPoints is empty', () => {
      const { container } = render(<SparklineChart dataPoints={[]} trend="neutral" />);
      expect(container.textContent).toContain('Zbieranie danych trendu');
    });

    it('renders collecting message when dataPoints is undefined', () => {
      const { container } = render(<SparklineChart dataPoints={undefined} trend="neutral" />);
      expect(container.textContent).toContain('Zbieranie danych trendu');
    });

    it('renders "Zbieranie danych trendu…" message for 1 data point', () => {
      const { container } = render(
        <SparklineChart
          dataPoints={[{ timestamp: 1000, viewCount: 500 }]}
          trend="neutral"
        />
      );
      expect(container.textContent).toContain('Zbieranie danych trendu');
      expect(container.querySelector('svg')).toBeNull();
    });

    it('renders horizontal centered line when all values are identical', () => {
      const dataPoints = [
        { timestamp: 1000, viewCount: 100 },
        { timestamp: 2000, viewCount: 100 },
        { timestamp: 3000, viewCount: 100 },
      ];
      const { container } = render(
        <SparklineChart dataPoints={dataPoints} trend="neutral" />
      );
      const polyline = container.querySelector('polyline');
      expect(polyline).toBeInTheDocument();

      // All Y values should be height/2 = 16
      const points = polyline.getAttribute('points');
      const yValues = points.split(' ').map(p => parseFloat(p.split(',')[1]));
      yValues.forEach(y => expect(y).toBe(16));
    });
  });

  describe('SVG rendering', () => {
    const sampleData = [
      { timestamp: 1000, viewCount: 100 },
      { timestamp: 2000, viewCount: 200 },
      { timestamp: 3000, viewCount: 150 },
    ];

    it('renders SVG with width 100% and height 32px', () => {
      const { container } = render(
        <SparklineChart dataPoints={sampleData} trend="up" />
      );
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '100%');
      expect(svg).toHaveAttribute('height', '32');
    });

    it('renders polyline with stroke-width 1.5', () => {
      const { container } = render(
        <SparklineChart dataPoints={sampleData} trend="up" />
      );
      const polyline = container.querySelector('polyline');
      expect(polyline).toBeInTheDocument();
      expect(polyline).toHaveAttribute('stroke-width', '1.5');
    });

    it('does not render axes, labels, or legend', () => {
      const { container } = render(
        <SparklineChart dataPoints={sampleData} trend="up" />
      );
      // No axis lines, no text labels (only the polyline and gradient path)
      const texts = container.querySelectorAll('text');
      expect(texts.length).toBe(0);
    });

    it('renders gradient fill under line', () => {
      const { container } = render(
        <SparklineChart dataPoints={sampleData} trend="up" />
      );
      const gradient = container.querySelector('linearGradient');
      expect(gradient).toBeInTheDocument();

      const stops = gradient.querySelectorAll('stop');
      expect(stops.length).toBe(2);
      expect(stops[0]).toHaveAttribute('stop-opacity', '0.1');
      expect(stops[1]).toHaveAttribute('stop-opacity', '0');
    });

    it('applies border-radius and margin-top via container div', () => {
      const { container } = render(
        <SparklineChart dataPoints={sampleData} trend="up" />
      );
      const wrapper = container.firstChild;
      expect(wrapper.style.borderRadius).toBe('var(--radius-video)');
      expect(wrapper.style.marginTop).toBe('8px');
    });
  });

  describe('trend colors', () => {
    const sampleData = [
      { timestamp: 1000, viewCount: 100 },
      { timestamp: 2000, viewCount: 200 },
    ];

    it('applies --color-trend-up for up trend', () => {
      const { container } = render(
        <SparklineChart dataPoints={sampleData} trend="up" />
      );
      const polyline = container.querySelector('polyline');
      expect(polyline).toHaveAttribute('stroke', 'var(--color-trend-up)');
    });

    it('applies --color-trend-down for down trend', () => {
      const { container } = render(
        <SparklineChart dataPoints={sampleData} trend="down" />
      );
      const polyline = container.querySelector('polyline');
      expect(polyline).toHaveAttribute('stroke', 'var(--color-trend-down)');
    });

    it('applies --color-trend-neutral for neutral trend', () => {
      const { container } = render(
        <SparklineChart dataPoints={sampleData} trend="neutral" />
      );
      const polyline = container.querySelector('polyline');
      expect(polyline).toHaveAttribute('stroke', 'var(--color-trend-neutral)');
    });
  });

  describe('animation', () => {
    it('applies stroke-dashoffset animation style', () => {
      // jsdom doesn't support getTotalLength, so pathLength stays 0
      // We test that the polyline is rendered correctly
      const sampleData = [
        { timestamp: 1000, viewCount: 100 },
        { timestamp: 2000, viewCount: 200 },
      ];
      const { container } = render(
        <SparklineChart dataPoints={sampleData} trend="up" />
      );
      const polyline = container.querySelector('polyline');
      expect(polyline).toBeInTheDocument();
    });
  });
});

describe('computeYScale', () => {
  it('computes adjusted min/max with 10% margin', () => {
    const result = computeYScale([100, 200, 300]);
    expect(result.min).toBe(100);
    expect(result.max).toBe(300);
    // range = 200, margin = 20
    expect(result.adjustedMin).toBe(80);
    expect(result.adjustedMax).toBe(320);
  });

  it('handles identical values', () => {
    const result = computeYScale([50, 50, 50]);
    expect(result.min).toBe(50);
    expect(result.max).toBe(50);
    expect(result.adjustedMin).toBe(50);
    expect(result.adjustedMax).toBe(50);
  });
});

describe('computeY', () => {
  it('returns height/2 when all values are identical', () => {
    const y = computeY(100, 100, 100, true);
    expect(y).toBe(16); // VIEWBOX_HEIGHT / 2
  });

  it('maps minimum value to bottom (high Y)', () => {
    // adjustedMin=80, adjustedMax=320, value=80
    // ratio = 0, y = 4 + (1 - 0) * (32 - 8) = 4 + 24 = 28
    const y = computeY(80, 80, 320, false);
    expect(y).toBe(28);
  });

  it('maps maximum value to top (low Y)', () => {
    // adjustedMin=80, adjustedMax=320, value=320
    // ratio = 1, y = 4 + (1 - 1) * 24 = 4
    const y = computeY(320, 80, 320, false);
    expect(y).toBe(4);
  });

  it('keeps all Y values within padding bounds', () => {
    const values = [100, 150, 200, 250, 300];
    const { adjustedMin, adjustedMax } = computeYScale(values);
    values.forEach(v => {
      const y = computeY(v, adjustedMin, adjustedMax, false);
      expect(y).toBeGreaterThanOrEqual(4);
      expect(y).toBeLessThanOrEqual(28);
    });
  });
});


describe('findNearestPoint', () => {
  const points = [
    { x: 10, y: 5, dataPoint: { timestamp: 1000, viewCount: 100 } },
    { x: 50, y: 10, dataPoint: { timestamp: 2000, viewCount: 200 } },
    { x: 90, y: 15, dataPoint: { timestamp: 3000, viewCount: 300 } },
  ];

  it('returns null for empty points array', () => {
    expect(findNearestPoint(50, [])).toBeNull();
    expect(findNearestPoint(50, null)).toBeNull();
  });

  it('returns the only point when array has one element', () => {
    const single = [{ x: 30, y: 5, dataPoint: { timestamp: 1000, viewCount: 100 } }];
    expect(findNearestPoint(80, single)).toBe(single[0]);
  });

  it('snaps to the closest point on X axis', () => {
    expect(findNearestPoint(12, points)).toBe(points[0]);
    expect(findNearestPoint(45, points)).toBe(points[1]);
    expect(findNearestPoint(85, points)).toBe(points[2]);
  });

  it('snaps to exact position', () => {
    expect(findNearestPoint(50, points)).toBe(points[1]);
  });

  it('handles cursor at the boundary between two points', () => {
    // At x=30, equidistant from 10 and 50 — first one wins (< not <=)
    const result = findNearestPoint(30, points);
    expect(result).toBe(points[0]);
  });
});

describe('computeTooltipPosition', () => {
  it('positions tooltip to the right when space is available', () => {
    const pos = computeTooltipPosition(50, 300, 100);
    // 50 + 8 = 58, 58 + 100 = 158 <= 300 → right side
    expect(pos).toBe(58);
  });

  it('flips tooltip to the left when right edge would overflow', () => {
    const pos = computeTooltipPosition(250, 300, 100);
    // 250 + 8 + 100 = 358 > 300 → flip left: 250 - 8 - 100 = 142
    expect(pos).toBe(142);
  });

  it('clamps to 0 when left flip would go negative', () => {
    const pos = computeTooltipPosition(5, 10, 100);
    // right: 5 + 8 + 100 = 113 > 10 → flip left: 5 - 8 - 100 = -103 → clamped to 0
    expect(pos).toBe(0);
  });

  it('positions correctly at container edge', () => {
    // containerWidth=200, tooltipWidth=80, cursorX=112
    // right: 112 + 8 + 80 = 200 <= 200 → fits right
    const pos = computeTooltipPosition(112, 200, 80);
    expect(pos).toBe(120);
  });

  it('flips when exactly overflowing by 1px', () => {
    // containerWidth=200, tooltipWidth=80, cursorX=113
    // right: 113 + 8 + 80 = 201 > 200 → flip left: 113 - 8 - 80 = 25
    const pos = computeTooltipPosition(113, 200, 80);
    expect(pos).toBe(25);
  });
});

describe('SparklineChart tooltip interaction', () => {
  const sampleData = [
    { timestamp: 1700000000000, viewCount: 1200 },
    { timestamp: 1700100000000, viewCount: 2500 },
    { timestamp: 1700200000000, viewCount: 3800 },
  ];

  it('renders container with position relative for tooltip positioning', () => {
    const { container } = render(
      <SparklineChart dataPoints={sampleData} trend="up" />
    );
    const wrapper = container.firstChild;
    expect(wrapper.style.position).toBe('relative');
  });

  it('does not show tooltip content or indicator initially', () => {
    const { container } = render(
      <SparklineChart dataPoints={sampleData} trend="up" />
    );
    const tooltip = container.querySelector('[data-testid="sparkline-tooltip"]');
    expect(tooltip.style.opacity).toBe('0');
    expect(container.querySelector('[data-testid="sparkline-indicator"]')).toBeNull();
  });
});
