/**
 * Simulator IoT & Data Generator untuk EcoCycle Maggot SaaS
 * Versi Stabil (Kompatibel dengan semua versi Node.js)
 */

const SPREADSHEET_ID = '1EFLxKs-5DmOoaNWMovvLQAXzoqM6jBh9HUUN4kMAOAM';
const WEBHOOK_URL = 'http://localhost:3000/api/iot/esp32';
const SETORAN_URL = 'http://localhost:3000/api/admin/setoran';

let simulasiSuhuMaggot = 29.2;
let simulasiLembabMaggot = 68.0;
let simulasiSuhuKebun = 28.5;
let simulasiLembabTanah = 52.0;
let simulasiBeratTimbangan = 0.0;
let statusPompa = 'OFF';

function getRandomFloat(min, max, decimals = 1) {
  const num = Math.random() * (max - min) + min;
  return Number(num.toFixed(decimals));
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function simulasikanSensorDanPompa() {
  simulasiSuhuMaggot = Math.min(32, Math.max(26, simulasiSuhuMaggot + getRandomFloat(-0.4, 0.4)));
  simulasiLembabMaggot = Math.min(85, Math.max(55, simulasiLembabMaggot + getRandomFloat(-1.5, 1.5)));
  simulasiSuhuKebun = Math.min(35, Math.max(24, simulasiSuhuKebun + getRandomFloat(-0.5, 0.5)));

  if (statusPompa === 'ON') {
    simulasiLembabTanah = Math.min(85, simulasiLembabTanah + getRandomFloat(3, 6));
    if (simulasiLembabTanah >= 75) statusPompa = 'OFF';
  } else {
    simulasiLembabTanah = Math.max(25, simulasiLembabTanah - getRandomFloat(0.2, 0.8));
    if (simulasiLembabTanah < 40) {
      statusPompa = 'ON';
    }
  }

  const payload = {
    spreadsheet_id: SPREADSHEET_ID,
    suhu_maggot: Number(simulasiSuhuMaggot.toFixed(1)),
    kelembaban_maggot: Number(simulasiLembabMaggot.toFixed(1)),
    suhu_kebun: Number(simulasiSuhuKebun.toFixed(1)),
    kelembaban_tanah: Number(simulasiLembabTanah.toFixed(1)),
    berat_kg: simulasiBeratTimbangan,
  };

  console.log(`\n[IoT SENSOR UPDATE] ---------------------------------------`);
  console.log(`🌡️ Suhu Maggot : ${payload.suhu_maggot}°C | 💧 Lembab Maggot: ${payload.kelembaban_maggot}%`);
  console.log(`☀️ Suhu Kebun  : ${payload.suhu_kebun}°C  | 🌱 Lembab Tanah : ${payload.kelembaban_tanah}%`);
  console.log(`💦 Status Pompa: ${statusPompa} (Mode AUTO)`);

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    console.log(`[SERVER RESPONSE] Berhasil dikirim ke web! Status Pompa:`, result.status_pompa);
  } catch (err) {
    console.error(`[SIMULATOR ERROR] Gagal mengirim ke web lokal (Pastikan 'npm run dev' menyala):`, err.message);
  }
}

const daftarNamaWarga = [
  'Budi Santoso', 'Siti Aminah', 'Ahmad Fauzi', 'Dewi Lestari', 
  'Eko Prasetyo', 'Rina Marlina', 'Joko Widodo', 'Sri Wahyuni'
];

async function simulasikanSetoranWarga() {
  const wargaAcak = daftarNamaWarga[getRandomInt(0, daftarNamaWarga.length - 1)];
  const beratSampah = getRandomFloat(2.0, 18.0, 1);
  simulasiBeratTimbangan = beratSampah;

  console.log(`\n[SETORAN WARGA BARU] ⚖️ ${wargaAcak} menyetor ${beratSampah} Kg sampah organik.`);

  try {
    const res = await fetch(SETORAN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama_supplier: wargaAcak,
        berat_kg: beratSampah,
        berat_layak_kg: Number((beratSampah * 0.9).toFixed(1)),
        status: 'Dibayar',
      }),
    });
    const result = await res.json();
    console.log(`[SETORAN TERKIRIM] Respon Google Sheet:`, result.message);
  } catch (err) {
    console.error(`[SETORAN ERROR]:`, err.message);
  }
}

console.log(`==================================================`);
console.log(`🚀 ECOCYCLE IoT & DATA GENERATOR SIMULATOR STARTED`);
console.log(`Target Spreadsheet ID: ${SPREADSHEET_ID}`);
console.log(`Tekan Ctrl + C untuk menghentikan simulator.`);
console.log(`==================================================`);

// Eksekusi pertama kali
simulasikanSensorDanPompa();

// Jalankan interval per 10 detik untuk sensor, dan 45 detik untuk setoran warga
setInterval(simulasikanSensorDanPompa, 10000);
setInterval(simulasikanSetoranWarga, 45000);