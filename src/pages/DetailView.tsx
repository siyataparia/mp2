import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import styles from './DetailView.module.css';

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function stableId(b: Bean, i: number) {
  return (b.id && String(b.id).trim()) ? String(b.id) : `name-${slugify(b.name)}-${i}`;
}


function placeholder(text: string, w: number, h: number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
    <rect width='100%' height='100%' fill='#eee'/>
    <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
      font-family='system-ui, sans-serif' font-size='14' fill='#888'>${text}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type Bean = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  group?: string;
  color?: string;
};

function normalizeOne(raw: unknown): Bean {
  const r = raw as any;
  const id = String(r?.id ?? r?._id ?? r?.beanId ?? r?.Id ?? r?.ID ?? '');
  const name = String(r?.name ?? r?.flavor ?? r?.title ?? 'Unknown');
  const description = r?.description ?? r?.desc ?? r?.about ?? '';
  const imageUrl = r?.imageUrl ?? r?.image ?? r?.img ?? r?.photoUrl ?? r?.thumbnail ?? '';
  const group = r?.group ?? r?.category ?? r?.type ?? r?.family ?? '';
  const color = r?.color ?? r?.hexColor ?? r?.hex ?? '';
  return { id, name, description, imageUrl, group, color };
}

/** Try to load a single bean by id, with fallbacks */
async function fetchBeanById(id: string): Promise<Bean | null> {
  // 1) Try direct /beans/:id
  try {
    const { data } = await axios.get(
      `https://jellybellywikiapi.onrender.com/api/beans/${encodeURIComponent(id)}`,
      { timeout: 15000 }
    );
    const candidate: unknown =
      (data && (data as any).data ? (data as any).data : data) ?? null;

    if (Array.isArray(candidate)) {
      const found: unknown | undefined = (candidate as unknown[]).find((x: unknown) => {
        const r = x as any;
        const rid = String(r?.id ?? r?._id ?? r?.beanId ?? r?.Id ?? r?.ID ?? '');
        return rid === String(id);
      });
      return found ? normalizeOne(found) : null;
    }
    return candidate ? normalizeOne(candidate) : null;
  } catch {
    // 2) Fallback: fetch list from /beans and find
    try {
      const { data } = await axios.get('https://jellybellywikiapi.onrender.com/api/beans', {
        timeout: 15000,
      });
      const listA: unknown[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
      const foundA: unknown | undefined = listA.find((x: unknown) => {
        const r = x as any;
        const rid = String(r?.id ?? r?._id ?? r?.beanId ?? r?.Id ?? r?.ID ?? '');
        return rid === String(id);
      });
      if (foundA) return normalizeOne(foundA);
    } catch {
      // ignore and try flavors
    }

    // 3) Fallback: fetch from /flavors and find
    try {
      const { data } = await axios.get('https://jelly-belly-wiki.netlify.app/api/flavors', {
        timeout: 15000,
      });
      const listB: unknown[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
      const foundB: unknown | undefined = listB.find((x: unknown) => {
        const r = x as any;
        const rid = String(r?.id ?? r?._id ?? r?.beanId ?? r?.Id ?? r?.ID ?? '');
        return rid === String(id);
      });
      if (foundB) return normalizeOne(foundB);
    } catch {
      // give up
    }
    return null;
  }
}

/** Fetch only the ids list (to support Prev/Next when deep-linking) */
async function fetchAllIds(): Promise<string[]> {
  try {
    const { data } = await axios.get('https://jellybellywikiapi.onrender.com/api/beans', {
      timeout: 15000,
    });
    const listA: unknown[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
    return listA
      .map((x: unknown) => {
        const r = x as any;
        return String(r?.id ?? r?._id ?? r?.beanId ?? r?.Id ?? r?.ID ?? '');
      })
      .filter((s: string) => !!s);
  } catch {
    const { data } = await axios.get('https://jelly-belly-wiki.netlify.app/api/flavors', {
      timeout: 15000,
    });
    const listB: unknown[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
    return listB
      .map((x: unknown) => {
        const r = x as any;
        return String(r?.id ?? r?._id ?? r?.beanId ?? r?.Id ?? r?.ID ?? '');
      })
      .filter((s: string) => !!s);
  }
}

type FromSource = 'list' | 'gallery' | undefined;
interface NavState {
  ids?: string[];
  index?: number;
  from?: FromSource;
  beans?: Bean[];
}

export default function DetailView() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const passed = (location.state as NavState) || {};

  const [bean, setBean] = useState<Bean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ids, setIds] = useState<string[]>(passed.ids ?? []);
  const [idx, setIdx] = useState<number>(passed.index ?? -1);
  const from: FromSource = passed.from;
  

  // A) Use the list we came from (if provided) — SOURCE OF TRUTH
useEffect(() => {
  if (passed.beans?.length) {
    const list = passed.beans;
    const nextIds = list.map((b, i) => stableId(b, i)); // stable, order-specific ids
    const pos = nextIds.indexOf(String(id));

    setIds(nextIds);
    setIdx(pos >= 0 ? pos : 0);
    setBean(pos >= 0 ? list[pos] : list[0]);
    setLoading(false);
    setError(null);
  }
}, [id, passed.beans]);

// B) Deep-link fallback: only fetch when we did NOT get beans in route state
useEffect(() => {
  if (passed.beans?.length) return; // IMPORTANT: skip fetch when we have the list

  let alive = true;
  setLoading(true);
  setError(null);

  (async () => {
    try {
      const one = await fetchBeanById(id);
      if (!alive) return;

      if (one) {
        setBean(one);
        setError(null);
      } else {
        setBean(null);
        setError('Not found.');
      }
    } catch {
      if (!alive) return;
      setBean(null);
      setError('Failed to load item.');
    } finally {
      if (alive) setLoading(false);
    }
  })();

  return () => { alive = false; };
}, [id, passed.beans]);

// C) If we didn't get ids (deep link), fetch ids list — skip if beans were passed
useEffect(() => {
  if (passed.beans?.length) return; // we already set ids in effect A
  if (ids.length) return;

  let alive = true;
  (async () => {
    try {
      const list = await fetchAllIds();
      if (!alive) return;
      setIds(list);
    } catch {
      // ignore — Prev/Next will just be disabled on deep links
    }
  })();

  return () => { alive = false; };
}, [ids.length, passed.beans]);

// D) Compute index if missing (deep link case)
useEffect(() => {
  if (idx >= 0 || !ids.length || !id) return;
  const pos = ids.indexOf(String(id));
  setIdx(pos >= 0 ? pos : 0);
}, [idx, ids, id]);


  const canPrev = useMemo(() => idx > 0, [idx]);
  const canNext = useMemo(() => idx >= 0 && idx < ids.length - 1, [idx, ids.length]);

const goPrev = () => {
  if (!canPrev) return;
  const target = ids[idx - 1];
  navigate(`/detail/${target}`, { state: { ids, index: idx - 1, from, beans: passed.beans } });
};
const goNext = () => {
  if (!canNext) return;
  const target = ids[idx + 1];
  navigate(`/detail/${target}`, { state: { ids, index: idx + 1, from, beans: passed.beans } });
};

  if (loading) return <main className={styles.container}><h2 className={styles.title}>Details</h2><p>Loading…</p></main>;
  if (error)   return <main className={styles.container}><h2 className={styles.title}>Details</h2><p>{error}</p></main>;
  if (!bean)   return <main className={styles.container}><h2 className={styles.title}>Details</h2><p>Not found.</p></main>;

  const fallback = placeholder(bean.name, 600, 400);


  return (
    <main className={styles.container}>
      <h2 className={styles.title}>{bean.name}</h2>

      <div className={styles.top}>
        <img
          src={bean.imageUrl || fallback}
          alt={bean.name}
          className={styles.img}
        />
        <div className={styles.info}>
          {bean.group && <p><strong>Group:</strong> {bean.group}</p>}
          {bean.color && <p><strong>Color:</strong> {bean.color}</p>}
          {bean.description && <p className={styles.desc}>{bean.description}</p>}
        </div>
      </div>

      <div className={styles.actions}>
        <button onClick={goPrev} disabled={!canPrev}>← Previous</button>
        <button onClick={goNext} disabled={!canNext}>Next →</button>
        <Link to={from === 'gallery' ? '/gallery' : '/list'} className={styles.back}>
          Back
        </Link>
      </div>
    </main>
  );
}
