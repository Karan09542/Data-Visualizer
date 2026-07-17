import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { MathNodeRenderer } from './MathNodeRenderer';
import { TransferNodeRenderer } from './TransferNodeRenderer';
import { getValueAtPath } from '../utils/pathUtils';
import { ErrorBoundary } from './ErrorBoundary';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface IsolatedNodeViewProps {
  path: string;
}

export const IsolatedNodeView: React.FC<IsolatedNodeViewProps> = ({ path }) => {
  const parsedData = useStore((state) => state.parsedData);
  const appTheme = useStore((state) => state.appTheme);

  const nodeData = useMemo(() => {
    if (!parsedData || !path) return null;
    const name = path.split('.').pop() || '';
    const value = getValueAtPath(parsedData, path);
    return { name, value, type: typeof value, path };
  }, [parsedData, path]);

  const transferNodeTypes = useMemo(() => ({
    transfer: ({ data }: any) => <TransferNodeRenderer node={{ data } as any} />
  }), []);

  const flowNodes = useMemo(() => {
    if (!nodeData) return [];
    return [{ id: 'isolated_transfer_node', type: 'transfer', data: nodeData, position: { x: 0, y: 0 } }];
  }, [nodeData]);

  if (!nodeData) {
    return (
      <div className={`flex items-center justify-center w-full h-full ${appTheme === 'dark' ? 'bg-[#0d1117] text-white' : 'bg-white text-slate-800'}`}>
        <div className="flex flex-col items-center">
          <p className="text-xl font-bold mb-2">Node not found or loading...</p>
        </div>
      </div>
    );
  }

  const isMathNode =
    typeof nodeData.name === "string" &&
    (nodeData.name.endsWith("_math_node") ||
      nodeData.name.endsWith(".math") ||
      nodeData.name.toLowerCase().endsWith("graph") ||
      nodeData.name.toLowerCase().endsWith("math"));

  const isTransferNode =
    typeof nodeData.name === "string" &&
    (nodeData.name.endsWith("_transfer_node") || nodeData.name.endsWith(".transfer"));

  const isFullScreen = isTransferNode;

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center overflow-hidden ${isFullScreen ? 'p-0' : 'p-4 md:p-8'} ${appTheme === 'dark' ? 'bg-[#0d1117]' : 'bg-slate-50'}`}>
      <ErrorBoundary fallback={<div className="p-4 text-red-500">Failed to render isolated node view.</div>}>
        <div className={`w-full h-full flex relative ${isFullScreen ? '' : 'max-w-5xl max-h-[90vh] shadow-2xl rounded-[20px] overflow-hidden bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/5'}`}>
          {isMathNode ? (
            <div className="w-full h-full flex relative">
              <MathNodeRenderer nodeId={path} data={nodeData} isExpanded={true} width={1200} height={800} />
            </div>
          ) : isTransferNode ? (
            <div className={`w-full h-full relative ${appTheme === 'dark' ? 'bg-[#0d1117]' : 'bg-slate-50'}`}>
              <ReactFlow
                nodes={flowNodes}
                nodeTypes={transferNodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                minZoom={0.2}
                maxZoom={2}
              >
                <Background color={appTheme === 'dark' ? '#ffffff' : '#000000'} gap={20} size={1} style={{ opacity: 1 }} />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-8 text-slate-500">
              Preview not supported for this node type.
            </div>
          )}
        </div>
      </ErrorBoundary>
    </div>
  );
};
