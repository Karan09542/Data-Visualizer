import {
  Keyboard,
  Command,
  PenTool,
  Move,
  HelpCircle,
  Network,
  FileJson,
  Code,
  Terminal,
  Calculator,
  ListTodo,
  Image as ImageIcon,
  Share2,
  Edit,
  Play,
  CheckCircle2,
  Crosshair,
  SlidersHorizontal,
  Grid3x3,
  Sigma,
  Plus,
  Layers,
  Activity,
  Search,
  Filter,
  Braces,
  GitBranch,
  FolderTree,
} from 'lucide-react';
import type { HelpContent } from './HelpDialog';

/*
 * The words in every help popup. To change what a popup says, edit it here;
 * HelpDialog.tsx decides how it looks. Wrap code in `backticks`.
 */

export const shortcutsHelp: HelpContent = {
  title: 'Keyboard shortcuts',
  subtitle: 'Keys and gestures for working faster',
  icon: Keyboard,
  sections: [
    {
      id: 'general',
      title: 'General',
      icon: Command,
      tone: 'indigo',
      blocks: [
        {
          type: 'shortcuts',
          items: [
            { keys: ['Ctrl', '`'], label: 'Search files' },
            { keys: ['Alt', 'T'], label: 'Open the Todo Center' },
            { keys: ['Alt', 'A'], label: 'Open the audio player' },
            { keys: ['Ctrl', 'Z'], label: 'Undo' },
            { keys: ['Ctrl', 'Y'], label: 'Redo' },
            { keys: ['Double tap'], label: 'Undo on a touch screen' },
          ],
        },
      ],
    },
    {
      id: 'drawing',
      title: 'Drawing',
      icon: PenTool,
      tone: 'amber',
      description: 'These work while the drawing toolbar is open and you are not typing in a field.',
      blocks: [
        {
          type: 'shortcuts',
          items: [
            { keys: ['Shift', 'D'], label: 'Show or hide the drawing toolbar' },
            { keys: ['Shift', 'V'], label: 'Select' },
            { keys: ['Shift', 'B'], label: 'Box select' },
            { keys: ['Shift', 'P'], label: 'Pen' },
            { keys: ['Shift', 'H'], label: 'Highlighter' },
            { keys: ['Shift', 'F'], label: 'Function brush' },
            { keys: ['Shift', 'E'], label: 'Eraser' },
            { keys: ['Tab'], label: 'Rotate the selected shape' },
          ],
        },
        {
          type: 'syntax',
          items: [
            { code: 'Alt + R / O / Y / G', label: 'Red, orange, yellow, green' },
            { code: 'Alt + S / B / P / V', label: 'Sky, blue, purple, violet' },
            { code: 'Alt + W / K', label: 'White, black' },
          ],
        },
      ],
    },
    {
      id: 'canvas',
      title: 'Canvas and graph',
      icon: Move,
      tone: 'emerald',
      blocks: [
        {
          type: 'shortcuts',
          items: [
            { keys: ['Scroll'], label: 'Zoom in and out' },
            { keys: ['Drag'], label: 'Move around the canvas' },
            { keys: ['Shift', 'Drag'], label: 'Move a node with everything under it' },
            { keys: ['Right-click'], label: 'Node actions' },
          ],
        },
      ],
    },
  ],
};

export const nodesHelp: HelpContent = {
  title: 'Interactive nodes',
  subtitle: 'Turn plain JSON or YAML keys into live widgets',
  icon: HelpCircle,
  sections: [
    {
      id: 'api',
      title: 'API nodes',
      icon: Network,
      tone: 'indigo',
      blocks: [
        {
          type: 'callout',
          title: 'Call a URL from the graph',
          text: 'Give a key the suffix `_api_node` and a URL as its value. The node becomes a button that fetches the URL and shows the response.',
        },
        {
          type: 'cards',
          items: [
            { icon: Edit, title: 'Configure the request', text: 'Double-click the URL, or press Edit, to set the method (`GET`, `POST`, `PUT`…), the response format (`JSON`, `Text`, `Blob`) and a timeout.' },
            { icon: Play, title: 'See the response', text: 'The request goes through a safe proxy. The response appears under a `__fetched` child node.' },
          ],
        },
        { type: 'code', title: 'Example', language: 'json', code: '{\n  "github_profile_api_node": "https://api.github.com/users/octocat"\n}' },
      ],
    },
    {
      id: 'js',
      title: 'JavaScript nodes',
      icon: FileJson,
      tone: 'amber',
      blocks: [
        {
          type: 'callout',
          title: 'Run JavaScript in the graph',
          text: 'Keys ending in `_js_node` hold JavaScript you can run to calculate values or transform data.',
        },
        {
          type: 'cards',
          items: [
            { icon: Code, title: 'Full editor', text: 'Code opens in the Monaco editor, the same one VS Code uses.' },
            { icon: Terminal, title: 'Output', text: 'Running it adds a `__js_terminal` child node showing what you `console.log` and `return`.' },
          ],
        },
        { type: 'code', title: 'Example', language: 'json', code: '{\n  "math_calc_js_node": "const result = 50 * 20;\\nconsole.log(result);\\nreturn result;"\n}' },
      ],
    },
    {
      id: 'ts',
      title: 'TypeScript nodes',
      icon: Code,
      tone: 'blue',
      blocks: [
        {
          type: 'callout',
          title: 'Typed code, compiled in the browser',
          text: 'Keys ending in `_ts_node` are compiled and run as TypeScript.',
        },
        {
          type: 'cards',
          items: [
            { icon: CheckCircle2, title: 'Type checking', text: 'Errors and hints show inline in the editor as you type.' },
            { icon: Play, title: 'Output', text: 'Running it adds a `__ts_terminal` child node showing the output.' },
          ],
        },
        { type: 'code', title: 'Example', language: 'json', code: '{\n  "greet_ts_node": "const msg: string = \'Hello\';\\nconsole.log(msg);"\n}' },
      ],
    },
    {
      id: 'py',
      title: 'Python nodes',
      icon: Terminal,
      tone: 'emerald',
      blocks: [
        {
          type: 'callout',
          title: 'Real Python, no server',
          text: 'Keys ending in `_py_node` run Python in your browser with Pyodide.',
        },
        {
          type: 'cards',
          items: [
            { icon: Code, title: 'Full runtime', text: 'Use `print`, define functions and import packages, as in normal Python.' },
            { icon: Terminal, title: 'Output', text: 'Printed lines stream into a `__py_terminal` child node. The last expression becomes the result.' },
          ],
        },
        { type: 'code', title: 'Example', language: 'json', code: '{\n  "greet_py_node": "text = \'Hello\'\\nprint(text)\\n{\'message\': text}"\n}' },
      ],
    },
    {
      id: 'math',
      title: 'Math nodes',
      icon: Calculator,
      tone: 'rose',
      blocks: [
        {
          type: 'callout',
          title: 'Plot equations',
          text: 'Keys ending in `.math` or `_math_node` open an interactive graph of the equation.',
        },
        {
          type: 'cards',
          items: [
            { icon: Crosshair, title: 'Interactive grid', text: 'Plot Cartesian, polar and parametric curves. Pan, zoom and drag points.' },
            { icon: SlidersHorizontal, title: 'Sliders', text: 'Letters like `a`, `b` or `k` become sliders. The plot updates as you move them.' },
            { icon: Grid3x3, title: 'Matrices and vectors', text: 'Define matrices such as `[[1, 2], [3, 4]]`, find determinants, and draw vectors and polygons.' },
            { icon: Sigma, title: 'Typeset with KaTeX', text: 'Equations render as they would in a textbook.' },
          ],
        },
        { type: 'code', title: 'Example', language: 'json', code: '{\n  "sine_wave_math_node": "f(x) = a * sin(b * x + c)",\n  "spiral.math": "r = theta * k"\n}' },
      ],
    },
    {
      id: 'todo',
      title: 'Todo nodes',
      icon: ListTodo,
      tone: 'purple',
      blocks: [
        {
          type: 'callout',
          title: 'Checklists inside the graph',
          text: 'Keys ending in `.todo` or `_todo_node` become interactive checklists for tasks and roadmaps.',
        },
        {
          type: 'cards',
          items: [
            { icon: FolderTree, title: 'Nested tasks', text: 'Tasks can hold sub-tasks. Expand and collapse them as you go.' },
            { icon: CheckCircle2, title: 'Smart ticking', text: 'Ticking a parent ticks its sub-tasks, and finishing every sub-task ticks the parent.' },
            { icon: Edit, title: 'Rename and prioritise', text: 'Double-click a task to rename it. Click its priority to cycle High → Medium → Low.' },
            { icon: Plus, title: 'Add and remove', text: 'Changes save straight back into your JSON or YAML.' },
          ],
        },
        { type: 'code', title: 'Value format', language: 'json', code: '{\n  "title": "Project deliverables",\n  "tasks": [\n    { "id": "t1", "text": "Task name", "completed": false, "priority": "High" }\n  ]\n}' },
      ],
    },
    {
      id: 'image',
      title: 'Image nodes',
      icon: ImageIcon,
      tone: 'cyan',
      blocks: [
        {
          type: 'callout',
          title: 'Edit images in place',
          text: 'Keys ending in `.image`, `.png`, `.jpg` or `_image_node` open an image editor.',
        },
        {
          type: 'cards',
          items: [
            { icon: Edit, title: 'Editing tools', text: 'Crop, draw, add text and shapes, and apply filters without losing the original.' },
            { icon: Layers, title: 'Layers and artboards', text: 'Reorder, hide and lock layers. `Ctrl+[` and `Ctrl+]` move a layer back or forward; add `Shift` to send it all the way.' },
          ],
        },
        { type: 'code', title: 'Value format', language: 'json', code: '{\n  "src": "https://example.com/image.png",\n  "alt": "An example image",\n  "filters": ["grayscale"]\n}' },
      ],
    },
    {
      id: 'transfer',
      title: 'Transfer nodes',
      icon: Share2,
      tone: 'indigo',
      blocks: [
        {
          type: 'callout',
          title: 'Send files device to device',
          text: 'Keys ending in `.transfer` or `_transfer_node` open a peer-to-peer file transfer panel.',
        },
        {
          type: 'cards',
          items: [
            { icon: Share2, title: 'Direct with WebRTC', text: 'Files go straight between browsers. Nothing is stored on a server.' },
            { icon: Activity, title: 'Live progress', text: 'See transfer speed, connection status and progress as files move.' },
          ],
        },
        { type: 'code', title: 'Example', language: 'json', code: '{\n  "specs_transfer_node": "",\n  "backup.transfer": ""\n}' },
      ],
    },
  ],
};

export const queryHelp: HelpContent = {
  title: 'Search and query',
  subtitle: 'Find any node, from a single word to precise filters',
  icon: Search,
  footerHint: { keys: ['Ctrl', 'F'], label: 'Jump to the search box' },
  sections: [
    {
      id: 'basic',
      title: 'Basic search',
      icon: Search,
      tone: 'indigo',
      description: 'Type any word. It is matched loosely against node names, values, paths and types.',
      blocks: [{ type: 'syntax', items: [{ code: 'auth', label: 'Anything that mentions “auth”' }] }],
    },
    {
      id: 'fields',
      title: 'Fields and comparisons',
      icon: Filter,
      tone: 'amber',
      description: 'Use `field:value` to look in one property. Compare with `>` `<` `>=` `<=` `==` `!=`; nested fields work too.',
      blocks: [
        {
          type: 'syntax',
          items: [
            { code: 'type:"array"', label: 'Type is exactly array' },
            { code: 'depth>=3', label: 'Three or more levels deep' },
            { code: 'childrenCount > 5', label: 'More than five children' },
            { code: 'id!="root"', label: 'Every node except root' },
            { code: 'name/="^auth"', label: 'Name starts with “auth” (regex)' },
            { code: 'price > 10 AND size < 5', label: 'Both conditions match' },
          ],
        },
      ],
    },
    {
      id: 'operators',
      title: 'Operators',
      icon: Braces,
      tone: 'emerald',
      blocks: [
        {
          type: 'syntax',
          items: [
            { code: ':', label: 'Equals' },
            { code: '~=', label: 'Roughly matches' },
            { code: '*=', label: 'Contains' },
            { code: '/=', label: 'Matches a regular expression' },
            { code: '>  <  >=  <=', label: 'Compares numbers' },
            { code: 'IN', label: 'Shares a value with a list' },
          ],
        },
      ],
    },
    {
      id: 'logic',
      title: 'Combining conditions',
      icon: GitBranch,
      tone: 'blue',
      blocks: [
        {
          type: 'syntax',
          items: [
            { code: 'AND', label: 'All conditions must match' },
            { code: 'OR', label: 'Any condition can match' },
            { code: '( … )', label: 'Group conditions to control order' },
          ],
        },
      ],
    },
    {
      id: 'paths',
      title: 'Nested paths',
      icon: FolderTree,
      tone: 'purple',
      description: 'Dots go into objects, and `[]` searches every item of an array.',
      blocks: [
        {
          type: 'syntax',
          items: [
            { code: 'settings.theme:"dark"', label: 'A field inside an object' },
            { code: 'features[].name:"Export"', label: 'A field in any array item' },
          ],
        },
      ],
    },
    {
      id: 'json',
      title: 'JSON queries',
      icon: Braces,
      tone: 'cyan',
      description: 'For complex filters, write a MongoDB-style query object.',
      blocks: [
        {
          type: 'code',
          title: 'Name starts with “u”, and is an object or more than two levels deep',
          language: 'json',
          code: '{\n  "$or": [\n    { "type": { "$eq": "object" } },\n    { "depth": { "$gt": 2 } }\n  ],\n  "name": { "$regex": "^u.*" }\n}',
        },
      ],
    },
  ],
};
