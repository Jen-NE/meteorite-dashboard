# GitHub Pages Deployment Guide

Follow these steps to deploy your Meteorite Dashboard to GitHub Pages:

## Step 1: Initialize Git Repository

```bash
cd /home/jan/Documents/Meteors
git init
git add .
git commit -m "Initial commit: Meteorite Dashboard"
```

## Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (e.g., "meteorite-dashboard")
3. **Do NOT** initialize with README, .gitignore, or license (we already have these)
4. Click "Create repository"

## Step 3: Connect and Push to GitHub

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual values:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## Step 4: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top navigation)
3. Click **Pages** (left sidebar)
4. Under "Source", select:
   - Branch: `main`
   - Folder: `/ (root)`
5. Click **Save**

## Step 5: Wait and Access

- GitHub will build your site (takes 1-5 minutes)
- Your site will be available at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`
- You'll be automatically redirected to the dashboard

## Step 6: Update README

Edit `README.md` and replace the placeholder URL with your actual GitHub Pages URL.

## Troubleshooting

### If the site doesn't load:
1. Check that GitHub Pages is enabled in Settings → Pages
2. Wait a few minutes for deployment to complete
3. Check the Actions tab for any build errors
4. Make sure the CSV file is in the `javascript-dashboard/` folder

### If data doesn't load:
1. Open browser console (F12) to check for errors
2. Verify the CSV file path is correct
3. Check that all files were committed and pushed

### To update your site:
```bash
# Make changes to your files
git add .
git commit -m "Description of changes"
git push
```

The site will automatically rebuild in a few minutes.

## Files Structure for Deployment

```
Meteors/
├── index.html                              # Root redirect page
├── README.md                               # Project documentation
├── .gitignore                              # Git ignore rules
├── Meteorite_Landings_Processed.csv        # Data (parent folder)
├── javascript-dashboard/
│   ├── meteorite-dashboard.html            # Main application
│   ├── meteorite-dashboard.js              # Application logic
│   ├── meteorite-worker.js                 # Web worker
│   ├── Meteorite_Landings_Processed.csv    # Data (copied here)
│   └── README-JavaScript.md
└── serve.py                                # Local development server
```

## Custom Domain (Optional)

If you want to use a custom domain:

1. Add a file named `CNAME` in the root with your domain:
   ```
   yourdomain.com
   ```
2. Configure DNS with your domain provider:
   - Add CNAME record pointing to `YOUR_USERNAME.github.io`
3. Enable HTTPS in GitHub Pages settings

## Notes

- GitHub Pages serves static files only (HTML, CSS, JS)
- The Web Worker and CSV loading work entirely client-side
- No server-side processing is needed
- The site is free and has no bandwidth limits for reasonable use
