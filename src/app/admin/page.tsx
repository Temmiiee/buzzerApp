'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'SECRET';

export default function AdminPage() {
  const [info, setInfo] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/info`)
      .then(res => res.json())
      .then(setInfo);
    fetch(`${API_URL}/health`)
      .then(res => res.json())
      .then(setHealth);
  }, []);

  const handleCleanup = async () => {
    setCleanupStatus('Nettoyage en cours...');
    const res = await fetch(`${API_URL}/admin/cleanup?token=${ADMIN_TOKEN}`, { method: 'POST' });
    const data = await res.json();
    setCleanupStatus(data.status || data.error);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Admin - Gestion des Salles</h1>
      <div className="mb-4">
        <p><b>Salles actives :</b> {info?.rooms ?? '...'}</p>
        <p><b>Connexions actives :</b> {info?.activeConnections ?? '...'}</p>
        <p><b>Statut serveur :</b> {health?.status ?? '...'}</p>
        <p><b>Dernier check :</b> {health?.timestamp ?? '...'}</p>
      </div>
      <button onClick={handleCleanup} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
        Nettoyer toutes les salles et déconnecter tout le monde
      </button>
      {cleanupStatus && <p className="mt-4 text-blue-700">{cleanupStatus}</p>}
    </main>
  );
} 