import dagre from 'dagre';
import { Edge, Node } from '@xyflow/react';
import { LayoutMode } from '../store/useStore';

export type SchemaType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array' | 'any';

export type SchemaField = {
  id: string;
  name: string;
  type: SchemaType;
  isArray: boolean;
  itemBaseType?: string; 
  fields?: SchemaField[];
  isRef?: boolean;
  refNodeId?: string;
  jsonPath?: string;
};

export type SchemaNodeData = {
  label: string;
  fields: SchemaField[];
  path: string;
  layoutMode: LayoutMode;
  jsonPath?: string;
};

function capitalize(str: string) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function extractSchema(data: any, rootName = 'Root', layoutMode: LayoutMode = 'horizontal', edgeStyle: string = 'smoothstep'): { nodes: Node[], edges: Edge[] } {
  let fieldCounter = 0;

  function inferType(val: any): SchemaType {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    if (typeof val === 'object') return 'object';
    return typeof val as SchemaType;
  }

  function parseFields(obj: any, path: string, parentNodeId: string, cleanPath: string): SchemaField[] {
    if (typeof obj !== 'object' || obj === null) return [];

    const fields: SchemaField[] = [];
    for (const [key, val] of Object.entries(obj)) {
      const type = inferType(val);
      const fieldId = `${path}_${key}_${fieldCounter++}`;
      const fieldCleanPath = `${cleanPath}.${key}`;

      if (type === 'array') {
        const firstItem = Array.isArray(val) && val.length > 0 ? val[0] : null;
        if (firstItem) {
          const itemType = inferType(firstItem);
          if (itemType === 'object') {
            const keysCount = Object.keys(firstItem).length;
            if (keysCount > 4 || Object.values(firstItem).some(v => inferType(v) === 'object' || inferType(v) === 'array')) {
              const childNodeId = `node_${fieldId}`;
              const childCleanPath = `${fieldCleanPath}[]`;
              nodes.push({ 
                id: childNodeId, 
                type: 'schemaNode', 
                data: { 
                  label: capitalize(key) + ' Item', 
                  fields: parseFields(firstItem, fieldId, childNodeId, childCleanPath), 
                  path: fieldId, 
                  layoutMode,
                  jsonPath: childCleanPath 
                }, 
                position: { x: 0, y: 0 } 
              });
              edges.push({ 
                id: `e_${parentNodeId}_${childNodeId}`, 
                source: parentNodeId, 
                target: childNodeId, 
                sourceHandle: fieldId, 
                type: edgeStyle, 
                style: { stroke: '#64748b', strokeWidth: 1.5, opacity: 0.2 },
                animated: false
              });
              
              fields.push({
                id: fieldId,
                name: key,
                type: 'object',
                isArray: true,
                itemBaseType: capitalize(key) || 'Item',
                isRef: true,
                refNodeId: childNodeId,
                jsonPath: fieldCleanPath
              });
            } else {
              fields.push({
                id: fieldId,
                name: key,
                type: 'object',
                isArray: true,
                itemBaseType: 'Item',
                fields: parseFields(firstItem, fieldId, parentNodeId, `${fieldCleanPath}[]`),
                jsonPath: fieldCleanPath
              });
            }
          } else {
            fields.push({
              id: fieldId,
              name: key,
              type: itemType,
              isArray: true,
              itemBaseType: itemType === 'any' ? 'any' : itemType,
              jsonPath: fieldCleanPath
            });
          }
        } else {
          fields.push({
            id: fieldId,
            name: key,
            type: 'any',
            isArray: true,
            itemBaseType: 'any',
            jsonPath: fieldCleanPath
          });
        }
      } else if (type === 'object') {
        const keysCount = Object.keys(val).length;
        if (keysCount > 4 || Object.values(val).some(v => inferType(v) === 'object' || inferType(v) === 'array')) {
          const childNodeId = `node_${fieldId}`;
          const childCleanPath = fieldCleanPath;
          nodes.push({ 
            id: childNodeId, 
            type: 'schemaNode', 
            data: { 
              label: capitalize(key), 
              fields: parseFields(val, fieldId, childNodeId, childCleanPath), 
              path: fieldId, 
              layoutMode,
              jsonPath: childCleanPath 
            }, 
            position: { x: 0, y: 0 } 
          });
          edges.push({ 
            id: `e_${parentNodeId}_${childNodeId}`, 
            source: parentNodeId, 
            target: childNodeId, 
            sourceHandle: fieldId, 
            type: edgeStyle, 
            style: { stroke: '#64748b', strokeWidth: 1.5, opacity: 0.2 },
            animated: false
          });

          fields.push({
            id: fieldId,
            name: key,
            type: 'object',
            isArray: false,
            isRef: true,
            refNodeId: childNodeId,
            jsonPath: fieldCleanPath
          });
        } else {
          fields.push({
            id: fieldId,
            name: key,
            type: 'object',
            isArray: false,
            fields: parseFields(val, fieldId, parentNodeId, fieldCleanPath),
            jsonPath: fieldCleanPath
          });
        }
      } else {
        fields.push({
          id: fieldId,
          name: key,
          type: type,
          isArray: false,
          jsonPath: fieldCleanPath
        });
      }
    }
    return fields;
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (Array.isArray(data)) {
    // For arrays, sample the first item to generate the schema
    const sampleItem = data.length > 0 ? data[0] : {};
    nodes.push({
      id: 'root-node',
      type: 'schemaNode',
      data: { 
        label: `${rootName} []`, 
        fields: parseFields(sampleItem, 'root', 'root-node', 'root[]'), 
        path: 'root', 
        layoutMode,
        jsonPath: 'root[]'
      },
      position: { x: 0, y: 0 }
    });
  } else {
    nodes.push({
      id: 'root-node',
      type: 'schemaNode',
      data: { 
        label: rootName, 
        fields: parseFields(data, 'root', 'root-node', 'root'), 
        path: 'root', 
        layoutMode,
        jsonPath: 'root'
      },
      position: { x: 0, y: 0 }
    });
  }

  // Optional: Run dagre layout if we had edges (we don't for now, but keeping for future)
  if (edges.length > 0) {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    const rankdir = layoutMode === 'vertical' ? 'TB' : 'LR';
    dagreGraph.setGraph({ rankdir, align: 'UL', ranksep: 200, nodesep: 50 });

    nodes.forEach((n: any) => {
      dagreGraph.setNode(n.id, { width: 300, height: 300 });
    });

    edges.forEach((e) => {
      dagreGraph.setEdge(e.source, e.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((n: any) => {
      const dNode = dagreGraph.node(n.id);
      n.position = { x: dNode.x - dNode.width / 2, y: dNode.y - dNode.height / 2 };
    });
  }

  return { nodes, edges };
}
