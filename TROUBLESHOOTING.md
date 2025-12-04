# Troubleshooting Guide

## "supabaseUrl is required" Error

If you see this error when loading the application, it means the environment variables aren't being loaded properly.

### Solution: Restart the Dev Server

The environment variables are loaded when the dev server starts. If you see this error:

1. **Stop the dev server** (Ctrl+C or Cmd+C in the terminal)
2. **Start it again**: The system will automatically restart it for you
3. **Refresh your browser** at http://localhost:3000

### Why This Happens

Next.js loads environment variables at server startup. The `.env.local` file has been created with your Supabase credentials, but the server needs to restart to pick them up.

### Verify Environment Variables

You can verify the environment variables are set correctly:

```bash
# View the .env.local file
cat .env.local
```

You should see:
```
NEXT_PUBLIC_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Database Migration Errors

### Error: "relation does not exist"

This means the database tables haven't been created yet.

**Solution:**
1. Open your Supabase dashboard
2. Go to SQL Editor
3. Copy the contents of `supabase/migrations/20250101000000_init_schema.sql`
4. Paste and run in the SQL Editor
5. Verify all tables were created successfully

### Error: "permission denied for table"

This means Row Level Security (RLS) policies aren't allowing access.

**Solution:**
1. Make sure you're signed in with an authenticated user
2. Check that your user has a profile in the `users` table
3. Verify the RLS policies were created (they're in the migration file)

## Authentication Errors

### Can't Sign In

**Check:**
1. Did you create an account first? Click "First time? Create admin account"
2. Is your password at least 6 characters?
3. Are you using the correct email and password?

### "User profile not found"

This means you have a Supabase auth account but no entry in the `users` table.

**Solution:**
1. This shouldn't happen with the sign-up flow, but if it does:
2. Go to Supabase Dashboard → Authentication → Users
3. Find your user ID
4. Go to SQL Editor and run:
```sql
INSERT INTO users (id, email, full_name, role)
VALUES ('your-user-id-here', 'your-email@example.com', 'Your Name', 'admin');
```

## Build Errors

### TypeScript Errors

If you see TypeScript errors during build:

```bash
npm run typecheck
```

This will show you the specific errors. Most common issues:
- Missing import statements
- Type mismatches

### Build Fails

If `npm run build` fails:

1. Check the error message carefully
2. Make sure all dependencies are installed: `npm install`
3. Clear the Next.js cache: `rm -rf .next`
4. Try building again: `npm run build`

## Runtime Errors

### "Cannot read property of undefined"

This usually means data isn't loading from the database.

**Check:**
1. Are you connected to the internet?
2. Is your Supabase project active and running?
3. Are the environment variables set correctly?
4. Did you apply the database migration?

### "Network Error" or "Failed to fetch"

**Check:**
1. Your internet connection
2. Your Supabase project status in the dashboard
3. The Supabase URL in `.env.local` is correct

## Data Issues

### No Data Showing

If you don't see any data:

1. **Did you seed the database?** Run `scripts/seed-data.sql` in Supabase SQL Editor
2. **Are you logged in?** RLS policies require authentication
3. **Check your role**: Some views are restricted by role (admin/sales/trainer)

### Can't Create Records

**Common causes:**
1. You're not logged in
2. Your user role doesn't have permission (check RLS policies)
3. Required fields are missing

## Performance Issues

### App is Slow

**Check:**
1. Your internet connection
2. Supabase project region (closer is faster)
3. Browser console for errors

### Large Database

If you have a lot of data:
1. Indexes are already created on key fields
2. Consider pagination (not implemented in MVP)
3. Consider limiting query results

## Import/Export Issues

### CSV Import Fails

**Check:**
1. CSV format matches expected headers
2. Training interests are semicolon-separated
3. No invalid characters in the data
4. File encoding is UTF-8

### CSV Export is Empty

**Causes:**
1. No data in the table
2. RLS policies blocking access
3. You're not authenticated

## Development Issues

### Hot Reload Not Working

**Solution:**
1. Restart the dev server
2. Clear browser cache
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Changes Not Showing

**Solution:**
1. Check you saved the file
2. Verify no build errors in the terminal
3. Clear Next.js cache: `rm -rf .next`
4. Restart dev server

## Browser Compatibility

### Supported Browsers

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Issues on Older Browsers

If you're on an older browser:
1. Update to the latest version
2. Or use a modern browser (Chrome/Firefox/Edge)

## Getting More Help

### Useful Commands

```bash
# Check if dependencies are installed
ls node_modules/@supabase

# View environment variables (don't share the output publicly!)
cat .env.local

# Check database connection
# Go to Supabase Dashboard → Database → Tables

# View logs
# Check browser console (F12 → Console)
# Check terminal where dev server is running
```

### Still Stuck?

1. Check the browser console (F12) for error messages
2. Check the terminal where the dev server is running
3. Review the setup documentation in `SETUP.md`
4. Verify each step in `QUICKSTART.md` was completed

## Common Solutions Checklist

When something goes wrong, try these in order:

- [ ] Restart the dev server
- [ ] Hard refresh the browser (Ctrl+Shift+R)
- [ ] Check browser console for errors
- [ ] Verify environment variables in `.env.local`
- [ ] Ensure database migration was applied
- [ ] Confirm you're signed in
- [ ] Check your user role in the `users` table
- [ ] Clear Next.js cache: `rm -rf .next`
- [ ] Reinstall dependencies: `rm -rf node_modules && npm install`

---

Most issues are resolved by restarting the dev server or ensuring the database migration was applied correctly.
