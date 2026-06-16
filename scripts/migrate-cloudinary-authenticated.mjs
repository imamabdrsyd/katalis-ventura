#!/usr/bin/env node
/**
 * Migrasi lampiran Cloudinary lama dari delivery type `upload` (publik) ke
 * `authenticated` (private, hanya bisa dibuka lewat signed URL dari server).
 *
 * Cakupan: hanya prefix `axion/attachments/` (struk transaksi + KTP kontak).
 * TIDAK menyentuh folder publik link-in-bio (mis. `gallery`) yang memang publik.
 *
 * URUTAN AMAN — jalankan script ini HANYA SETELAH:
 *   1. Kode signing (endpoint cloudinary-sign + resolver) sudah DEPLOY ke produksi.
 *   2. Upload preset `axion_gallery` di dashboard sudah di-set Type = Authenticated
 *      (supaya upload BARU sudah authenticated; script ini untuk file LAMA).
 * Kalau dijalankan sebelum kode signing deploy, preview file lama akan putus.
 *
 * Cara pakai:
 *   # Dry-run (default) — cuma menampilkan apa yang akan diubah, tidak mengubah apa pun
 *   node scripts/migrate-cloudinary-authenticated.mjs
 *
 *   # Eksekusi sungguhan
 *   APPLY=1 node scripts/migrate-cloudinary-authenticated.mjs
 *
 * Env yang dibutuhkan (sama seperti app):
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.env.APPLY === '1';
const PREFIX = 'axion/attachments/';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`✖ Env ${name} wajib di-set.`);
    process.exit(1);
  }
  return v;
}

cloudinary.config({
  cloud_name: requireEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME'),
  api_key: requireEnv('CLOUDINARY_API_KEY'),
  api_secret: requireEnv('CLOUDINARY_API_SECRET'),
  secure: true,
});

const supabase = createClient(
  requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } }
);

const log = (...a) => console.log(...a);

/** Ganti delivery type pada URL Cloudinary: /image/upload/ -> /image/authenticated/ (juga raw, video). */
function toAuthenticatedUrl(url) {
  if (typeof url !== 'string') return url;
  return url.replace(
    /(res\.cloudinary\.com\/[^/]+\/(?:image|raw|video)\/)upload\//,
    '$1authenticated/'
  );
}

function isTargetUrl(url) {
  return (
    typeof url === 'string' &&
    /res\.cloudinary\.com\/[^/]+\/(?:image|raw|video)\/upload\//.test(url) &&
    url.includes('/axion/attachments/')
  );
}

// --- 1. Rename semua asset Cloudinary di prefix ke type authenticated ---
async function migrateCloudinaryAssets() {
  let migrated = 0;
  let skipped = 0;
  for (const resourceType of ['image', 'raw', 'video']) {
    let nextCursor;
    do {
      const res = await cloudinary.api.resources({
        type: 'upload',
        resource_type: resourceType,
        prefix: PREFIX,
        max_results: 100,
        next_cursor: nextCursor,
      });
      for (const asset of res.resources) {
        const publicId = asset.public_id;
        if (APPLY) {
          await cloudinary.uploader.rename(publicId, publicId, {
            resource_type: resourceType,
            to_type: 'authenticated',
            overwrite: true,
            invalidate: true,
          });
        }
        migrated += 1;
        log(`${APPLY ? '✓ migrasi' : '· akan migrasi'} [${resourceType}] ${publicId}`);
      }
      nextCursor = res.next_cursor;
    } while (nextCursor);
  }
  log(`\nCloudinary: ${migrated} asset ${APPLY ? 'dimigrasi' : 'akan dimigrasi'} ke authenticated (${skipped} dilewati).`);
}

// --- 2. Rewrite URL di DB (transactions.meta + business_contacts.id_card_attachments) ---
async function rewriteAttachmentArray(arr) {
  let changed = false;
  const out = (arr ?? []).map((att) => {
    if (att && isTargetUrl(att.url)) {
      changed = true;
      return { ...att, url: toAuthenticatedUrl(att.url) };
    }
    return att;
  });
  return { out, changed };
}

async function migrateTransactions() {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, meta')
    .not('meta', 'is', null);
  if (error) throw error;

  let updated = 0;
  for (const row of data) {
    const meta = row.meta ?? {};
    let dirty = false;

    if (Array.isArray(meta.attachments)) {
      const { out, changed } = await rewriteAttachmentArray(meta.attachments);
      if (changed) { meta.attachments = out; dirty = true; }
    }
    if (meta.attachment && isTargetUrl(meta.attachment.url)) {
      meta.attachment = { ...meta.attachment, url: toAuthenticatedUrl(meta.attachment.url) };
      dirty = true;
    }

    if (dirty) {
      updated += 1;
      log(`${APPLY ? '✓' : '·'} transactions ${row.id}`);
      if (APPLY) {
        const { error: upErr } = await supabase.from('transactions').update({ meta }).eq('id', row.id);
        if (upErr) console.error(`  ✖ gagal update ${row.id}:`, upErr.message);
      }
    }
  }
  log(`transactions: ${updated} baris ${APPLY ? 'diupdate' : 'akan diupdate'}.`);
}

async function migrateContacts() {
  const { data, error } = await supabase
    .from('business_contacts')
    .select('id, id_card_attachments')
    .not('id_card_attachments', 'is', null);
  if (error) throw error;

  let updated = 0;
  for (const row of data) {
    const { out, changed } = await rewriteAttachmentArray(row.id_card_attachments);
    if (changed) {
      updated += 1;
      log(`${APPLY ? '✓' : '·'} business_contacts ${row.id}`);
      if (APPLY) {
        const { error: upErr } = await supabase
          .from('business_contacts')
          .update({ id_card_attachments: out })
          .eq('id', row.id);
        if (upErr) console.error(`  ✖ gagal update ${row.id}:`, upErr.message);
      }
    }
  }
  log(`business_contacts: ${updated} baris ${APPLY ? 'diupdate' : 'akan diupdate'}.`);
}

async function main() {
  log(APPLY ? '=== MODE EKSEKUSI (APPLY=1) ===\n' : '=== DRY-RUN (set APPLY=1 untuk eksekusi) ===\n');
  await migrateCloudinaryAssets();
  log('');
  await migrateTransactions();
  await migrateContacts();
  log('\nSelesai.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
