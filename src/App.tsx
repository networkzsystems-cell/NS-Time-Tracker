import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Square,
  Download,
  Clock,
  Timer,
  Mail,
  Building2,
  Hash,
  Loader2,
  AlertCircle,
  Activity,
  Trash2,
  X,
  Layers,
  LogIn,
  Search,
  BookUser,
  User,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { supabase, type TimeEntry, type Candidate, type FeedbackValue } from '@/lib/supabase';
import CandidateRegistry from '@/CandidateRegistry';
import LoginPage from '@/LoginPage';

const DEPARTMENTS = [
  'Reception',
  'Exam Hall',
  'Valuation',
  'Below-cutoff',
  'Technical Interview',
  'Teaching Interested Interview',
  'Counselling',
] as const;

const EMAIL_KEY = 'nsp_tracker_email';
const DEPT_KEY = 'nsp_tracker_dept';
const SESSION_KEY = 'nsp_tracker_session';

type DeptTheme = {
  label: string;
  badge: string;
  card: string;
  border: string;
  dot: string;
  clock: string;
};

const DEPT_THEMES: Record<string, DeptTheme> = {
  Reception: { label: 'Reception', badge: 'bg-sky-100 text-sky-800', card: 'bg-sky-50/70', border: 'border-sky-200', dot: 'bg-sky-500', clock: 'text-sky-700' },
  'Exam Hall': { label: 'Exam Hall', badge: 'bg-violet-100 text-violet-800', card: 'bg-violet-50/70', border: 'border-violet-200', dot: 'bg-violet-500', clock: 'text-violet-700' },
  Valuation: { label: 'Valuation', badge: 'bg-amber-100 text-amber-800', card: 'bg-amber-50/70', border: 'border-amber-200', dot: 'bg-amber-500', clock: 'text-amber-700' },
  'Below-cutoff': { label: 'Below-cutoff', badge: 'bg-rose-100 text-rose-800', card: 'bg-rose-50/70', border: 'border-rose-200', dot: 'bg-rose-500', clock: 'text-rose-700' },
  'Technical Interview': { label: 'Technical Interview', badge: 'bg-emerald-100 text-emerald-800', card: 'bg-emerald-50/70', border: 'border-emerald-200', dot: 'bg-emerald-500', clock: 'text-emerald-700' },
  'Teaching Interested Interview': { label: 'Teaching Interested Interview', badge: 'bg-indigo-100 text-indigo-800', card: 'bg-indigo-50/70', border: 'border-indigo-200', dot: 'bg-indigo-500', clock: 'text-indigo-700' },
  Counselling: { label: 'Counselling', badge: 'bg-teal-100 text-teal-800', card: 'bg-teal-50/70', border: 'border-teal-200', dot: 'bg-teal-500', clock: 'text-teal-700' },
};

const DEFAULT_THEME: DeptTheme = { label: 'Other', badge: 'bg-slate-100 text-slate-800', card: 'bg-slate-50/70', border: 'border-slate-200', dot: 'bg-slate-500', clock: 'text-slate-700' };

function deptTheme(dept: string): DeptTheme {
  return DEPT_THEMES[dept] ?? DEFAULT_THEME;
}

const DEPT_ORDER = [...DEPARTMENTS];

function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'Running...';
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatHMS(startDate: Date, nowMs: number): string {
  const elapsedMs = Math.max(0, nowMs - startDate.getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatStartClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function downloadCsv(entries: TimeEntry[]) {
  const headers = [
    'ID',
    'Email',
    'Department',
    'Session Code',
    'Start Time (UTC)',
    'Stop Time (UTC)',
    'Duration (minutes)',
    'Feedback',
  ];
  const escape = (val: string | number | null) => {
    if (val === null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const rows = entries.map((e) =>
    [
      e.id,
      e.user_email,
      e.department,
      e.task_code,
      e.start_time,
      e.stop_time ?? '',
      e.duration_minutes ?? '',
      e.feedback ?? '',
    ]
      .map(escape)
      .join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nsp_time_entries_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function App() {
  const [email, setEmail] = useState(
    () => localStorage.getItem(EMAIL_KEY) ?? ''
  );
  const [department, setDepartment] = useState(
    () => localStorage.getItem(DEPT_KEY) ?? ''
  );
  const [taskCode, setTaskCode] = useState('');
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeTimers, setActiveTimers] = useState<TimeEntry[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [codeSearch, setCodeSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stoppingId, setStoppingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [exporting, setExporting] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [screen, setScreen] = useState<'tracker' | 'login' | 'registry'>(() => {
    return localStorage.getItem(SESSION_KEY) === 'registry' ? 'registry' : 'tracker';
  });
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [valuationFeedback, setValuationFeedback] = useState<Record<number, FeedbackValue | ''>>({});

  const emailRef = useRef<HTMLInputElement>(null);

  // Persist email + department
  useEffect(() => {
    if (email) localStorage.setItem(EMAIL_KEY, email);
  }, [email]);
  useEffect(() => {
    if (department) localStorage.setItem(DEPT_KEY, department);
  }, [department]);

  // Single interval for all active timers — runs while any timer is active
  useEffect(() => {
    if (activeTimers.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeTimers.length]);

  const fetchCandidates = useCallback(async () => {
    const { data } = await supabase
      .from('candidates')
      .select('*')
      .order('code', { ascending: true });
    setCandidates((data ?? []) as Candidate[]);
  }, []);

  const fetchEntries = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('time_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (err) {
      setError('Failed to load session logs.');
      return;
    }
    const rows = (data ?? []) as TimeEntry[];
    setEntries(rows);
    const running = rows.filter((e) => e.stop_time === null);
    setActiveTimers(running);
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchCandidates();
    fetchEntries().finally(() => setLoading(false));
  }, [fetchEntries, fetchCandidates]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('time_entries_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'time_entries' },
        () => {
          fetchEntries();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'candidates' },
        () => {
          fetchCandidates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEntries, fetchCandidates]);

  const nameValid = useMemo(
    () => email.trim().length >= 2,
    [email]
  );
  const canStart =
    nameValid &&
    department.trim() !== '' &&
    taskCode.trim() !== '' &&
    !submitting;

  const filteredCandidates = useMemo(() => {
    const q = codeSearch.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [candidates, codeSearch]);

  const activeCodes = useMemo(() => new Set(activeTimers.map((t) => t.task_code)), [activeTimers]);

  const activeTimersForDept = useMemo(
    () => activeTimers.filter((t) => t.department === department),
    [activeTimers, department]
  );

  const timersByDept = useMemo(() => {
    const groups = new Map<string, TimeEntry[]>();
    for (const timer of activeTimersForDept) {
      const list = groups.get(timer.department) ?? [];
      list.push(timer);
      groups.set(timer.department, list);
    }
    return [...groups.entries()].sort((a, b) => {
      const ai = DEPT_ORDER.indexOf(a[0]);
      const bi = DEPT_ORDER.indexOf(b[0]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [activeTimersForDept]);

  const handleStart = async () => {
    setError(null);
    if (!nameValid) {
      setError('Please enter a valid name.');
      emailRef.current?.focus();
      return;
    }
    if (!department.trim()) {
      setError('Please select a department.');
      return;
    }
    if (!taskCode.trim()) {
      setError('Please select a candidate name.');
      return;
    }

    const existingTimer = activeTimers.find((t) => t.task_code === taskCode.trim());
    if (existingTimer) {
      setWarningMessage(`This candidate's timer is already running in ${existingTimer.department} department`);
      setShowWarning(true);
      return;
    }

    setSubmitting(true);
    const { data, error: err } = await supabase
      .from('time_entries')
      .insert({
        user_email: email.trim(),
        department: department.trim(),
        task_code: taskCode.trim(),
        start_time: new Date().toISOString(),
      })
      .select()
      .single();

    setSubmitting(false);
    if (err) {
      setError('Failed to start timer. Please try again.');
      return;
    }
    const row = data as TimeEntry;
    setActiveTimers((prev) => [...prev, row]);
    setEntries((prev) => [row, ...prev]);
    setTaskCode('');
  };

  const handleStop = async (id: number) => {
    setError(null);
    const timer = activeTimers.find((t) => t.id === id);
    if (!timer) {
      return;
    }

    if (timer.department === 'Valuation' || timer.department === 'Technical Interview' || timer.department === 'Below-cutoff') {
      const feedback = valuationFeedback[id];
      if (!feedback) {
        setError('Please select a feedback option before stopping the timer.');
        return;
      }
    }

    setStoppingId(id);

    const stopTime = new Date();
    const durationMinutes = Math.max(
      0,
      Math.round(
        (stopTime.getTime() - new Date(timer.start_time).getTime()) / 60000
      )
    );

    const updatePayload: Record<string, unknown> = {
      stop_time: stopTime.toISOString(),
      duration_minutes: durationMinutes,
    };

    if (timer.department === 'Valuation' || timer.department === 'Technical Interview' || timer.department === 'Below-cutoff') {
      updatePayload.feedback = valuationFeedback[id];
    }

    const { data, error: err } = await supabase
      .from('time_entries')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    setStoppingId(null);
    if (err) {
      setError('Failed to stop timer. Please try again.');
      return;
    }
    const updated = data as TimeEntry;
    setActiveTimers((prev) => prev.filter((t) => t.id !== id));
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setValuationFeedback((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleClearLogs = async () => {
    setClearing(true);
    const { error: err } = await supabase
      .from('time_entries')
      .delete()
      .neq('id', 0);
    setClearing(false);
    setShowClearModal(false);
    if (err) {
      setError('Failed to clear logs. Please try again.');
      return;
    }
    setEntries([]);
    setActiveTimers([]);
    setTaskCode('');
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('time_entries')
      .select('*')
      .order('created_at', { ascending: false });

    setExporting(false);
    if (err) {
      setError('Failed to export data.');
      return;
    }
    downloadCsv((data ?? []) as TimeEntry[]);
  };

  const completedEntries = useMemo(
    () => entries.filter((e) => e.stop_time !== null),
    [entries]
  );



  if (screen === 'login') {
    return <LoginPage onBack={() => setScreen('tracker')} onSuccess={() => {
      localStorage.setItem(SESSION_KEY, 'registry');
      setScreen('registry');
    }} />;
  }

  if (screen === 'registry') {
    return <CandidateRegistry onBack={() => setScreen('tracker')} onLogout={() => {
      localStorage.removeItem(SESSION_KEY);
      setScreen('login');
    }} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-sm">
              <Timer className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight text-slate-900 sm:text-lg">
                NS Job Fair
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                Multi-department concurrent session tracking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScreen('login')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 active:scale-[0.98]"
            >
              <LogIn className="h-4 w-4" />
              Login
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left column: controls + active timers */}
          <section className="lg:col-span-2">
            <div className="space-y-6">
              {/* Controls panel */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  <Activity className="h-4 w-4" />
                  Start New Timer
                </h2>
                <p className="mb-5 text-sm text-slate-500">
                  Fill in the details and start a new concurrent timer.
                </p>

                {/* Email */}
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Name Field
                </label>
                <div className="relative mb-4">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={emailRef}
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    placeholder="Enter name"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                {/* Department */}
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Department
                </label>
                <div className="relative mb-4">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={submitting}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm text-slate-900 transition focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Select a department...</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Candidate Name — linked to Candidate Registry */}
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">
                    Candidate Name
                  </label>
                  {taskCode && (
                    <button
                      type="button"
                      onClick={() => setTaskCode('')}
                      className="text-xs font-medium text-slate-400 transition hover:text-slate-600"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
                {taskCode && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                    <User className="h-4 w-4 text-sky-600" />
                    <span className="text-sm font-bold text-sky-700">
                      {(() => {
                        const c = candidates.find((c) => c.code === taskCode);
                        return c ? c.name : taskCode;
                      })()}
                    </span>
                    {(() => {
                      const c = candidates.find((c) => c.code === taskCode);
                      return c ? <span className="truncate text-xs text-slate-500">· {c.code} · {c.domain}</span> : null;
                    })()}
                  </div>
                )}
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={codeSearch}
                    onChange={(e) => setCodeSearch(e.target.value)}
                    placeholder="Search name or code..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </div>
                <div className="mb-6 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-1.5">
                  {candidates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <BookUser className="mb-2 h-6 w-6 text-slate-300" />
                      <p className="text-xs text-slate-400">No candidates registered yet.</p>
                      <p className="text-xs text-slate-400">Add them in the Candidate Registry.</p>
                    </div>
                  ) : filteredCandidates.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">No matching candidates.</div>
                  ) : (
                    <div className="space-y-1">
                      {filteredCandidates.map((c) => {
                        const selected = c.code === taskCode;
                        const isActive = activeCodes.has(c.code);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setTaskCode(c.code)}
                            className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
                              selected
                                ? 'border-sky-500 bg-sky-500 text-white shadow-sm'
                                : isActive
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-400'
                                : c.category === 'Fresher'
                                ? 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                                : 'border-amber-200 bg-amber-50/60 text-amber-800 hover:border-amber-300 hover:bg-amber-50'
                            }`}
                          >
                            <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${selected ? 'bg-white/20 text-white' : isActive ? 'bg-emerald-100 text-emerald-600' : c.category === 'Fresher' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-600'}`}>
                              {c.code.slice(0, 3)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold leading-tight">{c.name}</div>
                              <div className={`truncate text-xs leading-tight ${selected ? 'text-white/70' : 'text-slate-400'}`}>
                                {c.code} · {c.domain}
                              </div>
                            </div>
                            {isActive && !selected && (
                              <span className="flex-shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-medium text-white">Active</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Start button */}
                <button
                  onClick={handleStart}
                  disabled={!canStart}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5" fill="currentColor" />
                  )}
                  Start Timer
                </button>
              </div>

              {/* Active Timers queue — filtered to selected department */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    <Layers className="h-4 w-4" />
                    Active Timers
                    {department && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                        {deptTheme(department).label}
                      </span>
                    )}
                  </h2>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    {activeTimersForDept.length} active
                  </span>
                </div>

                {!department ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                      <Building2 className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600">
                      Select a department
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Active timers for the selected department appear here.
                    </p>
                  </div>
                ) : activeTimersForDept.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                      <Layers className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600">
                      No active timers for {deptTheme(department).label}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Start a timer above to see it here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 p-4">
                    {timersByDept.map(([dept, timers]) => {
                      const theme = deptTheme(dept);
                      return (
                        <div key={dept} className={`rounded-2xl border ${theme.border} ${theme.card} p-3`}>
                          <div className="mb-2.5 flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
                              <span className="text-sm font-semibold text-slate-800">{theme.label}</span>
                            </div>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${theme.badge}`}>
                              {timers.length} {timers.length === 1 ? 'timer' : 'timers'}
                            </span>
                          </div>
                          <div className="space-y-2.5">
                            {timers.map((t) => {
                              const candidate = candidates.find((c) => c.code === t.task_code);
                              const needsFeedback = t.department === 'Valuation' || t.department === 'Technical Interview' || t.department === 'Below-cutoff';
                              const feedbackSelected = valuationFeedback[t.id];
                              const stopDisabled = stoppingId === t.id || (needsFeedback && !feedbackSelected);
                              return (
                                <div
                                  key={t.id}
                                  className="rounded-xl border border-white/60 bg-white/80 p-3.5 shadow-sm transition hover:border-white"
                                >
                                  <div className="mb-2 flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                                        <span className="truncate text-sm font-semibold text-slate-800">
                                          {candidate ? candidate.name : t.task_code}
                                        </span>
                                      </div>
                                      {candidate && (
                                        <span className="mt-0.5 block truncate text-xs text-slate-400">
                                          {candidate.code} · {candidate.domain}
                                        </span>
                                      )}
                                    </div>
                                    {needsFeedback && (
                                      <div className="flex-shrink-0">
                                        <div className="relative">
                                          <select
                                            value={valuationFeedback[t.id] ?? ''}
                                            onChange={(e) => setValuationFeedback((prev) => ({ ...prev, [t.id]: e.target.value as FeedbackValue | '' }))}
                                            disabled={stoppingId === t.id}
                                            className={`appearance-none rounded-lg border px-2.5 py-1.5 pr-7 text-xs font-medium outline-none transition focus:ring-2 ${
                                              feedbackSelected
                                                ? 'border-amber-400 bg-amber-50 text-amber-800 focus:ring-amber-100'
                                                : 'border-red-300 bg-red-50 text-red-700 focus:ring-red-100'
                                            }`}
                                          >
                                            <option value="">Select feedback *</option>
                                            {t.department === 'Valuation' ? (
                                              <>
                                                <option value="Below 70%">Below 70%</option>
                                                <option value="Above 70%">Above 70%</option>
                                              </>
                                            ) : (
                                              <>
                                                <option value="Teaching Interested">Teaching Interested</option>
                                                <option value="Course Interested">Course Interested</option>
                                                <option value="Both">Both</option>
                                                <option value="N/A">N/A</option>
                                              </>
                                            )}
                                          </select>
                                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                        </div>
                                      </div>
                                    )}
                                    <button
                                      onClick={() => handleStop(t.id)}
                                      disabled={stopDisabled}
                                      className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition active:scale-[0.98] ${
                                        stopDisabled && !stoppingId
                                          ? 'cursor-not-allowed bg-slate-300'
                                          : 'bg-red-500 hover:bg-red-600'
                                      } disabled:opacity-50`}
                                    >
                                      {stoppingId === t.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Square className="h-3.5 w-3.5" fill="currentColor" />
                                      )}
                                      Stop
                                    </button>
                                  </div>
                                  {needsFeedback && !feedbackSelected && (
                                    <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600">
                                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                      <span>Feedback required before stopping.</span>
                                    </div>
                                  )}
                                  <div className="flex items-end justify-between gap-2 border-t border-slate-100 pt-2.5">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                      <Clock className="h-3.5 w-3.5" />
                                      <span>Started at {formatStartClock(t.start_time)}</span>
                                    </div>
                                    <div className={`font-mono text-xl font-bold tabular-nums ${theme.clock}`}>
                                      {formatHMS(new Date(t.start_time), now)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Right column: timesheet history */}
          <section className="lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  <Clock className="h-4 w-4" />
                  Timesheet History
                </h2>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {completedEntries.length}{' '}
                    {completedEntries.length === 1 ? 'entry' : 'entries'}
                  </span>
                  <button
                    onClick={() => setShowClearModal(true)}
                    disabled={entries.length === 0 || clearing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-50 hover:border-red-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Clear Logs</span>
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <Clock className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">
                    No sessions logged yet
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Start and stop a timer to see it appear here.
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50 text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-5 py-3 font-semibold">Email</th>
                          <th className="px-5 py-3 font-semibold">Candidate Name</th>
                          <th className="px-5 py-3 font-semibold">Feedback</th>
                          <th className="px-5 py-3 text-right font-semibold">
                            Duration
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {entries.map((e) => {
                          const running = e.stop_time === null;
                          return (
                            <tr
                              key={e.id}
                              className="transition hover:bg-slate-50/60"
                            >
                              <td className="px-5 py-3">
                                <div className="font-medium text-slate-800">
                                  {e.user_email}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {e.department}
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                  {(() => {
                                    const c = candidates.find((c) => c.code === e.task_code);
                                    return c ? c.name : e.task_code;
                                  })()}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                {e.feedback && (
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                    e.feedback === 'Below 70%' || e.feedback === 'Above 70%'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-sky-50 text-sky-700'
                                  }`}>
                                    {e.feedback}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-right">
                                {running ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                                    Running...
                                  </span>
                                ) : (
                                  <span className="font-mono font-medium tabular-nums text-slate-700">
                                    {formatDuration(e.duration_minutes)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="divide-y divide-slate-50 sm:hidden">
                    {entries.map((e) => {
                      const running = e.stop_time === null;
                      return (
                        <div key={e.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-slate-800">
                                {e.user_email}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-400">
                                {e.department}
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              {running ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                                  Running...
                                </span>
                              ) : (
                                <span className="font-mono text-sm font-medium tabular-nums text-slate-700">
                                  {formatDuration(e.duration_minutes)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-1.5">
                            <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                              {(() => {
                                const c = candidates.find((c) => c.code === e.task_code);
                                return c ? c.name : e.task_code;
                              })()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Clear confirmation modal */}
      {showClearModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
          onClick={() => !clearing && setShowClearModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <button
                onClick={() => !clearing && setShowClearModal(false)}
                className="text-slate-400 transition hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="mb-1 text-base font-semibold text-slate-900">
              Clear all logs?
            </h3>
            <p className="mb-5 text-sm text-slate-500">
              This will permanently delete all {entries.length} session{' '}
              {entries.length === 1 ? 'entry' : 'entries'}, including any active
              timers. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearLogs}
                disabled={clearing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-500/20 transition hover:bg-red-600 active:scale-[0.98] disabled:opacity-50"
              >
                {clearing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate timer warning modal */}
      {showWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
          onClick={() => setShowWarning(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <button
                onClick={() => setShowWarning(false)}
                className="text-slate-400 transition hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="mb-1 text-base font-semibold text-slate-900">
              Timer Already Running
            </h3>
            <p className="mb-5 text-sm text-slate-500">
              {warningMessage}
            </p>
            <button
              onClick={() => setShowWarning(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-500/20 transition hover:bg-amber-600 active:scale-[0.98]"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        NS Job Fair · Sessions recorded in UTC
      </footer>

      {/* Floating Refresh Button */}
      <button
        onClick={() => window.location.reload()}
        aria-label="Refresh page"
        className="fixed bottom-20 right-6 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-700 hover:shadow-xl active:scale-90 sm:bottom-20"
      >
        <RefreshCw className="h-5 w-5" />
      </button>
    </div>
  );
}
