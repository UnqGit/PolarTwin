import React, { useRef, useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';

interface DSLEditorProps {
  value: string;
  onChange: (val: string) => void;
  selectedLine?: number; // 0-indexed
  errorLine?: number;    // 0-indexed
}

export function DSLEditor({ value, onChange, selectedLine, errorLine }: DSLEditorProps) {
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const [currentTheme, setCurrentTheme] = React.useState('twin-dark');

  useEffect(() => {
    const updateTheme = () => {
      setCurrentTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'twin-light' : 'twin-dark');
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const handleEditorWillMount = (monaco: any) => {
    monaco.languages.register({ id: 'twin-dsl' });
    monaco.languages.setMonarchTokensProvider('twin-dsl', {
      tokenizer: {
        root: [
          [/#.*/, 'comment'],
          [/@[A-Za-z0-9_.]+/, 'annotation'],
          [/\b(event|at|for|set|where|target)\b/, 'keyword'],
          [/[={}]/, 'delimiter'],
          [/[0-9.]+/, 'number'],
        ]
      }
    });
    monaco.editor.defineTheme('twin-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280' },
        { token: 'annotation', foreground: '10b981' },
        { token: 'keyword', foreground: '3b82f6', fontStyle: 'bold' },
        { token: 'delimiter', foreground: 'f59e0b' },
        { token: 'number', foreground: '8b5cf6' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
      }
    });
    monaco.editor.defineTheme('twin-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280' },
        { token: 'annotation', foreground: '10b981' },
        { token: 'keyword', foreground: '2563eb', fontStyle: 'bold' },
        { token: 'delimiter', foreground: 'd97706' },
        { token: 'number', foreground: '7c3aed' },
      ],
      colors: {
        'editor.background': '#f8fafc', // matches var(--bg-main) in light mode
      }
    });
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    if (editorRef.current) {
      const decorations: any[] = [];
      if (errorLine !== undefined && errorLine >= 0) {
        decorations.push({
          range: new monaco!.Range(errorLine + 1, 1, errorLine + 1, 1),
          options: { isWholeLine: true, className: 'error-line-highlight' }
        });
      } else if (selectedLine !== undefined && selectedLine >= 0) {
        decorations.push({
          range: new monaco!.Range(selectedLine + 1, 1, selectedLine + 1, 1),
          options: { isWholeLine: true, className: 'selected-line-highlight' }
        });
        editorRef.current.revealLineInCenter(selectedLine + 1);
      }
      editorRef.current.decorations = editorRef.current.deltaDecorations(editorRef.current.decorations || [], decorations);
    }
  }, [selectedLine, errorLine, monaco]);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <style>{`
        .error-line-highlight { background-color: rgba(239, 68, 68, 0.2) !important; }
        .selected-line-highlight { background-color: rgba(255, 255, 255, 0.1) !important; }
      `}</style>
      <Editor
        height="100%"
        language="twin-dsl"
        theme={currentTheme}
        value={value}
        onChange={(val) => onChange(val || '')}
        onMount={handleEditorDidMount}
        beforeMount={handleEditorWillMount}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          fontFamily: '"Consolas", "Monaco", monospace',
          wordWrap: 'on',
          lineNumbersMinChars: 3,
        }}
      />
    </div>
  );
}
