import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bugajwmhquptdmofirke.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Z2Fqd21ocXVwdGRtb2ZpcmtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzYxMDUsImV4cCI6MjA5MzI1MjEwNX0.vi7nyjd6arWejWtfhJ71h5F70O69_14Fivm9XJjkuic'

export const supabase = createClient(supabaseUrl, supabaseKey)