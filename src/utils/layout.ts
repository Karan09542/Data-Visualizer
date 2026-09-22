import * as d3 from 'd3';
import { TreeNode } from '../utils/transformer';

const applyLayoutModeToHierarchy = (
    subRoot: d3.HierarchyNode<TreeNode>,
    mode: string,
    basew: number,
    baseh: number,
    nodeSpread: number,
    nodeSize: number,
    collapsedNodes: Set<string>,
    isSubtree: boolean = false
) => {
    if (mode === 'horizontal') {
        const tree = d3.tree<TreeNode>().nodeSize([(baseh + 40) * nodeSpread, (basew + 80) * nodeSpread]); // y step, x step
        tree(subRoot);
        subRoot.each(d => {
            const temp = d.x;
            d.x = d.y;
            d.y = temp;
        });
    } else if (mode === 'vertical') {
        const tree = d3.tree<TreeNode>().nodeSize([(basew + 20) * nodeSpread, (baseh + 80) * nodeSpread]); // x step, y step
        tree(subRoot);
    } else if (mode === 'compact') {
        const tree = d3.tree<TreeNode>().nodeSize([(baseh * 0.45) * nodeSpread, (basew * 0.75) * nodeSpread]);
        tree(subRoot);
        subRoot.each(d => {
            const temp = d.x;
            d.x = d.y;
            d.y = temp;
        });
    } else if (mode === 'radial') {
        const tree = d3.tree<TreeNode>().nodeSize([0.18 * Math.max(0.5, 1.5 - nodeSpread * 0.2), Math.max(basew, baseh) * 1.3 * nodeSpread]); // angle, radius
        tree(subRoot);
        subRoot.each(d => {
            const angle = d.x;
            const radius = d.y;
            d.x = radius * Math.cos(angle - Math.PI / 2);
            d.y = radius * Math.sin(angle - Math.PI / 2);
        });
    } else if (mode === 'force') {
        const nodesList = subRoot.descendants() as any[];
        const linksList = subRoot.links().map(l => ({
            source: l.source.data.id,
            target: l.target.data.id
        }));

        // Initial organic positioning around the center based on depth & angle
        const count = nodesList.length;
        const baseDist = (basew + 120) * nodeSpread;
        nodesList.forEach((n, idx) => {
            if (n === subRoot) {
                n.x = 0;
                n.y = 0;
                n.fx = 0;
                n.fy = 0;
            } else {
                const angle = (idx / Math.max(1, count - 1)) * 2 * Math.PI;
                const dist = (n.depth || 1) * baseDist * 0.9;
                n.x = Math.cos(angle) * dist;
                n.y = Math.sin(angle) * dist;
                delete n.fx;
                delete n.fy;
            }
        });

        const collisionRadius = (Math.hypot(basew, baseh) / 2 + 35) * Math.max(0.8, nodeSize);
        const linkDistance = (basew + 130) * nodeSpread;

        const simulation = d3.forceSimulation(nodesList)
            .force("link", d3.forceLink(linksList)
                .id((d: any) => d.data.id)
                .distance(linkDistance)
                .strength(0.85)
            )
            .force("charge", d3.forceManyBody()
                .strength(-1800 * nodeSpread)
                .distanceMin(80)
                .distanceMax(3500)
            )
            .force("collide", d3.forceCollide()
                .radius(collisionRadius)
                .strength(1.0)
                .iterations(3)
            )
            .force("centerX", d3.forceX(0).strength(0.04))
            .force("centerY", d3.forceY(0).strength(0.04))
            .alphaDecay(0.02);

        // Run simulation ticks to reach true physics equilibrium
        for (let i = 0; i < 280; i++) {
            simulation.tick();
        }

        // Release pinned center so coordinates are normal numbers
        delete (subRoot as any).fx;
        delete (subRoot as any).fy;
        subRoot.x = 0;
        subRoot.y = 0;
    } else if (mode === 'mindmap') {
        const rootChildren = subRoot.children || [];
        if (rootChildren.length === 0) {
            subRoot.x = 0;
            subRoot.y = 0;
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

            subRoot.x = 0;
            subRoot.y = 0;

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
                    const originalNode = subRoot.descendants().find(n => n.data.id === dummyNode.data.id);
                    if (originalNode && originalNode !== subRoot) {
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
                    const originalNode = subRoot.descendants().find(n => n.data.id === dummyNode.data.id);
                    if (originalNode && originalNode !== subRoot) {
                        originalNode.x = -dummyNode.y;
                        originalNode.y = dummyNode.x;
                    }
                });
            }
        }
    } else if (mode === 'grid') {
        const list = subRoot.descendants();
        if (isSubtree) {
            subRoot.x = 0;
            subRoot.y = 0;
            const childrenList = list.slice(1);
            if (childrenList.length > 0) {
                const cols = Math.ceil(Math.sqrt(childrenList.length));
                childrenList.forEach((node, idx) => {
                    const r = Math.floor(idx / cols);
                    const c = idx % cols;
                    node.x = (c + 1) * (basew + 80) * nodeSpread;
                    node.y = (r - Math.floor(cols / 2)) * (baseh + 60) * nodeSpread;
                });
            }
        } else {
            const cols = Math.ceil(Math.sqrt(list.length));
            list.forEach((node, idx) => {
                const r = Math.floor(idx / cols);
                const c = idx % cols;
                node.x = c * (basew + 100) * nodeSpread;
                node.y = r * (baseh + 80) * nodeSpread;
            });
        }
    } else if (mode === 'molecule') {
        const bondLength = (basew + 120) * nodeSpread;

        // Recursive molecular placement with authentic chemical bond geometry
        const placeMolecularAtom = (
            node: d3.HierarchyNode<TreeNode>,
            incomingAngle: number,
            cx: number,
            cy: number,
            depth: number
        ) => {
            node.x = cx;
            node.y = cy;
            const children = node.children || [];
            if (children.length === 0) return;

            const count = children.length;

            if (depth === 0) {
                // Central hub atom: Canonical molecular coordination geometries
                const baseAngles: number[] = [];
                if (count === 1) {
                    baseAngles.push(0);
                } else if (count === 2) {
                    baseAngles.push(-Math.PI / 3, Math.PI / 3); // Bent 120 deg
                } else if (count === 3) {
                    baseAngles.push(0, (2 * Math.PI) / 3, (4 * Math.PI) / 3); // Trigonal planar 120 deg
                } else if (count === 4) {
                    baseAngles.push(-Math.PI / 4, Math.PI / 4, (3 * Math.PI) / 4, -(3 * Math.PI) / 4); // Tetrahedral projection
                } else if (count === 6) {
                    for (let i = 0; i < 6; i++) baseAngles.push((i * Math.PI) / 3); // Hexagonal benzene ring
                } else {
                    const step = (2 * Math.PI) / count;
                    for (let i = 0; i < count; i++) baseAngles.push(i * step);
                }

                children.forEach((child, i) => {
                    const angle = baseAngles[i];
                    // Natural bond length with subtle chemical staggering
                    const l = bondLength * (i % 2 === 0 ? 1.0 : 1.15);
                    placeMolecularAtom(child, angle, cx + Math.cos(angle) * l, cy + Math.sin(angle) * l, depth + 1);
                });
            } else {
                // Sub-atom: Bonds fan forward away from the incoming bond
                const maxCone = Math.min(Math.PI * 0.8, count * (Math.PI / 4));
                const angleStep = count > 1 ? maxCone / (count - 1) : 0;
                const startAngle = count > 1 ? incomingAngle - maxCone / 2 : incomingAngle;

                children.forEach((child, i) => {
                    const angle = count === 1 ? incomingAngle : startAngle + i * angleStep;
                    const l = bondLength * (0.95 + (i % 2 === 0 ? 0.12 : -0.04));
                    placeMolecularAtom(child, angle, cx + Math.cos(angle) * l, cy + Math.sin(angle) * l, depth + 1);
                });
            }
        };

        placeMolecularAtom(subRoot, 0, 0, 0, 0);

        // Anti-overlap relaxation pass for molecule nodes
        const moleculeNodes = subRoot.descendants();
        const minDistance = (Math.hypot(basew, baseh) / 2 + 30) * Math.max(0.8, nodeSize);
        for (let iter = 0; iter < 12; iter++) {
            for (let i = 0; i < moleculeNodes.length; i++) {
                for (let j = i + 1; j < moleculeNodes.length; j++) {
                    const a = moleculeNodes[i];
                    const b = moleculeNodes[j];
                    const dx = (b.x || 0) - (a.x || 0);
                    const dy = (b.y || 0) - (a.y || 0);
                    const dist = Math.hypot(dx, dy) || 1;
                    if (dist < minDistance) {
                        const overlap = (minDistance - dist) / 2;
                        const nx = (dx / dist) * overlap;
                        const ny = (dy / dist) * overlap;
                        if (a !== subRoot) { a.x = (a.x || 0) - nx; a.y = (a.y || 0) - ny; }
                        if (b !== subRoot) { b.x = (b.x || 0) + nx; b.y = (b.y || 0) + ny; }
                    }
                }
            }
        }
    } else {
        // Fallback to prevent NaN if mode is unknown
        const tree = d3.tree<TreeNode>().nodeSize([(baseh + 40) * nodeSpread, (basew + 80) * nodeSpread]);
        tree(subRoot);
    }
};

export const computeLayout = (
    treeData: TreeNode | null,
    collapsedNodes: Set<string>,
    layoutMode: string,
    nodeShape: string = 'default',
    nodeSpread: number = 1.0,
    nodeSize: number = 1.0,
    nodeLayoutOverrides: Record<string, string> = {}
) => {
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

    // 1. Initial base layout on the root hierarchy
    const baseMode = nodeLayoutOverrides[root.data.id] || layoutMode;
    applyLayoutModeToHierarchy(root, baseMode, basew, baseh, nodeSpread, nodeSize, collapsedNodes, false);

    // 2. Apply any subtree layout overrides, sorted by depth (shallowest first)
    if (nodeLayoutOverrides && Object.keys(nodeLayoutOverrides).length > 0) {
        const allDescendants = root.descendants();
        const nodesWithOverride = allDescendants
            .filter(n => n !== root && nodeLayoutOverrides[n.data.id])
            .sort((a, b) => a.depth - b.depth);

        for (const subNode of nodesWithOverride) {
            // Only apply if node has visible children
            if (subNode.children && subNode.children.length > 0) {
                const subMode = nodeLayoutOverrides[subNode.data.id];
                const targetX = subNode.x;
                const targetY = subNode.y;
                applyLayoutModeToHierarchy(subNode, subMode, basew, baseh, nodeSpread, nodeSize, collapsedNodes, true);
                const offsetX = targetX - (subNode.x || 0);
                const offsetY = targetY - (subNode.y || 0);
                subNode.descendants().forEach(d => {
                    d.x = (d.x || 0) + offsetX;
                    d.y = (d.y || 0) + offsetY;
                });
            }
        }
    }

    // Ensure no NaN coordinates exist
    root.descendants().forEach(node => {
        if (isNaN(node.x) || node.x === undefined) node.x = 0;
        if (isNaN(node.y) || node.y === undefined) node.y = 0;
    });

    // After coordinates are set, we return the array of nodes and links
    return {
        nodes: root.descendants(),
        links: root.links()
    };
};

export const getEdgePath = (source: { x: number, y: number }, target: { x: number, y: number }, edgeStyle: string, layoutMode: string) => {
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

    // 8. ELECTRIC PULSE ZIGZAG (Smooth sinusoidal wave geometry)
    if (edgeStyle === 'zigzag' || edgeStyle === 'pulse') {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;

        // Use fewer, wider waves for a smoother look
        const waveCount = Math.max(3, Math.floor(dist / 50));
        const amp = edgeStyle === 'pulse' ? 12 : 14;
        let path = `M ${x1},${y1}`;

        for (let i = 0; i < waveCount; i++) {
            const t0 = i / waveCount;
            const t1 = (i + 0.5) / waveCount;
            const t2 = (i + 1) / waveCount;

            // Midpoint of this half-wave (the peak/valley)
            const peakX = x1 + dx * t1;
            const peakY = y1 + dy * t1;
            const side = (i % 2 === 0 ? 1 : -1) * amp;

            // Control point at the peak, displaced perpendicular
            const cpX = peakX + nx * side;
            const cpY = peakY + ny * side;

            // End point of this wave segment
            const endX = x1 + dx * t2;
            const endY = y1 + dy * t2;

            // Quadratic bezier for smooth rounded peaks
            path += ` Q ${cpX},${cpY} ${endX},${endY}`;
        }
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

    // 10. DEFAULT CURVED / DIRECT CONNECTIONS
    // For force, molecule, and radial: clean direct/spline connections (never horizontal S-curves)
    if (layoutMode === 'force' || layoutMode === 'molecule' || layoutMode === 'radial') {
        if (edgeStyle === 'straight' || edgeStyle === 'double' || edgeStyle === 'thin' || layoutMode === 'molecule') {
            return `M ${x1},${y1} L ${x2},${y2}`;
        }
        // Smooth gentle direct curve
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        return `M ${x1},${y1} Q ${mx},${my} ${x2},${y2}`;
    }

    if (layoutMode === 'vertical' || ['compact', 'grid'].includes(layoutMode)) {
        return `M ${x1},${y1} C ${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
    }
    return `M ${x1},${y1} C ${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
};

