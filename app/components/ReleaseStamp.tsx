"use client";
import { useEffect, useState } from 'react';
import { format } from '@/lib/app-stamp.cjs';
import pkg from '../../package.json';
export default function ReleaseStamp() {
  const info = JSON.parse(process.env.NEXT_PUBLIC_APP_BUILD_INFO || '{}');
  const [now, setNow] = useState<number | null>(null);
  const [exact, setExact] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const refresh = () => { clearInterval(timer); if (!document.hidden) { setNow(Date.now()); timer = setInterval(() => setNow(Date.now()), 60000); } };
    refresh(); document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const build = info.event === 'build' || !info.commitTime;
  const time = now === null ? null : format(build ? info.buildTime : info.commitTime, now);
  const version = info.version || pkg.version;
  const detail = time ? time.detail + (info.commit ? ' · commit ' + info.commit.slice(0, 7) : '') + (build ? ' (build time)' : '') : '';
  return <button type="button" className="app-release-stamp" onClick={() => setExact(!exact)} title={detail} aria-label={detail ? `v${version}, updated ${detail}` : `v${version}`}>
    v{version}{time && ' · '}{time && <time dateTime={time.datetime} title={detail}>{exact ? detail : 'Updated ' + time.label}</time>}
  </button>;
}
