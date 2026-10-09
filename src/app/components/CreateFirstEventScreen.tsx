import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { EventInfo, createEventRequest, setEventActiveRequest, setCurrentEventRequest } from '../lib/db';
import { CustomSelect } from './CustomSelect';
import { formatFinancialYear } from './EventSwitcher';
import { RequiredMark } from './RequiredMark';

const EVENT_EMOJIS = ['🪔', '🕉️', '🙏', '🎉', '🌸', '💥', '🐘', '🎆', '⛩️', '🔱', '🌺', '🪘'];
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - i);

// Hard landing-page gate — mirrors how App.tsx already gates the whole app
// behind `!user` for the Login screen. A tenant admin cannot reach any other
// page until they create their first Puja/Festival; enforced at the DB too
// (current_event_id() returns null -> every write to the 7 scoped tables is
// denied by RLS regardless of what the frontend blocks).
export function CreateFirstEventScreen({
  isAdmin, currentUserId, onCreated, onLogout, pickableEvents, onPicked,
}: {
  isAdmin: boolean;
  currentUserId: string;
  onCreated: (event: EventInfo) => void;
  onLogout: () => void;
  // When the tenant already has one or more active festivals but THIS user
  // has no current selection yet (first login, or their previous selection
  // was just deactivated) — show a simple pick list instead of the
  // create-a-brand-new-festival form. Every role sees this, not just admins.
  pickableEvents?: EventInfo[];
  onPicked?: (eventId: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState(currentYear);
  const [emoji, setEmoji] = useState<string | null>('🪔');
  const [openingCash, setOpeningCash] = useState('0');
  const [openingBank, setOpeningBank] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (pickableEvents && pickableEvents.length > 0 && onPicked) {
    const handlePick = async (eventId: string) => {
      setPicking(true);
      setPickError('');
      try {
        await setCurrentEventRequest(eventId);
        onPicked(eventId);
      } catch (err: any) {
        console.error('Failed to pick festival', err);
        setPickError(err?.message || 'Could not switch to that festival. Please try again.');
      } finally {
        setPicking(false);
      }
    };
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-md p-8 border border-gray-200 dark:border-gray-800">
          <div className="w-14 h-14 mx-auto rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4 text-2xl">🪔</div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 text-center">Pick your festival</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
            Your committee has {pickableEvents.length > 1 ? 'multiple festivals' : 'a festival'} active right now — choose which one you're working in.
          </p>
          <div className="space-y-2">
            {pickableEvents.map(event => (
              <button
                key={event.id}
                disabled={picking}
                onClick={() => handlePick(event.id)}
                className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors text-left disabled:opacity-50"
              >
                <span className="w-9 h-9 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-base shrink-0">{event.emoji || '🪔'}</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{event.name} — {formatFinancialYear(event.year)}</span>
              </button>
            ))}
          </div>
          {pickError && <p className="text-xs text-red-600 mt-3">{pickError}</p>}
          <button
            onClick={onLogout}
            className="w-full mt-6 px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium transition"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white dark:bg-gray-900 rounded-xl shadow-md p-8 border border-orange-200 dark:border-orange-500/30">
          <div className="w-14 h-14 mx-auto rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4 text-2xl">🪔</div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Waiting for your admin</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Your committee hasn't set up this year's 'Puja, Festival or Event' yet. Ask your admin to create one — you'll get access as soon as it's ready.
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
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const event = await createEventRequest(
        name.trim(), year, emoji, currentUserId,
        parseFloat(openingCash) || 0, parseFloat(openingBank) || 0,
      );
      // Creating an event doesn't itself mark it active or select it for
      // this user — without both, this screen would reappear next reload
      // even though an event already exists.
      await setEventActiveRequest(event.id, true);
      await setCurrentEventRequest(event.id);
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
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 text-center">Add 'Puja, Festival or Event'</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
          Create your first 'Puja, Festival or Event' before adding any data — Chanda, Expenses, Donations, and everything else stay scoped to it.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Name<RequiredMark /></label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Durga Puja"
              autoFocus
              className="w-full mt-1 px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Financial Year<RequiredMark /></label>
            <CustomSelect
              value={String(year)}
              onChange={v => setYear(Number(v))}
              options={YEAR_OPTIONS.map(y => ({ value: String(y), label: formatFinancialYear(y) }))}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Cash in Hand (₹)</label>
              <input
                type="number"
                min="0"
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Money in Bank (₹)</label>
              <input
                type="number"
                min="0"
                value={openingBank}
                onChange={e => setOpeningBank(e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg outline-none focus:border-orange-500"
              />
            </div>
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
