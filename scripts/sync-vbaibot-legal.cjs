/**
 * sync-vbaibot-legal.cjs
 * Đồng bộ kho văn bản pháp luật từ vbaibot (SQLite legal_docs) sang VBAI (MongoDB known_documents).
 * Giúp cả 2 hệ thống dùng CHUNG kho văn bản, không bị trùng dữ liệu khi tra cứu và tải về.
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const SQLITE_PATH = '/var/www/vbaibot/data/zalo-agent.db';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGO_DB = process.env.MONGODB_DB_NAME || 'vbai_db';

function normalizeDocNum(str) {
  if (!str) return '';
  return str.replace(/[\s/._-]/g, '').toUpperCase().replace(/Đ/g, 'D');
}

function inferIssuer(soHieu, source) {
  const s = (soHieu || '').toUpperCase();
  if (s.includes('TTG') || s.includes('TT-TTG')) return 'Thủ tướng Chính phủ';
  if (s.includes('NQ-CP') || s.includes('NĐ-CP') || s.includes('ND-CP')) return 'Chính phủ';
  if (s.includes('VPCP')) return 'Văn phòng Chính phủ';
  if (s.includes('QH')) return 'Quốc hội';
  if (s.includes('UBTVQH')) return 'Ủy ban Thường vụ Quốc hội';
  if (s.includes('BQP')) return 'Bộ Quốc phòng';
  if (s.includes('BCA')) return 'Bộ Công an';
  if (s.includes('BTC')) return 'Bộ Tài chính';
  if (s.includes('BKHĐT') || s.includes('BKHDT')) return 'Bộ Kế hoạch và Đầu tư';
  if (s.includes('BNV')) return 'Bộ Nội vụ';
  if (s.includes('BTP')) return 'Bộ Tư pháp';
  if (s.includes('BYT')) return 'Bộ Y tế';
  if (s.includes('BGDĐT') || s.includes('BGDDT')) return 'Bộ Giáo dục và Đào tạo';
  if (s.includes('BGTVT')) return 'Bộ Giao thông vận tải';
  if (s.includes('BNNPTNT')) return 'Bộ Nông nghiệp và Phát triển nông thôn';
  if (s.includes('BCT')) return 'Bộ Công Thương';
  if (s.includes('BXD')) return 'Bộ Xây dựng';
  if (s.includes('BTNMT')) return 'Bộ Tài nguyên và Môi trường';
  if (s.includes('BTTTT')) return 'Bộ Thông tin và Truyền thông';
  if (s.includes('BLĐTBXH') || s.includes('BLDTBXH')) return 'Bộ Lao động - Thương binh và Xã hội';
  if (s.includes('BVHTTDL')) return 'Bộ Văn hóa, Thể thao và Du lịch';
  if (s.includes('BKHCN')) return 'Bộ Khoa học và Công nghệ';
  if (s.includes('UBND')) return 'Ủy ban nhân dân';
  if (s.includes('HĐND') || s.includes('HDND')) return 'Hội đồng nhân dân';
  if (source === 'congbao') return 'Công báo';
  return 'Chính phủ';
}

function inferDocType(soHieu, loaiVb) {
  if (loaiVb) {
    const l = loaiVb.toLowerCase();
    if (l.includes('hợp nhất')) return 'van_ban_hop_nhat';
    if (l.includes('nghị định')) return 'nghi_dinh';
    if (l.includes('quyết định')) return 'quyet_dinh';
    if (l.includes('nghị quyết')) return 'nghi_quyet';
    if (l.includes('thông tư')) return 'thong_tu';
    if (l.includes('luật')) return 'luat';
    if (l.includes('công văn')) return 'cong_van';
    if (l.includes('chỉ thị')) return 'chi_thi';
    if (l.includes('thông báo')) return 'thong_bao';
  }
  const s = (soHieu || '').toUpperCase();
  if (s.includes('VBHN')) return 'van_ban_hop_nhat';
  if (s.includes('NĐ-CP') || s.includes('ND-CP')) return 'nghi_dinh';
  if (s.includes('QĐ-') || s.includes('QD-')) return 'quyet_dinh';
  if (s.includes('NQ-')) return 'nghi_quyet';
  if (s.includes('TT-') || s.includes('TTLT-')) return 'thong_tu';
  if (s.includes('CT-')) return 'chi_thi';
  if (s.includes('CV-') || s.includes('/VPCP-')) return 'cong_van';
  return 'van_ban';
}

async function syncLegalDocs() {
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`[Sync] SQLite DB not found at: ${SQLITE_PATH}`);
    process.exit(1);
  }

  const sqlite = new DatabaseSync(SQLITE_PATH, { readOnly: true });
  const rows = sqlite.prepare(`
    SELECT id, source, so_hieu, so_hieu_norm, trich_yeu, loai_vb, ngay_ban_hanh,
           detail_url, file_url, status, file_path, file_size, discovered_at, downloaded_at
    FROM legal_docs
    WHERE so_hieu != ''
    ORDER BY discovered_at DESC
  `).all();
  sqlite.close();

  console.log(`[Sync] Read ${rows.length} documents from vbaibot legal_docs.`);

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(MONGO_DB);
  const collection = db.collection('known_documents');

  let inserted = 0;
  let updated = 0;

  for (const r of rows) {
    const docNum = String(r.so_hieu || '').trim();
    if (!docNum) continue;

    const normNum = r.so_hieu_norm || normalizeDocNum(docNum);
    const title = (r.trich_yeu || '').trim() || `Văn bản số ${docNum}`;
    const docType = inferDocType(docNum, r.loai_vb);
    const issuer = inferIssuer(docNum, r.source);
    const issueDate = r.ngay_ban_hanh || null;
    const fileUrl = r.file_url || null;
    const detailUrl = r.detail_url || null;
    const filePath = r.file_path && fs.existsSync(r.file_path) ? r.file_path : null;

    const sourceUrls = [detailUrl, fileUrl].filter(Boolean);
    const pdfUrls = fileUrl ? [fileUrl] : [];

    const docNumAscii = docNum.replace(/Đ/g, 'D').replace(/đ/g, 'd');
    const docNumVariants = Array.from(new Set([docNum, docNumAscii, docNum.toUpperCase(), docNumAscii.toUpperCase()]));

    const existing = await collection.findOne({
      $or: [
        { document_number: { $in: docNumVariants } },
        { documentNumber: { $in: docNumVariants } },
        { normalized_number: normNum }
      ]
    });

    const resolvedDocNum = existing?.document_number || docNum;
    const updatePayload = {
      document_number: resolvedDocNum,
      documentNumber: existing?.documentNumber || resolvedDocNum,
      normalized_number: existing?.normalized_number || normNum,
      title: existing?.title && existing.title.length > title.length ? existing.title : title,
      document_type: docType,
      issuer: existing?.issuer || issuer,
      issue_date: issueDate || existing?.issue_date,
      issueDate: issueDate || existing?.issueDate,
      effective_date: issueDate || existing?.effective_date,
      effectiveDate: issueDate || existing?.effectiveDate,
      effective_status: 'in_force',
      effectiveStatus: 'in_force',
      official_source_urls: Array.from(new Set([...(existing?.official_source_urls || []), ...sourceUrls])),
      source_url: detailUrl || fileUrl || existing?.source_url || '',
      pdf_download_url: fileUrl || existing?.pdf_download_url || null,
      pdf_download_urls: Array.from(new Set([...(existing?.pdf_download_urls || []), ...pdfUrls])),
      local_file_path: filePath || existing?.local_file_path || null,
      file_path: filePath || existing?.file_path || null,
      file_size: r.file_size || existing?.file_size || 0,
      vbaibot_id: r.id,
      source: 'vbaibot_legal_docs',
      verification_status: 'verified',
      review_state: 'published',
      updated_at: new Date()
    };

    try {
      if (existing) {
        const { document_number, documentNumber, normalized_number, ...safeSet } = updatePayload;
        await collection.updateOne({ _id: existing._id }, { $set: safeSet });
        updated++;
      } else {
        await collection.insertOne({
          ...updatePayload,
          created_at: new Date()
        });
        inserted++;
      }
    } catch (err) {
      if (err && err.code === 11000) {
        // Bỏ qua bản ghi trùng khóa unique (vd hai bản ghi cùng số hiệu NĐ-CP / ND-CP)
        continue;
      }
      throw err;
    }
  }

  const totalMongo = await collection.countDocuments();
  console.log(`[Sync Completed] Inserted: ${inserted}, Updated: ${updated}, Total in known_documents: ${totalMongo}`);
  await client.close();
}

syncLegalDocs().catch(err => {
  console.error('[Sync Error]', err);
  process.exit(1);
});
