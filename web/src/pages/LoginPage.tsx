import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.login(email, password);

      if (result.requires2fa && result.pendingToken) {
        setPendingToken(result.pendingToken);
        return;
      }

      if (result.token) {
        login(result.token, result.user);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2fa = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingToken) return;

    setError('');
    setLoading(true);

    try {
      const result = await api.verify2fa(pendingToken, code);
      login(result.token, result.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Doğrulama başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="brand">
          <span className="brand-icon">🔐</span>
          <h1>BLB Authenticator</h1>
          <p className="muted">Hesabınıza giriş yapın</p>
        </div>

        {!pendingToken ? (
          <form onSubmit={handleLogin} className="form">
            <label>
              E-posta
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label>
              Şifre
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify2fa} className="form">
            <p className="info">Authenticator uygulamanızdaki 6 haneli kodu girin.</p>
            <label>
              Doğrulama Kodu
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading || code.length !== 6}>
              {loading ? 'Doğrulanıyor...' : 'Doğrula'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setPendingToken(null);
                setCode('');
                setError('');
              }}
            >
              Geri
            </button>
          </form>
        )}

        <p className="auth-footer">
          Hesabınız yok mu? <Link to="/register">Kayıt olun</Link>
        </p>
      </div>
    </div>
  );
}
