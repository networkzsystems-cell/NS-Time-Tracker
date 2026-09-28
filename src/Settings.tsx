import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  KeyRound,
  Loader as Loader2,
  Pencil,
  Plus,
  Save,
  Settings as SettingsIcon,
  Trash2,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { supabase, type AppSettings, type Domain } from '@/lib/supabase';

type SettingsProps = {
  onClose: () => void;
  onDomainsChanged: () => void;
};

type Tab = 'domains' | 'credentials';

export default function Settings({ onClose, onDomainsChanged }: SettingsProps) {
  const [tab, setTab] = useState<Tab>('domains');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingEditId, setSavingEditId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [domainError, setDomainError] = useState('');

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [savingCreds, setSavingCreds] = useState(false);
  const [credError, setCredError] = useState('');
  const [credSuccess, setCredSuccess] = useState(false);

  const fetchDomains = useCallback(async () => {
    const { data, error } = await supabase
      .from('domains')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setDomainError('Could not load domains.');
      return;
    }
    setDomains((data ?? []) as Domain[]);
    setDomainError('');
  }, []);

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      setCredError('Could not load settings.');
      return;
    }
    const s = data as AppSettings;
    setSettings(s);
    setUsername(s.username);
    setPassword(s.password);
    setCredError('');
  }, []);

  useEffect(() => {
    setLoadingDomains(true);
    fetchDomains().finally(() => setLoadingDomains(false));
  }, [fetchDomains]);

  useEffect(() => {
    setLoadingCreds(true);
    fetchSettings().finally(() => setLoadingCreds(false));
  }, [fetchSettings]);

  const handleAddDomain = async () => {
    const name = newDomain.trim();
    if (!name) return;
    setAddingDomain(true);
    setDomainError('');

    const { data, error } = await supabase
      .from('domains')
      .insert({ name })
      .select()
      .maybeSingle();

    setAddingDomain(false);
    if (error || !data) {
      setDomainError('Could not add domain. The name may already exist.');
      return;
    }
    setDomains((current) => [...current, data as Domain].sort((a, b) => a.name.localeCompare(b.name)));
    setNewDomain('');
    onDomainsChanged();
  };

  const handleStartEdit = (domain: Domain) => {
    setEditingId(domain.id);
    setEditValue(domain.name);
    setDomainError('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
    setDomainError('');
  };

  const handleSaveEdit = async (id: number) => {
    const name = editValue.trim();
    if (!name) return;
    setSavingEditId(id);
    setDomainError('');

    const { data, error } = await supabase
      .from('domains')
      .update({ name })
      .eq('id', id)
      .select()
      .maybeSingle();

    setSavingEditId(null);
    if (error || !data) {
      setDomainError('Could not update domain. The name may already exist.');
      return;
    }
    setDomains((current) =>
      [...current.map((d) => (d.id === id ? (data as Domain) : d))].sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditingId(null);
    setEditValue('');
    onDomainsChanged();
  };

  const handleDeleteDomain = async (id: number) => {
    setDeletingId(id);
    setDomainError('');

    const { error } = await supabase.from('domains').delete().eq('id', id);

    setDeletingId(null);
    if (error) {
      setDomainError('Could not remove this domain. It may be in use by existing candidates.');
      return;
    }
    setDomains((current) => current.filter((d) => d.id !== id));
    onDomainsChanged();
  };

  const handleSaveCredentials = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password.trim()) {
      setCredError('Username and password cannot be empty.');
      return;
    }
    setSavingCreds(true);
    setCredError('');
    setCredSuccess(false);

    const { error } = await supabase
      .from('app_settings')
      .update({ username: trimmedUsername, password: password.trim(), updated_at: new Date().toISOString() })
      .eq('id', 1);

    setSavingCreds(false);
    if (error) {
      setCredError('Could not update credentials.');
      return;
    }
    setCredSuccess(true);
    setTimeout(() => setCredSuccess(false), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 shadow-sm">
              <SettingsIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Settings</h2>
              <p className="text-xs text-slate-500">Manage domains and login credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-100 px-4 pt-3">
          <button
            onClick={() => setTab('domains')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === 'domains'
                ? 'bg-sky-50 text-sky-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            Domains
          </button>
          <button
            onClick={() => setTab('credentials')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === 'credentials'
                ? 'bg-sky-50 text-sky-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            Login credentials
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5">
          {tab === 'domains' && (
            <div className="space-y-5">
              {domainError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {domainError}
                </div>
              )}

              {/* Add new domain */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Add a new domain</label>
                <div className="flex gap-2">
                  <input
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDomain();
                      }
                    }}
                    placeholder="e.g. Data Science"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  />
                  <button
                    onClick={handleAddDomain}
                    disabled={addingDomain || !newDomain.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addingDomain ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </button>
                </div>
              </div>

              {/* Domain list */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-700">Existing domains</h3>
                {loadingDomains ? (
                  <div className="flex items-center justify-center py-8 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : domains.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                    No domains yet. Add one above.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {domains.map((domain) => (
                      <li key={domain.id} className="flex items-center gap-2 px-4 py-3">
                        {editingId === domain.id ? (
                          <>
                            <input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEdit(domain.id);
                                }
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              autoFocus
                              className="flex-1 rounded-lg border border-sky-300 bg-sky-50/50 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-100"
                            />
                            <button
                              onClick={() => handleSaveEdit(domain.id)}
                              disabled={savingEditId === domain.id || !editValue.trim()}
                              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 p-1.5 text-white transition hover:bg-emerald-600 disabled:opacity-50"
                            >
                              {savingEditId === domain.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="inline-flex items-center justify-center rounded-lg bg-slate-100 p-1.5 text-slate-500 transition hover:bg-slate-200"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm font-medium text-slate-800">{domain.name}</span>
                            <button
                              onClick={() => handleStartEdit(domain)}
                              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-sky-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDomain(domain.id)}
                              disabled={deletingId === domain.id}
                              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              {deletingId === domain.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === 'credentials' && (
            <div className="space-y-5">
              {credError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {credError}
                </div>
              )}
              {credSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Credentials updated successfully.
                </div>
              )}

              {loadingCreds ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="settings-username">
                      Username
                    </label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="settings-username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="settings-password">
                      Password
                    </label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="settings-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveCredentials}
                    disabled={savingCreds}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingCreds ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Update credentials
                  </button>

                  {settings && (
                    <p className="text-xs text-slate-400">
                      Last updated {new Date(settings.updated_at).toLocaleString()}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
