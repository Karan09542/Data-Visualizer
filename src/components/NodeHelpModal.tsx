import React from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import HelpDialog from './help/HelpDialog';
import { nodesHelp } from './help/helpContent';

interface NodeHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NodeHelpModal: React.FC<NodeHelpModalProps> = ({ isOpen, onClose }) => {
  const handleInsertExample = async () => {
    try {
      const { parsedData, codeFormat, setCode, setCodeFormat } = useStore.getState();

      const demoFields = {
        demo_user_info: "Demographic and details panel",
        github_profile_api_node: "https://api.github.com/users/octocat",
        posts_api_node: "https://jsonplaceholder.typicode.com/posts/1",
        ip_lookup_api_node: "https://ipapi.co/json/",
        calculator_js_node: "// JS calculation node executing!\n// namaste",
        greeting_ts_node: "const name: string = 'World';\n// Hello ${name}!\n// namaste",
        greeting_py_node: 'text = "World"\nprint(f"Hello {text}!")\nprint("namaste")',
        waveform_math_node: "f(x) = a * sin(b * x + c)",
        "demo_asset.image": "https://images.unsplash.com/photo-1542393545-10f5cde2c810?q=80&w=600&auto=format&fit=crop",
        "sync_assets.transfer": "",
        "project_tasks.todo": JSON.stringify({
          title: "Project Tasks",
          tasks: [
            { id: "dt1", text: "Design Database Schema", completed: true, status: "Completed", priority: "High" },
            {
              id: "dt2",
              text: "Setup Authentication Flow",
              completed: false,
              status: "Todo",
              priority: "High",
              tasks: [
                { id: "dt2-1", text: "Integrate OAuth Callback", completed: true, status: "Completed", priority: "Medium" },
                { id: "dt2-2", text: "Validate Session Tokens", completed: false, status: "Todo", priority: "High" }
              ]
            },
            { id: "dt3", text: "Write API endpoints & tests", completed: false, status: "Todo", priority: "Low" }
          ]
        }, null, 2)
      };

      const demoNodes = {
        demo_user_info: "Demographic and details panel",
        github_profile_api_node: "https://api.github.com/users/octocat",
        posts_api_node: "https://jsonplaceholder.typicode.com/posts/1",
        meta: {
          api_status: "online",
          ip_lookup_api_node: "https://ipapi.co/json/",
          run_calc_js_node: "// Math calculation:\n// namaste",
          format_date_ts_node: "// Current ISO Date:\n// namaste",
          greeting_py_node: 'text = "World"\nprint(f"Hello {text}!")\nprint("namaste")',
          waveform_math_node: "f(x) = a * sin(b * x + c)",
          "demo_asset.image": "https://images.unsplash.com/photo-1542393545-10f5cde2c810?q=80&w=600&auto=format&fit=crop",
          "specs_transfer_node": "",
          "project_tasks.todo": JSON.stringify({
            title: "Project Tasks",
            tasks: [
              { id: "dt1", text: "Design Database Schema", completed: true, status: "Completed", priority: "High" },
              {
                id: "dt2",
                text: "Setup Authentication Flow",
                completed: false,
                status: "Todo",
                priority: "High",
                tasks: [
                  { id: "dt2-1", text: "Integrate OAuth Callback", completed: true, status: "Completed", priority: "Medium" },
                  { id: "dt2-2", text: "Validate Session Tokens", completed: false, status: "Todo", priority: "High" }
                ]
              },
              { id: "dt3", text: "Write API endpoints & tests", completed: false, status: "Todo", priority: "Low" }
            ]
          }, null, 2)
        }
      };

      let newCode = '';

      let currentData: any = {};
      if (parsedData && typeof parsedData === 'object') {
        if (Array.isArray(parsedData)) {
          currentData = parsedData.map(row => ({
            ...row,
            ...demoFields
          }));
        } else {
          currentData = { ...parsedData, demo_nodes: demoNodes };
        }
      } else {
        currentData = {
          project_name: "Visualizer Showcase",
          demo_nodes: demoNodes
        };
      }

      if (codeFormat === 'yaml') {
        try {
          const yaml = (await import('js-yaml')).default;
          newCode = yaml.dump(currentData);
        } catch {
          newCode = JSON.stringify(currentData, null, 2);
        }
      } else {
        newCode = JSON.stringify(currentData, null, 2);
      }

      setCode(newCode);
      onClose();
    } catch (e) {
      console.error("Could not insert example", e);
    }
  };

  return (
    <HelpDialog
      open={isOpen}
      onClose={onClose}
      content={nodesHelp}
      action={{ label: 'Insert demo nodes', icon: Plus, onClick: handleInsertExample }}
    />
  );
};

export default NodeHelpModal;
