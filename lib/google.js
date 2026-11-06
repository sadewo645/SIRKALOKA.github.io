import { google } from 'googleapis';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { serialize, parse } from 'cookie';

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

// Penyimpanan sementara yang aman baik di Lokal maupun di Serverless Vercel (/tmp)
const TMP_DB_PATH = path.join('/tmp', 'ecocycle_central_db.json');
const LOCAL_DB_PATH = path.join(process.cwd(), 'central_db.json');

export function loadCentralDb() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
    }
    if (fs.existsSync(TMP_DB_PATH)) {
      return JSON.parse(fs.readFileSync(TMP_DB_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

export function saveCentralDb(data) {
  try {
    fs.writeFileSync(TMP_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    // Di Vercel, direktori root bersifat read-only, sehingga otomatis memakai /tmp & Cookie
  }
}

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Enkripsi Cookie Sesi agar Serverless Vercel tidak kehilangan state login
const SECRET = crypto
  .createHash('sha256')
  .update(process.env.SECRET_KEY || 'ecocycle_secret_key')
  .digest();

export function setSessionCookie(res, sessionData) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET, iv);
  let encrypted = cipher.update(JSON.stringify(sessionData), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const payload = `${iv.toString('hex')}:${encrypted}`;

  res.setHeader(
    'Set-Cookie',
    serialize('ecocycle_session', payload, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 Hari
      sameSite: 'lax',
    })
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    serialize('ecocycle_session', '', {
      httpOnly: true,
      path: '/',
      maxAge: -1,
    })
  );
}

export function getSession(req) {
  try {
    const cookies = parse(req.headers.cookie || '');
    if (!cookies.ecocycle_session) return null;
    const [ivHex, encrypted] = cookies.ecocycle_session.split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      SECRET,
      Buffer.from(ivHex, 'hex')
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt:32768:8:1$${salt}$${hash.toString('hex')}`;
}

function matchesInConstantTime(value, expected) {
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function verifyPassword(password, storedPassword) {
  const scryptMatch = storedPassword.match(
    /^scrypt:(\d+):(\d+):(\d+)\$([^$]+)\$([a-f\d]+)$/i
  );

  if (scryptMatch) {
    const [, costValue, blockSizeValue, parallelizationValue, salt, hashHex] = scryptMatch;
    const N = Number(costValue);
    const r = Number(blockSizeValue);
    const p = Number(parallelizationValue);
    const expectedHash = Buffer.from(hashHex, 'hex');
    const maxmem = 64 * 1024 * 1024;

    if (
      !Number.isSafeInteger(N) ||
      N < 2 ||
      N > 32768 ||
      (N & (N - 1)) !== 0 ||
      !Number.isSafeInteger(r) ||
      r < 1 ||
      r > 16 ||
      !Number.isSafeInteger(p) ||
      p < 1 ||
      p > 4 ||
      128 * N * r + 128 * r * p + 256 * r >= maxmem ||
      expectedHash.length === 0 ||
      expectedHash.length * 2 !== hashHex.length
    ) {
      return false;
    }

    const actualHash = crypto.scryptSync(password, salt, expectedHash.length, {
      N,
      r,
      p,
      maxmem,
    });
    return crypto.timingSafeEqual(actualHash, expectedHash);
  }

  const legacyHash = crypto.createHmac('sha256', SECRET).update(password).digest('hex');
  return matchesInConstantTime(legacyHash, storedPassword) ||
    matchesInConstantTime(password, storedPassword);
}

export function safeFloat(val, def = 0) {
  if (val === null || val === undefined || val === '') return def;
  if (typeof val === 'number') return val;
  let s = String(val).trim().replace(/[^\d.,-]/g, '');
  if (!s || s === '-') return def;
  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const num = parseFloat(s);
  return isNaN(num) ? def : num;
}

export async function getSheetsClientForTenant(sessionOrTenant) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: sessionOrTenant.refresh_token,
    access_token: sessionOrTenant.access_token,
  });

  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  return { sheets, spreadsheetId: sessionOrTenant.spreadsheet_id, oauth2Client };
}

// Memastikan 5 Tab Standar (Termasuk IoT_Monitoring) tersedia di Google Sheet
export async function ensureRequiredTabs(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set(
    (meta.data.sheets || []).map((s) => s.properties.title)
  );

  const requiredTabs = [
    'Pengaturan_Sistem',
    'Data_Supplier',
    'Log_Setoran',
    'Log_Keuangan',
    'IoT_Monitoring',
  ];

  const requests = [];
  for (const title of requiredTabs) {
    if (!existingTitles.has(title)) {
      requests.push({ addSheet: { properties: { title } } });
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });

    const batchData = [];
    if (!existingTitles.has('Log_Keuangan')) {
      batchData.push({
        range: 'Log_Keuangan!A1:E1',
        values: [['Tanggal', 'Jenis', 'Kategori', 'Nominal_Rp', 'Keterangan']],
      });
    }
    if (!existingTitles.has('IoT_Monitoring')) {
      batchData.push({
        range: 'IoT_Monitoring!A1:B12',
        values: [
          ['Parameter', 'Nilai'],
          ['Nama_Sistem', 'Unit Biopond & Kebun Utama'],
          ['Status_Koneksi', 'Aktif'],
          ['IoT_Spreadsheet_ID', spreadsheetId],
          ['Berat_LoadCell_Kg', '0'],
          ['Status_Timbangan', 'IDLE'],
          ['Suhu_Maggot_C', '29.5'],
          ['Kelembaban_Maggot_Persen', '68'],
          ['Suhu_Kebun_C', '28.0'],
          ['Kelembaban_Tanah_Persen', '45'],
          ['Mode_Pompa', 'AUTO'],
          ['Status_Pompa', 'OFF'],
        ],
      });
      batchData.push({
        range: 'IoT_Monitoring!A13:B14',
        values: [
          ['Batas_Kering_Tanah_Persen', '40'],
          ['Terakhir_Update', new Date().toISOString().replace('T', ' ').slice(0, 19)],
        ],
      });
    }

    if (batchData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: 'RAW', data: batchData },
      });
    }
  }
}

export async function initializeTenantSpreadsheet(oauth2Client, adminName) {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // Cek apakah sudah pernah punya file "Sistem Maggot - [Nama]" di Google Drive
  const searchRes = await drive.files.list({
    q: `name = 'Sistem Maggot - ${adminName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: 'files(id, name)',
  });

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    const existingId = searchRes.data.files[0].id;
    await ensureRequiredTabs(sheets, existingId);
    return existingId;
  }

  // Jika belum ada, buat Spreadsheet baru beserta 5 Tab
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `Sistem Maggot - ${adminName}` },
      sheets: [
        { properties: { title: 'Pengaturan_Sistem' } },
        { properties: { title: 'Data_Supplier' } },
        { properties: { title: 'Log_Setoran' } },
        { properties: { title: 'Log_Keuangan' } },
        { properties: { title: 'IoT_Monitoring' } },
      ],
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId;
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        {
          range: 'Pengaturan_Sistem!A1:B2',
          values: [
            ['Kunci', 'Nilai'],
            ['Harga_Per_Kg', '1000'],
          ],
        },
        {
          range: 'Data_Supplier!A1:C1',
          values: [['Nama_Supplier', 'No_HP', 'Password']],
        },
        {
          range: 'Log_Setoran!A1:F1',
          values: [
            ['Tanggal', 'Nama_Supplier', 'Berat_Kg', 'Bagi_Hasil_Rp', 'Status', 'Berat_Layak_Kg'],
          ],
        },
        {
          range: 'Log_Keuangan!A1:E1',
          values: [['Tanggal', 'Jenis', 'Kategori', 'Nominal_Rp', 'Keterangan']],
        },
        {
          range: 'IoT_Monitoring!A1:B14',
          values: [
            ['Parameter', 'Nilai'],
            ['Nama_Sistem', 'Unit Biopond & Kebun Utama'],
            ['Status_Koneksi', 'Aktif'],
            ['IoT_Spreadsheet_ID', spreadsheetId],
            ['Berat_LoadCell_Kg', '0'],
            ['Status_Timbangan', 'IDLE'],
            ['Suhu_Maggot_C', '29.5'],
            ['Kelembaban_Maggot_Persen', '68'],
            ['Suhu_Kebun_C', '28.0'],
            ['Kelembaban_Tanah_Persen', '45'],
            ['Mode_Pompa', 'AUTO'],
            ['Status_Pompa', 'OFF'],
            ['Batas_Kering_Tanah_Persen', '40'],
            ['Terakhir_Update', nowStr],
          ],
        },
      ],
    },
  });

  return spreadsheetId;
}