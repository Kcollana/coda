import { useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';

const defineTheme = (monaco) => {
  monaco.editor.defineTheme('coda', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment',   foreground: '404058', fontStyle: 'italic' },
      { token: 'keyword',   foreground: 'b57dff' },
      { token: 'string',    foreground: '9ecfb0' },
      { token: 'number',    foreground: 'f4a26b' },
      { token: 'type',      foreground: '7dcfff' },
      { token: 'function',  foreground: '82aaff' },
      { token: 'variable',  foreground: 'd0d0e8' },
      { token: 'delimiter', foreground: '5a5a78' },
    ],
    colors: {
      'editor.background':                  '#0d0d12',
      'editor.foreground':                  '#d0d0e8',
      'editor.lineHighlightBackground':     '#18181f',
      'editor.selectionBackground':         '#7c3aed35',
      'editor.inactiveSelectionBackground': '#7c3aed18',
      'editorCursor.foreground':            '#a78bfa',
      'editorLineNumber.foreground':        '#30304a',
      'editorLineNumber.activeForeground':  '#60608a',
      'editorWhitespace.foreground':        '#1e1e2c',
      'editorIndentGuide.background1':      '#1e1e2c',
      'editorIndentGuide.activeBackground1':'#36364a',
      'editorBracketMatch.background':      '#7c3aed25',
      'editorBracketMatch.border':          '#7c3aed80',
      'editorWidget.background':            '#12121a',
      'editorWidget.border':               '#28283c',
      'editorSuggestWidget.background':     '#12121a',
      'editorSuggestWidget.border':         '#28283c',
      'editorSuggestWidget.selectedBackground': '#7c3aed25',
      'editorHoverWidget.background':       '#12121a',
      'editorHoverWidget.border':           '#28283c',
      'scrollbarSlider.background':         '#28283c60',
      'scrollbarSlider.hoverBackground':    '#36364a80',
      'scrollbarSlider.activeBackground':   '#7c3aed60',
      'minimap.background':                 '#0d0d12',
    },
  });
};

export default function Editor({
  yText,
  awareness,
  language,
  onCursorPositionChange,
  onEditorReady,
  yComments,
  currentUser,
  onGutterClick,
}) {
  const editorRef      = useRef(null);
  const monacoRef      = useRef(null);
  const bindingRef     = useRef(null);
  const cursorStyleRef = useRef(null);
  const commentDecoRef = useRef([]);

  // ── Inject per-user cursor CSS whenever awareness changes ──────────────────
  useEffect(() => {
    if (!awareness) return;

    if (!cursorStyleRef.current) {
      const el = document.createElement('style');
      el.id = 'coda-cursor-styles';
      document.head.appendChild(el);
      cursorStyleRef.current = el;
    }

    const buildStyles = () => {
      const rules = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID || !state.user) return;
        const color   = state.user.color || '#888888';
        const rawName = state.user.name  || 'User';
        // escape single quotes for CSS content value
        const name = rawName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        rules.push(
          `.yRemoteSelection-${clientId} { background: ${color}28; }`,
          `.yRemoteSelectionHead-${clientId} {
            border-left: 2px solid ${color};
            border-top: 2px solid ${color};
            height: 100%; box-sizing: border-box; position: relative;
          }`,
          `.yRemoteSelectionHead-${clientId}::after {
            content: '${name}';
            position: absolute;
            top: -1.45em; left: -2px;
            background: ${color};
            color: #fff;
            font-size: 11px; font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 1px 5px;
            border-radius: 3px 3px 3px 0;
            white-space: nowrap;
            pointer-events: none;
            line-height: 1.4;
            letter-spacing: 0.01em;
          }`,
        );
      });
      cursorStyleRef.current.textContent = rules.join('\n');
    };

    buildStyles();
    awareness.on('change', buildStyles);
    return () => {
      awareness.off('change', buildStyles);
      cursorStyleRef.current?.remove();
      cursorStyleRef.current = null;
    };
  }, [awareness]);

  // ── Comment gutter decorations ─────────────────────────────────────────────
  useEffect(() => {
    if (!yComments || !editorRef.current || !monacoRef.current) return;

    const render = () => {
      const editor  = editorRef.current;
      const monaco  = monacoRef.current;
      if (!editor || !monaco) return;

      const comments = yComments.toArray();
      const byLine   = new Map();
      comments.filter((c) => !c.resolved).forEach((c) => {
        byLine.set(c.line, (byLine.get(c.line) || []).concat(c));
      });

      const decorations = [];
      byLine.forEach((_, line) => {
        decorations.push({
          range: new monaco.Range(line, 1, line, 1),
          options: {
            glyphMarginClassName: 'comment-glyph',
            glyphMarginHoverMessage: { value: `${byLine.get(line).length} comment(s)` },
            isWholeLine: false,
          },
        });
      });

      commentDecoRef.current = editor.deltaDecorations(
        commentDecoRef.current,
        decorations,
      );
    };

    render();
    yComments.observe(render);
    return () => yComments.unobserve(render);
  }, [yComments]);

  const handleMount = (editor, monaco) => {
    editorRef.current  = editor;
    monacoRef.current  = monaco;

    defineTheme(monaco);
    monaco.editor.setTheme('coda');

    bindingRef.current = new MonacoBinding(
      yText,
      editor.getModel(),
      new Set([editor]),
      awareness,
    );

    editor.onDidChangeCursorPosition((e) => {
      onCursorPositionChange?.({
        line:   e.position.lineNumber,
        column: e.position.column,
      });
    });

    // Gutter click → open comment thread for that line
    editor.onMouseDown((e) => {
      const T = monaco.editor.MouseTargetType;
      if (
        e.target.type === T.GUTTER_GLYPH_MARGIN ||
        e.target.type === T.GUTTER_LINE_NUMBERS
      ) {
        const line = e.target.position?.lineNumber;
        if (line) onGutterClick?.(line);
      }
    });

    onEditorReady?.(editor, monaco);
    editor.focus();
  };

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const model = editorRef.current.getModel();
    if (model) monacoRef.current.editor.setModelLanguage(model, language);
  }, [language]);

  useEffect(() => () => bindingRef.current?.destroy(), []);

  return (
    <MonacoEditor
      height="100%"
      defaultLanguage="javascript"
      theme="coda"
      onMount={handleMount}
      options={{
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
        fontLigatures: true,
        lineHeight: 22,
        glyphMargin: true,
        minimap: { enabled: true, scale: 1, renderCharacters: false },
        scrollBeyondLastLine: false,
        wordWrap: 'off',
        cursorBlinking: 'phase',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        formatOnPaste: true,
        automaticLayout: true,
        tabSize: 2,
        renderLineHighlight: 'line',
        padding: { top: 12, bottom: 12 },
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: 'active' },
        overviewRulerLanes: 2,
      }}
    />
  );
}
