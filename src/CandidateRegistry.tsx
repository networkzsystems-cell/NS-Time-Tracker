import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, BookUser, Download, Loader as Loader2, LogOut, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { supabase, type Candidate, type CandidateDomain } from '@/lib/supabase';

async function generateCandidateCode(category: Candidate['category']): Promise<string> {
  const { data, error } = await supabase.rpc('generate_candidate_code', { p_category: category });
  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to generate candidate code');
  }
  return data as string;
}

type CandidateRegistryProps = {
  onBack: () => void;
  onLogout: () => void;
};

type CandidateForm = {
  name: string;
  mobile: string;
  place: string;
  category: Candidate['category'];
  domain: CandidateDomain;
};

const emptyForm: CandidateForm = {
  name: '',
  mobile: '',
  place: '',
  category: 'Fresher',
  domain: 'Python',
};

const DOMAINS: CandidateDomain[] = ['Python', 'Networking', '.Net', 'Digital marketing'];

function previewCode(candidates: Candidate[], category: Candidate['category']): string {
  const prefix = category === 'Fresher' ? 'F' : 'E';
  const highest = candidates.reduce((max, candidate) => {
    if (candidate.code.startsWith(prefix)) {
      const number = Number(candidate.code.slice(1));
      return Number.isFinite(number) ? Math.max(max, number) : max;
    }
    return max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

export default function CandidateRegistry({ onBack, onLogout }: CandidateRegistryProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const fetchCandidates = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError('Could not load the candidate registry.');
      return;
    }
    setCandidates((data ?? []) as Candidate[]);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchCandidates().finally(() => setLoading(false));
  }, [fetchCandidates]);

  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((candidate) =>
      [candidate.code, candidate.name, candidate.mobile, candidate.place, candidate.category, candidate.domain]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [candidates, search]);

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    let code: string;
    try {
      code = await generateCandidateCode(form.category);
    } catch {
      setSaving(false);
      setError('Could not generate a candidate code. Please try again.');
      return;
    }

    const { data, error: insertError } = await supabase
      .from('candidates')
      .insert({ ...form, code })
      .select()
      .maybeSingle();

    setSaving(false);
    if (insertError || !data) {
      setError('Could not add this candidate. Please try again.');
      return;
    }
    setCandidates((current) => [...current, data as Candidate]);
    setForm(emptyForm);
  };

  const handleDelete = async (id: number) => {
    setError('');
    setDeletingId(id);
    const { error: deleteError } = await supabase.from('candidates').delete().eq('id', id);
    setDeletingId(null);
    if (deleteError) {
      setError('Could not remove this candidate. Please try again.');
      return;
    }
    setCandidates((current) => current.filter((candidate) => candidate.id !== id));
  };

  const handleExport = () => {
    const headers = ['Code', 'Name', 'Mobile No.', 'Place', 'Category', 'Domain'];
    const rows = candidates.map((candidate) =>
      [candidate.code, candidate.name, candidate.mobile, candidate.place, candidate.category, candidate.domain]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'candidate-registry.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-sm">
              <BookUser className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight text-slate-900 sm:text-lg">Candidate Registry</h1>
              <p className="hidden text-xs text-slate-500 sm:block">Reception desk · NS Job Fair</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Tracker</span>
            </button>
            <button onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Add candidate</h2>
              <p className="mt-1 text-sm text-slate-500">A code is created automatically from the selected category.</p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Next: {previewCode(candidates, form.category)}</span>
          </div>
          <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {([
              ['name', 'Name', 'Full name'],
              ['mobile', 'Mobile no.', 'Mobile number'],
              ['place', 'Place', 'City or place'],
            ] as const).map(([key, label, placeholder]) => (
              <label key={key} className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
                <input
                  value={form[key]}
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                  placeholder={placeholder}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </label>
            ))}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Category</span>
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as Candidate['category'] }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
              >
                <option>Fresher</option>
                <option>Experienced</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Domain</span>
              <select
                value={form.domain}
                onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value as CandidateDomain }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 self-end rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add candidate
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Candidate codes</h2>
              <p className="mt-1 text-sm text-slate-500">{candidates.length} registered {candidates.length === 1 ? 'candidate' : 'candidates'}</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidates" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100" />
              </div>
              <button onClick={handleExport} disabled={candidates.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50">
                <Download className="h-4 w-4" />
                Download CSV
              </button>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filteredCandidates.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">{search ? 'No matching candidates found.' : 'No candidates added yet.'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Code</th>
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Mobile no.</th>
                    <th className="px-5 py-3 font-semibold">Place</th>
                    <th className="px-5 py-3 font-semibold">Category</th>
                    <th className="px-5 py-3 font-semibold">Domain</th>
                    <th className="px-5 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCandidates.map((candidate) => (
                    <tr key={candidate.id} className="transition hover:bg-slate-50/60">
                      <td className="px-5 py-3"><span className="inline-flex rounded-lg bg-sky-50 px-2.5 py-1 font-mono text-sm font-bold text-sky-700">{candidate.code}</span></td>
                      <td className="px-5 py-3 font-medium text-slate-800">{candidate.name}</td>
                      <td className="px-5 py-3 text-slate-600">{candidate.mobile}</td>
                      <td className="px-5 py-3 text-slate-600">{candidate.place}</td>
                      <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${candidate.category === 'Fresher' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{candidate.category}</span></td>
                      <td className="px-5 py-3"><span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{candidate.domain}</span></td>
                      <td className="px-5 py-3 text-right"><button onClick={() => handleDelete(candidate.id)} disabled={deletingId === candidate.id} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

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
