import { NextResponse } from 'next/server';
import { gcpSql } from '@/lib/gcp';
import { createServerClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    // 1. Test Supabase connection
    const supabase = await createServerClient();
    const { error: supabaseError } = await supabase.from('businesses').select('id').limit(1);
    
    // 2. Test GCP connection
    // Kita jalankan query sederhana untuk melihat apakah GCP jalan dan pgvector aktif
    const gcpResult = await gcpSql`
      SELECT NOW() as current_time, extname, extversion 
      FROM pg_extension 
      WHERE extname = 'vector'
    `;
    
    const isVectorActive = gcpResult.length > 0;
    const gcpTime = isVectorActive 
      ? gcpResult[0].current_time 
      : (await gcpSql`SELECT NOW() as current_time`)[0].current_time;

    return NextResponse.json({
      status: 'success',
      message: 'Berhasil terhubung ke kedua database! 🚀',
      connections: {
        supabase: {
          status: supabaseError ? `error: ${supabaseError.message}` : 'connected',
          role: 'Primary Transactional Database (OLTP)'
        },
        gcp_cloud_sql: {
          status: 'connected',
          role: 'Analytical Database & Agent Memory (OLAP / Vector DB)',
          timestamp: gcpTime,
          vector_extension_active: isVectorActive,
          vector_version: isVectorActive ? gcpResult[0].extversion : 'Not found',
        }
      }
    });
  } catch (error: any) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Gagal terhubung ke GCP Database',
        detail: error.message 
      }, 
      { status: 500 }
    );
  }
}
