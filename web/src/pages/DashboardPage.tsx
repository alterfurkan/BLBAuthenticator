import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, type TotpEntryWithCode } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [entries, setEntries] = useState<TotpEntryWithCode[]>([]);
  const [remaining, setRemaining] = useState(30);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchCodes = () => {
    api
      .listEntriesWithCodes()
      .then(({ entries: list, remaining: r }) => {
        setEntries(list);
        setRemaining(r);
        setError('');
      })
      .catch(() => setError('Kodlar yüklenemedi'));
  };

  useEffect(() => {
    fetchCodes();
    setLoading(false);
    const interval = setInterval(fetchCodes, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id: number, label: string) => {
    if (!confirm(`"${label}" kaydını silmek istediğinize emin misiniz?`)) return;

    setDeletingId(id);
    setError('');

    try {
      await api.deleteEntry(id);
      fetchCodes();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Silinemedi');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>BLB Authenticator</h1>
          <p className="muted">{user?.email}</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => navigate('/entries/add')}>
            + Hesap Ekle
          </button>
          <button type="button" className="btn-secondary" onClick={() => { logout(); navigate('/login'); }}>
            Çıkış
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        {loading ? (
          <p className="muted">Yükleniyor...</p>
        ) : entries.length === 0 ? (
          <div className="card empty-card">
            <h2>Henüz hesap yok</h2>
            <p className="muted">
              GitHub, Google, banka vb. servislerinizin 2FA kodlarını buraya ekleyin.
            </p>
            <button type="button" onClick={() => navigate('/entries/add')}>
              İlk Hesabı Ekle
            </button>
          </div>
        ) : (
          <ul className="entry-list">
            {entries.map((entry) => (
              <li key={entry.id} className="card entry-card">
                <div className="entry-info">
                  <h3>{entry.label}</h3>
                  {entry.issuer && <p className="muted entry-issuer">{entry.issuer}</p>}
                </div>
                <div className="entry-code-block">
                  <span className="entry-code">{entry.code}</span>
                  <div className="totp-timer entry-timer">
                    <div
                      className="totp-timer-bar"
                      style={{ width: `${(remaining / 30) * 100}%` }}
                    />
                  </div>
                  <span className="muted entry-remaining">{remaining}s</span>
                </div>
                <button
                  type="button"
                  className="btn-danger btn-small"
                  disabled={deletingId === entry.id}
                  onClick={() => handleDelete(entry.id, entry.label)}
                >
                  {deletingId === entry.id ? '...' : 'Sil'}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="error">{error}</p>}
      </main>
    </div>
  );
}
