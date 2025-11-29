import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import './App.css';

type SandboxMessage =
  | { source: 'playground'; type: 'log'; payload: unknown[] }
  | { source: 'playground'; type: 'error'; payload: string }
  | { source: 'playground'; type: 'ready'; payload: null };

const LOCAL_STORAGE_KEY = 'ceejay-playground-code';

export default function App() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [code, setCode] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const debounceRef = useRef<number | undefined>(undefined);

  // Load code from localStorage on mount
  useEffect(() => {
    const savedCode = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedCode) setCode(savedCode);
  }, []);

  // Save code to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, code);
  }, [code]);

  const srcDoc = `
<!doctype html>
<html>
  <head><meta charset="utf-8"/></head>
  <body>
    <script>
      (function(){
        function send(type, payload){
          parent.postMessage({ source: 'playground', type, payload }, '*');
        }

        console.log = (...args) => send('log', args);
        console.error = (err) => send('error', String(err));

        window.addEventListener('message', (e) => {
          if (!e.data || e.data.source !== 'playground-parent') return;
          try {
            new Function(e.data.code)();
          } catch(err) {
            send('error', err.stack || String(err));
          }
        });

        send('ready', null);
      })();
    </script>
  </body>
</html>
`;

  useEffect(() => {
    const listener = (event: MessageEvent<SandboxMessage>) => {
      const d = event.data;
      if (!d || d.source !== 'playground') return;

      switch (d.type) {
        case 'log': {
          const formatted = d.payload
            .map((item) =>
              typeof item === 'object' && item !== null
                ? JSON.stringify(item, null, 2)
                : String(item)
            )
            .join(' ');
          setLogs((prev) => [...prev, formatted]);
          break;
        }

        case 'error':
          setLogs((prev) => [...prev, 'Error: ' + d.payload]);
          break;
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  const runCode = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.srcdoc = srcDoc;

    setTimeout(() => {
      iframe.contentWindow?.postMessage(
        { source: 'playground-parent', type: 'run', code },
        '*'
      );
    }, 20);
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(() => {
      setLogs([]); // 🧼 Clear console automatically
      runCode();
    }, 400);
  }, [code]);

  return (
    <div className='container'>
      <h2 className='animate-bounce'>JavaScript Playground by Prince Ceejay</h2>
      <div className='buttons'>
        <button onClick={runCode}>Run Code</button>
        <button onClick={() => setLogs([])}>Clear Console</button>
      </div>

      <div className='flex'>
        <div className='h-screen pb-2 editor-wrapper'>
          <Editor
            height='100%'
            defaultLanguage='javascript'
            value={code}
            onChange={(value) => setCode(value ?? '')}
            theme='vs-dark'
            onMount={(editor) => {
              editor.focus(); // Auto-focus when editor mounts
            }}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              lineNumbers: 'on',
            }}
          />
        </div>

        <iframe
          ref={iframeRef}
          title='sandbox'
          className='preview'
          sandbox='allow-scripts'
        />

        <div className='h-screen console'>
          <h3 className='animate-pulse font-bold text-xl'>Console:</h3>
          <pre className='text-left pb-2'>{logs.join('\n')}</pre>
        </div>
      </div>
    </div>
  );
}
