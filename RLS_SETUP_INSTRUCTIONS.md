# How to Enable RLS Policies

## Step 1: Go to Supabase Dashboard
1. Go to https://app.supabase.com
2. Select your project
3. In the left sidebar, click **SQL Editor**
4. Click **New Query**

## Step 2: Copy and Paste the SQL
Copy ALL the SQL from `supabase/migrations/enable_rls_policies.sql` and paste it into the SQL editor.

## Step 3: Run the Query
Click the **Run** button (or press Ctrl+Enter)

## Step 4: Verify RLS is Enabled
1. Go to **Table Editor** in Supabase
2. Click on the `courses` table
3. At the top, you should see a lock icon 🔒 indicating RLS is enabled
4. Repeat for `enrollments` and `user_roles` tables

## What These Policies Do

### Courses Table
- ✅ Professors can see and create their own courses
- ✅ Students can see courses they're enrolled in
- ❌ Students CANNOT see other courses
- ❌ Students CANNOT modify courses

### Enrollments Table
- ✅ Students can see their own enrollments
- ✅ Professors can see who is enrolled in their courses
- ✅ Students can enroll themselves in courses
- ❌ Students CANNOT enroll other students

### User Roles Table
- ✅ Each user can see their own role
- ✅ System can insert roles (via database trigger)
- ❌ Users CANNOT see other users' roles
- ❌ Users CANNOT modify roles

## Testing After RLS is Enabled

1. **Log in as Professor** and verify:
   - You can see your courses
   - You can create new courses
   - You can see enrollments in your courses

2. **Log in as Student** and verify:
   - You can join courses with valid join codes
   - You can only see courses you've joined
   - The course list updates instantly

If anything breaks, we can temporarily disable RLS again and debug.
