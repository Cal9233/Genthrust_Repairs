# PHASE 8: DEPLOYMENT (30 minutes)

Once your app is working locally, it's time to deploy it to production!

---

## Option A: Deploy to Vercel (Recommended)

Vercel is the easiest option for React apps. Free tier is generous.

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate.

### Step 3: Deploy

```bash
# From your repair-dashboard directory
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - What's your project's name? genthrust-ro-tracker
# - In which directory is your code located? ./
# - Want to override settings? No
```

### Step 4: Set Environment Variables

After first deploy:

```bash
# Set each environment variable
vercel env add VITE_CLIENT_ID
vercel env add VITE_TENANT_ID
vercel env add VITE_SHAREPOINT_SITE_URL
vercel env add VITE_EXCEL_FILE_NAME
vercel env add VITE_EXCEL_TABLE_NAME

# Choose: Production
# Paste the value when prompted
```

Or set them in the Vercel dashboard:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable for Production

### Step 5: Redeploy with Environment Variables

```bash
vercel --prod
```

### Step 6: Update Azure AD Redirect URI

1. Go to Azure Portal → Azure AD → App Registrations
2. Select your app
3. Go to **Authentication**
4. Under **Single-page application**, add your Vercel URL:
   - Example: `https://genthrust-ro-tracker.vercel.app`
5. Click **Save**

### Step 7: Test Production

Open your Vercel URL and test:
- ✅ Login works
- ✅ Dashboard loads
- ✅ Table shows data
- ✅ Status updates work

---

## Option B: Deploy to Azure Static Web Apps

Azure Static Web Apps is a great option if you're already using Azure.

### Step 1: Build the App

```bash
npm run build
```

This creates a `dist` folder with production files.

### Step 2: Install Azure Static Web Apps CLI

```bash
npm install -g @azure/static-web-apps-cli
```

### Step 3: Deploy via Azure Portal

1. Go to https://portal.azure.com
2. Search for "Static Web Apps"
3. Click **+ Create**
4. Fill in:
   - **Subscription**: Your subscription
   - **Resource group**: Create new or use existing
   - **Name**: `genthrust-ro-tracker`
   - **Region**: Choose closest to you
   - **Deployment source**: Choose GitHub or upload manually
5. Click **Review + create**
6. Click **Create**

### Step 4: Configure Build Settings

If using GitHub:
- **Build presets**: React
- **App location**: `/repair-dashboard`
- **Output location**: `dist`

### Step 5: Set Environment Variables

1. Go to your Static Web App in Azure Portal
2. Click **Configuration** in the left menu
3. Click **+ Add**
4. Add each environment variable:
   - `VITE_CLIENT_ID`
   - `VITE_TENANT_ID`
   - `VITE_SHAREPOINT_SITE_URL`
   - `VITE_EXCEL_FILE_NAME`
   - `VITE_EXCEL_TABLE_NAME`
5. Click **Save**

### Step 6: Update Azure AD Redirect URI

Same as Vercel - add your Azure Static Web Apps URL to Azure AD.

---

## Option C: Deploy to Netlify

Another great free option.

### Step 1: Install Netlify CLI

```bash
npm install -g netlify-cli
```

### Step 2: Login

```bash
netlify login
```

### Step 3: Deploy

```bash
# Build the app
npm run build

# Deploy
netlify deploy

# Follow prompts, then deploy to production
netlify deploy --prod
```

### Step 4: Set Environment Variables

```bash
netlify env:set VITE_CLIENT_ID "your-value"
netlify env:set VITE_TENANT_ID "your-value"
netlify env:set VITE_SHAREPOINT_SITE_URL "your-value"
netlify env:set VITE_EXCEL_FILE_NAME "your-value"
netlify env:set VITE_EXCEL_TABLE_NAME "your-value"
```

---

## Post-Deployment Checklist

After deploying to any platform:

- [ ] Production URL is accessible
- [ ] Azure AD redirect URI includes production URL
- [ ] All environment variables are set
- [ ] Can login with Microsoft account
- [ ] Dashboard loads correctly
- [ ] Data appears from Excel
- [ ] Can update status (writes back to Excel)
- [ ] Mobile responsive works
- [ ] No console errors

---

## Continuous Deployment

### With GitHub

Most platforms (Vercel, Netlify, Azure) support automatic deployment from GitHub:

1. Push your code to GitHub
2. Connect your repository to deployment platform
3. Every push to `main` branch auto-deploys

**Setup:**

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"

# Create GitHub repo and push
git remote add origin https://github.com/yourusername/genthrust-ro-tracker.git
git push -u origin main

# Connect repo in Vercel/Netlify/Azure dashboard
```

---

## Custom Domain (Optional)

### Vercel
1. Go to project settings
2. Click **Domains**
3. Add your custom domain
4. Follow DNS instructions

### Azure Static Web Apps
1. Go to **Custom domains**
2. Click **+ Add**
3. Follow DNS instructions

### Netlify
1. Go to **Domain settings**
2. Click **Add custom domain**
3. Follow DNS instructions

**Don't forget** to add custom domain to Azure AD redirect URIs!

---

## Performance Tips

### Enable Compression
Most platforms do this automatically.

### Caching
Vite builds with cache-friendly filenames automatically.

### CDN
Vercel, Netlify, and Azure all use global CDNs automatically.

---

## Monitoring

### Vercel Analytics
```bash
npm install @vercel/analytics
```

Add to `src/main.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react';

// In your render:
<Analytics />
```

### Error Tracking

Consider adding Sentry:
```bash
npm install @sentry/react
```

---

## Cost Estimates

### Vercel Free Tier
- 100 GB bandwidth/month
- Unlimited personal projects
- **Cost: $0/month** (more than enough for personal use)

### Azure Static Web Apps Free Tier
- 100 GB bandwidth/month
- 2 custom domains
- **Cost: $0/month**

### Netlify Free Tier
- 100 GB bandwidth/month
- **Cost: $0/month**

All options are completely free for personal use!

---

## Backup Strategy

Your data is in Excel on SharePoint, which:
- ✅ Has version history
- ✅ Auto-saves
- ✅ Backed up by Microsoft
- ✅ Can be restored by IT

**No additional backup needed** - Excel is your database and it's already backed up.

---

## Checkpoint

At this point you should have:

- ✅ App deployed to production
- ✅ Environment variables configured
- ✅ Azure AD redirect URIs updated
- ✅ App accessible via public URL
- ✅ Full functionality working in production

**Next:** [Testing & Troubleshooting](99-TESTING-TROUBLESHOOTING.md)
