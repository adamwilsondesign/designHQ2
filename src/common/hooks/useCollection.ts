import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, QueryConstraint } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface LiveResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

// Live Firestore collection. `path` may be null to skip (e.g. no user yet).
// `constraintsKey` must change whenever `constraints` does.
export function useCollection<T extends { id: string }>(
  path: string | null,
  constraints: QueryConstraint[] = [],
  constraintsKey = '',
): LiveResult<T[]> {
  const [state, setState] = useState<LiveResult<T[]>>({ data: [], loading: !!path, error: null });

  useEffect(() => {
    if (!path) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    return onSnapshot(
      query(collection(db, path), ...constraints),
      snap => setState({ data: snap.docs.map(d => ({ id: d.id, ...d.data() }) as T), loading: false, error: null }),
      err => setState({ data: [], loading: false, error: err.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, constraintsKey]);

  return state;
}

// Live single document; data is null when it does not exist.
export function useDocument<T>(path: string | null): LiveResult<(T & { id: string }) | null> {
  const [state, setState] = useState<LiveResult<(T & { id: string }) | null>>({ data: null, loading: !!path, error: null });

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    return onSnapshot(
      doc(db, path),
      snap => setState({ data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T & { id: string }) : null, loading: false, error: null }),
      err => setState({ data: null, loading: false, error: err.message }),
    );
  }, [path]);

  return state;
}
