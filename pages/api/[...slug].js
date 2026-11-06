import { google } from 'googleapis';
import {
  getOAuth2Client,
  loadCentralDb,
  saveCentralDb,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  hashPassword,
  verifyPassword,
  safeFloat,
  getSheetsClientForTenant,
  ensureRequiredTabs,
  initializeTenantSpreadsheet,
} from '../../lib/google';

const NAMA_BULAN_ID = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const NAMA_BULAN_SINGKAT = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

function parseDateFlexible(dateStr) {
  if (!dateStr) return null;
  const part = String(dateStr).trim().split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
    const [y, m, d] = part.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(part)) {
    const [d, m, y] = part.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatNow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export default async function handler(req, res) {
  const { slug } = req.query;
  const routePath = Array.isArray(slug) ? slug.join('/') : slug;

  try {
    // =================================================================
    // 1. GOOGLE OAUTH2 LOGIN & REGISTER
    // =================================================================
    if (routePath.startsWith('auth/google')) {
      const oauth2Client = getOAuth2Client();
      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: true,
        scope: [
          'openid',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });
      return res.redirect(url);
    }

    // =================================================================
    // 2. OAUTH2 CALLBACK DARI GOOGLE
    // =================================================================
    if (routePath === 'oauth2callback') {
      const { code } = req.query;
      if (!code) return res.status(400).send('Kode OAuth tidak ditemukan.');

      const oauth2Client = getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const adminEmail = (userInfo.data.email || '').toLowerCase();
      const adminName = userInfo.data.name || adminEmail.split('@')[0];

      const db = loadCentralDb();
      const existing = db[adminEmail] || {};

      const refreshToken = tokens.refresh_token || existing.refresh_token;
      const spreadsheetId = await initializeTenantSpreadsheet(oauth2Client, adminName);

      const tenantData = {
        admin_email: adminEmail,
        admin_name: adminName,
        spreadsheet_id: spreadsheetId,
        refresh_token: refreshToken,
        access_token: tokens.access_token,
      };

      db[adminEmail] = tenantData;
      saveCentralDb(db);

      setSessionCookie(res, {
        role: 'admin',
        ...tenantData,
      });

      return res.redirect('/admin');
    }

    // =================================================================
    // 3. LOGOUT
    // =================================================================
    if (routePath === 'logout') {
      clearSessionCookie(res);
      return res.redirect('/');
    }

    // =================================================================
    // 4. LOGIN SUPPLIER (WARGA)
    // =================================================================
    if (routePath === 'login/supplier' && req.method === 'POST') {
      const { admin_email, supplier_name, password } = req.body || {};
      const emailKey = (admin_email || '').trim().toLowerCase();
      const supName = (supplier_name || '').trim();
      const pass = (password || '').trim();

      if (!emailKey || !supName || !pass) {
        return res.status(400).json({ status: 'error', message: 'Semua kolom wajib diisi.' });
      }

      const db = loadCentralDb();
      const tenant = db[emailKey];
      if (!tenant) {
        return res.status(404).json({
          status: 'error',
          message: 'Email Admin belum terdaftar atau sesi server perlu disinkronkan oleh Admin.',
        });
      }

      const { sheets, spreadsheetId } = await getSheetsClientForTenant(tenant);
      const supRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Data_Supplier!A2:C',
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const rows = supRes.data.values || [];

      for (const row of rows) {
        if (row.length >= 3) {
          const rName = String(row[0]).trim();
          const rHp = String(row[1]).trim();
          const rPass = String(row[2]).trim();

          if (rName.toLowerCase() === supName.toLowerCase()) {
            const isValid = verifyPassword(pass, rPass);
            if (isValid) {
              setSessionCookie(res, {
                role: 'supplier',
                admin_email: emailKey,
                admin_name: tenant.admin_name,
                spreadsheet_id: tenant.spreadsheet_id,
                refresh_token: tenant.refresh_token,
                access_token: tenant.access_token,
                supplier_name: rName,
                supplier_hp: rHp,
              });
              return res.json({ status: 'success', redirect: '/supplier' });
            } else {
              return res.status(401).json({ status: 'error', message: 'Password salah.' });
            }
          }
        }
      }

      return res.status(404).json({ status: 'error', message: 'Nama Supplier tidak ditemukan.' });
    }

    // =================================================================
    // 5. WEBHOOK / ENDPOINT KHUSUS PERANGKAT IoT (ESP32)
    // =================================================================
    if (routePath === 'iot/esp32') {
      // ESP32 dapat mengirim data sensor via POST atau membaca status pompa via GET
      const adminEmail = String(req.query.admin_email || req.body?.admin_email || '').toLowerCase();
      const db = loadCentralDb();
      const tenant = db[adminEmail] || Object.values(db)[0];

      if (!tenant) {
        return res.status(404).json({ status: 'error', message: 'Tenant aktif tidak ditemukan.' });
      }

      const { sheets, spreadsheetId } = await getSheetsClientForTenant(tenant);
      await ensureRequiredTabs(sheets, spreadsheetId);

      if (req.method === 'POST') {
        const {
          berat_kg,
          suhu_maggot,
          kelembaban_maggot,
          suhu_kebun,
          kelembaban_tanah,
        } = req.body || {};

        const iotGet = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'IoT_Monitoring!A2:B14',
          valueRenderOption: 'UNFORMATTED_VALUE',
        });

        const map = {};
        for (const r of iotGet.data.values || []) {
          if (r[0]) map[String(r[0]).trim()] = r[1];
        }

        if (berat_kg !== undefined) map['Berat_LoadCell_Kg'] = safeFloat(berat_kg, 0);
        if (suhu_maggot !== undefined) map['Suhu_Maggot_C'] = safeFloat(suhu_maggot, 29);
        if (kelembaban_maggot !== undefined) map['Kelembaban_Maggot_Persen'] = safeFloat(kelembaban_maggot, 68);
        if (suhu_kebun !== undefined) map['Suhu_Kebun_C'] = safeFloat(suhu_kebun, 28);
        if (kelembaban_tanah !== undefined) map['Kelembaban_Tanah_Persen'] = safeFloat(kelembaban_tanah, 45);

        // Logika Auto Pompa Air jika Mode_Pompa == AUTO
        const modePompa = String(map['Mode_Pompa'] || 'AUTO').toUpperCase();
        const batasKering = safeFloat(map['Batas_Kering_Tanah_Persen'], 40);
        const tanahSekarang = safeFloat(map['Kelembaban_Tanah_Persen'], 45);

        if (modePompa === 'AUTO') {
          map['Status_Pompa'] = tanahSekarang < batasKering ? 'ON' : 'OFF';
        }
        map['Terakhir_Update'] = formatNow();

        const orderedKeys = [
          'Nama_Sistem', 'Status_Koneksi', 'IoT_Spreadsheet_ID',
          'Berat_LoadCell_Kg', 'Status_Timbangan', 'Suhu_Maggot_C',
          'Kelembaban_Maggot_Persen', 'Suhu_Kebun_C', 'Kelembaban_Tanah_Persen',
          'Mode_Pompa', 'Status_Pompa', 'Batas_Kering_Tanah_Persen', 'Terakhir_Update',
        ];

        const valuesToWrite = orderedKeys.map((k) => [k, map[k] ?? '']);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'IoT_Monitoring!A2:B14',
          valueInputOption: 'RAW',
          requestBody: { values: valuesToWrite },
        });

        return res.json({
          status: 'success',
          mode_pompa: map['Mode_Pompa'],
          status_pompa: map['Status_Pompa'],
          status_timbangan: map['Status_Timbangan'],
        });
      }

      // Jika GET dari ESP32
      const iotGet = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'IoT_Monitoring!A2:B14',
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
      const map = {};
      for (const r of iotGet.data.values || []) {
        if (r[0]) map[String(r[0]).trim()] = r[1];
      }
      return res.json({ status: 'success', iot: map });
    }

    // =================================================================
    // VALIDASI SESI UNTUK ENDPOINT ADMIN & SUPPLIER
    // =================================================================
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ status: 'error', message: 'Sesi telah berakhir. Silakan login kembali.' });
    }

    // Simpan ulang ke cache lokal/tmp agar login supplier selalu terhubung
    if (session.role === 'admin') {
      const db = loadCentralDb();
      db[session.admin_email] = {
        admin_email: session.admin_email,
        admin_name: session.admin_name,
        spreadsheet_id: session.spreadsheet_id,
        refresh_token: session.refresh_token,
        access_token: session.access_token,
      };
      saveCentralDb(db);
    }

    const { sheets, spreadsheetId } = await getSheetsClientForTenant(session);

    // =================================================================
    // 6. ENDPOINT INIT DATA DASHBOARD ADMIN + GRAFIK + IoT
    // =================================================================
    if (routePath === 'admin/init-data' && req.method === 'GET') {
      await ensureRequiredTabs(sheets, spreadsheetId);

      const batchRes = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: [
          'Pengaturan_Sistem!A2:B',
          'Data_Supplier!A2:B',
          'Log_Setoran!A2:F',
          'Log_Keuangan!A2:E',
          'IoT_Monitoring!A2:B14',
        ],
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const valueRanges = batchRes.data.valueRanges || [];

      // 1. Harga Per Kg
      let hargaPerKg = 1000;
      for (const row of valueRanges[0]?.values || []) {
        if (row[0] === 'Harga_Per_Kg') hargaPerKg = safeFloat(row[1], 1000);
      }

      // 2. Daftar Anggota Supplier
      const suppliers = (valueRanges[1]?.values || [])
        .filter((r) => r && r[0])
        .map((r) => ({
          nama: String(r[0]).trim(),
          no_hp: r[1] ? String(r[1]).trim() : '-',
        }));

      // 3. Log Setoran & Data Grafik (Harian, 1 Bulan, 1 Tahun)
      const now = new Date();
      const currYear = now.getFullYear();
      const prevYear = currYear - 1;
      const currMonth = now.getMonth() + 1;

      const dailyDates = [];
      const dailyLabels = [];
      const dailyLayakMap = {};
      const dailyDiterimaMap = {};

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        dailyDates.push(key);
        dailyLabels.push(`${d.getDate()} ${NAMA_BULAN_SINGKAT[d.getMonth() + 1]}`);
        dailyLayakMap[key] = 0;
        dailyDiterimaMap[key] = 0;
      }

      const daysInMonth = new Date(currYear, currMonth, 0).getDate();
      const monthlyLabels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
      const monthlyLayak = Array(daysInMonth).fill(0);
      const monthlyDiterima = Array(daysInMonth).fill(0);

      const yearlyLabels = NAMA_BULAN_SINGKAT.slice(1);
      const yearlyCurr = Array(12).fill(0);
      const yearlyPrev = Array(12).fill(0);

      let limbahDiterimaBulanIni = 0;
      let limbahLayakBulanIni = 0;
      let limbahHariIni = 0;
      const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

      const rawSetoran = valueRanges[2]?.values || [];
      const allLogs = [];

      for (let i = rawSetoran.length - 1; i >= 0; i--) {
        const row = rawSetoran[i];
        if (!row || row.length < 3) continue;

        const tglStr = String(row[0] || '');
        const namaSup = String(row[1] || '-');
        const beratDiterima = safeFloat(row[2], 0);
        const bagiHasil = safeFloat(row[3], 0);
        const statusStr = String(row[4] || 'Dibayar');
        const beratLayak = row.length > 5 && row[5] !== '' ? safeFloat(row[5], beratDiterima) : beratDiterima;

        const dt = parseDateFlexible(tglStr);
        if (dt) {
          const dKey = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
          if (dKey in dailyLayakMap) {
            dailyLayakMap[dKey] += beratLayak;
            dailyDiterimaMap[dKey] += beratDiterima;
          }
          if (dKey === todayKey) limbahHariIni += beratLayak;

          const y = dt.getFullYear();
          const m = dt.getMonth() + 1;
          if (y === currYear) {
            yearlyCurr[m - 1] += beratLayak;
            if (m === currMonth) {
              limbahDiterimaBulanIni += beratDiterima;
              limbahLayakBulanIni += beratLayak;
              const dayIdx = dt.getDate() - 1;
              if (dayIdx >= 0 && dayIdx < daysInMonth) {
                monthlyLayak[dayIdx] += beratLayak;
                monthlyDiterima[dayIdx] += beratDiterima;
              }
            }
          } else if (y === prevYear) {
            yearlyPrev[m - 1] += beratLayak;
          }
        }

        allLogs.push({
          tanggal: tglStr,
          nama_supplier: namaSup,
          berat_kg: Number(beratDiterima.toFixed(2)),
          berat_layak_kg: Number(beratLayak.toFixed(2)),
          bagi_hasil_rp: Math.round(bagiHasil),
          status: statusStr,
        });
      }

      const persenLayak =
        limbahDiterimaBulanIni > 0
          ? Math.min(100, Math.round((limbahLayakBulanIni / limbahDiterimaBulanIni) * 100))
          : 0;

      // 4. Log Keuangan (Sayur, Telur, Ekowisata & Bagi Hasil 80:20)
      const rawKeuangan = valueRanges[3]?.values || [];
      const pendapatanKategori = { Sayur: 0, Telur: 0, Ekowisata: 0 };
      let pendapatanBulanIni = 0;
      let pengeluaranBulanIni = 0;
      const labaPerBulan = {};
      const keuanganLogs = [];

      for (let i = rawKeuangan.length - 1; i >= 0; i--) {
        const row = rawKeuangan[i];
        if (!row || row.length < 4) continue;
        const tglK = String(row[0] || '');
        const jenis = String(row[1] || 'Pendapatan');
        const kategori = String(row[2] || 'Sayur');
        const nominal = Math.round(safeFloat(row[3], 0));
        const ket = String(row[4] || '-');

        const dtK = parseDateFlexible(tglK);
        if (dtK) {
          const ymKey = `${dtK.getFullYear()}-${dtK.getMonth() + 1}`;
          if (!labaPerBulan[ymKey]) labaPerBulan[ymKey] = { year: dtK.getFullYear(), net: 0 };

          if (jenis.toLowerCase() === 'pendapatan') {
            labaPerBulan[ymKey].net += nominal;
          } else {
            labaPerBulan[ymKey].net -= nominal;
          }

          if (dtK.getFullYear() === currYear && dtK.getMonth() + 1 === currMonth) {
            if (jenis.toLowerCase() === 'pendapatan') {
              pendapatanBulanIni += nominal;
              if (kategori in pendapatanKategori) pendapatanKategori[kategori] += nominal;
            } else {
              pengeluaranBulanIni += nominal;
            }
          }
        }

        keuanganLogs.push({
          tanggal: tglK,
          jenis,
          kategori,
          nominal_rp: nominal,
          keterangan: ket,
        });
      }

      const labaBersih = Math.max(0, pendapatanBulanIni - pengeluaranBulanIni);
      const kasCadangan20 = Math.round(labaBersih * 0.2);
      const dibagikanWarga80 = Math.round(labaBersih * 0.8);

      let totalKasCadangan = 0;
      let totalKembaliWargaTahunIni = 0;
      Object.values(labaPerBulan).forEach((item) => {
        if (item.net > 0) {
          totalKasCadangan += Math.round(item.net * 0.2);
          if (item.year === currYear) totalKembaliWargaTahunIni += Math.round(item.net * 0.8);
        }
      });

      // 5. Data IoT Monitoring
      const iotMap = {
        Nama_Sistem: 'Unit Biopond & Kebun Utama',
        Status_Koneksi: 'Aktif',
        IoT_Spreadsheet_ID: spreadsheetId,
        Berat_LoadCell_Kg: 0,
        Status_Timbangan: 'IDLE',
        Suhu_Maggot_C: 29.5,
        Kelembaban_Maggot_Persen: 68,
        Suhu_Kebun_C: 28.0,
        Kelembaban_Tanah_Persen: 45,
        Mode_Pompa: 'AUTO',
        Status_Pompa: 'OFF',
        Batas_Kering_Tanah_Persen: 40,
        Terakhir_Update: formatNow(),
      };

      for (const r of valueRanges[4]?.values || []) {
        if (r && r[0]) iotMap[String(r[0]).trim()] = r[1];
      }

      return res.json({
        status: 'success',
        admin_name: session.admin_name,
        admin_email: session.admin_email,
        spreadsheet_id: spreadsheetId,
        harga_per_kg: hargaPerKg,
        suppliers,
        today_logs: allLogs.slice(0, 30),
        keuangan_logs: keuanganLogs.slice(0, 30),
        iot: iotMap,
        analytics: {
          curr_year: currYear,
          prev_year: prevYear,
          bulan_nama: NAMA_BULAN_ID[currMonth],
          limbah_hari_ini_kg: Number(limbahHariIni.toFixed(2)),
          limbah_layak_kg: Number(limbahLayakBulanIni.toFixed(2)),
          limbah_diterima_kg: Number(limbahDiterimaBulanIni.toFixed(2)),
          persen_layak: persenLayak,
          pendapatan_bulan_ini: pendapatanBulanIni,
          pengeluaran_bulan_ini: pengeluaranBulanIni,
          pendapatan_sayur: pendapatanKategori.Sayur,
          pendapatan_telur: pendapatanKategori.Telur,
          pendapatan_ekowisata: pendapatanKategori.Ekowisata,
          laba_bersih: labaBersih,
          kas_cadangan_20: kasCadangan20,
          dibagikan_warga_80: dibagikanWarga80,
          total_kas_cadangan: totalKasCadangan,
          total_kembali_warga_tahun_ini: totalKembaliWargaTahunIni,
          charts: {
            daily: {
              labels: dailyLabels,
              layak: dailyDates.map((k) => Number(dailyLayakMap[k].toFixed(2))),
              diterima: dailyDates.map((k) => Number(dailyDiterimaMap[k].toFixed(2))),
            },
            monthly: {
              labels: monthlyLabels,
              layak: monthlyLayak.map((x) => Number(x.toFixed(2))),
              diterima: monthlyDiterima.map((x) => Number(x.toFixed(2))),
            },
            yearly: {
              labels: yearlyLabels,
              curr_year: yearlyCurr.map((x) => Number(x.toFixed(2))),
              prev_year: yearlyPrev.map((x) => Number(x.toFixed(2))),
            },
          },
        },
      });
    }

    // =================================================================
    // 7. UPDATE HARGA PER KG
    // =================================================================
    if (routePath === 'admin/update-harga' && req.method === 'POST') {
      const val = safeFloat(req.body?.harga_per_kg, -1);
      if (val < 0) return res.status(400).json({ status: 'error', message: 'Harga tidak valid.' });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Pengaturan_Sistem!A2:B2',
        valueInputOption: 'RAW',
        requestBody: { values: [['Harga_Per_Kg', Math.round(val)]] },
      });
      return res.json({ status: 'success', message: 'Harga per Kg berhasil disimpan.' });
    }

    // =================================================================
    // 8. TAMBAH ANGGOTA / SUPPLIER BARU
    // =================================================================
    if (routePath === 'admin/supplier' && req.method === 'POST') {
      const { nama, no_hp, password } = req.body || {};
      if (!nama || !no_hp || !password) {
        return res.status(400).json({ status: 'error', message: 'Semua kolom wajib diisi.' });
      }

      const hashed = hashPassword(String(password).trim());
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Data_Supplier!A:C',
        valueInputOption: 'RAW',
        requestBody: { values: [[String(nama).trim(), String(no_hp).trim(), hashed]] },
      });
      return res.json({ status: 'success', message: `Anggota ${nama} berhasil didaftarkan.` });
    }

    // =================================================================
    // 9. SIMPAN SETORAN LIMBAH
    // =================================================================
    if (routePath === 'admin/setoran' && req.method === 'POST') {
      const { nama_supplier, berat_kg, berat_layak_kg, status } = req.body || {};
      const beratDiterima = safeFloat(berat_kg, 0);
      const beratLayak =
        berat_layak_kg !== '' && berat_layak_kg !== undefined
          ? safeFloat(berat_layak_kg, beratDiterima)
          : beratDiterima;

      if (!nama_supplier || beratDiterima <= 0) {
        return res.status(400).json({ status: 'error', message: 'Pilih anggota dan masukkan berat > 0 Kg.' });
      }

      const setRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Pengaturan_Sistem!A2:B2',
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
      const hargaPerKg = safeFloat(setRes.data.values?.[0]?.[1], 1000);
      const bagiHasilRp = Math.round(beratLayak * hargaPerKg);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Log_Setoran!A:F',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[formatNow(), nama_supplier, beratDiterima, bagiHasilRp, status || 'Dibayar', beratLayak]],
        },
      });

      return res.json({ status: 'success', message: 'Setoran limbah berhasil disimpan ke Google Sheet.' });
    }

    // =================================================================
    // 10. SIMPAN TRANSAKSI KEUANGAN
    // =================================================================
    if (routePath === 'admin/keuangan' && req.method === 'POST') {
      const { jenis, kategori, nominal_rp, keterangan } = req.body || {};
      const nominal = Math.round(safeFloat(nominal_rp, 0));
      if (nominal <= 0) return res.status(400).json({ status: 'error', message: 'Nominal harus > 0.' });

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Log_Keuangan!A:E',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[formatNow(), jenis || 'Pendapatan', kategori || 'Sayur', nominal, keterangan || '-']],
        },
      });

      return res.json({ status: 'success', message: 'Transaksi keuangan berhasil dicatat.' });
    }

    // =================================================================
    // 11. PENGATURAN & KONTROL SISTEM IoT (POMPA, TIMBANGAN, SETTING)
    // =================================================================
    if (routePath === 'admin/iot-control' && req.method === 'POST') {
      const updates = req.body || {};

      const iotGet = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'IoT_Monitoring!A2:B14',
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const map = {};
      for (const r of iotGet.data.values || []) {
        if (r[0]) map[String(r[0]).trim()] = r[1];
      }

      Object.keys(updates).forEach((k) => {
        map[k] = updates[k];
      });

      // Jika Mode_Pompa diubah ke AUTO, evaluasi langsung status pompa terhadap batas kelembaban tanah
      if (String(map['Mode_Pompa']).toUpperCase() === 'AUTO') {
        const tanah = safeFloat(map['Kelembaban_Tanah_Persen'], 45);
        const batas = safeFloat(map['Batas_Kering_Tanah_Persen'], 40);
        map['Status_Pompa'] = tanah < batas ? 'ON' : 'OFF';
      }

      map['Terakhir_Update'] = formatNow();

      const orderedKeys = [
        'Nama_Sistem', 'Status_Koneksi', 'IoT_Spreadsheet_ID',
        'Berat_LoadCell_Kg', 'Status_Timbangan', 'Suhu_Maggot_C',
        'Kelembaban_Maggot_Persen', 'Suhu_Kebun_C', 'Kelembaban_Tanah_Persen',
        'Mode_Pompa', 'Status_Pompa', 'Batas_Kering_Tanah_Persen', 'Terakhir_Update',
      ];

      const valuesToWrite = orderedKeys.map((k) => [k, map[k] ?? '']);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'IoT_Monitoring!A2:B14',
        valueInputOption: 'RAW',
        requestBody: { values: valuesToWrite },
      });

      return res.json({
        status: 'success',
        message: 'Konfigurasi sistem IoT berhasil disinkronkan ke Google Sheet.',
        iot: map,
      });
    }

    // =================================================================
    // 12. ENDPOINT RIWAYAT SUPPLIER (SERVER-SIDE FILTERING)
    // =================================================================
    if (routePath === 'supplier/logs' && req.method === 'GET') {
      const supName = (session.supplier_name || '').trim().toLowerCase();
      const logRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Log_Setoran!A2:F',
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const rows = logRes.data.values || [];
      const logs = [];
      let totalBerat = 0;
      let totalBagiHasil = 0;

      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (r && r.length >= 3) {
          if (String(r[1] || '').trim().toLowerCase() === supName) {
            const b = safeFloat(r[2], 0);
            const rp = safeFloat(r[3], 0);
            totalBerat += b;
            totalBagiHasil += rp;
            logs.push({
              tanggal: String(r[0] || ''),
              berat_kg: Number(b.toFixed(2)),
              bagi_hasil_rp: Math.round(rp),
              status: String(r[4] || 'Dibayar'),
            });
          }
        }
      }

      return res.json({
        status: 'success',
        supplier_name: session.supplier_name,
        admin_name: session.admin_name,
        total_berat_kg: Number(totalBerat.toFixed(2)),
        total_bagi_hasil_rp: Math.round(totalBagiHasil),
        logs,
      });
    }

    return res.status(404).json({ status: 'error', message: 'Endpoint tidak ditemukan.' });
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Internal Server Error' });
  }
}