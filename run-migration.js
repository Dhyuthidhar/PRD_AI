const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config()

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const migrationSQL = fs.readFileSync('./migrations/2026-03-06_document_analysis.sql', 'utf8')
    
    console.log('Running document analysis migration...')
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })
    
    if (error) {
      console.error('Migration failed:', error)
      process.exit(1)
    }
    
    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Error running migration:', error)
    process.exit(1)
  }
}

runMigration()