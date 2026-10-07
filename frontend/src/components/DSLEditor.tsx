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
      // ── Scene file tokenizer (.scene) ─────────────────────────────────
      monaco.languages.register({ id: 'twin-scenario-dsl' });
      monaco.languages.setMonarchTokensProvider('twin-scenario-dsl', {
        tokenizer: {
          root: [
            // Comments
            [/#.*/, 'comment'],
            // Connection selectors with parens: @(source|type|target)
            [/@\([^)]*\)/, 'selector'],
            // Standard @-selectors: @Generator1, @network, @external.network, etc.
            [/@[A-Za-z0-9_.]+/, 'selector'],
            // Keywords: event keyword prefix, timing attrs, inf value
            [/\b(event|at|for|inf)\b/, 'keyword'],
            // Pipe and ampersand operators (used in connection selectors)
            [/[|&]/, 'operator'],
            // Delimiters: = { } :
            [/[={}:]/, 'delimiter'],
            // Numbers (including decimals)
            [/\d+(?:\.\d*)?|\.\d+/, 'number'],
          ]
        }
      });

      // ── Event file tokenizer (.event) ─────────────────────────────────
      monaco.languages.register({ id: 'twin-event-dsl' });
      monaco.languages.setMonarchTokensProvider('twin-event-dsl', {
        tokenizer: {
          root: [
            // Comments
            [/#.*/, 'comment'],
            // Selectors with parens: @connection(@node|data|), @connection.(f1 & f2)
            [/@[A-Za-z0-9_.]*\([^)]*\)(?:\.[A-Za-z0-9_.]*)?/, 'selector'],
            // Standard @-selectors: @component.type, @external.network, @connection, etc.
            [/@[A-Za-z0-9_.]+/, 'selector'],
            // Keywords: clause keywords + 'fields' (Spec §11) + 'inf' (Spec §7.2)
            [/\b(set|where|target|fields|inf)\b/, 'keyword'],
            // Pipe and ampersand operators (combined target selectors, where continuations)
            [/[|&]/, 'operator'],
            // Delimiters: = { }
            [/[={}]/, 'delimiter'],
            // Numbers
            [/\d+(?:\.\d*)?|\.\d+/, 'number'],
          ]
        }
      });

      monaco.editor.defineTheme('twin-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '64748b' },
          { token: 'selector', foreground: '63dbbc' }, // accent-primary
          { token: 'keyword', foreground: 'b566ff', fontStyle: 'bold' }, // aurora purple
          { token: 'operator', foreground: '0ea5e9' }, // aurora blue
          { token: 'delimiter', foreground: '0ea5e9' }, // aurora blue
          { token: 'number', foreground: 'fbbf24' },
        ],
        colors: {
          'editor.background': '#060812', // Matches --bg-main
          'editor.lineHighlightBackground': '#0b1221', // Matches --bg-panel-secondary
        }
      });
      monaco.editor.defineTheme('twin-light', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '94a3b8' },
          { token: 'selector', foreground: '0ea5e9' }, // Icy blue
          { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' }, // Light icy blue
          { token: 'operator', foreground: '475569' },
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
        .error-line-highlight { background-color: rgba(244, 63, 94, 0.2) !important; }
        .selected-line-highlight { background-color: rgba(99, 219, 188, 0.1) !important; }
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
          fontSize: 13,
          fontFamily: '"Consolas", "Courier New", monospace',
          wordWrap: 'on',
          lineNumbersMinChars: 3,
        }}
      />
    </div>
  );
}
