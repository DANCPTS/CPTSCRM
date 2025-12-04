# START HERE - CPTS Training CRM

## 🚀 Your CRM is Ready!

A complete training CRM has been built for Construction & Plant Training Services. Everything is configured and ready to use.

## ⚡ Quick Start (3 Steps)

### Step 1: Run the Database Migration

Your database schema needs to be created in Supabase:

1. Open your Supabase dashboard at https://supabase.com/dashboard
2. Go to your project
3. Click "SQL Editor" in the left sidebar
4. Open this file: `supabase/migrations/20250101000000_init_schema.sql`
5. Copy the entire file contents
6. Paste into the SQL Editor in Supabase
7. Click "Run" or press Ctrl/Cmd + Enter
8. Wait for success confirmation

**What this creates:**
- 9 database tables (users, leads, companies, contacts, courses, course_runs, bookings, tasks, activities)
- All security policies (Row Level Security)
- Indexes for performance
- Timestamp triggers

### Step 2: Load Demo Data (Optional but Recommended)

To see the CRM with sample data:

1. In the same SQL Editor
2. Open: `scripts/seed-data.sql`
3. Copy and paste the contents
4. Run the script
5. This adds 5 courses, 4 companies, 10 contacts, 8 leads, 5 runs, and 5 bookings

### Step 3: Restart Dev Server & Create Your Account

**Important:** The environment variables need to be loaded by restarting the dev server.

1. **Stop the dev server** if it's running (it will restart automatically)
2. **Wait for it to restart** - you'll see "Ready" in the terminal
3. Visit http://localhost:3000 in your browser
4. If you see "supabaseUrl is required" error, wait a moment for the server to fully restart and refresh
5. Click "First time? Create admin account"
6. Fill in:
   - Your full name
   - Email address
   - Password (minimum 6 characters)
7. Click "Create Admin Account"
8. Sign in with your new credentials

## ✅ You're All Set!

You now have access to:

- **Dashboard** - Metrics, tasks, upcoming sessions
- **Leads** - Kanban pipeline board
- **Companies** - Client company management
- **Contacts** - Trainee database
- **Courses** - Training catalog
- **Runs** - Scheduled sessions
- **Bookings** - Course registrations
- **Tasks** - Your to-do list
- **Settings** - Import/export data

## 📚 Documentation

Three comprehensive guides are available:

1. **QUICKSTART.md** - 5-minute walkthrough
2. **SETUP.md** - Complete setup guide with troubleshooting
3. **PROJECT_SUMMARY.md** - Technical overview and features

## 🎯 First Actions to Try

1. **View the Dashboard** - See your metrics and today's panel
2. **Browse Leads** - Switch between Kanban and List view
3. **Add a New Lead** - Click "+ Add Lead" button
4. **Check Companies** - View the seeded companies
5. **Explore Courses** - See the 5 training courses
6. **View Upcoming Runs** - Check scheduled sessions
7. **Try CSV Export** - Go to Settings and export leads

## 🔐 Security

- All data is protected by Row Level Security
- User roles: Admin, Sales, Trainer
- GDPR consent tracking built-in
- Secure authentication with Supabase

## 📊 What's Included

### Features
- ✅ Lead pipeline with drag-and-drop kanban
- ✅ Company and contact management
- ✅ Course catalog and scheduling
- ✅ Booking system with status tracking
- ✅ Task management
- ✅ Dashboard with metrics
- ✅ CSV import/export
- ✅ GDPR compliance tools
- ✅ Role-based access control
- ✅ Mobile responsive design

### Demo Data (if seeded)
- 5 training courses (Excavator, Telehandler, Forklift, MEWP, Supervisor)
- 4 client companies
- 10 trainees/contacts (English and Polish speakers)
- 8 leads across all pipeline stages
- 5 upcoming course runs
- 5 bookings with various statuses

## 🛠 Technical Details

- **Framework**: Next.js 13 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI**: shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Build Status**: ✅ Successful

## 🆘 Need Help?

### "supabaseUrl is required" Error?

The dev server needs to restart to load environment variables. Just wait for it to restart automatically and refresh your browser.

If the issue persists:
1. Check `TROUBLESHOOTING.md` for detailed solutions
2. Verify `.env.local` file exists with Supabase credentials
3. Ensure the migration was applied successfully
4. Try manually restarting the dev server

## 🚢 Ready for Production

This is a production-ready MVP with:
- Secure authentication
- Row Level Security on all tables
- TypeScript type safety
- Responsive design
- Clean, maintainable code
- Comprehensive documentation

---

**Start with Step 1 above to set up your database!**

Then explore the CRM and customize it for your needs.
