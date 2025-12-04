#!/bin/bash

# Script to concatenate all migrations in chronological order
cd /tmp/cc-agent/58951546/project/supabase/migrations

# Create a combined SQL file
echo "-- Combined migrations for CRM database" > /tmp/combined_migrations.sql
echo "-- Generated on $(date)" >> /tmp/combined_migrations.sql
echo "" >> /tmp/combined_migrations.sql

# Loop through all migration files in sorted order
for file in $(ls -1 *.sql | sort); do
  echo "" >> /tmp/combined_migrations.sql
  echo "-- ============================================" >> /tmp/combined_migrations.sql
  echo "-- Migration: $file" >> /tmp/combined_migrations.sql
  echo "-- ============================================" >> /tmp/combined_migrations.sql
  echo "" >> /tmp/combined_migrations.sql
  cat "$file" >> /tmp/combined_migrations.sql
  echo "" >> /tmp/combined_migrations.sql
done

echo "Combined migrations created at /tmp/combined_migrations.sql"
