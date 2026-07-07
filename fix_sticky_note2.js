const fs = require('fs');
const file = 'src/components/StickyNote.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Also update the useEffect to sync content if note.content changes externally
const effectCode = `
  useEffect(() => {
    setContent(note.content);
  }, [note.content]);
`;
// Let's just do a sed or something. Or we can just use the script to replace.
txt = txt.replace('const [content, setContent] = useState(note.content);', `const [content, setContent] = useState(note.content);
  useEffect(() => {
    if (!isEditing) {
      setContent(note.content);
    }
  }, [note.content, isEditing]);`);

fs.writeFileSync(file, txt);
