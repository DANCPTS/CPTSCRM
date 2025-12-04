const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_CRM;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_CRM;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase CRM credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigrations() {
  console.log('Starting migrations...');

  const sqlFile = fs.readFileSync(
    path.join(__dirname, 'combined_migrations.sql'),
    'utf8'
  );

  console.log(`Executing combined migrations (${sqlFile.length} characters)...`);

  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlFile
    });

    if (error) {
      console.error('Migration error:', error);
      process.exit(1);
    }

    console.log('Migrations completed successfully!');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

runMigrations();
