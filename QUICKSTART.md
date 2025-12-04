# CPTS Training CRM - Quick Start Guide

## Get Up and Running in 5 Minutes

### Step 1: Apply Database Migration (2 minutes)

1. Open your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Open the file `supabase/migrations/20250101000000_init_schema.sql`
4. Copy the entire contents
5. Paste into the Supabase SQL Editor
6. Click "Run" or press Ctrl+Enter
7. Wait for confirmation that all tables were created

### Step 2: Seed Demo Data (Optional - 1 minute)

1. In the same SQL Editor
2. Open `scripts/seed-data.sql`
3. Copy and paste the contents
4. Run the script
5. This adds sample courses, companies, contacts, leads, and bookings

### Step 3: Create Your Admin Account (1 minute)

1. The dev server should already be running at http://localhost:3000
2. Click "First time? Create admin account"
3. Enter:
   - Your full name
   - Email address
   - Password (min 6 characters)
4. Click "Create Admin Account"
5. Return to sign in and log in with your credentials

### Step 4: Explore the CRM (1 minute)

You're now in! Explore these key areas:

- **Dashboard** - See your metrics and today's tasks
- **Leads** - Toggle between Kanban and List view
- **Companies** - View or add client companies
- **Contacts** - Manage trainees and contacts
- **Courses** - Browse the training catalog
- **Runs** - See scheduled sessions
- **Bookings** - View course registrations
- **Tasks** - Check your to-do list
- **Settings** - Export/import data

## What You Can Do Now

### Add a New Lead
1. Click "Leads" in sidebar
2. Click "Add Lead" button
3. Fill in name, company, contact details
4. Select training interests (checkboxes)
5. Check GDPR consent
6. Save

### Create a Company
1. Click "Companies"
2. Click "Add Company"
3. Enter company details
4. Save

### Add a Contact
1. Click "Contacts"
2. Click "Add Contact"
3. Fill in personal details
4. Optionally link to a company
5. Set language preference
6. Check GDPR consent
7. Save

### Schedule a Course Run
1. Click "Runs"
2. Click "Schedule Run"
3. Select course
4. Set dates and location
5. Set seat capacity
6. Assign trainer
7. Save

### Create a Booking
1. Click "Bookings"
2. Click "New Booking"
3. Select course run
4. Choose contact
5. Optionally select company
6. Set amount and status
7. Save

## Tips & Shortcuts

- **Search**: Use the search bar in each section to filter records
- **Quick Edit**: Click any card/row to open edit dialog
- **Status Updates**: In tasks, click checkbox to toggle done/open
- **Export Data**: Go to Settings → Export Data
- **Import Leads**: Settings → Import Leads (CSV format)

## Default Demo Data (if seeded)

- **Courses**: 5 training courses (Excavator, Telehandler, Forklift, MEWP, Supervisor)
- **Companies**: 4 client companies including Scott Group, MPH
- **Contacts**: 10 trainees (mix of EN and PL speakers)
- **Leads**: 8 leads spread across pipeline stages
- **Runs**: 5 upcoming sessions over next 2 weeks
- **Bookings**: 5 bookings with various statuses

## Need Help?

Check `SETUP.md` for detailed documentation including:
- Complete feature list
- User roles and permissions
- Troubleshooting guide
- Project structure
- Development commands

## Next Steps

1. Customize courses for your training offerings
2. Add your real companies and contacts
3. Import your existing leads via CSV
4. Schedule your course runs
5. Start managing bookings!

---

**Remember**: This is a production-ready MVP. All data is secured with Row Level Security and proper authentication.
