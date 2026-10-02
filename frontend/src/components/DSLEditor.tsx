import React, { useRef, useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';

interface DSLEditorProps {
  value: string;
  onChange: (val: string) => void;
  selectedLine?: number; // 0-indexed
  errorLine?: number;    // 0-indexed
  sourceVersion?: number; // optional, when changed, forces an editor update
  fileType?: 'scenario' | 'event';
}

export function DSLEditor({ value, onChange, selectedLine, errorLine, sourceVersion, fileType = 'scenario' }: DSLEditorProps) {
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
    const isRegistered = monaco.languages.getLanguages().some((lang: any) => lang.id === 'twin-scenario-dsl' || lang.id === 'twin-event-dsl');
    if (!isRegistered) {
      monaco.languages.register({ id: 'twin-scenario-dsl' });
      monaco.languages.setMonarchTokensProvider('twin-scenario-dsl', {
        tokenizer: {
          root: [
            [/#.*/, 'comment'],
            [/@[A-Za-z0-9_.]+/, 'selector'],
            [/\b(event|at|for)\b/, 'keyword'],
            [/[={}]/, 'delimiter'],
            [/[0-9.]+/, 'number'],
          ]
        }
      });
      monaco.languages.register({ id: 'twin-event-dsl' });
      monaco.languages.setMonarchTokensProvider('twin-event-dsl', {
        tokenizer: {
          root: [
            [/#.*/, 'comment'],
            [/@[A-Za-z0-9_.]+/, 'selector'],
            [/\b(set|where|target)\b/, 'keyword'],
            [/[={}]/, 'delimiter'],
            [/[0-9.]+/, 'number'],
          ]
        }
      });
      monaco.editor.defineTheme('twin-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '64748b' },
          { token: 'selector', foreground: '00e676' }, // Aurora green
          { token: 'keyword', foreground: 'b566ff', fontStyle: 'bold' }, // Aurora purple
          { token: 'delimiter', foreground: '00d2ff' }, // Aurora cyan
          { token: 'number', foreground: 'fbbf24' },
        ],
        colors: {
          'editor.background': '#06060c', // Matches --bg-main
          'editor.lineHighlightBackground': '#161a29', // Matches --bg-panel-secondary
        }
      });
      monaco.editor.defineTheme('twin-light', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '94a3b8' },
          { token: 'selector', foreground: '0ea5e9' }, // Icy blue
          { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' }, // Light icy blue
          { token: 'delimiter', foreground: '475569' },
          { token: 'number', foreground: 'd97706' },
        ],
        colors: {
          'editor.background': '#f0f4f8', // Matches var(--bg-main) in light mode
          'editor.lineHighlightBackground': '#e2e8f0', // Matches var(--bg-panel-secondary)
        }
      });
    }
  };

  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    editorRef.current = editor;

    // Force the language and tokenization to re-apply on remount
    if (editor.getModel() && monacoInstance) {
      monacoInstance.editor.setModelLanguage(editor.getModel(), fileType === 'event' ? 'twin-event-dsl' : 'twin-scenario-dsl');
    }
    // A tiny nudge to the value forces Monaco's tokenizer to wake up for existing text
    const currentVal = editor.getValue();
    editor.setValue(currentVal);
  };

  // Dynamically change language if fileType changes without unmounting
  useEffect(() => {
    if (editorRef.current && monaco) {
      const model = editorRef.current.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, fileType === 'event' ? 'twin-event-dsl' : 'twin-scenario-dsl');
      }
    }
  }, [fileType, monaco]);

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


  // Sync external changes using sourceVersion
  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.getValue() !== value) {
        editorRef.current.setValue(value);
      }
    }
  }, [sourceVersion]);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <style>{`
        .error-line-highlight { background-color: rgba(239, 68, 68, 0.2) !important; }
        .selected-line-highlight { background-color: rgba(255, 255, 255, 0.1) !important; }
      `}</style>
      <Editor
        height="100%"
        language={fileType === 'event' ? 'twin-event-dsl' : 'twin-scenario-dsl'}
        theme={currentTheme}
        defaultValue={value}
        onChange={(val) => {
          onChange(val || '');
        }}
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
