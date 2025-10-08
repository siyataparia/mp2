import { Routes, Route, Link, Navigate } from 'react-router-dom';
import styles from './App.module.css';
import ListView from './pages/ListView';
import GalleryView from './pages/GalleryView';
import DetailView from './pages/DetailView';

export default function App() {
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Jelly Belly Explorer</h1>
        <nav className={styles.nav}>
          <Link to="/list">List</Link>
          <Link to="/gallery">Gallery</Link>
        </nav>
      </header>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to="/list" />} />
          <Route path="/list" element={<ListView />} />
          <Route path="/gallery" element={<GalleryView />} />
          <Route path="/detail/:id" element={<DetailView />} />
          <Route path="*" element={<div>Not Found</div>} />
        </Routes>
      </main>
    </div>
  );
}
