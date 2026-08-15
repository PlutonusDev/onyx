"use client";

/**
 * In-browser code execution.
 *
 * JavaScript and HTML run inside a sandboxed <iframe> (no same-origin, no
 * network to us), so nothing user/model code does can touch the app or its
 * credentials. Python runs on Pyodide (WASM), loaded lazily from a CDN the
 * first time it's needed.
 */

export type RunKind =
  | "web" // html / svg — rendered directly
  | "mermaid"
  | "markdown"
  | "js"
  | "python"
  | "none";

export function runKindFor(language: string): RunKind {
  const l = language.toLowerCase();
  if (["html", "svg", "xml"].includes(l)) return "web";
  if (l === "mermaid") return "mermaid";
  if (["markdown", "md"].includes(l)) return "markdown";
  if (["js", "javascript", "mjs", "cjs"].includes(l)) return "js";
  if (["py", "python"].includes(l)) return "python";
  return "none";
}

/** Is there anything to run/preview for this language? */
export function isPreviewable(language: string): boolean {
  return runKindFor(language) !== "none";
}

/** HTML document that runs `code` and streams console output to the parent. */
export function jsSandboxDoc(code: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font:13px/1.6 ui-monospace,monospace;color:#e4e4e7;background:#0b0b0e}
  </style></head><body><script>
    (function(){
      var send=function(level,args){
        try{parent.postMessage({__onyxLog:true,level:level,
          text:args.map(function(a){
            if(typeof a==='object'){try{return JSON.stringify(a,null,2)}catch(e){return String(a)}}
            return String(a)}).join(' ')},'*')}catch(e){}
      };
      ['log','info','warn','error','debug'].forEach(function(k){
        var orig=console[k];
        console[k]=function(){send(k,[].slice.call(arguments));if(orig)orig.apply(console,arguments)};
      });
      window.onerror=function(m,s,l,c,err){send('error',[String(err&&err.stack||m)]);return true};
      window.addEventListener('unhandledrejection',function(e){send('error',['Unhandled: '+(e.reason&&e.reason.stack||e.reason)])});
      try{
        var __r=eval(${JSON.stringify(code)});
        if(__r!==undefined)send('log',[__r]);
      }catch(err){send('error',[String(err&&err.stack||err)])}
      parent.postMessage({__onyxDone:true},'*');
    })();
  <\/script></body></html>`;
}

/* ------------------------------------------------------------------- Python */

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

interface PyodideLike {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideLike>;
    __onyxPyodide?: Promise<PyodideLike>;
  }
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Python runtime."));
    document.head.appendChild(s);
  });
}

function getPyodide(): Promise<PyodideLike> {
  if (window.__onyxPyodide) return window.__onyxPyodide;
  window.__onyxPyodide = (async () => {
    if (!window.loadPyodide) await injectScript(`${PYODIDE_CDN}pyodide.js`);
    if (!window.loadPyodide) throw new Error("Python runtime unavailable.");
    return window.loadPyodide({ indexURL: PYODIDE_CDN });
  })();
  return window.__onyxPyodide;
}

export interface PyRun {
  output: string;
  error: string | null;
}

export async function runPython(code: string): Promise<PyRun> {
  const py = await getPyodide();
  let out = "";
  py.setStdout({ batched: (s) => (out += s) });
  py.setStderr({ batched: (s) => (out += s) });
  try {
    const result = await py.runPythonAsync(code);
    if (result !== undefined && result !== null) out += `\n${String(result)}`;
    return { output: out.trimEnd(), error: null };
  } catch (err) {
    return {
      output: out.trimEnd(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
