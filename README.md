# Technex Task & Offer Hub

A modern static website with Supabase Auth, persistent task/offer storage, realtime public updates, and admin CRUD controls.

## 1. Configure Supabase

1. Create/open a project at https://supabase.com.
2. In Project Settings → API, copy the **Project URL** and the **publishable/anon key**.
3. Paste them into `config.js`. Never use a `service_role` or secret key in browser code.
4. Open SQL Editor and run the entire `supabase-setup.sql` file.
5. In Authentication → Users, create the admin user with the email you want to use and the password you choose. Do not put your password in website source code.
6. Keep public signups disabled if only you should have admin access. The RLS policies below only allow a specific admin email to manage offers.

## 2. Set the admin email

Open `supabase-setup.sql` and replace `ADMIN_EMAIL_REPLACE_ME` with the exact admin email, in lowercase, before running the SQL. If you already ran the SQL, change the email in the policies by rerunning the policy section after dropping the existing policies.

## 3. Local test

This is a static website. From the project folder run:
- Windows: `py -m http.server 8080`
- Then open `http://localhost:8080`

Do not double-click `index.html` if you want to test Auth/realtime; use a local server.

## 4. Deploy on Vercel

Upload these files to a GitHub repository and import it in Vercel as a static project. No build command is needed; set the output directory to `.` (or leave the static default). Add your domain in Vercel after deployment.

## 5. Included features

- WPS Office featured download points to the official WPS download page.
- Search and All / Tasks / Offers filters.
- Supabase Auth admin login.
- Admin create/edit/delete; published items show publicly, drafts stay private.
- Realtime refresh when the offers table changes.
- Row Level Security for public read of published items and admin-only writes.

## Important security notes

- The admin email is enforced by database policies, not by hiding the admin button.
- Use a unique password. Do not publish passwords, service-role keys, or tokens in GitHub.
- A task/offer site does not verify whether a visitor completed an external task. Add a server-side verification/reward workflow before paying rewards.
