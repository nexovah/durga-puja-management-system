import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { EventInfo, createEventRequest } from '../lib/db';

const EVENT_EMOJIS = ['🪔', '🕉️', '🙏', '🎉', '🌸', '💥', '🐘', '🎆', '⛩️', '🔱', '🌺', '🪘'];

// Hard landing-page gate — mirrors how App.tsx already gates the whole app
// behind `!user` for the Login screen. A tenant admin cannot reach any other
// page until they create their first Puja/Festival; enforced at the DB too
// (current_event_id() returns null -> every write to the 7 scoped tables is
// denied by RLS regardless of what the frontend blocks).
export function CreateFirstEventScreen({
  isAdmin, currentUserId, onCreated, onLogout,
}: {
  isAdmin: boolean;
  currentUserId: string;
  onCreated: (event: EventInfo) => void;
  onLogout: () => void;
}) {
  const [name, setName] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [emoji, setEmoji] = useState<string | null>('🪔');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white dark:bg-gray-900 rounded-xl shadow-md p-8 border border-orange-200 dark:border-orange-500/30">
          <div className="w-14 h-14 mx-auto rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4 text-2xl">🪔</div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Waiting for your admin</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Your committee hasn't set up this year's Puja / Festival yet. Ask your admin to create one — you'll get access as soon as it's ready.
          </p>
          <button
            onClick={onLogout}
            className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition"
          >
            <span className="inline-flex items-center gap-2"><LogOut size={16} /> Log out</span>
          </button>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!name.trim() || !year.trim()) {
      setError('Name and year are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const event = await createEventRequest(name.trim(), Number(year), emoji, currentUserId);
      onCreated(event);
    } catch (err: any) {
      console.error('Failed to create first event', err);
      setError(err?.message || 'Could not create the event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-md p-8 border border-gray-200 dark:border-gray-800">
        <div className="w-14 h-14 mx-auto rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4 text-2xl">
          {emoji || '🪔'}
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 text-center">Puja / Festival to Manage CRM</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
          Create your first Puja or Festival before adding any data — Chanda, Expenses, Donations, and everything else stay scoped to it.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Durga Puja"
              autoFocus
              className="w-full mt-1 px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Year *</label>
            <input
              value={year}
              onChange={e => setYear(e.target.value.replace(/\D/g, ''))}
              placeholder="2026"
              maxLength={4}
              className="w-full mt-1 px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Emoji (optional)</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {EVENT_EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setEmoji(emoji === e ? null : e)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-base border transition-colors ${
                    emoji === e ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <button
          onClick={handleCreate}
          disabled={saving}
          className="w-full mt-6 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Creating…' : 'Create & Start Managing'}
        </button>
        <button
          onClick={onLogout}
          className="w-full mt-2 px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium transition"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
