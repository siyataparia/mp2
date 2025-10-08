import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import styles from './GalleryView.module.css';
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

function bucketOf(b: Bean): string {
  return b.group && b.group.trim() ? b.group : b.name.charAt(0).toUpperCase();
}

export default function GalleryView() {
  const [all, setAll] = useState<Bean[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const beans = await fetchBeans();
        if (!alive) return;
  
        if (!beans || beans.length === 0) {
          setAll((mockData as unknown[]).map((x) => normalizeOne(x)));
        } else {
          setAll(beans);
        }
        setError(null);
      } catch {
        if (!alive) return;
        setAll((mockData as unknown[]).map((x) => normalizeOne(x)));
        setError(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);
  
  

  const allBuckets: string[] = useMemo(() => {
    const s = new Set<string>();
    all.forEach((b) => s.add(bucketOf(b)));
    return Array.from(s).sort();
  }, [all]);

  useEffect(() => {
    if (!active.length && allBuckets.length) {
      setActive(allBuckets.slice(0, Math.min(3, allBuckets.length)));
    }
  }, [allBuckets, active.length]);

  const filtered: Bean[] = useMemo(() => {
    if (!active.length) return all;
    const sel = new Set(active);
    return all.filter((b) => sel.has(bucketOf(b)));
  }, [all, active]);

const ids: string[] = filtered.map((b, i) => stableId(b, i));

  if (loading) return <main className={styles.container}><h2>Gallery View</h2><p>Loading…</p></main>;
  if (error)   return <main className={styles.container}><h2>Gallery View</h2><p>{error}</p></main>;

  return (
    <main className={styles.container}>
      <h2>Gallery View</h2>

      <div className={styles.filters}>
        {allBuckets.map((tag) => {
          const checked = active.includes(tag);
          return (
            <label key={tag} className={styles.chip}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  setActive((prev) =>
                    e.target.checked ? [...prev, tag] : prev.filter((t) => t !== tag)
                  )
                }
              />
              <span>{tag}</span>
            </label>
          );
        })}
      </div>

      <div className={styles.grid}>
        {filtered.map((b, i) => {
          const img = b.imageUrl || placeholder(b.name, 300, 160);
          return (
            <Link
              key={stableId(b, i)}
              to={`/detail/${stableId(b, i)}`}
              state={{ ids, index: i, from: 'gallery', beans: filtered }}
              className={styles.card}
            >
              <img src={img} alt={b.name} className={styles.img} />
              <figcaption className={styles.caption}>{b.name}</figcaption>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
