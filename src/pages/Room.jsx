import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import TitleBar from '../components/TitleBar';
import ChatToast from '../components/ChatToast';
import ActivityBar from '../components/ActivityBar';
import Sidebar from '../components/Sidebar';
import TabBar from '../components/TabBar';
import Editor from '../Editor';
import Panel from '../components/Panel';
import StatusBar from '../components/StatusBar';
import CommentPopover from '../components/CommentPopover';
import FileNameModal from '../components/FileNameModal';
import LobbyOverlay from '../components/LobbyOverlay';
import JoinRequestToast from '../components/JoinRequestToast';
import { getLang, getExt, ensureExt } from '../utils/fileTypes';

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'go', 'rust',
  'java', 'cpp', 'c', 'csharp', 'html', 'css', 'json',
  'sql', 'markdown', 'yaml', 'bash',
];

const FOLDER_EXT  = /\.(js|ts|jsx|tsx|py|go|rs|java|cpp|c|cs|html|css|json|sql|md|yml|yaml|sh|txt|toml|xml|rb|php)$/i;
const FOLDER_SKIP = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '__pycache__', '.venv', 'venv']);
const MAX_LOGS    = 500;

async function readDirRecursive(dirHandle, prefix = '') {
  const results = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (FOLDER_SKIP.has(name) || name.startsWith('.')) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'directory') {
      results.push(...await readDirRecursive(handle, path));
    } else {
      results.push({ path, handle });
    }
  }
  return results;
}

export default function Room() {
  const { roomId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom]       = useState(null);
  const [setup, setSetup]     = useState(null);
  const [connected, setConnected] = useState(false);
  const [peers, setPeers]     = useState([]);

  // File system state
  const [filesMap, setFilesMap]     = useState(new Map());
  const [activeFile, setActiveFile] = useState(null);
  const [openTabs, setOpenTabs]     = useState([]);

  // Lobby state
  const [lobbyStatus, setLobbyStatus]         = useState('connecting');
  const [pendingRequests, setPendingRequests]  = useState([]);
  const lobbyWsRef = useRef(null);

  // UI state
  const [activePanel, setActivePanel] = useState('explorer');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelOpen, setPanelOpen]     = useState(false);
  const [output, setOutput]           = useState(null);
  const [running, setRunning]         = useState(false);
  const [cursorPos, setCursorPos]     = useState({ line: 1, column: 1 });
  const [copied, setCopied]           = useState(false);
  const [wordWrap, setWordWrap]       = useState(false);
  const [commentLine, setCommentLine] = useState(null);
  const [commentCount, setCommentCount] = useState(0);

  // Modal state
  const [modal, setModal] = useState(null);

  // Edit log debounce
  const editDebounceRef = useRef(null);
  const editDeltaRef    = useRef({ added: 0, removed: 0 });

  const editorRef  = useRef(null);
  const monacoRef  = useRef(null);

  const handleEditorReady = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  }, []);

  const cmd = useCallback((id) => {
    editorRef.current?.trigger('menu', id, null);
  }, []);

  const language = useMemo(() => {
    return filesMap.get(activeFile)?.language || getLang(activeFile || '') || 'javascript';
  }, [filesMap, activeFile]);

  const currentYText = useMemo(() => {
    if (!setup?.ydoc || !activeFile) return null;
    return setup.ydoc.getText(`file/${activeFile}`);
  }, [setup, activeFile]);

  // ── Load room ──────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get(`/rooms/${roomId}`)
      .then(({ data }) => setRoom(data))
      .catch(() => {});
  }, [roomId]);

  // ── Lobby phase ────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('coda-token');
    if (!token) { navigate('/login'); return; }

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws    = new WebSocket(
      `${proto}://${location.host}/lobby/${roomId}?token=${encodeURIComponent(token)}`
    );
    lobbyWsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'approved') {
          setLobbyStatus('approved');
          if (msg.pendingList?.length) setPendingRequests(msg.pendingList);
        } else if (msg.type === 'waiting') {
          setLobbyStatus('waiting');
        } else if (msg.type === 'rejected') {
          setLobbyStatus('rejected');
        } else if (msg.type === 'join_request') {
          setPendingRequests((p) => [...p, { userId: msg.userId, username: msg.username }]);
        } else if (msg.type === 'request_cancelled') {
          setPendingRequests((p) => p.filter((r) => r.userId !== msg.userId));
        }
      } catch {}
    };

    ws.onerror   = () => setLobbyStatus('approved'); // graceful degrade if lobby unreachable
    ws.onclose   = (e) => { if (e.code === 4001) navigate('/login'); };

    return () => {
      lobbyWsRef.current = null;
      if (ws.readyState <= 1) ws.close();
    };
  }, [roomId, navigate]);

  // ── Yjs + WebSocket (runs only after lobby approved) ───────────────────────
  useEffect(() => {
    if (lobbyStatus !== 'approved') return;

    const token = localStorage.getItem('coda-token');
    if (!token) { navigate('/login'); return; }

    const ydoc     = new Y.Doc();
    const proto    = location.protocol === 'https:' ? 'wss' : 'ws';
    const provider = new WebsocketProvider(`${proto}://${location.host}/ws`, roomId, ydoc, {
      params: { token },
    });

    const yChat       = ydoc.getArray('chat');
    const yMeta       = ydoc.getMap('meta');
    const yComments   = ydoc.getArray('comments');
    const yFileMeta   = ydoc.getMap('files');
    const yChangeLogs = ydoc.getArray('changelog');

    const pushLog = (entry) => {
      yChangeLogs.push([{ ...entry, timestamp: Date.now(), user: user.username }]);
      if (yChangeLogs.length > MAX_LOGS) yChangeLogs.delete(0, yChangeLogs.length - MAX_LOGS);
    };

    provider.awareness.setLocalStateField('user', {
      name:  user.username,
      color: user.color || '#7c3aed',
      id:    user.id || user._id,
    });

    provider.on('status', ({ status }) => setConnected(status === 'connected'));

    // Log own join
    pushLog({ type: 'user_joined' });

    // Awareness with peer join/leave logging (guarded after first sync)
    let synced = false;
    provider.on('sync', (isSynced) => { if (isSynced) synced = true; });

    const peersCache = new Map();
    const updatePeers = ({ added = [], removed = [] } = {}) => {
      const states = [...provider.awareness.getStates().entries()];
      setPeers(states.filter(([, s]) => s.user).map(([, s]) => s.user));
      states.forEach(([cid, s]) => { if (s.user) peersCache.set(cid, s.user.name); });

      if (synced) {
        added.forEach((cid) => {
          if (cid === provider.awareness.clientID) return;
          const s = provider.awareness.getStates().get(cid);
          if (s?.user) pushLog({ type: 'user_joined', user: s.user.name });
        });
        removed.forEach((cid) => {
          const cached = peersCache.get(cid);
          if (cached && cid !== provider.awareness.clientID) {
            pushLog({ type: 'user_left', user: cached });
            peersCache.delete(cid);
          }
        });
      }
    };

    provider.awareness.on('change', updatePeers);
    updatePeers();

    const updateFilesMap = () => setFilesMap(new Map(yFileMeta.entries()));
    yFileMeta.observe(updateFilesMap);
    updateFilesMap();

    const updateCommentCount = () =>
      setCommentCount(yComments.toArray().filter((c) => !c.resolved).length);
    updateCommentCount();
    yComments.observe(updateCommentCount);

    setSetup({ provider, ydoc, yChat, yMeta, yComments, yFileMeta, yChangeLogs, pushLog });

    return () => {
      yFileMeta.unobserve(updateFilesMap);
      yComments.unobserve(updateCommentCount);
      provider.awareness.off('change', updatePeers);
      provider.destroy();
      ydoc.destroy();
      setSetup(null);
      setFilesMap(new Map());
      setActiveFile(null);
      setOpenTabs([]);
    };
  }, [roomId, user, navigate, lobbyStatus]);

  // ── Seed initial file once connected and files are empty ───────────────────
  useEffect(() => {
    if (!connected || !setup || filesMap.size > 0) return;
    const lang = room?.language || 'javascript';
    const ext  = getExt(lang);
    const initialFile = `main.${ext}`;
    setup.yFileMeta.set(initialFile, { language: lang, created: Date.now() });

    const oldText = setup.ydoc.getText('content');
    if (oldText.length > 0) {
      const newText = setup.ydoc.getText(`file/${initialFile}`);
      if (newText.length === 0) newText.insert(0, oldText.toString());
    }
    setup.pushLog?.({ type: 'file_created', file: initialFile });
  }, [connected, setup, filesMap.size, room]);

  // ── Open first available file when filesMap populates ─────────────────────
  useEffect(() => {
    if (filesMap.size === 0 || activeFile) return;
    const first = [...filesMap.keys()][0];
    setActiveFile(first);
    setOpenTabs([first]);
  }, [filesMap, activeFile]);

  // ── Edit change log (debounced per file) ───────────────────────────────────
  useEffect(() => {
    if (!currentYText || !activeFile || !setup) return;

    const handler = (event) => {
      event.changes.delta.forEach((op) => {
        if (op.insert) editDeltaRef.current.added += (typeof op.insert === 'string' ? op.insert.length : 1);
        if (op.delete) editDeltaRef.current.removed += op.delete;
      });
      clearTimeout(editDebounceRef.current);
      editDebounceRef.current = setTimeout(() => {
        const { added, removed } = editDeltaRef.current;
        if (added > 0 || removed > 0) {
          setup.pushLog({ type: 'edit', file: activeFile, details: { added, removed } });
          editDeltaRef.current = { added: 0, removed: 0 };
        }
      }, 2000);
    };

    currentYText.observe(handler);
    return () => {
      currentYText.unobserve(handler);
      clearTimeout(editDebounceRef.current);
    };
  }, [currentYText, activeFile, setup]);

  // ── File operations ────────────────────────────────────────────────────────
  const openFileTab = useCallback((filename) => {
    setOpenTabs((prev) => [...new Set([...prev, filename])]);
    setActiveFile(filename);
  }, []);

  const closeTab = useCallback((filename) => {
    setOpenTabs((prev) => {
      const next = prev.filter((f) => f !== filename);
      if (filename === activeFile) {
        const idx = prev.indexOf(filename);
        const fallback = next[Math.min(idx, next.length - 1)];
        if (fallback) setActiveFile(fallback);
      }
      return next.length > 0 ? next : prev;
    });
  }, [activeFile]);

  const createFile = useCallback((name) => {
    if (!setup) return;
    const filename = ensureExt(name);
    const lang = getLang(filename);
    setup.yFileMeta.set(filename, { language: lang, created: Date.now() });
    openFileTab(filename);
    setup.pushLog?.({ type: 'file_created', file: filename });
  }, [setup, openFileTab]);

  const renameFile = useCallback((oldName, newName) => {
    if (!setup || !newName || oldName === newName) return;
    const filename = newName.includes('.') ? newName : `${newName}.${oldName.split('.').pop()}`;
    const meta     = filesMap.get(oldName) || {};
    const lang     = getLang(filename) || meta.language || 'javascript';

    const oldText = setup.ydoc.getText(`file/${oldName}`);
    const newText = setup.ydoc.getText(`file/${filename}`);
    newText.delete(0, newText.length);
    newText.insert(0, oldText.toString());
    oldText.delete(0, oldText.length);

    setup.yFileMeta.set(filename, { ...meta, language: lang });
    setup.yFileMeta.delete(oldName);

    setup.pushLog?.({ type: 'file_renamed', file: filename, details: { from: oldName, to: filename } });
    setOpenTabs((prev) => prev.map((f) => (f === oldName ? filename : f)));
    setActiveFile((prev) => (prev === oldName ? filename : prev));
  }, [setup, filesMap]);

  const deleteFile = useCallback((filename) => {
    if (!setup || filesMap.size <= 1) return;
    const yText = setup.ydoc.getText(`file/${filename}`);
    yText.delete(0, yText.length);
    setup.yFileMeta.delete(filename);
    setup.pushLog?.({ type: 'file_deleted', file: filename });
    closeTab(filename);
    if (activeFile === filename) {
      const remaining = [...filesMap.keys()].filter((f) => f !== filename);
      if (remaining.length) openFileTab(remaining[0]);
    }
  }, [setup, filesMap, activeFile, closeTab, openFileTab]);

  const openFilesFromDisk = useCallback(() => {
    if (!setup) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.js,.ts,.jsx,.tsx,.py,.go,.rs,.java,.cpp,.c,.cs,.html,.css,.json,.sql,.md,.yml,.yaml,.sh,.txt';
    input.onchange = async (e) => {
      for (const file of Array.from(e.target.files)) {
        const content = await file.text();
        const lang = getLang(file.name);
        setup.yFileMeta.set(file.name, { language: lang, created: Date.now() });
        const yText = setup.ydoc.getText(`file/${file.name}`);
        yText.delete(0, yText.length);
        yText.insert(0, content);
        openFileTab(file.name);
      }
    };
    input.click();
  }, [setup, openFileTab]);

  const openFolderFromDisk = useCallback(async () => {
    if (!setup) return;
    if (!('showDirectoryPicker' in window)) {
      openFilesFromDisk();
      return;
    }
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      const entries   = await readDirRecursive(dirHandle);
      let loaded = 0;
      for (const { path, handle } of entries) {
        if (!FOLDER_EXT.test(path)) continue;
        try {
          const file    = await handle.getFile();
          const content = await file.text();
          const lang    = getLang(path.split('/').pop()) || 'text';
          setup.yFileMeta.set(path, { language: lang, created: Date.now() });
          const yText = setup.ydoc.getText(`file/${path}`);
          yText.delete(0, yText.length);
          yText.insert(0, content);
          openFileTab(path);
          loaded++;
        } catch {} // skip binary / unreadable files
      }
      if (loaded > 0) setup.pushLog?.({ type: 'folder_opened', details: { count: loaded } });
    } catch (err) {
      if (err.name !== 'AbortError') console.error('[coda] folder picker error:', err);
    }
  }, [setup, openFileTab, openFilesFromDisk]);

  const saveCurrentFile = useCallback(() => {
    if (!setup || !activeFile) return;
    const content = setup.ydoc.getText(`file/${activeFile}`).toString();
    const blob = new Blob([content], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url, download: activeFile.split('/').pop(),
    });
    a.click();
    URL.revokeObjectURL(url);
  }, [setup, activeFile]);

  const saveAllFiles = useCallback(() => {
    if (!setup) return;
    filesMap.forEach((_, filename) => {
      const content = setup.ydoc.getText(`file/${filename}`).toString();
      const blob = new Blob([content], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), {
        href: url, download: filename.split('/').pop(),
      });
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [setup, filesMap]);

  const handleLanguageChange = useCallback((lang) => {
    if (!setup || !activeFile) return;
    const meta = filesMap.get(activeFile) || {};
    setup.yFileMeta.set(activeFile, { ...meta, language: lang });
    setup.yMeta?.set('language', lang);
    setup.pushLog?.({ type: 'language_changed', file: activeFile, details: { language: lang } });
    api.patch(`/rooms/${roomId}`, { language: lang }).catch(() => {});
  }, [setup, activeFile, filesMap, roomId]);

  // ── Run code ───────────────────────────────────────────────────────────────
  const runCode = useCallback(async () => {
    if (!setup || !currentYText || running) return;
    setRunning(true);
    setPanelOpen(true);
    setOutput({ status: 'Running…', stdout: '', stderr: '' });
    try {
      const { data } = await api.post('/execute', { code: currentYText.toString(), language });
      setOutput(data);
      setup.pushLog?.({ type: 'code_run', file: activeFile, details: { language, status: data.status || 'OK' } });
    } catch (err) {
      setOutput({ stderr: err.response?.data?.error || 'Execution failed', stdout: '', status: 'Error' });
      setup.pushLog?.({ type: 'code_run', file: activeFile, details: { language, status: 'Error' } });
    } finally {
      setRunning(false);
    }
  }, [setup, currentYText, language, running, activeFile]);

  // ── Lobby approve / reject ─────────────────────────────────────────────────
  const handleApproveUser = useCallback((userId) => {
    lobbyWsRef.current?.send(JSON.stringify({ type: 'approve', userId }));
    setPendingRequests((p) => p.filter((r) => r.userId !== userId));
  }, []);

  const handleRejectUser = useCallback((userId) => {
    lobbyWsRef.current?.send(JSON.stringify({ type: 'reject', userId }));
    setPendingRequests((p) => p.filter((r) => r.userId !== userId));
  }, []);

  const retryLobby = useCallback(() => navigate(0), [navigate]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'n')                 { e.preventDefault(); setModal({ type: 'new', defaultValue: '', onConfirm: createFile }); }
      if (e.key === 'o' && !e.shiftKey) { e.preventDefault(); openFilesFromDisk(); }
      if (e.key === 's' && !e.shiftKey) { e.preventDefault(); saveCurrentFile(); }
      if (e.key === 'w')                 { e.preventDefault(); if (activeFile) closeTab(activeFile); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [createFile, openFilesFromDisk, saveCurrentFile, activeFile, closeTab]);

  // ── Panel / activity bar ───────────────────────────────────────────────────
  const handleActivitySelect = useCallback((panel) => {
    if (activePanel === panel && sidebarOpen) setSidebarOpen(false);
    else { setActivePanel(panel); setSidebarOpen(true); }
  }, [activePanel, sidebarOpen]);

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const toggleWordWrap = useCallback(() => {
    setWordWrap((w) => {
      const next = !w;
      editorRef.current?.updateOptions({ wordWrap: next ? 'on' : 'off' });
      return next;
    });
  }, []);

  // ── Menu definitions ───────────────────────────────────────────────────────
  const menus = [
    {
      label: 'File',
      items: [
        { label: 'New File',        shortcut: 'Ctrl+N', action: () => setModal({ type: 'new', defaultValue: '', onConfirm: createFile }) },
        { label: 'Open File(s)…',   shortcut: 'Ctrl+O', action: openFilesFromDisk },
        { label: 'Open Folder…',                        action: openFolderFromDisk },
        { type: 'sep' },
        { label: 'Save',            shortcut: 'Ctrl+S',       action: saveCurrentFile, disabled: !activeFile },
        { label: 'Save All',        shortcut: 'Ctrl+Shift+S', action: saveAllFiles,    disabled: filesMap.size === 0 },
        { type: 'sep' },
        { label: 'Rename File…', action: () => activeFile && setModal({ type: 'rename', defaultValue: activeFile, onConfirm: (n) => renameFile(activeFile, n) }), disabled: !activeFile },
        { label: 'Delete File',  action: () => activeFile && deleteFile(activeFile), disabled: !activeFile || filesMap.size <= 1 },
        { label: 'Close Tab',    shortcut: 'Ctrl+W', action: () => activeFile && closeTab(activeFile), disabled: !activeFile },
        { type: 'sep' },
        { label: 'Share Room Link', action: copyLink },
        { type: 'sep' },
        { label: 'My Rooms',  action: () => navigate('/') },
        { label: 'Sign Out',  action: () => { logout(); navigate('/login'); } },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo',           shortcut: 'Ctrl+Z',        action: () => cmd('undo') },
        { label: 'Redo',           shortcut: 'Ctrl+Y',        action: () => cmd('redo') },
        { type: 'sep' },
        { label: 'Cut',            shortcut: 'Ctrl+X',        action: () => cmd('editor.action.clipboardCutAction') },
        { label: 'Copy',           shortcut: 'Ctrl+C',        action: () => cmd('editor.action.clipboardCopyAction') },
        { label: 'Paste',          shortcut: 'Ctrl+V',        action: () => cmd('editor.action.clipboardPasteAction') },
        { type: 'sep' },
        { label: 'Find',           shortcut: 'Ctrl+F',        action: () => cmd('actions.find') },
        { label: 'Find & Replace', shortcut: 'Ctrl+H',        action: () => cmd('editor.action.startFindReplaceAction') },
        { label: 'Find in Files',  shortcut: 'Ctrl+Shift+F',  action: () => cmd('workbench.action.findInFiles') },
        { type: 'sep' },
        { label: 'Format Document', shortcut: 'Shift+Alt+F', action: () => cmd('editor.action.formatDocument') },
        { label: 'Toggle Comment',  shortcut: 'Ctrl+/',       action: () => cmd('editor.action.commentLine') },
        { label: 'Indent Lines',    shortcut: 'Ctrl+]',       action: () => cmd('editor.action.indentLines') },
        { label: 'Outdent Lines',   shortcut: 'Ctrl+[',       action: () => cmd('editor.action.outdentLines') },
        { type: 'sep' },
        { label: 'Select All',      shortcut: 'Ctrl+A',        action: () => cmd('editor.action.selectAll') },
        { label: 'Duplicate Line',  shortcut: 'Shift+Alt+↓',  action: () => cmd('editor.action.copyLinesDownAction') },
        { label: 'Delete Line',     shortcut: 'Ctrl+Shift+K', action: () => cmd('editor.action.deleteLines') },
        { label: 'Move Line Up',    shortcut: 'Alt+↑',         action: () => cmd('editor.action.moveLinesUpAction') },
        { label: 'Move Line Down',  shortcut: 'Alt+↓',         action: () => cmd('editor.action.moveLinesDownAction') },
      ],
    },
    {
      label: 'Selection',
      items: [
        { label: 'Select All',               shortcut: 'Ctrl+A',       action: () => cmd('editor.action.selectAll') },
        { type: 'sep' },
        { label: 'Expand Selection',         shortcut: 'Shift+Alt+→',  action: () => cmd('editor.action.smartSelect.expand') },
        { label: 'Shrink Selection',         shortcut: 'Shift+Alt+←',  action: () => cmd('editor.action.smartSelect.shrink') },
        { type: 'sep' },
        { label: 'Copy Line Up',             shortcut: 'Shift+Alt+↑',  action: () => cmd('editor.action.copyLinesUpAction') },
        { label: 'Copy Line Down',           shortcut: 'Shift+Alt+↓',  action: () => cmd('editor.action.copyLinesDownAction') },
        { type: 'sep' },
        { label: 'Add Cursor Above',         shortcut: 'Ctrl+Alt+↑',   action: () => cmd('editor.action.insertCursorAbove') },
        { label: 'Add Cursor Below',         shortcut: 'Ctrl+Alt+↓',   action: () => cmd('editor.action.insertCursorBelow') },
        { label: 'Add Cursors to Line Ends', shortcut: 'Shift+Alt+I',  action: () => cmd('editor.action.insertCursorAtEndOfEachLineSelected') },
        { label: 'Add Next Occurrence',      shortcut: 'Ctrl+D',       action: () => cmd('editor.action.addSelectionToNextFindMatch') },
        { type: 'sep' },
        { label: 'Select All Occurrences',   shortcut: 'Ctrl+Shift+L', action: () => cmd('editor.action.selectHighlights') },
        { label: 'Select All Matches',       shortcut: 'Alt+Enter',    action: () => cmd('editor.action.selectAllMatches') },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Toggle Sidebar',      shortcut: 'Ctrl+B', action: () => setSidebarOpen((o) => !o) },
        { label: 'Toggle Output Panel', shortcut: 'Ctrl+`', action: () => setPanelOpen((o) => !o) },
        { type: 'sep' },
        { label: 'Explorer',      action: () => handleActivitySelect('explorer'), checked: activePanel === 'explorer' && sidebarOpen },
        { label: 'Collaborators', action: () => handleActivitySelect('users'),    checked: activePanel === 'users'    && sidebarOpen },
        { label: 'Chat',          action: () => handleActivitySelect('chat'),     checked: activePanel === 'chat'     && sidebarOpen },
        { label: 'Comments',      action: () => handleActivitySelect('comments'), checked: activePanel === 'comments' && sidebarOpen },
        { label: 'Run',           action: () => handleActivitySelect('run'),      checked: activePanel === 'run'      && sidebarOpen },
        { type: 'sep' },
        { label: 'Word Wrap',  shortcut: 'Alt+Z',  action: toggleWordWrap, checked: wordWrap },
        { label: 'Minimap', action: () => {
          const enabled = editorRef.current?.getOptions().get(62)?.enabled;
          editorRef.current?.updateOptions({ minimap: { enabled: !enabled } });
        }},
        { label: 'Zoom In',    shortcut: 'Ctrl+=', action: () => editorRef.current?.trigger('keyboard', 'editor.action.fontZoomIn',    null) },
        { label: 'Zoom Out',   shortcut: 'Ctrl+-', action: () => editorRef.current?.trigger('keyboard', 'editor.action.fontZoomOut',   null) },
        { label: 'Reset Zoom', shortcut: 'Ctrl+0', action: () => editorRef.current?.trigger('keyboard', 'editor.action.fontZoomReset', null) },
      ],
    },
    {
      label: 'Go',
      items: [
        { label: 'Go to Line/Column…', shortcut: 'Ctrl+G',        action: () => cmd('editor.action.gotoLine') },
        { label: 'Go to Symbol…',      shortcut: 'Ctrl+Shift+O',  action: () => cmd('editor.action.gotoSymbol') },
        { label: 'Go to Bracket',      shortcut: 'Ctrl+Shift+\\', action: () => cmd('editor.action.jumpToBracket') },
        { type: 'sep' },
        { label: 'Go to Beginning',    shortcut: 'Ctrl+Home',     action: () => cmd('cursorTop') },
        { label: 'Go to End',          shortcut: 'Ctrl+End',      action: () => cmd('cursorBottom') },
        { label: 'Go to Line Start',   shortcut: 'Home',          action: () => cmd('cursorHome') },
        { label: 'Go to Line End',     shortcut: 'End',           action: () => cmd('cursorEnd') },
        { type: 'sep' },
        { label: 'Go to Definition',   shortcut: 'F12',           action: () => cmd('editor.action.revealDefinition') },
        { label: 'Go to References',   shortcut: 'Shift+F12',     action: () => cmd('editor.action.goToReferences') },
        { label: 'Go to Type Def',     shortcut: 'Ctrl+F12',      action: () => cmd('editor.action.goToTypeDefinition') },
        { label: 'Peek Definition',    shortcut: 'Alt+F12',       action: () => cmd('editor.action.peekDefinition') },
        { type: 'sep' },
        { label: 'Next Error',         shortcut: 'F8',            action: () => cmd('editor.action.marker.next') },
        { label: 'Previous Error',     shortcut: 'Shift+F8',      action: () => cmd('editor.action.marker.prev') },
      ],
    },
    {
      label: 'Run',
      items: [
        { label: 'Run Code', shortcut: 'Ctrl+Enter', action: runCode },
        { label: 'Stop Run', shortcut: 'Ctrl+.',      action: () => {}, disabled: !running },
        { type: 'sep' },
        { type: 'heading', label: 'Language' },
        ...LANGUAGES.map((l) => ({
          label:   l,
          checked: language === l,
          action:  () => handleLanguageChange(l),
        })),
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Keyboard Shortcuts', shortcut: 'Ctrl+K Ctrl+S', action: () => cmd('workbench.action.openGlobalKeybindings') },
        { label: 'Command Palette…',   shortcut: 'Ctrl+Shift+P',  action: () => cmd('editor.action.quickCommand') },
        { type: 'sep' },
        { label: 'Toggle Line Numbers',      action: () => {
          const current = editorRef.current?.getOptions().get(62);
          editorRef.current?.updateOptions({ lineNumbers: current === 'on' ? 'off' : 'on' });
        }},
        { label: 'Toggle Render Whitespace', action: () => cmd('editor.action.toggleRenderWhitespace') },
        { label: 'Toggle Bracket Guides',    action: () => {
          editorRef.current?.updateOptions({ guides: { bracketPairs: 'active' } });
        }},
        { type: 'sep' },
        { label: 'About Coda', action: () => alert('Coda — Real-time Collaborative Code Editor\nBuilt with React, Monaco, Yjs, and Node.js') },
      ],
    },
  ];

  return (
    <div className="vsc-root">
      {lobbyStatus !== 'approved' ? (
        <LobbyOverlay status={lobbyStatus} roomName={room?.name} onRetry={retryLobby} />
      ) : (
        <>
          <TitleBar menus={menus} peers={peers} user={user} roomName={room?.name} />

          <div className="vsc-body">
            <ActivityBar
              active={activePanel}
              onSelect={handleActivitySelect}
              commentCount={commentCount}
            />

            {sidebarOpen && (
              <Sidebar
                panel={activePanel}
                room={room}
                peers={peers}
                language={language}
                onLanguageChange={handleLanguageChange}
                running={running}
                onRun={runCode}
                yChat={setup?.yChat}
                user={user}
                yComments={setup?.yComments}
                onJumpToLine={(line) => {
                  editorRef.current?.revealLineInCenter(line);
                  editorRef.current?.setPosition({ lineNumber: line, column: 1 });
                  editorRef.current?.focus();
                }}
                filesMap={filesMap}
                activeFile={activeFile}
                onFileClick={openFileTab}
                onNewFile={() => setModal({ type: 'new', defaultValue: '', onConfirm: createFile })}
                onRenameFile={(f) => setModal({ type: 'rename', defaultValue: f, onConfirm: (n) => renameFile(f, n) })}
                onDeleteFile={deleteFile}
                onOpenFolder={openFolderFromDisk}
              />
            )}

            <div className="vsc-editor-group" style={{ position: 'relative' }}>
              <TabBar
                tabs={openTabs}
                activeFile={activeFile}
                onTabClick={openFileTab}
                onTabClose={closeTab}
                onRun={runCode}
                running={running}
                onShare={copyLink}
                copied={copied}
              />

              <div className="vsc-editor-content">
                {setup && currentYText && activeFile && (
                  <Editor
                    key={activeFile}
                    yText={currentYText}
                    awareness={setup.provider.awareness}
                    language={language}
                    onCursorPositionChange={setCursorPos}
                    onEditorReady={handleEditorReady}
                    yComments={setup.yComments}
                    currentUser={user}
                    onGutterClick={(line) => setCommentLine(line)}
                  />
                )}
              </div>

              {commentLine !== null && setup && (
                <CommentPopover
                  line={commentLine}
                  yComments={setup.yComments}
                  currentUser={user}
                  onClose={() => setCommentLine(null)}
                />
              )}

              {panelOpen && (
                <Panel
                  output={output}
                  running={running}
                  onClose={() => setPanelOpen(false)}
                  editorRef={editorRef}
                  monacoRef={monacoRef}
                  activeFile={activeFile}
                  yChangeLogs={setup?.yChangeLogs}
                  onJumpTo={(line, col) => {
                    editorRef.current?.revealLineInCenter(line);
                    editorRef.current?.setPosition({ lineNumber: line, column: col ?? 1 });
                    editorRef.current?.focus();
                  }}
                />
              )}
            </div>
          </div>

          <ChatToast
            yChat={setup?.yChat}
            currentUser={user}
            chatVisible={sidebarOpen && activePanel === 'chat'}
            onOpen={() => { setActivePanel('chat'); setSidebarOpen(true); }}
          />

          <StatusBar
            connected={connected}
            language={language}
            peers={peers}
            cursorPos={cursorPos}
            onTogglePanel={() => setPanelOpen((p) => !p)}
          />

          {modal && (
            <FileNameModal
              title={modal.type === 'new' ? 'New File' : 'Rename File'}
              defaultValue={modal.defaultValue}
              onConfirm={modal.onConfirm}
              onClose={() => setModal(null)}
            />
          )}
        </>
      )}

      <JoinRequestToast
        requests={pendingRequests}
        onApprove={handleApproveUser}
        onReject={handleRejectUser}
      />
    </div>
  );
}
