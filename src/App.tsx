import React, { useEffect, useRef, useState } from 'react';
import './App.css';

// type SandboxMessage =
//   | { source: "playground"; type: "log"; payload: unknown[] }
//   | { source: "playground"; type: "error"; payload: string }
//   | { source: "playground"; type: "ready" };

// type SandboxWindow = Window & {
//   console: {
//     log: (...args: unknown[]) => void;
//     error: (...args: unknown[]) => void;
//   };
//   eval: (code: string) => unknown;
// };

export default function App() {
  const [code, setCode] = useState<string>(''); // Start with empty editor
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // iframe srcdoc with console forwarding and code listener
  const getSrcDoc = (): string =>
    `<!doctype html>
<html>
  <head><meta charset="utf-8"/></head>
  <body>
    <script>
      (function(){
        function send(type, payload){
          parent.postMessage({ source: 'playground', type: type, payload: payload }, '*');
        }

        console.log = function(){ send('log', Array.from(arguments)); };
        console.error = function(){ send('error', Array.from(arguments).map(a => String(a)).join(' ')); };

        window.addEventListener('message', function(e){
          try {
            if (!e.data || e.data.source !== 'playground-parent' || e.data.type !== 'run') return;
            try {
              eval(e.data.code);
            } catch(err) {
              if(err && err.message){
                send('error', String(err.message));
              } else {
                send('error', String(err));
              }
            }
          } catch(outerErr) {
            send('error', String(outerErr && outerErr.message ? outerErr.message : outerErr));
          }
        });

        send('ready', null);
      })();
    </script>
  </body>
</html>`;

  // Listen for messages from iframe (logs, errors, ready)
  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      const data = event.data as unknown;
      if (!data || typeof data !== 'object') return;

      const d = data as { source?: unknown; type?: unknown; payload?: unknown };
      if (d.source !== 'playground') return;

      if (d.type === 'log') {
        const arr = Array.isArray(d.payload) ? d.payload : [d.payload];
        const formatted = arr
          .map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 2)))
          .join(' ');
        setLogs((prev) => [...prev, formatted]);
      } else if (d.type === 'error') {
        const msg =
          typeof d.payload === 'string' ? d.payload : String(d.payload);
        setLogs((prev) => [...prev, 'Error: ' + msg]);
      } else if (d.type === 'ready') {
        setLogs((prev) => [...prev, '[sandbox ready]']);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Run code by posting it to iframe
  const runCode = (): void => {
    setLogs([]); // clear previous

    const iframe = iframeRef.current;
    if (!iframe) return;

    // Reload iframe srcdoc if not loaded
    if (iframe.srcdoc !== getSrcDoc()) {
      iframe.srcdoc = getSrcDoc();
      setTimeout(() => {
        iframe.contentWindow?.postMessage(
          { source: 'playground-parent', type: 'run', code },
          '*'
        );
      }, 50);
    } else {
      iframe.contentWindow?.postMessage(
        { source: 'playground-parent', type: 'run', code },
        '*'
      );
    }
  };

  return (
    <div className='container'>
      <h2>TypeScript JS Playground</h2>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        placeholder='Write any JavaScript here…'
      />

      <div className='buttons'>
        <button onClick={runCode}>Run Code</button>
        <button onClick={() => setLogs([])}>Clear Console</button>
      </div>
{/* 
      <iframe
        ref={iframeRef}
        title='sandbox'
        className='preview'
        sandbox='allow-scripts'
      /> */}

      <div className='console'>
        <h3>Console:</h3>
        <pre>{logs.join('\n')}</pre>
      </div>
    </div>
  );
}
