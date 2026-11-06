import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function SupplierDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/supplier/logs')
      .then((res) => {
        if (res.status === 401) window.location.href = '/';
        return res.json();
      })
      .then((json) => {
        if (json.status === 'success') setData(json);
      });
  }, []);

  const formatRp = (num) => 'Rp' + Number(num || 0).toLocaleString('id-ID');

  return (
    <>
      <Head>
        <title>Dasbor Warga - SIRKALOKA</title>
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
      </Head>

      <div className="bg-[#f4f7ec] min-h-screen text-slate-900">
        <nav className="bg-[#225808] text-white px-4 py-4 shadow">
          <div className="max-w-4xl mx-auto flex flex-wrap justify-between items-center gap-y-3">
            <div className="flex items-center gap-2">
              <img src="/sirkaloka-mark.png" alt="" className="w-10 h-10 object-contain" />
              <div>
                <p className="text-base font-extrabold tracking-tight">SIRKALOKA</p>
                <p className="text-[10px] text-emerald-200">Where Waste Becomes Worth</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 flex-1 sm:flex-initial">
              <div className="sm:text-right">
                <h1 className="text-sm font-extrabold">Halo, {data?.supplier_name || 'Warga'}</h1>
                <p className="text-xs text-emerald-200">Unit Pengelola: {data?.admin_name}</p>
              </div>
              <a
                href="/api/logout"
                className="text-xs bg-red-600 hover:bg-red-700 px-3.5 py-2 rounded-xl font-bold"
              >
                Keluar
              </a>
            </div>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold uppercase text-gray-400">Total Sampah Disuplai</p>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-1">
                {data?.total_berat_kg || 0} Kg
              </h2>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold uppercase text-gray-400">Total Bagi Hasil Diterima</p>
              <h2 className="text-3xl font-extrabold text-emerald-700 mt-1">
                {formatRp(data?.total_bagi_hasil_rp)}
              </h2>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-base font-extrabold mb-4">Riwayat Setoran Limbah Anda</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b text-gray-500 uppercase text-xs">
                    <th className="py-3 px-2">Tanggal</th>
                    <th className="py-3 px-2">Berat (Kg)</th>
                    <th className="py-3 px-2">Bagi Hasil</th>
                    <th className="py-3 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data?.logs || []).map((l, i) => (
                    <tr key={i}>
                      <td className="py-3 px-2 text-gray-500">{l.tanggal}</td>
                      <td className="py-3 px-2 font-bold">{l.berat_kg} Kg</td>
                      <td className="py-3 px-2 font-bold text-emerald-700">
                        {formatRp(l.bagi_hasil_rp)}
                      </td>
                      <td className="py-3 px-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}