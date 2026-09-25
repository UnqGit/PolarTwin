import React, { useRef, useState, useEffect } from 'react';

interface DSLEditorProps {
  value: string;
  onChange: (val: string) => void;
  selectedLine?: number; // 0-indexed
  errorLine?: number;    // 0-indexed
}

export function DSLEditor({ value, onChange, selectedLine, errorLine }: DSLEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const lines = value.split('\n');

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  useEffect(() => {
    // If selectedLine changes, try to scroll to it
    if (selectedLine !== undefined && selectedLine >= 0 && textareaRef.current) {
      const lineHeight = 20; // 20px per line approx
      const targetScroll = selectedLine * lineHeight;
      textareaRef.current.scrollTop = targetScroll - 40;
    }
  }, [selectedLine]);

  // Simple syntax highlighting regexes
  const highlightTokens = (text: string) => {
    return text.split(/(\b(?:event|at|for|set|where|target)\b|@[A-Za-z0-9_.]+|[={}]|[0-9.]+|#.*)/g).map((part, i) => {
      if (!part) return null;
      if (part.startsWith('#')) return <span key={i} style={{ color: '#6b7280' }}>{part}</span>;
      if (['event', 'at', 'for', 'set', 'where', 'target'].includes(part)) return <span key={i} style={{ color: '#3b82f6', fontWeight: 'bold' }}>{part}</span>;
      if (part.startsWith('@')) return <span key={i} style={{ color: '#10b981' }}>{part}</span>;
      if (['=', '{', '}'].includes(part)) return <span key={i} style={{ color: '#f59e0b' }}>{part}</span>;
      if (/^[0-9.]+$/.test(part)) return <span key={i} style={{ color: '#8b5cf6' }}>{part}</span>;
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flex: 1, backgroundColor: '#1e1e1e', color: '#d4d4d4', fontFamily: '"Consolas", "Monaco", monospace', fontSize: '14px', lineHeight: '20px', overflow: 'hidden' }}>
      
      {/* Line Numbers */}
      <div style={{ 
        width: '40px', 
        backgroundColor: '#252526', 
        color: '#858585', 
        textAlign: 'right', 
        padding: '16px 8px 16px 0', 
        userSelect: 'none', 
        overflow: 'hidden',
        borderRight: '1px solid #404040',
        zIndex: 10
      }}>
        <div style={{ transform: `translateY(-${scrollTop}px)` }}>
          {lines.map((_, i) => (
            <div key={i} style={{ 
              height: '20px', 
              color: i === errorLine ? '#ef4444' : (i === selectedLine ? '#d4d4d4' : '#858585'),
              fontWeight: (i === selectedLine || i === errorLine) ? 'bold' : 'normal'
            }}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Editor Content Area */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        
        {/* Background Highlights */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }}>
          <div style={{ transform: `translateY(-${scrollTop}px)`, padding: '16px' }}>
            {lines.map((_, i) => (
              <div key={i} style={{ 
                height: '20px', 
                backgroundColor: i === errorLine ? 'rgba(239, 68, 68, 0.2)' : (i === selectedLine ? 'rgba(255, 255, 255, 0.1)' : 'transparent'),
                width: '100%',
                marginLeft: '-16px',
                paddingLeft: '16px'
              }} />
            ))}
          </div>
        </div>

        {/* Syntax Highlighted Backdrop */}
        <div 
          ref={backdropRef}
          style={{ 
            position: 'absolute', 
            top: 0, left: 0, right: 0, bottom: 0, 
            padding: '16px', 
            pointerEvents: 'none', 
            zIndex: 2, 
            whiteSpace: 'pre', 
            overflow: 'hidden',
            wordWrap: 'normal'
          }}
        >
          {lines.map((line, i) => (
            <div key={i} style={{ height: '20px', color: 'transparent' }}>
              {highlightTokens(line)}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            padding: '16px',
            backgroundColor: 'transparent',
            color: 'transparent',
            caretColor: '#d4d4d4',
            border: 'none',
            outline: 'none',
            resize: 'none',
            zIndex: 3,
            whiteSpace: 'pre',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            margin: 0
          }}
        />
      </div>
    </div>
  );
}
