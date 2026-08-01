export function extractTextFromLexical(content: string): string {
  if (!content) return '';
  
  try {
    if (content.trim().startsWith('{') && content.includes('"root"')) {
      const state = JSON.parse(content);
      return extractTextFromNode(state.root);
    }
  } catch (e) {
    // If it's not valid JSON, it might just be the old plain text format
  }
  
  return content;
}

function extractTextFromNode(node: any): string {
  if (!node) return '';
  
  let text = '';
  
  if (node.type === 'text') {
    text += node.text;
  }
  
  if (node.type === 'listitem') {
    const isChecked = node.checked;
    if (isChecked !== undefined) {
      text += (isChecked ? '- [x] ' : '- [ ] ');
    } else {
      text += '- ';
    }
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      text += extractTextFromNode(child);
    }
  }

  if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listitem') {
    text += '\n';
  }

  return text;
}
