# 🚀 Katalis Ventura - Setup Guide

Step-by-step guide untuk mengsetup project dari scratch.

---

## Prerequisites Checklist

Sebelum mulai, pastikan sudah install:

- [ ] **Node.js 18+** - Check dengan `node --version`
- [ ] **npm** atau **pnpm** atau **yarn** - Check dengan `npm --version`
- [ ] **Git** - Check dengan `git --version`
- [ ] **Supabase Account** - Daftar gratis di [supabase.com](https://supabase.com)
- [ ] **Code Editor** - VS Code recommended

---

## Step 1: Clone & Install Dependencies

```bash
# Clone repository
git clone <your-repo-url>
cd katalis-ventura

# Install dependencies (pilih salah satu)
npm install
# atau
pnpm install
# atau
yarn install
```

**Expected output:**
```
added 300+ packages in 45s
```

---

## Step 2: Setup Supabase Project

### 2.1 Create New Project

1. Login ke [app.supabase.com](https://app.supabase.com)
2. Click **New Project**
3. Isi detail:
   - **Name**: katalis-ventura
   - **Database Password**: (save this securely!)
   - **Region**: Southeast Asia (Singapore) - closest to Indonesia
4. Wait 2-3 menit untuk provisioning

### 2.2 Run Database Schema

1. Di Supabase Dashboard, go to **SQL Editor** (icon di sidebar)
2. Click **New Query**
3. Copy **entire content** dari file `supabase/schema.sql`
4. Paste ke SQL Editor
5. Click **Run** (or press Ctrl+Enter)

**Expected output:**
```
Success. No rows returned
```

✅ Ini akan create:
- 6 tables (businesses, transactions, user_business_roles, etc.)
- Indexes untuk performance
- RLS policies untuk security
- Triggers untuk auto-update timestamps

### 2.3 Get API Credentials

1. Go to **Settings** → **API** (icon di sidebar)
2. Copy these values:

```
Project URL: https://xxxxx.supabase.co
anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Step 3: Configure Environment Variables

### 3.1 Create .env.local

```bash
# Copy example file
cp .env.local.example .env.local

# Open in editor
code .env.local  # VS Code
# atau
nano .env.local  # Terminal editor
```

### 3.2 Fill in Values

Replace placeholder values dengan credentials dari Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

⚠️ **IMPORTANT:**
- NEVER commit `.env.local` to git (already in .gitignore)
- Use different Supabase projects for development/production

---

## Step 4: Run Development Server

```bash
npm run dev
```

**Expected output:**
```
  ▲ Next.js 14.2.21
  - Local:        http://localhost:3000
  - Ready in 2.1s
```

### 4.1 Test the App

Open browser → http://localhost:3000

You should see:
- ✅ Landing page dengan gradient background
- ✅ "Katalis Ventura" logo di header
- ✅ Sign Up button works
- ✅ No console errors

---

## Step 5: Create Test Account

### 5.1 Sign Up as Business Manager

1. Click **Get Started** atau **Sign Up**
2. Fill form:
   - Full Name: `Test Manager`
   - Email: `manager@test.com`
   - Password: `password123`
   - Role: **Business Manager** ← important!
3. Click **Create Account**

### 5.2 Setup Business

You'll be redirected to `/setup-business`:

1. Fill form:
   - Business Name: `Test Company`
   - Business Type: Short-term Rental
   - Capital Investment: `100000000` (100 juta)
   - Property Address: (optional)
2. Click **Create Business & Continue**

### 5.3 Verify in Supabase

Go to Supabase Dashboard → **Table Editor**:

Check these tables have data:
- ✅ `profiles` - 1 row (your user)
- ✅ `businesses` - 1 row (Test Company)
- ✅ `user_business_roles` - 1 row (linking you to business)

---

## Step 6: Test Investor Account (Optional)

### 6.1 Create Second Account

1. **Logout** atau open **Incognito window**
2. Sign Up with:
   - Email: `investor@test.com`
   - Role: **Investor** ← different role!
3. You'll be redirected to `/join-business`

### 6.2 Join Business

Currently you need invite code. For now, manually add in Supabase:

1. Go to Supabase → **Table Editor** → `user_business_roles`
2. Click **Insert row**
3. Fill:
   - `user_id`: (copy from auth.users for investor@test.com)
   - `business_id`: (copy from businesses table)
   - `role`: `investor`
4. Save

Now investor can access the business dashboard (read-only).

---

## Troubleshooting

### Issue: "Module not found" errors

**Solution:**
```bash
# Delete node_modules dan reinstall
rm -rf node_modules
npm install
```

### Issue: Can't connect to Supabase

**Check:**
1. ✅ `.env.local` exists with correct values
2. ✅ No typos in SUPABASE_URL (ends with .supabase.co)
3. ✅ ANON_KEY is the **public** key, not service_role

**Test connection:**
```bash
# Check if env variables are loaded
npm run dev
# In browser console, check:
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
```

### Issue: SQL errors when running schema

**Common causes:**
1. Extension not enabled → Run `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` first
2. Tables already exist → Drop tables or use `CREATE TABLE IF NOT EXISTS`
3. Auth users don't exist yet → Sign up first, then re-run schema

**Solution:**
```sql
-- Drop all tables (CAREFUL - deletes data!)
DROP TABLE IF EXISTS invite_codes CASCADE;
DROP TABLE IF EXISTS investor_metrics CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS user_business_roles CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Then re-run schema.sql
```

### Issue: RLS prevents data access

**Symptoms:**
- Tables exist but queries return empty
- "Row level security policy" errors

**Solution:**
1. Check RLS is enabled: Supabase → **Authentication** → **Policies**
2. Verify user is authenticated: Check `auth.users` table
3. Test policy with SQL:
```sql
-- Check if current user has access
SELECT * FROM user_business_roles WHERE user_id = auth.uid();
```

### Issue: Port 3000 already in use

**Solution:**
```bash
# Use different port
npm run dev -- -p 3001

# Or kill process using 3000
lsof -ti:3000 | xargs kill -9
```

---

## Development Workflow

### Typical Development Flow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install dependencies (if package.json changed)
npm install

# 3. Start dev server
npm run dev

# 4. Make changes
# 5. Test in browser
# 6. Commit
git add .
git commit -m "feat: add new feature"

# 7. Push
git push origin main
```

### Database Changes

When modifying database schema:

1. ✅ Update `supabase/schema.sql`
2. ✅ Run new SQL in Supabase SQL Editor
3. ✅ Update TypeScript types in `types/index.ts`
4. ✅ Test changes locally
5. ✅ Document in commit message

---

## Next Steps

Setelah setup berhasil:

1. **Explore codebase** - Check `README.md` untuk structure
2. **Read implementation plan** - File `IMPLEMENTATION_PLAN.md`
3. **Start building features** - Follow Phase 2-5 in roadmap
4. **Join development** - Check open issues

---

## Resources

- 📚 **Next.js Docs**: https://nextjs.org/docs
- 📚 **Supabase Docs**: https://supabase.com/docs
- 📚 **Tailwind CSS**: https://tailwindcss.com/docs
- 💬 **Get Help**: Open GitHub issue or ask in Discord

---

## Success Checklist

Before proceeding to development, verify:

- [ ] ✅ Dev server runs without errors
- [ ] ✅ Can sign up new account
- [ ] ✅ Can create business
- [ ] ✅ Supabase tables populated correctly
- [ ] ✅ RLS policies working (data isolated by business)
- [ ] ✅ Environment variables configured
- [ ] ✅ No console errors in browser

**All checked?** 🎉 You're ready to build features!

---

**Happy Coding!** 🚀
