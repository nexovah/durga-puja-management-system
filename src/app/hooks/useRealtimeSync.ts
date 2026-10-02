import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

// Keeps a local list in sync with a single Postgres table over one
// Realtime channel, merging each change in place — never refetches the
// whole table. RLS (current_tenant_id()/current_event_id(), same as every
// REST call) already scopes which rows this client receives, since the
// socket is authorized with the same tenant JWT via
// supabase.realtime.setAuth() (see supabaseClient.ts's
// setTenantAccessToken). Call once per table; supabase-js multiplexes
// every channel over one shared websocket connection, so this stays cheap
// no matter how many tables call it.
export function useRealtimeSync<T extends { id: string }>(
  enabled: boolean,
  table: string,
  setList: (updater: (prev: T[]) => T[]) => void,
  fromRow: (row: any) => T,
) {
  // Keep the latest fromRow/setList without re-subscribing every render —
  // only `enabled`/`table` identity should tear down and rebuild the channel.
  const fromRowRef = useRef(fromRow);
  fromRowRef.current = fromRow;
  const setListRef = useRef(setList);
  setListRef.current = setList;

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`sync:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (!oldId) return;
            setListRef.current(prev => prev.filter(r => r.id !== oldId));
            return;
          }
          const row = fromRowRef.current(payload.new);
          setListRef.current(prev => {
            const i = prev.findIndex(r => r.id === row.id);
            if (i === -1) return [row, ...prev];
            const next = prev.slice();
            next[i] = row;
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, table]);
}
