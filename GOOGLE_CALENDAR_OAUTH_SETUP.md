# Google Calendar OAuth Integration - Complete Setup Guide

This guide will walk you through setting up private Google Calendar integration using OAuth 2.0.

---

## Part 1: Google Cloud Setup (10-15 minutes)

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click on the project dropdown at the top (next to "Google Cloud")
3. Click **"NEW PROJECT"**
4. Enter a project name (e.g., "CRM Calendar Integration")
5. Click **"CREATE"**
6. Wait for the project to be created, then select it from the dropdown

### Step 2: Enable Google Calendar API

1. In your project, go to **"APIs & Services"** > **"Library"** (from left sidebar)
2. Search for **"Google Calendar API"**
3. Click on **"Google Calendar API"**
4. Click **"ENABLE"**
5. Wait for it to enable (takes a few seconds)

### Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** > **"OAuth consent screen"** (from left sidebar)
2. Select **"External"** user type
3. Click **"CREATE"**
4. Fill in the required fields:
   - **App name**: Your CRM name (e.g., "My CRM")
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click **"SAVE AND CONTINUE"**
6. On the "Scopes" page, click **"ADD OR REMOVE SCOPES"**
7. Search for and select:
   - `https://www.googleapis.com/auth/calendar.readonly`
8. Click **"UPDATE"** then **"SAVE AND CONTINUE"**
9. On "Test users" page, click **"ADD USERS"**
10. Add your Google email address
11. Click **"SAVE AND CONTINUE"**
12. Review and click **"BACK TO DASHBOARD"**

### Step 4: Create OAuth Credentials

1. Go to **"APIs & Services"** > **"Credentials"** (from left sidebar)
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**
4. For "Application type", select **"Web application"**
5. Enter a name (e.g., "CRM Web Client")
6. Under **"Authorized redirect URIs"**, click **"+ ADD URI"**
7. Add your callback URL:
   - For local development: `http://localhost:3000/api/auth/google/callback`
   - For production: `https://yourdomain.com/api/auth/google/callback`
8. Click **"CREATE"**
9. A popup will show your **Client ID** and **Client Secret**
10. **IMPORTANT**: Copy both and save them somewhere safe!

---

## Part 2: Environment Configuration

### Step 5: Add Credentials to Your Project

1. Open your project's `.env` file
2. Add these new variables (replace with your actual values):

```env
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
NEXTAUTH_SECRET=generate_a_random_string_here
NEXTAUTH_URL=http://localhost:3000
```

3. To generate `NEXTAUTH_SECRET`, run this in your terminal:
```bash
openssl rand -base64 32
```

4. Save the `.env` file

---

## Part 3: Install Required Dependencies

### Step 6: Install OAuth Packages

Run this command in your project directory:

```bash
npm install next-auth @auth/supabase-adapter googleapis
```

---

## Part 4: Implementation (I'll do this for you)

### Step 7: Backend API Routes

I'll create:
- `/app/api/auth/[...nextauth]/route.ts` - NextAuth configuration
- `/app/api/calendar/events/route.ts` - Fetch calendar events

### Step 8: Frontend Integration

I'll update:
- `/app/calendar/page.tsx` - Add OAuth login button and display events

---

## After Setup is Complete

### How to Use:

1. Navigate to the Calendar page in your CRM
2. Click **"Connect with Google"**
3. Sign in with your Google account
4. Grant permission to read your calendar
5. Your private calendar events will display in the CRM!

### Security Notes:

- Your calendar remains private
- Only you can see your events after logging in
- Tokens are stored securely in the database
- You can revoke access anytime from [Google Account Settings](https://myaccount.google.com/permissions)

---

## Troubleshooting

**"Redirect URI mismatch" error:**
- Make sure the redirect URI in Google Cloud Console exactly matches your URL
- Include the port number for localhost (`:3000`)

**"Access blocked" error:**
- Make sure you added yourself as a test user in OAuth consent screen
- Your app is in "Testing" mode - only test users can access it

**Can't see events:**
- Check browser console for errors
- Verify your environment variables are correct
- Make sure you granted calendar.readonly permission

---

Ready for me to implement the code? Just confirm and I'll set everything up!
