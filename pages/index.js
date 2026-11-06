import { useState } from 'react';
import Head from 'next/head';

export default function LoginPage() {
  const [tab, setTab] = useState('admin');
  const [adminEmail, setAdminEmail] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSupplierLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/login/supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_email: adminEmail,
          supplier_name: supplierName,
          password,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        window.location.href = data.redirect;
      } else {
        setErrorMsg(data.message || 'Gagal masuk.');
      }
    } catch (err) {
      setErrorMsg('Gagal menghubungi server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>SIRKALOKA | Where Waste Becomes Worth</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `tailwind.config = { theme: { extend: { colors: { emerald: {
              50: '#EBF7A9', 100: '#BBD394', 200: '#C4CC82', 300: '#B6D455',
              400: '#99BD49', 500: '#88B43A', 600: '#8ABB63', 700: '#518123',
              800: '#225808', 900: '#225808', 950: '#0C1805'
            } } } } };`,
          }}
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style>{`body { font-family: 'Plus Jakarta Sans', sans-serif; }`}</style>
      </Head>

      <div className="min-h-screen bg-[#f4f7ec] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-[#EBF7A9] p-5 text-center">
            <img
              src="/sirkaloka-logo.png"
              alt="Logo SIRKALOKA"
              className="w-48 h-36 object-contain mx-auto"
            />
            <p className="text-[#225808] text-sm font-semibold mt-1">
              Where Waste Becomes Worth
            </p>
          </div>

          <div className="grid grid-cols-2 border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => setTab('admin')}
              className={`py-3.5 text-xs font-bold uppercase tracking-wider transition ${
                tab === 'admin'
                  ? 'text-emerald-800 border-b-2 border-emerald-700 bg-white'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Masuk sebagai Admin
            </button>
            <button
              onClick={() => setTab('supplier')}
              className={`py-3.5 text-xs font-bold uppercase tracking-wider transition ${
                tab === 'supplier'
                  ? 'text-emerald-800 border-b-2 border-emerald-700 bg-white'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Masuk sebagai Warga
            </button>
          </div>

          {tab === 'admin' ? (
            <div className="p-7 space-y-5">
              <div className="text-center space-y-1.5">
                <h2 className="text-lg font-extrabold text-slate-800">Portal Pengelola Budidaya</h2>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Terhubung otomatis ke Google Sheets & Google Drive Anda beserta tab Monitoring IoT ESP32.
                </p>
              </div>

              <a
                href="/api/auth/google"
                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-slate-800 font-bold py-3.5 px-4 rounded-2xl shadow-sm transition text-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z" />
                </svg>
                <span>Masuk sebagai Admin (Google)</span>
              </a>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-3">
                <p className="text-xs text-emerald-900">
                  Belum punya database? Klik tombol di bawah untuk membuat otomatis file{' '}
                  <strong>&quot;Sistem Maggot - [Nama Anda]&quot;</strong> di Google Drive.
                </p>
                <a
                  href="/api/auth/google"
                  className="w-full inline-block bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 px-4 rounded-xl shadow transition text-xs uppercase tracking-wider"
                >
                  Daftar Sistem Baru dengan Google Akun
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSupplierLogin} className="p-7 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Email Admin Pengelola
                </label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@gmail.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Nama Anggota / Supplier
                </label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Nama sesuai registrasi"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-bold border border-red-200">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-2xl shadow transition text-sm"
              >
                {loading ? 'Memverifikasi...' : 'Masuk ke Dasbor Warga'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}