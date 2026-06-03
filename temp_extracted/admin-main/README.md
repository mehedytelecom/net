# Mehedy Telecom Admin Panel

This is the admin panel for Mehedy Telecom, built with React, Vite, and Firebase.

## 🚀 Deployment to GitHub Pages

The project is configured to automatically deploy to GitHub Pages when you push to the `main` branch.

### 1. GitHub Repository Settings
1. Go to your repository on GitHub: `mehedytelecom/admin`.
2. Go to **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.

### 2. Firebase Configuration
For Google Authentication to work on your GitHub Pages site, you MUST add the domain to your Firebase project:
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: `gen-lang-client-0938975347`.
3. Go to **Authentication** > **Settings** > **Authorized domains**.
4. Click **Add domain** and enter: `mehedytelecom.github.io`.

## 🛠️ Local Development

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 📦 Build for Production

To manually build the project:
```bash
npm run build
```
The output will be in the `dist/` folder.
