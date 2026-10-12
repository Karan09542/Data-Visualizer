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
        const leafCount = Math.max(1, subRoot.leaves().length);
        const dynamicAngleStep = isSubtree
            ? Math.max(0.18 * Math.max(0.5, 1.5 - nodeSpread * 0.2), (2 * Math.PI) / leafCount)
            : 0.18 * Math.max(0.5, 1.5 - nodeSpread * 0.2);
        const radiusStep = Math.max(basew, baseh) * 1.3 * nodeSpread;
        const tree = d3.tree<TreeNode>().nodeSize([dynamicAngleStep, radiusStep]); // angle, radius
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
                const localDepth = (n.depth ?? 0) - (subRoot.depth ?? 0);
                const dist = Math.max(1, localDepth) * baseDist * 0.9;
                n.x = Math.cos(angle) * dist;
                n.y = Math.sin(angle) * dist;
                delete n.fx;
                delete n.fy;
            }
        });

        const collisionRadius = (Math.hypot(basew, baseh) / 2 + 35) * Math.max(0.8, nodeSize);
        const linkDistance = (basew + 130) * nodeSpread;

        const isLargeGraph = count > 150;
        const isHugeGraph = count > 600;

        const simulation = d3.forceSimulation(nodesList)
            .force("link", d3.forceLink(linksList)
                .id((d: any) => d.data.id)
                .distance(linkDistance)
                .strength(0.85)
            )
            .force("charge", d3.forceManyBody()
                .strength(isHugeGraph ? -800 * nodeSpread : -1800 * nodeSpread)
                .theta(0.9) // Barnes-Hut Quadtree approximation threshold O(N log N)
                .distanceMin(80)
                .distanceMax(3500)
            )
            .force("collide", d3.forceCollide()
                .radius(collisionRadius)
                .strength(isHugeGraph ? 0.7 : 1.0)
                .iterations(isLargeGraph ? 1 : 2) // Single collision pass for large graphs to prevent lag
            )
            .force("centerX", d3.forceX(0).strength(0.04))
            .force("centerY", d3.forceY(0).strength(0.04))
            .alphaDecay(isHugeGraph ? 0.05 : isLargeGraph ? 0.035 : 0.02);

        // Adaptive simulation ticks: large graphs reach equilibrium fast without blocking the thread
        const maxTicks = isHugeGraph ? 50 : isLargeGraph ? 90 : 160;
        for (let i = 0; i < maxTicks; i++) {
            simulation.tick();
            if (simulation.alpha() < 0.025) break; // Early convergence
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

            const subRootDescendants = subRoot.descendants();
            const nodeMap = new Map<string, d3.HierarchyNode<TreeNode>>(
                subRootDescendants.map(n => [n.data.id, n])
            );

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
                    const originalNode = nodeMap.get(dummyNode.data.id);
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
                    const originalNode = nodeMap.get(dummyNode.data.id);
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

        // Quadtree-based anti-overlap relaxation pass for molecule nodes O(N log N)
        const moleculeNodes = subRoot.descendants();
        const minDistance = (Math.hypot(basew, baseh) / 2 + 30) * Math.max(0.8, nodeSize);
        const relaxationPasses = moleculeNodes.length > 300 ? 3 : 6;
        for (let iter = 0; iter < relaxationPasses; iter++) {
            const tree = d3.quadtree<d3.HierarchyNode<TreeNode>>()
                .x(d => d.x ?? 0)
                .y(d => d.y ?? 0)
                .addAll(moleculeNodes);

            for (let i = 0; i < moleculeNodes.length; i++) {
                const a = moleculeNodes[i];
                const ax = a.x ?? 0;
                const ay = a.y ?? 0;

                tree.visit((quad, x0, y0, x1, y1) => {
                    if (!quad.length) {
                        let d: any = quad;
                        do {
                            const b = d.data as d3.HierarchyNode<TreeNode>;
                            if (b && b !== a) {
                                const bx = b.x ?? 0;
                                const by = b.y ?? 0;
                                const dx = bx - ax;
                                const dy = by - ay;
                                const dist = Math.hypot(dx, dy) || 1;
                                if (dist < minDistance) {
                                    const overlap = (minDistance - dist) / 2;
                                    const nx = (dx / dist) * overlap;
                                    const ny = (dy / dist) * overlap;
                                    if (a !== subRoot) { a.x = ax - nx; a.y = ay - ny; }
                                    if (b !== subRoot) { b.x = bx + nx; b.y = by + ny; }
                                }
                            }
                        } while ((d = d.next));
                    }
                    return x0 > ax + minDistance || x1 < ax - minDistance || y0 > ay + minDistance || y1 < ay - minDistance;
                });
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

                // Create an isolated local hierarchy for this subtree so depth is 0 at subNode
                // This guarantees the subtree layout is strictly calculated relative to subNode (parent), NOT the root
                const localRoot = d3.hierarchy<TreeNode>(
                    subNode.data,
                    d => collapsedNodes.has(d.id) ? null : d.children
                );

                applyLayoutModeToHierarchy(localRoot, subMode, basew, baseh, nodeSpread, nodeSize, collapsedNodes, true);

                // Build a quick map of local positions for each descendant in the subtree
                const localMap = new Map<string, { x: number; y: number }>();
                localRoot.descendants().forEach(d => {
                    localMap.set(d.data.id, { x: d.x ?? 0, y: d.y ?? 0 });
                });

                // Apply positions directly around targetX, targetY of the parent subNode
                subNode.descendants().forEach(d => {
                    const localPos = localMap.get(d.data.id);
                    if (localPos) {
                        d.x = targetX + localPos.x;
                        d.y = targetY + localPos.y;
                    }
                });
            }
        }
    }

    // Special layout rule for API response nodes and raw fetched data nodes:
    // Place API response / fetched node directly adjacent to parent API node,
    // and shift the entire fetched subtree together so it stays completely intact!
    root.descendants().forEach(node => {
        if (!node.parent) return;

        const isApiParent =
            node.parent.data.type === 'string' &&
            typeof node.parent.data.name === 'string' &&
            node.parent.data.name.endsWith('_api_node');

        if (!isApiParent) return;

        const parentMode = (nodeLayoutOverrides && nodeLayoutOverrides[node.parent.data.id]) || baseMode;
        const isVertical = parentMode === 'vertical';

        // File-mode single response preview card
        if (node.data.type === 'api_response' || node.data.id.endsWith('.__response')) {
            node.x = isVertical ? node.parent.x : node.parent.x + 460;
            node.y = isVertical ? node.parent.y + 240 : node.parent.y;
        } else if (node.data.id.endsWith('.__fetched')) {
            // Raw nodes fetched data key node (__fetched)
            // Adjacent to API node: right of API node card (width ~340px) with comfortable gap
            const targetX = isVertical ? node.parent.x : node.parent.x + 360;
            const targetY = isVertical ? node.parent.y + 180 : node.parent.y;

            const shiftX = targetX - (node.x || 0);
            const shiftY = targetY - (node.y || 0);

            // Shift fetched node AND ALL ITS DESCENDANTS together so the subtree stays intact
            node.descendants().forEach(d => {
                d.x = (d.x || 0) + shiftX;
                d.y = (d.y || 0) + shiftY;
            });
        }
    });

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
    if (edgeStyle === 'straight') {
        return `M ${x1},${y1} L ${x2},${y2}`;
    }

    // 3. STEP / DASHED / CIRCUIT (Orthogonal mid-point splitter)
    if (edgeStyle === 'step' || edgeStyle === 'dashed' || edgeStyle === 'circuit') {
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

    // ARC: a gentle circular arc that leaves the parent heading outward and curves in to the child,
    // so it doesn't cut back across siblings. Children on either side mirror each other.
    if (edgeStyle === 'arc') {
        const dx = x2 - x1, dy = y2 - y1;
        const d = Math.hypot(dx, dy);
        // Bend depth peaks at 45° and falls to zero for level or aligned children,
        // so near-straight edges stay straight instead of humping over their siblings
        const s = (0.3 * Math.abs(dx * dy)) / (d || 1);
        if (s < 1) return `M ${x1},${y1} L ${x2},${y2}`;
        const r = (d * d) / (8 * s) + s / 2;
        const sweep = dx * dy >= 0 ? 1 : 0;
        return `M ${x1},${y1} A ${r},${r} 0 0 ${sweep} ${x2},${y2}`;
    }

    // 10. DEFAULT CURVED / DIRECT CONNECTIONS
    // For force, molecule, and radial: clean direct/spline connections (never horizontal S-curves)
    if (layoutMode === 'force' || layoutMode === 'molecule' || layoutMode === 'radial') {
        if (edgeStyle === 'straight' || layoutMode === 'molecule') {
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

