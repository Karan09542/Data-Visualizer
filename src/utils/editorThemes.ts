export const editorThemes: Record<string, any> = {
  'one-dark-pro': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'c678dd' },
      { token: 'string', foreground: '98c379' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'type', foreground: 'e5c07b' },
      { token: 'function', foreground: '61afef' },
      { token: 'comment', foreground: '7f848e', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'e06c75' }
    ],
    colors: {
      'editor.background': '#282c34',
      'editor.foreground': '#abb2bf',
      'editor.lineHighlightBackground': '#2c313c'
    }
  },
  'dracula': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'ff79c6' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'type', foreground: '8be9fd' },
      { token: 'function', foreground: '50fa7b' },
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'f8f8f2' }
    ],
    colors: {
      'editor.background': '#282a36',
      'editor.foreground': '#f8f8f2',
      'editor.lineHighlightBackground': '#44475a'
    }
  },
  'night-owl': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'c792ea', fontStyle: 'italic' },
      { token: 'string', foreground: 'ecc48d' },
      { token: 'number', foreground: 'f78c6c' },
      { token: 'type', foreground: 'addb67' },
      { token: 'function', foreground: '82aaff' },
      { token: 'comment', foreground: '637777', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'd6deeb' }
    ],
    colors: {
      'editor.background': '#011627',
      'editor.foreground': '#d6deeb',
      'editor.lineHighlightBackground': '#0b2942'
    }
  },
  'github-dark': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'ff7b72' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: '79c0ff' },
      { token: 'type', foreground: 'ff7b72' },
      { token: 'function', foreground: 'd2a8ff' },
      { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'c9d1d9' }
    ],
    colors: {
      'editor.background': '#0d1117',
      'editor.foreground': '#c9d1d9',
      'editor.lineHighlightBackground': '#161b22'
    }
  },
  'synthwave-84': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'fede5d' },
      { token: 'string', foreground: 'ff8b39' },
      { token: 'number', foreground: 'f97e72' },
      { token: 'type', foreground: 'f97e72' },
      { token: 'function', foreground: '36f9f6' },
      { token: 'comment', foreground: '848bbd', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'fe4450' }
    ],
    colors: {
      'editor.background': '#262335',
      'editor.foreground': '#ffffff',
      'editor.lineHighlightBackground': '#2a2139'
    }
  }
};
