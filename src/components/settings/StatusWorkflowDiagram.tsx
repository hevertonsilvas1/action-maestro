import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import type { WinnerStatusConfig, StatusTransition } from '@/hooks/useWinnerStatuses';

interface StatusWorkflowDiagramProps {
  statuses: WinnerStatusConfig[];
  transitions: StatusTransition[];
}

const NODE_W = 150;
const NODE_H = 40;
const GAP_X = 60;
const GAP_Y = 70;
const COLS = 4;
const PAD = 30;
const ARROW_SIZE = 6;

/** Compute cubic bezier path between two node centres */
function arrowPath(
  x1: number, y1: number,
  x2: number, y2: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Determine best connection points
  let sx: number, sy: number, ex: number, ey: number;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal flow
    if (dx > 0) {
      sx = x1 + NODE_W / 2; sy = y1;
      ex = x2 - NODE_W / 2; ey = y2;
    } else {
      sx = x1 - NODE_W / 2; sy = y1;
      ex = x2 + NODE_W / 2; ey = y2;
    }
  } else {
    // Vertical flow
    if (dy > 0) {
      sx = x1; sy = y1 + NODE_H / 2;
      ex = x2; ey = y2 - NODE_H / 2;
    } else {
      sx = x1; sy = y1 - NODE_H / 2;
      ex = x2; ey = y2 + NODE_H / 2;
    }
  }

  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const cpx1 = mx;
  const cpy1 = sy;
  const cpx2 = mx;
  const cpy2 = ey;

  return { path: `M${sx},${sy} C${cpx1},${cpy1} ${cpx2},${cpy2} ${ex},${ey}`, ex, ey, sx, sy };
}

function getContrastText(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a2e' : '#ffffff';
}

export function StatusWorkflowDiagram({ statuses, transitions }: StatusWorkflowDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const activeStatuses = useMemo(
    () => statuses.filter(s => s.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [statuses],
  );

  // Position nodes in a grid
  const positions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    activeStatuses.forEach((s, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      map[s.id] = {
        x: PAD + col * (NODE_W + GAP_X) + NODE_W / 2,
        y: PAD + row * (NODE_H + GAP_Y) + NODE_H / 2,
      };
    });
    return map;
  }, [activeStatuses]);

  const svgWidth = Math.min(activeStatuses.length, COLS) * (NODE_W + GAP_X) - GAP_X + PAD * 2;
  const rows = Math.ceil(activeStatuses.length / COLS);
  const svgHeight = rows * (NODE_H + GAP_Y) - GAP_Y + PAD * 2;

  // Build transition edges
  const edges = useMemo(() => {
    const idSet = new Set(activeStatuses.map(s => s.id));
    return transitions
      .filter(t => idSet.has(t.from_status_id) && idSet.has(t.to_status_id))
      .map(t => {
        const from = positions[t.from_status_id];
        const to = positions[t.to_status_id];
        if (!from || !to) return null;
        return {
          id: t.id,
          fromId: t.from_status_id,
          toId: t.to_status_id,
          ...arrowPath(from.x, from.y, to.x, to.y),
        };
      })
      .filter(Boolean) as Array<{
        id: string; fromId: string; toId: string;
        path: string; ex: number; ey: number; sx: number; sy: number;
      }>;
  }, [transitions, activeStatuses, positions]);

  // Highlight edges connected to hovered node
  const isEdgeHighlighted = useCallback(
    (edge: { fromId: string; toId: string }) => {
      if (!hoveredNode) return false;
      return edge.fromId === hoveredNode || edge.toId === hoveredNode;
    },
    [hoveredNode],
  );

  if (activeStatuses.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Nenhum status ativo para exibir.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="mx-auto"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth={ARROW_SIZE}
            markerHeight={ARROW_SIZE}
            refX={ARROW_SIZE}
            refY={ARROW_SIZE / 2}
            orient="auto"
          >
            <polygon
              points={`0 0, ${ARROW_SIZE} ${ARROW_SIZE / 2}, 0 ${ARROW_SIZE}`}
              className="fill-muted-foreground/50"
            />
          </marker>
          <marker
            id="arrowhead-active"
            markerWidth={ARROW_SIZE}
            markerHeight={ARROW_SIZE}
            refX={ARROW_SIZE}
            refY={ARROW_SIZE / 2}
            orient="auto"
          >
            <polygon
              points={`0 0, ${ARROW_SIZE} ${ARROW_SIZE / 2}, 0 ${ARROW_SIZE}`}
              className="fill-primary"
            />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge) => {
          const highlighted = isEdgeHighlighted(edge);
          return (
            <path
              key={edge.id}
              d={edge.path}
              fill="none"
              strokeWidth={highlighted ? 2.5 : 1.5}
              markerEnd={highlighted ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
              className={
                highlighted
                  ? 'stroke-primary transition-all duration-200'
                  : 'stroke-muted-foreground/30 transition-all duration-200'
              }
            />
          );
        })}

        {/* Nodes */}
        {activeStatuses.map((status) => {
          const pos = positions[status.id];
          if (!pos) return null;
          const isHovered = hoveredNode === status.id;
          const textColor = getContrastText(status.color);

          return (
            <g
              key={status.id}
              onMouseEnter={() => setHoveredNode(status.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              {/* Shadow */}
              <rect
                x={pos.x - NODE_W / 2 + 2}
                y={pos.y - NODE_H / 2 + 2}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                className="fill-foreground/5"
              />
              {/* Node */}
              <rect
                x={pos.x - NODE_W / 2}
                y={pos.y - NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={status.color}
                strokeWidth={isHovered ? 3 : 0}
                className={isHovered ? 'stroke-primary' : ''}
                style={{
                  filter: isHovered ? 'brightness(1.1)' : undefined,
                  transition: 'all 0.2s ease',
                }}
              />
              {/* Label */}
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={textColor}
                fontSize={11}
                fontWeight={600}
                className="pointer-events-none select-none"
              >
                {status.name.length > 18 ? status.name.slice(0, 16) + '...' : status.name}
              </text>
              {/* Default badge */}
              {status.is_default && (
                <text
                  x={pos.x}
                  y={pos.y + NODE_H / 2 + 14}
                  textAnchor="middle"
                  fontSize={9}
                  className="fill-muted-foreground pointer-events-none select-none"
                >
                  padrao
                </text>
              )}
              {/* Auto icon */}
              {status.update_mode === 'automatic' && (
                <circle
                  cx={pos.x + NODE_W / 2 - 6}
                  cy={pos.y - NODE_H / 2 - 4}
                  r={7}
                  className="fill-amber-400 stroke-background"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
