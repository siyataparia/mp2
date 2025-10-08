import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import styles from './ListView.module.css';
import mockData from '../mock/beans.json';

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

/** Fetch from known hosts, prefer /beans, fallback to /flavors */
async function fetchBeans(): Promise<Bean[]> {
  try {
    const { data } = await axios.get('https://jellybellywikiapi.onrender.com/api/beans', { timeout: 15000 });
    const listA: unknown[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
    const beansA: Bean[] = listA.map((x) => normalizeOne(x));
    return beansA.filter((b: Bean) => b.id && b.name);
  } catch {
    const { data } = await axios.get('https://jelly-belly-wiki.netlify.app/api/flavors', { timeout: 15000 });
    const listB: unknown[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
    const beansB: Bean[] = listB.map((x) => normalizeOne(x));
    return beansB.filter((b: Bean) => b.id && b.name);
  }
}

type SortKey = 'name' | 'id';
type SortDir = 'asc' | 'desc';

export default function ListView() {
  const [all, setAll] = useState<Bean[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const beans = await fetchBeans();
        if (!alive) return;
  
        // fallback to mock if API returns nothing
        if (!beans || beans.length === 0) {
          setAll((mockData as unknown[]).map((x) => normalizeOne(x)));
        } else {
          setAll(beans);
        }
        setError(null);
      } catch {
        if (!alive) return;
        // fallback to mock on any error (e.g., CORS/network)
        setAll((mockData as unknown[]).map((x) => normalizeOne(x)));
        setError(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);
  
  

  const filtered: Bean[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((b: Bean) =>
      b.name.toLowerCase().includes(needle) ||
      (b.group?.toLowerCase().includes(needle) ?? false) ||
      (b.description?.toLowerCase().includes(needle) ?? false)
    );
  }, [all, q]);

  const sorted: Bean[] = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: Bean, b: Bean) => {
      const A = (sortKey === 'name' ? a.name : a.id).toString().toLowerCase();
      const B = (sortKey === 'name' ? b.name : b.id).toString().toLowerCase();
      if (A < B) return sortDir === 'asc' ? -1 : 1;
      if (A > B) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

const ids: string[] = sorted.map((b: Bean, i: number) => stableId(b, i));

  if (loading) return <main className={styles.container}><h2>List View</h2><p>Loading…</p></main>;
  if (error)   return <main className={styles.container}><h2>List View</h2><p>{error}</p></main>;

  return (
    <section className={styles.container}>
      <h2>List View</h2>

      <input
        className={styles.search}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search flavors, categories…"
        aria-label="Search"
      />

      <div className={styles.controls}>
        <label>
          Sort by&nbsp;
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="name">Name</option>
            <option value="id">ID</option>
          </select>
        </label>
        <label>
          Direction&nbsp;
          <select value={sortDir} onChange={(e) => setSortDir(e.target.value as SortDir)}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>

      <ul className={styles.list}>
        {sorted.map((b: Bean, i: number) => (
          <li key={b.id} className={styles.row}>
            <img
              className={styles.thumb}
              src={b.imageUrl || placeholder(b.name, 64, 64)}
              alt={b.name}
              width={64}
              height={64}
            />
            <div className={styles.meta}>
              <div className={styles.name}>{b.name}</div>
              {b.group && <div className={styles.sub}>{b.group}</div>}
            </div>
            <Link
              to={`/detail/${stableId(b, i)}`}
              state={{ ids, index: i, from: 'list', beans: sorted }}
              className={styles.link}
            >
              Details →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
