import { supabase } from './supabase'

export async function generateApplicantId() {
  const year = new Date().getFullYear()
  const { data } = await supabase
    .from('mandate_candidates')
    .select('applicant_id')
    .like('applicant_id', `APP-${year}-%`)
    .order('applicant_id', { ascending: false })
    .limit(1)

  let seq = 1
  if (data?.length > 0) {
    const parts = data[0].applicant_id.split('-')
    const n = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(n)) seq = n + 1
  }
  return `APP-${year}-${String(seq).padStart(5, '0')}`
}
