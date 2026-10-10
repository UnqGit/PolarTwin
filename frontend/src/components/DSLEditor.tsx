import React, { useRef, useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';

interface DSLEditorProps {
  value: string;
  onChange: (val: string) => void;
  selectedLine?: number; // 0-indexed
  errorLines?: number[];    // 0-indexed
  sourceVersion?: number; // optional, when changed, forces an editor update
  fileType?: 'scenario' | 'event';
  readOnly?: boolean;
}

export const DSLEditorContext = {
  eventNames: [] as string[],
  componentNames: [] as string[],
  componentTypes: [] as string[],
  connectionNames: [] as string[],
};

let hasRegisteredMonaco = false;

export function DSLEditor({ value, onChange, selectedLine, errorLines, sourceVersion, fileType = 'scenario', readOnly = false }: DSLEditorProps) {
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const [currentTheme, setCurrentTheme] = React.useState('twin-dark');
  const [isEditorReady, setIsEditorReady] = React.useState(false);

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
    if (hasRegisteredMonaco) return;
    hasRegisteredMonaco = true;

    const isRegistered = monaco.languages.getLanguages().some((lang: any) => lang.id === 'twin-scenario-dsl' || lang.id === 'twin-event-dsl');
    if (!isRegistered) {
      monaco.languages.register({ id: 'twin-scenario-dsl' });
      monaco.languages.register({ id: 'twin-event-dsl' });
    }

    // ── Scene file tokenizer (.scene) ─────────────────────────────────
    monaco.languages.setMonarchTokensProvider('twin-scenario-dsl', {
      defaultToken: 'source',
      ignoreCase: false,
      tokenizer: {
        root: [
          // Whitespace
          [/[ \t\r\n]+/, 'white'],
          // Comments (no $ anchor to avoid \r\n bugs on Windows)
          [/#.*/, 'comment'],
          // Strings
          [/"/, { token: 'string', next: '@string_double' }],
          [/'/, { token: 'string', next: '@string_single' }],
          // Connection selectors with parens: @(source|type|target)
          [/@\([^)]*\)/, 'selector'],
          // Standard @-selectors: @Generator1, @network, @external.network, etc.
          [/@[A-Za-z0-9_.]+/, 'selector'],
          // Keywords and Identifiers
          [/[a-zA-Z_]\w*/, {
            cases: {
              'event': 'keyword',
              'at': 'keyword',
              'for': 'keyword',
              'inf': 'keyword',
              'set': 'keyword',
              '@default': 'identifier'
            }
          }],
          // Pipe and ampersand operators (used in connection selectors)
          [/[|&]/, 'operator'],
          // Delimiters: = { } :
          [/[={}:]/, 'delimiter'],
          // Numbers (including decimals)
          [/\d+(?:\.\d*)?|\.\d+/, 'number'],
        ],
        string_double: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, { token: 'string', next: '@pop' }]
        ],
        string_single: [
          [/[^\\']+/, 'string'],
          [/\\./, 'string.escape'],
          [/'/, { token: 'string', next: '@pop' }]
        ]
      }
    });
    monaco.languages.setLanguageConfiguration('twin-scenario-dsl', {
      comments: {
        lineComment: '#'
      }
    });

    // ── Event file tokenizer (.event) ─────────────────────────────────
    monaco.languages.setMonarchTokensProvider('twin-event-dsl', {
      defaultToken: 'source',
      ignoreCase: false,
      tokenizer: {
        root: [
          // Whitespace
          [/[ \t\r\n]+/, 'white'],
          // Comments
          [/#.*/, 'comment'],
          // Strings
          [/"/, { token: 'string', next: '@string_double' }],
          [/'/, { token: 'string', next: '@string_single' }],
          // Selectors with parens: @connection(@node|data|), @connection.(f1 & f2)
          [/@[A-Za-z0-9_.]*\([^)]*\)(?:\.[A-Za-z0-9_.]*)?/, 'selector'],
          // Standard @-selectors: @component.type, @external.network, @connection, etc.
          [/@[A-Za-z0-9_.]+/, 'selector'],
          // Keywords and Identifiers
          [/[a-zA-Z_]\w*/, {
            cases: {
              'set': 'keyword',
              'where': 'keyword',
              'target': 'keyword',
              'fields': 'keyword',
              'inf': 'keyword',
              '@default': 'identifier'
            }
          }],
          // Pipe and ampersand operators (combined target selectors, where continuations)
          [/[|&]/, 'operator'],
          // Delimiters: = { }
          [/[={}]/, 'delimiter'],
          // Numbers
          [/\d+(?:\.\d*)?|\.\d+/, 'number'],
        ],
        string_double: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, { token: 'string', next: '@pop' }]
        ],
        string_single: [
          [/[^\\']+/, 'string'],
          [/\\./, 'string.escape'],
          [/'/, { token: 'string', next: '@pop' }]
        ]
      }
    });
    monaco.languages.setLanguageConfiguration('twin-event-dsl', {
      comments: {
        lineComment: '#'
      }
    });
    monaco.languages.registerCompletionItemProvider('twin-event-dsl', {
      provideCompletionItems: (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });
        
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const suggestions: any[] = [];
        const isStartOfLine = textUntilPosition.trim() === '' || textUntilPosition.trim() === word.word;

        const fullText = model.getValue();
        const textBefore = fullText.substring(0, model.getOffsetAt(position));
        const setMatches = [...textBefore.matchAll(/set\s*\{/g)];
        const closeMatches = [...textBefore.matchAll(/\}/g)];
        const inSetBlock = setMatches.length > closeMatches.length;

        if (inSetBlock) {
            suggestions.push({
                label: 'fields',
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: 'fields',
                documentation: 'Allow arbitrary payload fields (disables strict checking)',
                range
            });
        } else if (isStartOfLine) {
            suggestions.push(
                {
                  label: 'target',
                  kind: monaco.languages.CompletionItemKind.Keyword,
                  insertText: 'target ',
                  documentation: 'Target component or connection',
                  range
                },
                {
                  label: 'where',
                  kind: monaco.languages.CompletionItemKind.Keyword,
                  insertText: 'where ',
                  documentation: 'Condition for target matching (e.g. status == "active")',
                  range
                },
                {
                  label: 'set { ... }',
                  kind: monaco.languages.CompletionItemKind.Snippet,
                  insertText: 'set {\n    $0\n}',
                  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                  documentation: 'Payload fields required by this event',
                  range
                }
            );
        }

        if (textUntilPosition.match(/target\s+[\w.|]*$/)) {
            const targets = [
                '@component.name', '@component.type', '@connection', 
                '@connection.source', '@connection.target', '@connection.type',
                '@external', '@external.network', '@external.weather', '@external.supplies'
            ];
            targets.forEach(t => {
                suggestions.push({
                    label: t,
                    kind: monaco.languages.CompletionItemKind.Constant,
                    insertText: t,
                    documentation: 'Target selector type',
                    range
                });
            });
        }
        
        return { suggestions };
      }
    });

    monaco.languages.registerCompletionItemProvider('twin-scenario-dsl', {
      provideCompletionItems: (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });
        
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const suggestions: any[] = [];
        const isStartOfLine = textUntilPosition.trim() === '' || textUntilPosition.trim() === word.word;
        
        if (isStartOfLine) {
            DSLEditorContext.eventNames.forEach(ev => {
                suggestions.push({
                    label: `event:${ev}`,
                    kind: monaco.languages.CompletionItemKind.Event,
                    insertText: `event:${ev} @\${1:selector} at=\${2:0.0} for=\${3:inf}`,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: `Declare event '${ev}'`,
                    range
                });
                suggestions.push({
                    label: `event:${ev} (with block)`,
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: `event:${ev} @\${1:selector} at=\${2:0.0} for=\${3:inf} set {\n    $0\n}`,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: `Declare event '${ev}' with payload block`,
                    range
                });
            });
            // Fallback for custom events
            suggestions.push({
              label: 'event:',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'event:',
              documentation: 'Declare a new event',
              range
            });
        } else if (textUntilPosition.includes('event:')) {
            // Suggest targets when '@' is typed or space after event
            if (textUntilPosition.match(/event:\w+\s+@[\w.]*$/) || textUntilPosition.match(/event:\w+\s+$/)) {
                const prefix = textUntilPosition.endsWith('@') ? '' : '@';
                
                DSLEditorContext.componentNames.forEach(c => {
                    suggestions.push({
                        label: `@${c}`,
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: `${prefix}${c}`,
                        documentation: 'Target Component',
                        range
                    });
                });
                DSLEditorContext.componentTypes.forEach(t => {
                    suggestions.push({
                        label: `@${t}`,
                        kind: monaco.languages.CompletionItemKind.Interface,
                        insertText: `${prefix}${t}`,
                        documentation: 'Target Component Type',
                        range
                    });
                });
                DSLEditorContext.connectionNames.forEach(c => {
                    suggestions.push({
                        label: `@${c}`,
                        kind: monaco.languages.CompletionItemKind.Reference,
                        insertText: `${prefix}${c}`,
                        documentation: 'Target Connection',
                        range
                    });
                });
                
                const externalTargets = ['@network', '@weather', '@supplies'];
                externalTargets.forEach(t => {
                    suggestions.push({
                        label: t,
                        kind: monaco.languages.CompletionItemKind.Constant,
                        insertText: textUntilPosition.endsWith('@') ? t.substring(1) : t,
                        documentation: 'External Target',
                        range
                    });
                });
            }

            if (!textUntilPosition.includes('at=')) {
                suggestions.push({
                    label: 'at=',
                    kind: monaco.languages.CompletionItemKind.Property,
                    insertText: 'at=${1:0.0}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Start time in hours (e.g. at=1.5)',
                    range
                });
            }
            if (!textUntilPosition.includes('for=')) {
                suggestions.push({
                    label: 'for=',
                    kind: monaco.languages.CompletionItemKind.Property,
                    insertText: 'for=${1:inf}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Duration in hours (use inf for infinite)',
                    range
                });
            }
            if (!textUntilPosition.includes('set {')) {
                suggestions.push({
                    label: 'set { ... }',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'set {\n    $0\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Start the payload block',
                    range
                });
            }
        }
        
        return { suggestions };
      }
    });

    if (!isRegistered) {
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
    setIsEditorReady(true);
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
      if (errorLines && errorLines.length > 0) {
        Array.from(new Set(errorLines)).forEach(line => {
          decorations.push({
            range: new monaco!.Range(line + 1, 1, line + 1, 1),
            options: { isWholeLine: true, className: 'error-line-highlight' }
          });
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
  }, [selectedLine, errorLines, monaco, isEditorReady]);


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
          readOnly: readOnly,
        }}
      />
    </div>
  );
}
