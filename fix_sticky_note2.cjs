const fs = require('fs');
const file = 'src/components/StickyNote.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace('const [content, setContent] = useState(note.content);', `const [content, setContent] = useState(note.content);
  useEffect(() => {
    if (!isEditing) {
      setContent(note.content);
    }
  }, [note.content, isEditing]);`);

// Replace note.content with content in the render output for display
txt = txt.replace(/\{note\.content \|\| \(/g, '{content || (');

fs.writeFileSync(file, txt);
