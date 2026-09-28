import React, { useMemo, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { resolveColor } from './utils';

interface SvgRendererProps {
  laidOutGraph: any;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

export const SvgRenderer: React.FC<SvgRendererProps> = ({ laidOutGraph, onHover, onSelect }) => {
  const { posMap, edgeRoutes } = useMemo(() => {
    if (!laidOutGraph) return { posMap: new Map(), edgeRoutes: [] };
    
    const pMap = new Map<string, any>();
    const eRoutes: any[] = [];
    
    const extract = (n: any, offsetX = 0, offsetY = 0) => {
      const absX = offsetX + (n.x || 0);
      const absY = offsetY + (n.y || 0);
      if (n.id !== 'root') {
        pMap.set(n.id, { ...n, absX, absY });
      }
      if (n.children) {
        n.children.forEach((c: any) => extract(c, absX, absY));
      }
    };
    
    extract(laidOutGraph);
    
    if (laidOutGraph.edges) {
      laidOutGraph.edges.forEach((e: any) => {
        // e.sections contains array of { startPoint, endPoint, bendPoints }
        const paths = (e.sections || []).map((sec: any) => {
          let pts = [sec.startPoint];
          if (sec.bendPoints) pts = pts.concat(sec.bendPoints);
          pts.push(sec.endPoint);
          return pts;
        });
        eRoutes.push({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
          originalEdge: e.originalEdge,
          paths
        });
      });
    }
    
    return { posMap: pMap, edgeRoutes: eRoutes };
  }, [laidOutGraph]);

  useEffect(() => {
    if (!edgeRoutes || edgeRoutes.length === 0) return;
    
    // Check for crossings
    let sameTypeCrossings = 0;
    let crossTypeCrossings = 0;
    
    const segments: any[] = [];
    edgeRoutes.forEach(e => {
      e.paths.forEach((path: any[]) => {
        for (let i = 0; i < path.length - 1; i++) {
          segments.push({
            p1: path[i],
            p2: path[i+1],
            type: e.type,
            edgeId: e.id
          });
        }
      });
    });

    const ccw = (A: any, B: any, C: any) => (C.y-A.y)*(B.x-A.x) > (B.y-A.y)*(C.x-A.x);
    const intersect = (A: any, B: any, C: any, D: any) => 
      ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);
      
    // Naive pairwise intersection check (O(n^2), fine for a few hundred segments)
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const s1 = segments[i];
        const s2 = segments[j];
        if (s1.edgeId === s2.edgeId) continue;
        
        // Exclude junctions (shared endpoints)
        const sharedPoint = 
          (s1.p1.x === s2.p1.x && s1.p1.y === s2.p1.y) ||
          (s1.p1.x === s2.p2.x && s1.p1.y === s2.p2.y) ||
          (s1.p2.x === s2.p1.x && s1.p2.y === s2.p1.y) ||
          (s1.p2.x === s2.p2.x && s1.p2.y === s2.p2.y);
          
        if (sharedPoint) continue;
        
        if (intersect(s1.p1, s1.p2, s2.p1, s2.p2)) {
          if (s1.type === s2.type) {
             sameTypeCrossings++;
          } else {
             crossTypeCrossings++;
          }
        }
      }
    }
    
    console.log(`[Crossing Report] Same-type: ${sameTypeCrossings} | Cross-type: ${crossTypeCrossings}`);
  }, [edgeRoutes]);

  if (!laidOutGraph) {
    return <div style={{ color: 'white' }}>Layout running...</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#020617' }}>
      <TransformWrapper 
        initialScale={0.5} 
        minScale={0.1} 
        maxScale={4}
        limitToBounds={false}
      >
        <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
          <svg width={8000} height={4000} style={{ display: 'block' }}>
            <g id="edges">
              {edgeRoutes.map(e => (
                <g key={e.id}>
                  {e.paths.map((path: any[], i: number) => {
                    let d = '';
                    if (path.length > 0) {
                      d += `M ${path[0].x} ${path[0].y} `;
                      const r = 8; // Border radius
                      for (let j = 1; j < path.length - 1; j++) {
                        const p0 = path[j - 1];
                        const p1 = path[j];
                        const p2 = path[j + 1];
                        
                        // Vector from p0 to p1
                        const v1x = p1.x - p0.x;
                        const v1y = p1.y - p0.y;
                        const l1 = Math.sqrt(v1x * v1x + v1y * v1y);
                        
                        // Vector from p1 to p2
                        const v2x = p2.x - p1.x;
                        const v2y = p2.y - p1.y;
                        const l2 = Math.sqrt(v2x * v2x + v2y * v2y);
                        
                        if (l1 < r || l2 < r) {
                          d += `L ${p1.x} ${p1.y} `;
                        } else {
                          // Start of curve (pull back from corner)
                          const startX = p1.x - (v1x / l1) * r;
                          const startY = p1.y - (v1y / l1) * r;
                          
                          // End of curve (push forward from corner)
                          const endX = p1.x + (v2x / l2) * r;
                          const endY = p1.y + (v2y / l2) * r;
                          
                          d += `L ${startX} ${startY} Q ${p1.x} ${p1.y} ${endX} ${endY} `;
                        }
                      }
                      const pLast = path[path.length - 1];
                      d += `L ${pLast.x} ${pLast.y}`;
                    }
                    return (
                      <path 
                        key={i} 
                        d={d} 
                        fill="none" 
                        stroke={resolveColor(e.type)} 
                        strokeWidth={e.originalEdge?.isBus ? Math.min(6, 2 + Math.log2(e.originalEdge.count || 1)) : 2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        opacity={0.6}
                      />
                    );
                  })}
                </g>
              ))}
            </g>
            <g id="nodes">
              {Array.from(posMap.values()).map(n => (
                <g key={n.id} transform={`translate(${n.absX}, ${n.absY})`}>
                  <rect 
                    width={n.width} 
                    height={n.height} 
                    fill="rgba(30, 41, 59, 0.4)" 
                    stroke="rgba(148, 163, 184, 0.2)"
                    strokeWidth="1"
                    rx={8}
                  />
                  <text 
                    x={10} 
                    y={20} 
                    fill="#f1f5f9" 
                    fontSize={12} 
                    fontFamily="Inter, sans-serif"
                  >
                    {n.id}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
};
