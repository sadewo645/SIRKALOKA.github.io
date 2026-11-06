import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dasbor'); // 'dasbor' | 'iot' | 'setoran' | 'anggota' | 'keuangan'
  const [data, setData] = useState(null);
  const [toast, setToast] = useState(null);

  // State Grafik
  const [chartRange, setChartRange] = useState('yearly'); // 'daily' | 'monthly' | 'yearly'
  const [chartType, setChartType] = useState('line'); // 'line' | 'bar'
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // State Form Setoran
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [beratKg, setBeratKg] = useState('');
  const [beratLayakKg, setBeratLayakKg] = useState('');
  const [statusSetoran, setStatusSetoran] = useState('Dibayar');

  // State Timbangan Pintar Load Cell (Bruto - Tara = Neto)
  const [isWeighing, setIsWeighing] = useState(false);
  const [liveScaleKg, setLiveScaleKg] = useState(0);
  const [brutoKg, setBrutoKg] = useState(0);
  const [taraWadahKg, setTaraWadahKg] = useState(0);

  // State Form Anggota & Keuangan
  const [supNama, setSupNama] = useState('');
  const [supHp, setSupHp] = useState('');
  const [supPassword, setSupPassword] = useState('');
  const [keuJenis, setKeuJenis] = useState('Pendapatan');
  const [keuKategori, setKeuKategori] = useState('Sayur');
  const [keuNominal, setKeuNominal] = useState('');
  const [keuKeterangan, setKeuKeterangan] = useState('');
  const [hargaPerKg, setHargaPerKg] = useState(1000);

  // State Modal Setting Tambah/Konfigurasi Sistem Monitoring IoT
  const [showSettingModal, setShowSettingModal] = useState(false);
  const [namaSistemIoT, setNamaSistemIoT] = useState('Unit Biopond & Kebun Utama');
  const [iotSheetId, setIotSheetId] = useState('');
  const [batasKeringTanah, setBatasKeringTanah] = useState(40);
  const [simSensorBerat, setSimSensorBerat] = useState('');

  const showToastMsg = (message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const formatRp = (num) => 'Rp' + Number(num || 0).toLocaleString('id-ID');

  const getIndonesianDateHeader = () => {
    const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const bulan = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const now = new Date();
    return `${hari[now.getDay()]}, ${now.getDate()} ${bulan[now.getMonth()]} ${now.getFullYear()}`;
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/admin/init-data');
      if (res.status === 401) {
        window.location.href = '/';
        return;
      }
      const json = await res.json();
      if (json.status === 'success') {
        setData(json);
        setHargaPerKg(json.harga_per_kg);
        if (json.iot) {
          setLiveScaleKg(Number(json.iot.Berat_LoadCell_Kg || 0));
          setNamaSistemIoT(json.iot.Nama_Sistem || 'Unit Biopond & Kebun Utama');
          setIotSheetId(json.iot.IoT_Spreadsheet_ID || json.spreadsheet_id);
          setBatasKeringTanah(Number(json.iot.Batas_Kering_Tanah_Persen || 40));
        }
      } else {
        showToastMsg(json.message || 'Gagal memuat data', true);
      }
    } catch (err) {
      showToastMsg('Gagal terhubung ke server.', true);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (!isWeighing) return;
    const interval = setInterval(() => {
      fetchDashboard();
    }, 3500);
    return () => clearInterval(interval);
  }, [isWeighing]);

  // Render Chart.js dengan Point Style Bulat (Sesuai Gambar Kedua)
  useEffect(() => {
    if (!data?.analytics?.charts || activeTab !== 'dasbor' || !window.Chart) return;
    const ctx = chartRef.current?.getContext('2d');
    if (!ctx) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const c = data.analytics.charts;
    let labels = [];
    let datasets = [];

    if (chartRange === 'daily') {
      labels = c.daily.labels;
      datasets = [
        {
          label: 'Limbah Diterima (Kg)',
          data: c.daily.diterima,
          borderColor: '#94a3b8',
          backgroundColor: 'rgba(148, 163, 184, 0.25)',
          borderRadius: 6,
          tension: 0.35,
          borderWidth: 2,
        },
        {
          label: 'Layak Olah (Kg)',
          data: c.daily.layak,
          borderColor: '#88B43A',
          backgroundColor: chartType === 'bar' ? '#99BD49' : 'rgba(153, 189, 73, 0.18)',
          fill: true,
          borderRadius: 6,
          tension: 0.35,
          borderWidth: 2.5,
        },
      ];
    } else if (chartRange === 'monthly') {
      labels = c.monthly.labels.map((d) => `Tgl ${d}`);
      datasets = [
        {
          label: 'Limbah Diterima (Kg)',
          data: c.monthly.diterima,
          borderColor: '#94a3b8',
          backgroundColor: 'rgba(148, 163, 184, 0.25)',
          borderRadius: 4,
          tension: 0.3,
          borderWidth: 1.8,
        },
        {
          label: 'Layak Olah (Kg)',
          data: c.monthly.layak,
          borderColor: '#518123',
          backgroundColor: chartType === 'bar' ? '#8ABB63' : 'rgba(138, 187, 99, 0.2)',
          fill: true,
          borderRadius: 4,
          tension: 0.3,
          borderWidth: 2.5,
        },
      ];
    } else {
      labels = c.yearly.labels;
      datasets = [
        {
          label: `Tahun ${data.analytics.prev_year}`,
          data: c.yearly.prev_year,
          borderColor: '#99BD49',
          backgroundColor: chartType === 'bar' ? '#B6D455' : 'rgba(182, 212, 85, 0.12)',
          borderRadius: 6,
          tension: 0.35,
          borderWidth: 2,
        },
        {
          label: `Tahun ${data.analytics.curr_year}`,
          data: c.yearly.curr_year,
          borderColor: '#225808',
          backgroundColor: chartType === 'bar' ? '#518123' : 'rgba(81, 129, 35, 0.18)',
          fill: true,
          borderRadius: 6,
          tension: 0.35,
          borderWidth: 2.5,
        },
      ];
    }

    chartInstanceRef.current = new window.Chart(ctx, {
      type: chartType,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              boxWidth: 8,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' },
            },
          },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#0f172a',
            bodyColor: '#225808',
            borderColor: '#cbd5e1',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => `${context.dataset.label} : ${context.parsed.y} kg`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: { font: { size: 11 } },
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
          },
        },
      },
    });
  }, [data, chartRange, chartType, activeTab]);

  // =================================================================
  // FUNGSI TIMBANGAN LOAD CELL (MULAI -> SELESAI -> TARA -> NETO)
  // =================================================================
  const netoKg = Math.max(0, Number((brutoKg - taraWadahKg).toFixed(2)));

  const handleMulaiTimbang = async () => {
    setIsWeighing(true);
    await fetch('/api/admin/iot-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Status_Timbangan: 'WEIGHING' }),
    });
    await fetchDashboard();
    showToastMsg('Timbangan Load Cell aktif membaca beban secara live.');
  };

  const handleSelesaiTimbang = async () => {
    setIsWeighing(false);
    setBrutoKg(liveScaleKg);
    await fetch('/api/admin/iot-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Status_Timbangan: 'LOCKED' }),
    });
    showToastMsg(`Berat Bruto dikunci pada ${liveScaleKg} Kg. Silakan klik tombol Tara wadah.`);
  };

  const handleAmbilTaraDariSensor = () => {
    setTaraWadahKg(liveScaleKg);
    showToastMsg(`Berat wadah (Tara) diset ${liveScaleKg} Kg. Neto otomatis dihitung!`);
  };

  const handleGunakanNetoKeSetoran = () => {
    setBeratKg(String(brutoKg > 0 ? brutoKg : liveScaleKg));
    setBeratLayakKg(String(netoKg > 0 ? netoKg : liveScaleKg));
    setActiveTab('setoran');
    showToastMsg(`Berat Neto (${netoKg} Kg) berhasil dimasukkan ke Form Setoran!`);
  };

  const handleUpdateIoT = async (payload) => {
    const res = await fetch('/api/admin/iot-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok) {
      showToastMsg(json.message);
      fetchDashboard();
    } else {
      showToastMsg(json.message, true);
    }
  };

  const handleSaveSettingIoT = async (e) => {
    e.preventDefault();
    await handleUpdateIoT({
      Nama_Sistem: namaSistemIoT,
      IoT_Spreadsheet_ID: iotSheetId,
      Batas_Kering_Tanah_Persen: batasKeringTanah,
      Status_Koneksi: 'Aktif',
    });
    setShowSettingModal(false);
  };

  const handleSimpanSetoran = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/admin/setoran', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama_supplier: selectedSupplier,
        berat_kg: beratKg,
        berat_layak_kg: beratLayakKg,
        status: statusSetoran,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      showToastMsg(json.message);
      setBeratKg('');
      setBeratLayakKg('');
      fetchDashboard();
    } else {
      showToastMsg(json.message, true);
    }
  };

  const handleSimpanSupplier = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/admin/supplier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: supNama, no_hp: supHp, password: supPassword }),
    });
    const json = await res.json();
    if (res.ok) {
      showToastMsg(json.message);
      setSupNama('');
      setSupHp('');
      setSupPassword('');
      fetchDashboard();
    } else {
      showToastMsg(json.message, true);
    }
  };

  const handleSimpanKeuangan = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/admin/keuangan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jenis: keuJenis,
        kategori: keuKategori,
        nominal_rp: keuNominal,
        keterangan: keuKeterangan,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      showToastMsg(json.message);
      setKeuNominal('');
      setKeuKeterangan('');
      fetchDashboard();
    } else {
      showToastMsg(json.message, true);
    }
  };

  const a = data?.analytics || {};
  const iot = data?.iot || {};
  const bulanTahunLabel = `${a.bulan_nama || 'Oktober'} ${a.curr_year || 2026}`;
  const estimasiBagiHasil = Math.round(
    (parseFloat(beratLayakKg !== '' ? beratLayakKg : beratKg) || 0) * hargaPerKg
  );

  const getChartSubtitle = () => {
    if (chartRange === 'daily') return 'Setoran Limbah Harian (7 Hari Terakhir)';
    if (chartRange === 'monthly') return `Perjalanan Harian Bulan ${bulanTahunLabel}`;
    return `Perbandingan Tahunan (${a.prev_year || 2025} vs ${a.curr_year || 2026})`;
  };

  return (
    <>
      <Head>
        <title>Dasbor Pengelola - SIRKALOKA</title>
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
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style>{`
          body { font-family: 'Plus Jakarta Sans', sans-serif; }
          .glass-card { background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(12px); }
          .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
        `}</style>
      </Head>

      <div className="bg-[#f4f7ec] min-h-screen text-slate-900 pb-24 lg:pb-10">
        {/* ============================================================ */}
        {/* SIDEBAR NAVIGASI KIRI (KHUSUS DESKTOP >= 1024px)             */}
        {/* ============================================================ */}
        <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-72 bg-[#225808] text-white z-40 shadow-2xl justify-between p-6">
          <div className="space-y-8">
            {/* Brand Logo */}
            <div className="flex items-center gap-3 px-2">
              <img src="/sirkaloka-mark.png" alt="" className="w-11 h-11 object-contain" />
              <div>
                <span className="text-xl font-extrabold tracking-tight text-white">SIRKALOKA</span>
                <p className="text-[11px] text-emerald-200/90 font-medium">Where Waste Becomes Worth</p>
              </div>
            </div>

            {/* Menu Navigasi Desktop dengan SVG Outline Icons */}
            <nav className="space-y-1.5">
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-emerald-400/70 mb-2">
                Menu Utama
              </p>

              <button
                onClick={() => setActiveTab('dasbor')}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm transition ${
                  activeTab === 'dasbor'
                    ? 'font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                    : 'font-medium text-emerald-100/80 hover:bg-white/10'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Dasbor Bendahara</span>
              </button>

              <button
                onClick={() => setActiveTab('setoran')}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm transition ${
                  activeTab === 'setoran'
                    ? 'font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                    : 'font-medium text-emerald-100/80 hover:bg-white/10'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2M4 17v2a1 1 0 001 1h2m10 0h2a1 1 0 001-1v-2M7 12h10" />
                </svg>
                <span>Setoran Limbah</span>
              </button>

              <button
                onClick={() => setActiveTab('anggota')}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm transition ${
                  activeTab === 'anggota'
                    ? 'font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                    : 'font-medium text-emerald-100/80 hover:bg-white/10'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Anggota Warga</span>
              </button>

              <button
                onClick={() => setActiveTab('keuangan')}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm transition ${
                  activeTab === 'keuangan'
                    ? 'font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                    : 'font-medium text-emerald-100/80 hover:bg-white/10'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>Keuangan & Harga</span>
              </button>

              <button
                onClick={() => setActiveTab('iot')}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm transition ${
                  activeTab === 'iot'
                    ? 'font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                    : 'font-medium text-emerald-100/80 hover:bg-white/10'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <span>Monitoring & IoT</span>
              </button>
            </nav>
          </div>

          {/* Panel Bawah Sidebar */}
          <div className="space-y-3">
            <button
              onClick={() => setShowSettingModal(true)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-emerald-800/50 hover:bg-emerald-800 border border-emerald-700/60 text-xs font-semibold text-emerald-200 transition"
            >
              <span>+ Tambah Sistem IoT</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {data?.spreadsheet_id && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${data.spreadsheet_id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-2xl bg-emerald-900/70 hover:bg-emerald-800 border border-emerald-700/60 text-xs font-semibold text-emerald-100 transition"
              >
                <span>Buka Database Sheet</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            <div className="pt-4 border-t border-emerald-800/80 flex items-center justify-between">
              <div className="truncate pr-2">
                <p className="text-xs font-bold text-white truncate">{data?.admin_name || 'Admin'}</p>
                <p className="text-[11px] text-emerald-300/70 truncate">{data?.admin_email}</p>
              </div>
              <a
                href="/api/logout"
                title="Keluar"
                className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500 text-red-200 hover:text-white transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </a>
            </div>
          </div>
        </aside>

        {/* ============================================================ */}
        {/* TOP APP BAR (KHUSUS MOBILE / TABLET < 1024px)                */}
        {/* ============================================================ */}
        <header className="lg:hidden glass-card border-b border-gray-200/80 sticky top-0 z-30">
          <div className="max-w-3xl mx-auto px-4 py-3.5 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <img src="/sirkaloka-mark.png" alt="" className="w-9 h-9 object-contain" />
              <div>
                <span className="block text-lg font-extrabold text-emerald-900 tracking-tight">SIRKALOKA</span>
                <span className="block text-[9px] leading-none text-emerald-700">Where Waste Becomes Worth</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettingModal(true)}
                className="text-xs font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 px-3 py-1.5 rounded-xl transition flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Sistem IoT</span>
              </button>
              <a
                href="/api/logout"
                title="Keluar"
                className="text-gray-500 hover:text-red-600 p-1.5 rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </a>
            </div>
          </div>
        </header>

        {/* ============================================================ */}
        {/* KONTEN UTAMA                                                 */}
        {/* ============================================================ */}
        <main className="lg:pl-72">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 lg:pt-8 space-y-6">
            {toast && (
              <div
                className={`p-4 rounded-2xl text-xs sm:text-sm font-bold shadow-md transition-all ${
                  toast.isError
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                }`}
              >
                {toast.message}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 1: DASBOR BENDAHARA (DESAIN PERSIS GAMBAR KEDUA)     */}
            {/* ======================================================== */}
            {activeTab === 'dasbor' && (
              <section className="space-y-6">
                {/* Header Baris Atas */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <p className="text-xs sm:text-sm text-emerald-700 font-bold uppercase tracking-wider">
                      {getIndonesianDateHeader()}
                    </p>
                    <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                      Dasbor Bendahara
                    </h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => setActiveTab('setoran')}
                      className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-sm transition"
                    >
                      <span>+ Catat Setoran</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('iot')}
                      className="inline-flex items-center gap-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-sm transition"
                    >
                      <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                      <span>Timbangan & IoT</span>
                    </button>
                    <button
                      onClick={fetchDashboard}
                      className="inline-flex items-center gap-1.5 bg-white hover:bg-gray-50 text-slate-700 border border-gray-200 text-xs sm:text-sm font-bold px-3.5 py-2.5 rounded-2xl shadow-sm transition"
                    >
                      <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Segarkan</span>
                    </button>
                  </div>
                </div>

                {/* BARIS 1: BENTO GRID 3 KARTU UTAMA */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5">
                  {/* Kartu 1: Limbah Layak Olah + Donut Progress */}
                  <div className="xl:col-span-4 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition">
                    <div className="space-y-1">
                      <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800">
                        {bulanTahunLabel}
                      </span>
                      <p className="text-sm text-gray-500 font-medium pt-1">Limbah layak olah</p>
                      <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                        {a.limbah_layak_kg || 0} kg
                      </h2>
                      <p className="text-xs sm:text-sm text-gray-500">
                        dari {a.limbah_diterima_kg || 0} kg diterima
                      </p>
                      <p className="text-xs font-bold text-emerald-700 pt-1">
                        Setoran hari ini: {a.limbah_hari_ini_kg || 0} kg
                      </p>
                    </div>
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center flex-shrink-0">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" stroke="#EBF7A9" strokeWidth="12" fill="transparent" />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="#518123"
                          strokeWidth="12"
                          strokeDasharray="251.2"
                          strokeDashoffset={251.2 - ((a.persen_layak || 0) / 100) * 251.2}
                          strokeLinecap="round"
                          fill="transparent"
                          className="transition-all duration-700"
                        />
                      </svg>
                      <span className="absolute text-base sm:text-lg font-extrabold text-slate-900">
                        {a.persen_layak || 0}%
                      </span>
                    </div>
                  </div>

                  {/* Kartu 2: Pendapatan Bulan Ini - Sayur, Telur, Ekowisata (SVG Outline Icons) */}
                  <div className="xl:col-span-5 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between space-y-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Pendapatan bulan ini</p>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1">
                          {formatRp(a.pendapatan_bulan_ini)}
                        </h2>
                      </div>
                      <button
                        onClick={() => setActiveTab('keuangan')}
                        className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition"
                      >
                        + Catat Kas
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                      <div className="bg-[#EBF7A9] rounded-2xl p-3 text-center space-y-1 hover:scale-[1.02] transition">
                        <div className="flex justify-center text-emerald-800">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21V11m0 0C12 7 8 5 5 5c0 4 3 6 7 6zm0 0c0-4 4-6 7-6 0 4-3 6-7 6z" />
                          </svg>
                        </div>
                        <p className="text-xs text-emerald-900 font-semibold">Sayur</p>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {formatRp(a.pendapatan_sayur)}
                        </p>
                      </div>

                      <div className="bg-[#EBF7A9] rounded-2xl p-3 text-center space-y-1 hover:scale-[1.02] transition">
                        <div className="flex justify-center text-emerald-800">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-3.8 0-7 5.4-7 10.5C5 17.6 8.1 21 12 21s7-3.4 7-7.5C19 8.4 15.8 3 12 3z" />
                          </svg>
                        </div>
                        <p className="text-xs text-emerald-900 font-semibold">Telur</p>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {formatRp(a.pendapatan_telur)}
                        </p>
                      </div>

                      <div className="bg-[#EBF7A9] rounded-2xl p-3 text-center space-y-1 hover:scale-[1.02] transition">
                        <div className="flex justify-center text-emerald-800">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18L12 4 3 20zm9-5v5" />
                          </svg>
                        </div>
                        <p className="text-xs text-emerald-900 font-semibold">Ekowisata</p>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {formatRp(a.pendapatan_ekowisata)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Kartu 3: Banner Total Kembali ke Warga Tahun Berjalan */}
                  <div
                    className="md:col-span-2 xl:col-span-3 relative rounded-3xl overflow-hidden shadow-sm min-h-[180px] bg-emerald-900 flex flex-col justify-end p-6 text-white hover:shadow-md transition"
                    style={{
                      backgroundImage:
                        "linear-gradient(to bottom, rgba(10,35,20,0.2), rgba(11,61,32,0.93)), url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80')",
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    <span className="inline-block w-fit text-[10px] font-bold uppercase tracking-widest bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full mb-2">
                      Dampak Ekonomi Warga
                    </span>
                    <p className="text-xs sm:text-sm text-emerald-100 font-medium">
                      Total kembali ke warga tahun {a.curr_year || 2026}
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1">
                      {formatRp(a.total_kembali_warga_tahun_ini)}
                    </h2>
                  </div>
                </div>

                {/* BARIS 2: GRAFIK MULTI-WAKTU & HASIL USAHA 80:20 */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                  {/* Kartu 4: Analitik Tonase Limbah Organik */}
                  <div className="xl:col-span-7 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                      <div>
                        <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                          Analitik Tonase Limbah Organik
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">{getChartSubtitle()}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex bg-gray-100 p-1 rounded-2xl text-xs font-bold">
                          {[
                            { id: 'daily', label: 'Harian' },
                            { id: 'monthly', label: '1 Bulan' },
                            { id: 'yearly', label: '1 Tahun' },
                          ].map((b) => (
                            <button
                              key={b.id}
                              onClick={() => setChartRange(b.id)}
                              className={`px-3 py-1.5 rounded-xl transition ${
                                chartRange === b.id
                                  ? 'bg-emerald-700 text-white shadow-sm'
                                  : 'text-gray-600 hover:text-slate-900'
                              }`}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => setChartType(chartType === 'line' ? 'bar' : 'line')}
                          className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-slate-700 transition"
                        >
                          Bar / Line
                        </button>
                      </div>
                    </div>

                    <div className="h-64 sm:h-72 w-full">
                      <canvas ref={chartRef}></canvas>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 pt-1 border-t border-gray-100">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Arahkan kursor pada grafik untuk melihat detail tonase (Kg).
                      </span>
                      <span className="font-semibold text-emerald-700">Data Real-Time Google Sheets</span>
                    </div>
                  </div>

                  {/* Kartu 5: Hasil Usaha & Bagi Hasil 80:20 (Full SVG Icons Tanpa Emoji) */}
                  <div className="xl:col-span-5 bg-[#225808] text-white rounded-3xl p-6 shadow-md flex flex-col justify-between space-y-5">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg sm:text-xl font-extrabold">
                          Hasil usaha {bulanTahunLabel}
                        </h3>
                        <span className="text-[11px] bg-emerald-800/80 text-emerald-200 px-3 py-1 rounded-full font-semibold">
                          Bagi Hasil 80:20
                        </span>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-200 flex items-center gap-2.5">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Pendapatan Usaha
                          </span>
                          <span className="font-bold text-base">{formatRp(a.pendapatan_bulan_ini)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-200 flex items-center gap-2.5">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pengeluaran Operasional
                          </span>
                          <span className="font-bold text-base text-red-300">
                            -{formatRp(a.pengeluaran_bulan_ini)}
                          </span>
                        </div>
                      </div>

                      <hr className="border-emerald-800/80" />

                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-100 flex items-center gap-2.5 font-medium">
                            <svg className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Laba bersih
                          </span>
                          <span className="font-extrabold text-xl">{formatRp(a.laba_bersih)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-200 flex items-center gap-2.5">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            Kas cadangan (20%)
                          </span>
                          <span className="font-bold text-base">{formatRp(a.kas_cadangan_20)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-[#B6D455] text-slate-950 rounded-2xl p-5 shadow-inner">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                          DIBAGIKAN KE WARGA (80%)
                        </p>
                        <p className="text-3xl font-extrabold mt-1">
                          {formatRp(a.dibagikan_warga_80)}
                        </p>
                      </div>
                      <p className="text-xs text-emerald-300/90 font-medium">
                        Total kas cadangan terkumpul: {formatRp(a.total_kas_cadangan)}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ======================================================== */}
            {/* TAB 2: MONITORING IoT, TIMBANGAN LOAD CELL & POMPA AIR   */}
            {/* ======================================================== */}
            {activeTab === 'iot' && (
              <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Sistem Terintegrasi: {iot.Nama_Sistem || 'Unit Utama'} ({iot.Status_Koneksi || 'Aktif'})
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                      Monitoring IoT & Timbangan Load Cell
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowSettingModal(true)}
                    className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-sm transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Tambah / Konfigurasi Sistem Monitoring</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* PANEL 1: TIMBANGAN PINTAR LOAD CELL (BRUTO - TARA = NETO) */}
                  <div className="lg:col-span-6 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800">
                          Sensor Load Cell HX711
                        </span>
                        <h3 className="text-lg font-extrabold text-slate-900 mt-1">
                          Timbangan Digital Limbah (Tara & Neto)
                        </h3>
                      </div>
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full ${
                          isWeighing ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {isWeighing ? 'Sedang Menimbang...' : 'Siap Timbang'}
                      </span>
                    </div>

                    {/* Layar Digital Load Cell */}
                    <div className="bg-slate-900 text-emerald-400 rounded-2xl p-5 flex items-center justify-between shadow-inner">
                      <div>
                        <p className="text-xs text-slate-400">Bacaan Sensor Load Cell Saat Ini:</p>
                        <p className="text-4xl font-extrabold tracking-wider mt-1">{liveScaleKg} Kg</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-[11px] text-slate-400">Uji / Kalibrasi Beban (Kg):</p>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="12.5"
                            value={simSensorBerat}
                            onChange={(e) => setSimSensorBerat(e.target.value)}
                            className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs border border-slate-700 outline-none"
                          />
                          <button
                            onClick={() => {
                              const val = parseFloat(simSensorBerat) || 0;
                              setLiveScaleKg(val);
                              handleUpdateIoT({ Berat_LoadCell_Kg: val });
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                          >
                            Set
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Langkah 1 & 2: Tombol Mulai/Selesai Timbang & Tombol Tara Wadah */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2.5">
                        <p className="text-xs font-bold text-gray-500 uppercase">
                          1. Ambil Berat Kotor (Bruto)
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleMulaiTimbang}
                            className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition"
                          >
                            Mulai Timbang
                          </button>
                          <button
                            type="button"
                            onClick={handleSelesaiTimbang}
                            className="flex-1 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition"
                          >
                            Selesai Timbang
                          </button>
                        </div>
                        <p className="text-xs text-slate-700">
                          Berat Bruto Terkunci: <strong className="text-sm">{brutoKg} Kg</strong>
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                        <p className="text-xs font-bold text-amber-900 uppercase">
                          2. Kurangi Berat Wadah (Tara)
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleAmbilTaraDariSensor}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold py-2.5 px-3 rounded-xl transition"
                          >
                            Ambil Tara Wadah
                          </button>
                          <input
                            type="number"
                            step="0.1"
                            value={taraWadahKg}
                            onChange={(e) => setTaraWadahKg(parseFloat(e.target.value) || 0)}
                            className="w-20 px-2.5 py-2 rounded-xl border border-amber-300 text-xs font-bold bg-white outline-none"
                            title="Input Manual Berat Wadah (Kg)"
                          />
                        </div>
                        <p className="text-xs text-amber-900">
                          Potongan Wadah (Tara): <strong className="text-sm">-{taraWadahKg} Kg</strong>
                        </p>
                      </div>
                    </div>

                    {/* Hasil Akhir Berat Neto & Kirim ke Form Setoran */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase text-emerald-800">
                          Hasil Berat Bersih (Neto = Bruto - Wadah)
                        </p>
                        <p className="text-3xl font-extrabold text-emerald-700 mt-0.5">
                          {netoKg} Kg{' '}
                          <span className="text-sm font-semibold text-emerald-900">
                            ({formatRp(Math.round(netoKg * hargaPerKg))})
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleGunakanNetoKeSetoran}
                        className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-5 py-3.5 rounded-xl shadow transition"
                      >
                        Masukkan Neto ke Setoran
                      </button>
                    </div>
                  </div>

                  {/* PANEL 2: SENSOR LINGKUNGAN (MAGGOT & KEBUN) + KONTROL POMPA AIR */}
                  <div className="lg:col-span-6 space-y-6">
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-base font-extrabold text-slate-900">
                          Sensor Lingkungan Maggot (DHT) & Tanah Kebun
                        </h3>
                        <span className="text-[11px] text-gray-400">
                          Update: {iot.Terakhir_Update || '-'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-4 rounded-2xl bg-[#EBF7A9]/60 border border-emerald-100 text-center space-y-1">
                          <div className="flex justify-center text-emerald-800">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
                            </svg>
                          </div>
                          <p className="text-[11px] font-semibold text-emerald-900">Suhu Maggot</p>
                          <p className="text-lg font-extrabold text-slate-900">{iot.Suhu_Maggot_C}°C</p>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#EBF7A9]/60 border border-emerald-100 text-center space-y-1">
                          <div className="flex justify-center text-emerald-800">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a6 6 0 006-6c0-4-6-10-6-10S6 11 6 15a6 6 0 006 6z" />
                            </svg>
                          </div>
                          <p className="text-[11px] font-semibold text-emerald-900">Lembab Maggot</p>
                          <p className="text-lg font-extrabold text-slate-900">
                            {iot.Kelembaban_Maggot_Persen}%
                          </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#EBF7A9]/60 border border-emerald-100 text-center space-y-1">
                          <div className="flex justify-center text-emerald-800">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                          </div>
                          <p className="text-[11px] font-semibold text-emerald-900">Suhu Kebun</p>
                          <p className="text-lg font-extrabold text-slate-900">{iot.Suhu_Kebun_C}°C</p>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#EBF7A9] border border-emerald-200 text-center space-y-1">
                          <div className="flex justify-center text-emerald-800">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21V11m0 0C12 7 8 5 5 5c0 4 3 6 7 6zm0 0c0-4 4-6 7-6 0 4-3 6-7 6z" />
                            </svg>
                          </div>
                          <p className="text-[11px] font-semibold text-emerald-900">Lembab Tanah</p>
                          <p className="text-lg font-extrabold text-emerald-800">
                            {iot.Kelembaban_Tanah_Persen}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Kontrol Pompa Air (Auto / Manual) */}
                    <div className="bg-[#225808] text-white rounded-3xl p-6 shadow-md space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-300">
                            Penyiraman Biopond & Kebun
                          </span>
                          <h3 className="text-xl font-extrabold mt-0.5">Kontrol Pompa Air Pintar</h3>
                        </div>
                        <span
                          className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold ${
                            String(iot.Status_Pompa).toUpperCase() === 'ON'
                              ? 'bg-emerald-400 text-slate-950'
                              : 'bg-white/15 text-emerald-100'
                          }`}
                        >
                          POMPA: {iot.Status_Pompa || 'OFF'} ({iot.Mode_Pompa || 'AUTO'})
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white/10 rounded-2xl p-4 space-y-2.5">
                          <p className="text-xs font-bold text-emerald-200 uppercase">Mode Kerja Pompa</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateIoT({ Mode_Pompa: 'AUTO' })}
                              className={`py-2.5 rounded-xl text-xs font-extrabold transition ${
                                String(iot.Mode_Pompa).toUpperCase() === 'AUTO'
                                  ? 'bg-[#B6D455] text-slate-950 shadow'
                                  : 'bg-white/10 text-white hover:bg-white/20'
                              }`}
                            >
                              Otomatis (Sensor)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateIoT({ Mode_Pompa: 'MANUAL' })}
                              className={`py-2.5 rounded-xl text-xs font-extrabold transition ${
                                String(iot.Mode_Pompa).toUpperCase() === 'MANUAL'
                                  ? 'bg-[#B6D455] text-slate-950 shadow'
                                  : 'bg-white/10 text-white hover:bg-white/20'
                              }`}
                            >
                              Manual
                            </button>
                          </div>
                          <p className="text-[11px] text-emerald-200/90">
                            Mode Otomatis menyalakan pompa jika Kelembaban Tanah &lt;{' '}
                            <strong>{iot.Batas_Kering_Tanah_Persen || 40}%</strong>.
                          </p>
                        </div>

                        <div className="bg-white/10 rounded-2xl p-4 space-y-2.5">
                          <p className="text-xs font-bold text-emerald-200 uppercase">
                            Saklar Manual Pompa Air
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateIoT({ Mode_Pompa: 'MANUAL', Status_Pompa: 'ON' })
                              }
                              className={`py-2.5 rounded-xl text-xs font-extrabold transition ${
                                String(iot.Status_Pompa).toUpperCase() === 'ON'
                                  ? 'bg-emerald-400 text-slate-950 shadow'
                                  : 'bg-white/10 text-white hover:bg-white/20'
                              }`}
                            >
                              Nyalakan (ON)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateIoT({ Mode_Pompa: 'MANUAL', Status_Pompa: 'OFF' })
                              }
                              className={`py-2.5 rounded-xl text-xs font-extrabold transition ${
                                String(iot.Status_Pompa).toUpperCase() === 'OFF'
                                  ? 'bg-red-500 text-white shadow'
                                  : 'bg-white/10 text-white hover:bg-white/20'
                              }`}
                            >
                              Matikan (OFF)
                            </button>
                          </div>
                          <p className="text-[11px] text-emerald-200/90">
                            Perintah langsung disinkronkan ke Google Sheet & ESP32.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ======================================================== */}
            {/* TAB 3: SETORAN LIMBAH                                    */}
            {/* ======================================================== */}
            {activeTab === 'setoran' && (
              <section className="space-y-6">
                <div>
                  <p className="text-xs sm:text-sm text-emerald-700 font-bold uppercase tracking-wider">
                    Pencatatan Harian
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    Manajemen Setoran Limbah
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4 h-fit">
                    <div className="flex justify-between items-center">
                      <h3 className="text-base font-bold text-slate-900">Input Setoran Baru</h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab('iot')}
                        className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition"
                      >
                        Ambil dari Load Cell
                      </button>
                    </div>

                    <form onSubmit={handleSimpanSetoran} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                          Pilih Anggota / Supplier
                        </label>
                        <select
                          required
                          value={selectedSupplier}
                          onChange={(e) => setSelectedSupplier(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                        >
                          <option value="">-- Pilih Nama Anggota --</option>
                          {(data?.suppliers || []).map((s, idx) => (
                            <option key={idx} value={s.nama}>
                              {s.nama} ({s.no_hp})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                            Berat Diterima (Kg)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={beratKg}
                            onChange={(e) => setBeratKg(e.target.value)}
                            placeholder="0.0"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                            Layak Olah / Neto (Kg)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={beratLayakKg}
                            onChange={(e) => setBeratLayakKg(e.target.value)}
                            placeholder="Otomatis sama"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                          Status Bagi Hasil
                        </label>
                        <select
                          value={statusSetoran}
                          onChange={(e) => setStatusSetoran(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                        >
                          <option value="Dibayar">Dibayar</option>
                          <option value="Ditabung">Ditabung</option>
                          <option value="Pending">Pending</option>
                        </select>
                      </div>

                      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex justify-between items-center">
                        <span className="text-xs font-bold text-emerald-900">Estimasi Bagi Hasil:</span>
                        <span className="text-xl font-extrabold text-emerald-700">
                          {formatRp(estimasiBagiHasil)}
                        </span>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-2xl shadow transition text-sm"
                      >
                        Simpan
                      </button>
                    </form>
                  </div>

                  <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-base font-bold text-slate-900">Riwayat Setoran Terbaru</h3>
                      <span className="text-xs text-gray-400">30 Transaksi Terakhir</span>
                    </div>
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500 uppercase text-xs">
                            <th className="py-3 px-3">Tanggal</th>
                            <th className="py-3 px-3">Anggota</th>
                            <th className="py-3 px-3">Layak / Terima</th>
                            <th className="py-3 px-3">Bagi Hasil</th>
                            <th className="py-3 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(data?.today_logs || []).map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="py-3 px-3 text-xs text-gray-500">{r.tanggal}</td>
                              <td className="py-3 px-3 font-bold text-slate-800">{r.nama_supplier}</td>
                              <td className="py-3 px-3">
                                {r.berat_layak_kg} / {r.berat_kg} kg
                              </td>
                              <td className="py-3 px-3 font-bold text-emerald-700">
                                {formatRp(r.bagi_hasil_rp)}
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ======================================================== */}
            {/* TAB 4: ANGGOTA WARGA                                     */}
            {/* ======================================================== */}
            {activeTab === 'anggota' && (
              <section className="space-y-6">
                <div>
                  <p className="text-xs sm:text-sm text-emerald-700 font-bold uppercase tracking-wider">
                    Database Mitra Warga
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    Manajemen Anggota Penyetor
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-fit">
                    <h3 className="text-base font-bold text-slate-800 mb-4">Daftarkan Anggota Baru</h3>
                    <form onSubmit={handleSimpanSupplier} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                          Nama Lengkap
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Ibu Siti Aminah"
                          value={supNama}
                          onChange={(e) => setSupNama(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                          Nomor HP / WhatsApp
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="08123456789"
                          value={supHp}
                          onChange={(e) => setSupHp(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                          Password Login Warga
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="Buat password akses warga"
                          value={supPassword}
                          onChange={(e) => setSupPassword(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-2xl shadow transition text-sm"
                      >
                        Tambah Anggota
                      </button>
                    </form>
                  </div>

                  <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-base font-bold text-slate-800 mb-4">Daftar Anggota Terdaftar</h3>
                    <ul className="divide-y divide-gray-100 text-sm">
                      {(data?.suppliers || []).map((s, i) => (
                        <li
                          key={i}
                          className="py-3.5 px-2 flex justify-between items-center hover:bg-gray-50 rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                              {s.nama.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-800">{s.nama}</span>
                          </div>
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                            {s.no_hp}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* ======================================================== */}
            {/* TAB 5: KEUANGAN & HARGA                                  */}
            {/* ======================================================== */}
            {activeTab === 'keuangan' && (
              <section className="space-y-6">
                <div>
                  <p className="text-xs sm:text-sm text-emerald-700 font-bold uppercase tracking-wider">
                    Pencatatan Kas Bendahara
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    Keuangan Unit Usaha & Harga
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                      <h3 className="text-base font-bold text-slate-800 mb-4">
                        Catat Pemasukan / Pengeluaran
                      </h3>
                      <form onSubmit={handleSimpanKeuangan} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                              Jenis
                            </label>
                            <select
                              value={keuJenis}
                              onChange={(e) => {
                                setKeuJenis(e.target.value);
                                setKeuKategori(
                                  e.target.value === 'Pendapatan' ? 'Sayur' : 'Operasional'
                                );
                              }}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-sm outline-none"
                            >
                              <option value="Pendapatan">Pendapatan (+)</option>
                              <option value="Pengeluaran">Pengeluaran (-)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                              Unit Usaha
                            </label>
                            <select
                              value={keuKategori}
                              onChange={(e) => setKeuKategori(e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-sm outline-none"
                            >
                              {keuJenis === 'Pendapatan' ? (
                                <>
                                  <option value="Sayur">Sayur</option>
                                  <option value="Telur">Telur</option>
                                  <option value="Ekowisata">Ekowisata</option>
                                </>
                              ) : (
                                <>
                                  <option value="Operasional">Operasional Budidaya</option>
                                  <option value="Perawatan">Perawatan Kandang</option>
                                  <option value="Lainnya">Pengeluaran Lainnya</option>
                                </>
                              )}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                            Nominal (Rp)
                          </label>
                          <input
                            type="number"
                            required
                            placeholder="Contoh: 250000"
                            value={keuNominal}
                            onChange={(e) => setKeuNominal(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                            Keterangan
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: Penjualan panen sayur organik"
                            value={keuKeterangan}
                            onChange={(e) => setKeuKeterangan(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-2xl shadow transition text-sm"
                        >
                          Simpan Transaksi Kas
                        </button>
                      </form>
                    </div>

                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase text-emerald-700">
                          Tarif Konversi Setoran Warga
                        </p>
                        <p className="text-xs text-gray-500">Bagi hasil per Kg limbah layak olah</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={hargaPerKg}
                          onChange={(e) => setHargaPerKg(e.target.value)}
                          className="w-28 px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold text-right outline-none"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch('/api/admin/update-harga', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ harga_per_kg: hargaPerKg }),
                            });
                            const j = await res.json();
                            showToastMsg(j.message, !res.ok);
                          }}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"
                        >
                          Simpan
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-base font-bold text-slate-900 mb-4">
                      Riwayat Transaksi Kas Usaha
                    </h3>
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500 uppercase text-xs">
                            <th className="py-3 px-3">Tanggal</th>
                            <th className="py-3 px-3">Kategori</th>
                            <th className="py-3 px-3">Keterangan</th>
                            <th className="py-3 px-3 text-right">Nominal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(data?.keuangan_logs || []).map((k, i) => {
                            const isMasuk = k.jenis.toLowerCase() === 'pendapatan';
                            return (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="py-3 px-3 text-xs text-gray-500">
                                  {k.tanggal.split(' ')[0]}
                                </td>
                                <td className="py-3 px-3">
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                      isMasuk
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {k.kategori}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-gray-600">{k.keterangan}</td>
                                <td
                                  className={`py-3 px-3 text-right font-bold ${
                                    isMasuk ? 'text-emerald-700' : 'text-red-600'
                                  }`}
                                >
                                  {isMasuk ? '+' : '-'}
                                  {formatRp(k.nominal_rp)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>

        {/* ============================================================ */}
        {/* MODAL SETTING: TAMBAH / TAUTKAN SISTEM MONITORING IoT        */}
        {/* ============================================================ */}
        {showSettingModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase text-emerald-700">
                    Pengaturan Integrasi IoT
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Tambah / Tautkan Sistem Monitoring
                  </h3>
                </div>
                <button
                  onClick={() => setShowSettingModal(false)}
                  className="text-gray-400 hover:text-gray-700 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveSettingIoT} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Nama Unit Sistem Monitoring
                  </label>
                  <input
                    type="text"
                    required
                    value={namaSistemIoT}
                    onChange={(e) => setNamaSistemIoT(e.target.value)}
                    placeholder="Contoh: Biopond Maggot & Kebun Unit 1"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    ID Google Spreadsheet IoT (Tempat ESP32 Terhubung)
                  </label>
                  <input
                    type="text"
                    required
                    value={iotSheetId}
                    onChange={(e) => setIotSheetId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-mono bg-gray-50 outline-none"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Terhubung otomatis ke tab <strong>IoT_Monitoring</strong> pada Google Sheet Anda.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Ambang Batas Pompa Otomatis (Kelembaban Tanah %)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="95"
                    value={batasKeringTanah}
                    onChange={(e) => setBatasKeringTanah(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none"
                  />
                </div>

                <div className="bg-slate-900 text-emerald-300 p-3.5 rounded-2xl text-xs font-mono space-y-1">
                  <p className="text-white font-sans font-bold">Endpoint Webhook ESP32 Anda:</p>
                  <p className="break-all">
                    POST / GET: /api/iot/esp32?admin_email={data?.admin_email}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSettingModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow"
                  >
                    Simpan & Hubungkan Sistem
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* BOTTOM NAVIGATION BAR (KHUSUS MOBILE < 1024px)               */}
        {/* ============================================================ */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40">
          <div className="max-w-md mx-auto grid grid-cols-5 py-2">
            <button
              onClick={() => setActiveTab('dasbor')}
              className={`flex flex-col items-center py-1 ${
                activeTab === 'dasbor' ? 'text-emerald-700 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="text-[10px] mt-1">Dasbor</span>
            </button>

            <button
              onClick={() => setActiveTab('setoran')}
              className={`flex flex-col items-center py-1 ${
                activeTab === 'setoran' ? 'text-emerald-700 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2M4 17v2a1 1 0 001 1h2m10 0h2a1 1 0 001-1v-2M7 12h10" />
              </svg>
              <span className="text-[10px] mt-1">Setoran</span>
            </button>

            <button
              onClick={() => setActiveTab('anggota')}
              className={`flex flex-col items-center py-1 ${
                activeTab === 'anggota' ? 'text-emerald-700 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[10px] mt-1">Anggota</span>
            </button>

            <button
              onClick={() => setActiveTab('keuangan')}
              className={`flex flex-col items-center py-1 ${
                activeTab === 'keuangan' ? 'text-emerald-700 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="text-[10px] mt-1">Keuangan</span>
            </button>

            <button
              onClick={() => setActiveTab('iot')}
              className={`flex flex-col items-center py-1 ${
                activeTab === 'iot' ? 'text-emerald-700 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              <span className="text-[10px] mt-1">IoT</span>
            </button>
          </div>
        </nav>
      </div>
    </>
  );
}