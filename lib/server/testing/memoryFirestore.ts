/**
 * An in-memory stand-in for the Firestore calls the render pipeline makes (doc get/set/update, collection
 * docs with generated ids, transactions, batches) and FieldValue's increment/delete/serverTimestamp. Tests
 * only: one shared instance per test file, wired in with vi.mock (see lib/server/render-image.test.ts).
 */
export type Doc = Record<string, unknown>;
export const store = new Map<string, Doc>();
const isInc = (v: unknown): v is { __inc: number } => typeof v === "object" && v !== null && "__inc" in v;
const apply = (path: string, patch: Doc, merge: boolean) => {
  const cur = merge ? { ...(store.get(path) ?? {}) } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === "object" && v !== null && "__del" in v) delete cur[k];
    else cur[k] = isInc(v) ? Number(cur[k] ?? 0) + v.__inc : v;
  }
  store.set(path, cur);
};
let auto = 0;
/** A fresh id, as Firestore's add() would make. */
export const nextId = () => `auto${++auto}`;
const ref = (path: string): Ref => ({
  path,
  id: path.split("/").pop()!,
  collection: (c: string) => col(`${path}/${c}`),
  get: async () => snap(path),
  set: async (d: Doc, o?: { merge?: boolean }) => apply(path, d, !!o?.merge),
  update: async (d: Doc) => apply(path, d, true),
});
type Ref = { path: string; id: string; collection: (c: string) => ReturnType<typeof col>; get: () => Promise<ReturnType<typeof snap>>; set: (d: Doc, o?: { merge?: boolean }) => Promise<void>; update: (d: Doc) => Promise<void> };
const col = (path: string) => ({ doc: (id?: string) => ref(`${path}/${id ?? nextId()}`) });
const snap = (path: string) => ({ exists: store.has(path), id: path.split("/").pop(), data: () => store.get(path) });
export const fakeDb = {
  collection: col,
  runTransaction: async <T,>(f: (tx: unknown) => Promise<T>) => {
    const ops: (() => void)[] = [];
    const tx = {
      get: async (r: Ref) => snap(r.path),
      update: (r: Ref, d: Doc) => void ops.push(() => apply(r.path, d, true)),
      set: (r: Ref, d: Doc, o?: { merge?: boolean }) => void ops.push(() => apply(r.path, d, !!o?.merge)),
      create: (r: Ref, d: Doc) =>
        void ops.push(() => {
          if (store.has(r.path)) throw new Error(`already exists: ${r.path}`);
          apply(r.path, d, false);
        }),
    };
    const out = await f(tx);
    ops.forEach((o) => o());
    return out;
  },
  batch: () => {
    const ops: (() => void)[] = [];
    return {
      create: (r: Ref, d: Doc) => void ops.push(() => apply(r.path, d, false)),
      set: (r: Ref, d: Doc, o?: { merge?: boolean }) => void ops.push(() => apply(r.path, d, !!o?.merge)),
      commit: async () => ops.forEach((o) => o()),
    };
  },
};

export const fieldValue = { increment: (n: number) => ({ __inc: n }), delete: () => ({ __del: true }), serverTimestamp: () => Date.now() };
