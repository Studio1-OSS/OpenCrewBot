"use client";

import { BookOpen, Check, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { Bot, TeamMemoryState } from "@/lib/shared/types";
import { useApp } from "./OpenCrewBotApp";
import { Button, inputClass } from "./ui";

export function TeamMemory({ bot }: { bot: Bot }) {
  const { state: app, setPanel } = useApp();
  const [state, setState] = useState<TeamMemoryState | null>(null);
  const [server, setServer] = useState("");
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const serial = useRef(0);
  const load = useCallback(async (documentPath?: string) => {
    const request = ++serial.current;
    setLoading(true); setError("");
    try {
      const next = await api.teamMemory(bot.id, server || undefined, documentPath);
      if (request === serial.current) { setState(next); setError(next.error ?? ""); }
    } catch (e) { if (request === serial.current) setError(e instanceof Error ? e.message : "Couldn't connect."); }
    finally { if (request === serial.current) setLoading(false); }
  }, [bot.id, server]);
  const connectionsKey = bot.connections.join(",");
  useEffect(() => {
    let cancelled = false;
    const request = ++serial.current;
    api.teamMemory(bot.id, server || undefined).then((next) => {
      if (!cancelled && request === serial.current) { setState(next); setError(next.error ?? ""); setLoading(false); }
    }).catch((e) => {
      if (!cancelled && request === serial.current) { setError(e instanceof Error ? e.message : "Couldn't connect."); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [bot.id, server, app.connectionsVersion, connectionsKey]);

  return (
    <section className="space-y-5" aria-label="Team Memory">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[14px] font-medium"><BookOpen size={16} /> Shared knowledge</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-mute">Current project context from OpenLore. Your bot&apos;s personal notes stay in Personal.</p>
        </div>
        <button aria-label="Refresh team memory" onClick={() => void load(state?.document?.path)} disabled={loading} className="rounded-lg p-2 text-mute hover:bg-hover disabled:opacity-40"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
      </div>
      {loading && !state && <p role="status" className="text-sm text-mute">Checking this bot&apos;s connection…</p>}
      {error && <div role="alert" className="rounded-xl bg-danger-soft p-3 text-[13px] leading-relaxed text-danger">{error}<button className="mt-2 block font-medium underline" onClick={() => void load()}>Retry connection</button></div>}
      {state && state.servers.length === 0 && <div className="space-y-3 py-3"><p className="text-sm text-mute">Connect OpenLore, then assign one identity to {bot.name} in Details. Access is enforced by the knowledge server.</p><Button size="sm" onClick={() => setPanel({ kind: "connections" })}>Connect OpenLore</Button></div>}
      {state && state.servers.length > 0 && <>
        {state.servers.length > 1 && <label className="block text-xs text-mute">Connection<select className={`${inputClass} mt-1`} value={server || state.serverId} onChange={(e) => { setPath(""); setState(null); setLoading(true); setServer(e.target.value); }}>{state.servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        {state.identity && <div className="flex items-center gap-2 border-y border-line py-3 text-[13px]"><ShieldCheck size={16} className="text-ok" /><span className="text-mute">Viewing as</span><strong className="break-all font-medium">{state.identity}</strong></div>}
        {state.collections && <div><h3 className="mb-2 text-[12px] font-medium text-mute">Accessible collections</h3><pre className="overflow-x-auto rounded-lg bg-app p-3 text-[11px] leading-relaxed">{state.collections}</pre></div>}
        <div><h3 className="mb-2 text-[12px] font-medium text-mute">Documents this identity can read</h3>
          <div className="max-h-64 overflow-y-auto divide-y divide-line">{state.files?.map((file) => <button key={file} onClick={() => { setPath(file); void load(file); }} disabled={loading} className="flex w-full items-center gap-2 py-2 text-left text-[12px] text-ink hover:text-accent disabled:opacity-50"><FileText size={13} className="shrink-0 text-mute" /><span className="break-all">{file}</span></button>)}{state.files?.length === 0 && <p className="py-2 text-xs text-mute">No Markdown documents are visible to this identity.</p>}</div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void load(path); }} className="space-y-2"><label htmlFor={`lore-path-${bot.id}`} className="text-[12px] text-mute">Read a document by path</label><div className="flex gap-2"><input id={`lore-path-${bot.id}`} value={path} onChange={(e) => setPath(e.target.value)} placeholder="/shared/api-contract.md" className={`${inputClass} min-w-0 flex-1`} /><Button type="submit" size="sm" disabled={loading || !path.startsWith("/")}>Read</Button></div><p className="text-[11px] leading-relaxed text-faint">Requests use this bot&apos;s credential. Hidden documents stay inaccessible.</p></form>
        {state.document && <article className="space-y-2"><h3 className="break-all text-[12px] font-medium">{state.document.path}</h3><pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-app p-3 text-[12px] leading-relaxed">{state.document.content}</pre></article>}
        <div><h3 className="mb-2 text-[12px] font-medium text-mute">Recent operations</h3>{state.operations.length === 0 ? <p className="text-[12px] text-faint">Reads and agent tool calls appear here. Ask {bot.name} to consult Team Memory.</p> : <ol className="divide-y divide-line">{state.operations.map((op) => <li key={op.id} className="py-3"><div className="flex gap-2 text-[12px]"><span className={op.exitCode === 0 ? "text-ok" : "text-danger"}>{op.exitCode === 0 ? <Check size={14} /> : `Exit ${op.exitCode}`}</span><code className="min-w-0 break-all">{op.command}</code></div><p className="mt-1 truncate text-[11px] text-mute" title={op.preview}>{op.preview}</p><time className="text-[10px] text-faint">{new Date(op.at).toLocaleTimeString()}</time></li>)}</ol>}</div>
      </>}
    </section>
  );
}
