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

    if (layoutMode === 'horizontal' || layoutMode === 'mindmap') {
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
        const tree = d3.tree<TreeNode>().nodeSize([(baseh / 2) * nodeSpread, (basew + 20) * Math.max(1, nodeSpread * 0.8)]);
        tree(root);
        root.each(d => { const temp = d.x; d.x = d.y; d.y = temp; });
    } else if (layoutMode === 'radial') {
        const tree = d3.tree<TreeNode>().nodeSize([0.15 * (baseh/100) * Math.max(0.5, 1.5 - nodeSpread*0.2), Math.max(basew, baseh) * 1.5 * nodeSpread]); // angle, radius
        tree(root);
        root.each(d => {
            const angle = d.x;
            const radius = d.y;
            d.x = radius * Math.cos(angle - Math.PI/2);
            d.y = radius * Math.sin(angle - Math.PI/2);
        });
    } else if (layoutMode === 'force') {
        const tree = d3.tree<TreeNode>().nodeSize([(baseh + 20) * nodeSpread, (basew + 40) * nodeSpread]);
        tree(root);
        root.each(d => { const temp = d.x; d.x = d.y; d.y = temp; });
    }

    // After coordinates are set, we return the array of nodes and links
    return {
        nodes: root.descendants(),
        links: root.links()
    };
};

export const getEdgePath = (source: {x: number, y: number}, target: {x: number, y: number}, edgeStyle: string, layoutMode: string) => {
    const { x: x1, y: y1 } = source;
    const { x: x2, y: y2 } = target;

    if (edgeStyle === 'straight' || edgeStyle === 'double' || edgeStyle === 'thin' || edgeStyle === 'pulse' || edgeStyle === 'zigzag') {
        if (edgeStyle === 'zigzag') {
            const zx = (x1 + x2) / 2;
            const zy = (y1 + y2) / 2;
            return `M ${x1},${y1} L ${zx + 20},${zy - 20} L ${x2},${y2}`; // a simple kink
        }
        return `M ${x1},${y1} L ${x2},${y2}`;
    }

    if (edgeStyle === 'step' || edgeStyle === 'dashed' || edgeStyle === 'neon' || edgeStyle === 'circuit') {
        if (layoutMode === 'vertical') {
            return `M ${x1},${y1} L ${x1},${(y1 + y2) / 2} L ${x2},${(y1 + y2) / 2} L ${x2},${y2}`;
        }
        return `M ${x1},${y1} L ${(x1 + x2) / 2},${y1} L ${(x1 + x2) / 2},${y2} L ${x2},${y2}`;
    }

    if (edgeStyle === 'pipe' || edgeStyle === 'orgChart') {
        // slightly rounded step
        const r = edgeStyle === 'orgChart' ? 16 : 10;
        if (layoutMode === 'vertical') {
            const midY = (y1 + y2) / 2;
            const signX = Math.sign(x2 - x1);
            if (x1 === x2 || Math.abs(y1 - y2) < 20) return `M ${x1},${y1} L ${x2},${y2}`;
            return `M ${x1},${y1} L ${x1},${midY - r} Q ${x1},${midY} ${x1 + signX*r},${midY} L ${x2 - signX*r},${midY} Q ${x2},${midY} ${x2},${midY + r} L ${x2},${y2}`;
        }
        const midX = (x1 + x2) / 2;
        const signY = Math.sign(y2 - y1);
        if (y1 === y2 || Math.abs(x1 - x2) < 20) return `M ${x1},${y1} L ${x2},${y2}`;
        return `M ${x1},${y1} L ${midX - r},${y1} Q ${midX},${y1} ${midX},${y1 + signY*r} L ${midX},${y2 - signY*r} Q ${midX},${y2} ${midX + r},${y2} L ${x2},${y2}`;
    }

    // Defaults to curved / bezier / animated
    if (layoutMode === 'vertical') {
        return `M ${x1},${y1} C ${x1},${(y1+y2)/2} ${x2},${(y1+y2)/2} ${x2},${y2}`;
    }
    return `M ${x1},${y1} C ${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`;
};
