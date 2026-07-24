import * as d3 from 'd3';
import { TreeNode } from '../utils/transformer';

export const computeLayout = (treeData: TreeNode | null, collapsedNodes: Set<string>, layoutMode: string, nodeShape: string = 'default', nodeSpread: number = 1.0, nodeSize: number = 1.0) => {
    if (!treeData) return { nodes: [], links: [] };

    const root = d3.hierarchy(treeData, d => collapsedNodes.has(d.id) ? null : d.children);
    
    // Determine base sizes depending on nodeShape
    let basew = 260 * nodeSize;
    let baseh = 100 * nodeSize;
    
    if (nodeShape === 'circle') {
        basew = 220 * nodeSize;
        baseh = 220 * nodeSize;
    } else if (nodeShape === 'triangle') {
        basew = 320 * nodeSize;
        baseh = 240 * nodeSize;
    } else if (nodeShape === 'hexagon') {
        basew = 300 * nodeSize;
        baseh = 180 * nodeSize;
    } else if (nodeShape === 'diamond') {
        basew = 300 * nodeSize;
        baseh = 300 * nodeSize;
    } else if (nodeShape === 'parallelogram') {
        basew = 300 * nodeSize;
        baseh = 120 * nodeSize;
    } else if (nodeShape === 'pill') {
        basew = 280 * nodeSize;
        baseh = 100 * nodeSize;
    }

    if (layoutMode === 'horizontal') {
        const tree = d3.tree<TreeNode>().nodeSize([(baseh + 40) * nodeSpread, (basew + 80) * nodeSpread]); // y step, x step
        tree(root);
        root.each(d => {
            const temp = d.x;
            d.x = d.y;
            d.y = temp;
        });
    } else if (layoutMode === 'vertical') {
        const tree = d3.tree<TreeNode>().nodeSize([(basew + 20) * nodeSpread, (baseh + 80) * nodeSpread]); // x step, y step
        tree(root);
    } else if (layoutMode === 'compact') {
        const tree = d3.tree<TreeNode>().nodeSize([(baseh * 0.45) * nodeSpread, (basew * 0.75) * nodeSpread]);
        tree(root);
        root.each(d => { 
            const temp = d.x; 
            d.x = d.y; 
            d.y = temp; 
        });
    } else if (layoutMode === 'radial') {
        const tree = d3.tree<TreeNode>().nodeSize([0.18 * Math.max(0.5, 1.5 - nodeSpread * 0.2), Math.max(basew, baseh) * 1.3 * nodeSpread]); // angle, radius
        tree(root);
        root.each(d => {
            const angle = d.x;
            const radius = d.y;
            d.x = radius * Math.cos(angle - Math.PI/2);
            d.y = radius * Math.sin(angle - Math.PI/2);
        });
    } else if (layoutMode === 'force') {
        const nodesList = root.descendants() as any[];
        nodesList.forEach((n, idx) => {
            n.x = Math.cos(idx) * 100;
            n.y = Math.sin(idx) * 100;
        });

        const linksList = root.links().map(l => ({
            source: l.source.data.id,
            target: l.target.data.id
        }));

        const simulation = d3.forceSimulation(nodesList)
            .force("link", d3.forceLink(linksList).id((d: any) => d.data.id).distance(240 * nodeSpread).strength(1.2))
            .force("charge", d3.forceManyBody().strength(-400 * nodeSpread))
            .force("collide", d3.forceCollide().radius(140 * nodeSize))
            .force("centerX", d3.forceX(0).strength(0.08))
            .force("centerY", d3.forceY(0).strength(0.08));

        // Sync run simulation ticks to find state equilibrium
        for (let i = 0; i < 120; i++) {
            simulation.tick();
        }
    } else if (layoutMode === 'mindmap') {
        const rootChildren = root.children || [];
        if (rootChildren.length === 0) {
            root.x = 0;
            root.y = 0;
        } else {
            const leftNodes: d3.HierarchyNode<TreeNode>[] = [];
            const rightNodes: d3.HierarchyNode<TreeNode>[] = [];
            rootChildren.forEach((child, idx) => {
                if (idx % 2 === 0) {
                    leftNodes.push(child);
                } else {
                    rightNodes.push(child);
                }
            });

            root.x = 0;
            root.y = 0;

            if (rightNodes.length > 0) {
                const rightData = { 
                    id: 'dummy-right', 
                    name: 'dummy',
                    type: 'dummy',
                    path: 'dummy',
                    children: rightNodes.map(c => c.data) as any 
                };
                const dummyRight = d3.hierarchy<TreeNode>(rightData, d => collapsedNodes.has(d.id) ? null : d.children);
                const treeRight = d3.tree<TreeNode>().nodeSize([(baseh + 40) * nodeSpread, (basew + 100) * nodeSpread]);
                treeRight(dummyRight);
                
                dummyRight.descendants().forEach((dummyNode) => {
                    const originalNode = root.descendants().find(n => n.data.id === dummyNode.data.id);
                    if (originalNode && originalNode !== root) {
                        originalNode.x = dummyNode.y; 
                        originalNode.y = dummyNode.x; 
                    }
                });
            }

            if (leftNodes.length > 0) {
                const leftData = { 
                    id: 'dummy-left', 
                    name: 'dummy',
                    type: 'dummy',
                    path: 'dummy',
                    children: leftNodes.map(c => c.data) as any 
                };
                const dummyLeft = d3.hierarchy<TreeNode>(leftData, d => collapsedNodes.has(d.id) ? null : d.children);
                const treeLeft = d3.tree<TreeNode>().nodeSize([(baseh + 40) * nodeSpread, (basew + 100) * nodeSpread]);
                treeLeft(dummyLeft);
                
                dummyLeft.descendants().forEach((dummyNode) => {
                    const originalNode = root.descendants().find(n => n.data.id === dummyNode.data.id);
                    if (originalNode && originalNode !== root) {
                        originalNode.x = -dummyNode.y; 
                        originalNode.y = dummyNode.x;
                    }
                });
            }
        }
    } else if (layoutMode === 'grid') {
        const list = root.descendants();
        const cols = Math.ceil(Math.sqrt(list.length));
        list.forEach((node, idx) => {
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            node.x = c * (basew + 100) * nodeSpread;
            node.y = r * (baseh + 80) * nodeSpread;
        });
    } else if (layoutMode === 'organic') {
        const list = root.descendants();
        list.forEach((node, idx) => {
            const theta = idx * 0.45 * nodeSpread;
            const radius = (120 + idx * 50) * nodeSpread;
            node.x = radius * Math.cos(theta);
            node.y = radius * Math.sin(theta);
        });
    }

    // After coordinates are set, we return the array of nodes and links
    return {
        nodes: root.descendants(),
        links: root.links()
    };
};

export const getEdgePath = (source: {x: number, y: number}, target: {x: number, y: number}, edgeStyle: string, layoutMode: string) => {
    if (!source || !target || typeof source.x !== 'number' || typeof source.y !== 'number' || typeof target.x !== 'number' || typeof target.y !== 'number' || isNaN(source.x) || isNaN(source.y) || isNaN(target.x) || isNaN(target.y)) {
        return '';
    }

    const { x: x1, y: y1 } = source;
    const { x: x2, y: y2 } = target;

    if (x1 === x2 && y1 === y2) {
        return `M ${x1},${y1} L ${x2},${y2}`;
    }

    // 1. STRAIGHT & SOLID STYLES
    if (edgeStyle === 'straight' || edgeStyle === 'double' || edgeStyle === 'thin') {
        return `M ${x1},${y1} L ${x2},${y2}`;
    }

    // 2. TECHNICAL ELBOW ROUTING (Clean hard-corners with custom offset)
    if (edgeStyle === 'orgChart' || edgeStyle === 'elbow') {
        if (layoutMode === 'vertical' || ['compact', 'grid'].includes(layoutMode)) {
            const midY = y1 + 35;
            return `M ${x1},${y1} L ${x1},${midY} L ${x2},${midY} L ${x2},${y2}`;
        }
        const midX = x1 + 45;
        return `M ${x1},${y1} L ${midX},${y1} L ${midX},${y2} L ${x2},${y2}`;
    }

    // 3. STEP / DASHED / NEON / CIRCUIT (Orthogonal mid-point splitter)
    if (edgeStyle === 'step' || edgeStyle === 'dashed' || edgeStyle === 'neon' || edgeStyle === 'circuit') {
        if (layoutMode === 'vertical' || ['compact', 'grid'].includes(layoutMode)) {
            return `M ${x1},${y1} L ${x1},${(y1 + y2) / 2} L ${x2},${(y1 + y2) / 2} L ${x2},${y2}`;
        }
        return `M ${x1},${y1} L ${(x1 + x2) / 2},${y1} L ${(x1 + x2) / 2},${y2} L ${x2},${y2}`;
    }

    // 4. SMOOTH STEP / PIPE (Orthogonal with rounded fillets)
    if (edgeStyle === 'pipe') {
        const r = 14; 
        if (layoutMode === 'vertical' || ['compact', 'grid'].includes(layoutMode)) {
            const midY = (y1 + y2) / 2;
            const signX = Math.sign(x2 - x1) || 1;
            const signY = Math.sign(y2 - y1) || 1;
            if (x1 === x2 || Math.abs(y1 - y2) < 30) return `M ${x1},${y1} L ${x2},${y2}`;
            return `M ${x1},${y1} L ${x1},${midY - r * signY} Q ${x1},${midY} ${x1 + r * signX},${midY} L ${x2 - r * signX},${midY} Q ${x2},${midY} ${x2},${midY + r * signY} L ${x2},${y2}`;
        }
        const midX = (x1 + x2) / 2;
        const signX = Math.sign(x2 - x1) || 1;
        const signY = Math.sign(y2 - y1) || 1;
        if (y1 === y2 || Math.abs(x1 - x2) < 30) return `M ${x1},${y1} L ${x2},${y2}`;
        return `M ${x1},${y1} L ${midX - r * signX},${y1} Q ${midX},${y1} ${midX},${y1 + r * signY} L ${midX},${y2 - r * signY} Q ${midX},${y2} ${midX + r * signX},${y2} L ${x2},${y2}`;
    }

    // 5. FLOATING EDGE (Adaptive connector shrinking to float gracefully outside the boundary)
    if (edgeStyle === 'floating') {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist > 180) {
            const sx = x1 + (dx / dist) * 130;
            const sy = y1 + (dy / dist) * 50;
            const tx = x2 - (dx / dist) * 130;
            const ty = y2 - (dy / dist) * 50;
            return `M ${sx},${sy} C ${(sx + tx) / 2},${sy} ${(sx + tx) / 2},${ty} ${tx},${ty}`;
        }
        return `M ${x1},${y1} L ${x2},${y2}`;
    }

    // 6. SMART OBSTACLE-AWARE APPARENT ROUTING
    if (edgeStyle === 'smart') {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;
        const offset = dist > 250 ? 60 : 25;
        const mx = (x1 + x2) / 2 + nx * offset;
        const my = (y1 + y2) / 2 + ny * offset;
        return `M ${x1},${y1} Q ${mx},${my} ${x2},${y2}`;
    }

    // 7. TRANSIT-MAP METRO / CIRCUIT (Diag angles restricted strictly to 45 deg + alignment)
    if (edgeStyle === 'circuit') {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const sx = Math.sign(dx) || 1;
        const sy = Math.sign(dy) || 1;

        if (absDx > absDy) {
            return `M ${x1},${y1} L ${x1 + sy * absDy * sx},${y1 + sy * absDy} L ${x2},${y2}`;
        } else {
            return `M ${x1},${y1} L ${x1 + sx * absDx},${y1 + sx * absDx * sy} L ${x2},${y2}`;
        }
    }

    // 8. ELECTRIC PULSE ZIGZAG (Triangular shockwave geometry)
    if (edgeStyle === 'zigzag' || edgeStyle === 'pulse') {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy) || 1;
        const steps = Math.max(6, Math.floor(dist / 22));
        let path = `M ${x1},${y1}`;
        const nx = -dy / dist;
        const ny = dx / dist;

        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            let px = x1 + dx * t;
            let py = y1 + dy * t;
            const amp = 16;
            const disp = (i % 2 === 0 ? 1 : -1) * amp;
            px += nx * disp;
            py += ny * disp;
            path += ` L ${px},${py}`;
        }
        path += ` L ${x2},${y2}`;
        return path;
    }

    // 9. ORGANIC OCTOPUS WAVES
    if (edgeStyle === 'octopus') {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;
        const shift = Math.sin(dist / 40) * 35;
        const mx1 = x1 + dx * 0.33 + nx * shift;
        const my1 = y1 + dy * 0.33 + ny * shift;
        const mx2 = x1 + dx * 0.66 - nx * shift;
        const my2 = y1 + dy * 0.66 - ny * shift;
        return `M ${x1},${y1} C ${mx1},${my1} ${mx2},${my2} ${x2},${y2}`;
    }

    // 11. METRO / ANGLED-STEP (Double-bend slanted transitions centered at the middle)
    if (edgeStyle === 'metro' || edgeStyle === 'angled-step') {
        const dx = x2 - x1;
        const dy = y2 - y1;
        
        if (layoutMode === 'vertical' || ['compact', 'grid'].includes(layoutMode)) {
            const ym = (y1 + y2) / 2;
            const h_slant = Math.min(Math.abs(dx) * 0.5, Math.abs(dy) * 0.35, 30) * (Math.sign(dy) || 1);
            
            const midY1 = ym - h_slant;
            const midY2 = ym + h_slant;
            
            if (Math.abs(dy) <= Math.abs(h_slant * 2)) {
                return `M ${x1},${y1} L ${x2},${y2}`;
            }
            
            if (edgeStyle === 'metro') {
                // Curved transit-style rounded corners at the transition
                return `M ${x1},${y1} L ${x1},${midY1} C ${x1},${ym} ${x2},${ym} ${x2},${midY2} L ${x2},${y2}`;
            } else {
                // Sharp chamfered angled corners
                return `M ${x1},${y1} L ${x1},${midY1} L ${x2},${midY2} L ${x2},${y2}`;
            }
        } else {
            const xm = (x1 + x2) / 2;
            const w_slant = Math.min(Math.abs(dy) * 0.5, Math.abs(dx) * 0.35, 30) * (Math.sign(dx) || 1);
            
            const midX1 = xm - w_slant;
            const midX2 = xm + w_slant;
            
            if (Math.abs(dx) <= Math.abs(w_slant * 2)) {
                return `M ${x1},${y1} L ${x2},${y2}`;
            }
            
            if (edgeStyle === 'metro') {
                // Curved transit-style rounded corners at the transition
                return `M ${x1},${y1} L ${midX1},${y1} C ${xm},${y1} ${xm},${y2} ${midX2},${y2} L ${x2},${y2}`;
            } else {
                // Sharp chamfered angled corners
                return `M ${x1},${y1} L ${midX1},${y1} L ${midX2},${y2} L ${x2},${y2}`;
            }
        }
    }

    // 10. DEFAULT CURVED / BEZIER / ANIMATED
    if (layoutMode === 'vertical' || ['compact', 'grid'].includes(layoutMode)) {
        return `M ${x1},${y1} C ${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
    }
    return `M ${x1},${y1} C ${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
};

