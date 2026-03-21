# Google OAuth Setup for GuitarForge

## Prerequisites
- A Google account
- Access to the Supabase dashboard for the GuitarForge project
- Access to Google Cloud Console

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top and select "New Project"
3. Name it "GuitarForge" (or similar)
4. Click "Create"

## Step 2: Configure OAuth Consent Screen

1. In the Google Cloud Console, go to **APIs & Services > OAuth consent screen**
2. Select **External** user type and click "Create"
3. Fill in the required fields:
   - **App name:** GuitarForge
   - **User support email:** your email
   - **Developer contact email:** your email
4. Click "Save and Continue"
5. On the **Scopes** page, click "Add or Remove Scopes"
   - Add `email` and `profile` scopes
   - Click "Update" then "Save and Continue"
6. On the **Test users** page, add your email for testing
7. Click "Save and Continue" then "Back to Dashboard"

## Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**
2. Click "Create Credentials" > "OAuth client ID"
3. Select **Web application** as the application type
4. Name it "GuitarForge Web"
5. Under **Authorized redirect URIs**, add:
   ```
   https://rmwaezujumikbukbirpt.supabase.co/auth/v1/callback
   ```
6. Click "Create"
7. Copy the **Client ID** and **Client Secret** — you will need these next

## Step 4: Configure Supabase

1. Go to the [Supabase Dashboard](https://supabase.com/dashboard)
2. Select the GuitarForge project
3. Navigate to **Authentication > Providers**
4. Find **Google** in the list and expand it
5. Toggle it **ON**
6. Paste the **Client ID** from Step 3
7. Paste the **Client Secret** from Step 3
8. Click "Save"

## Step 5: Verify

1. Open GuitarForge in a browser
2. Click the Google sign-in button on the auth page
3. You should be redirected to Google's consent screen
4. After signing in, you should be redirected back to GuitarForge

## Notes

- While the app is in "Testing" mode in Google Cloud Console, only test users you added can sign in
- To allow any Google user to sign in, publish the app from the OAuth consent screen
- The redirect URL must exactly match what is configured in both Google Cloud Console and Supabase
- If using a custom domain later, add that redirect URL too

## Environment Details

- **Supabase Project ID:** rmwaezujumikbukbirpt
- **Redirect URL:** `https://rmwaezujumikbukbirpt.supabase.co/auth/v1/callback`
