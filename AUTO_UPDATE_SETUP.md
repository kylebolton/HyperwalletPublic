# Auto-Update Feature Setup Guide

## Overview

The auto-update feature has been implemented using `electron-updater`. The app will automatically check for updates when it starts and periodically (every 4 hours).

## Configuration

### 1. Update package.json

The repository is configured for GitHub releases at `kylebolton/HyperWallet`. The `publish` section in `package.json` is already set:

```json
"publish": {
  "provider": "github",
  "owner": "kylebolton",
  "repo": "HyperWallet"
}
```

**Important for Private Repositories:**

Since your repository is private, you need to set up authentication. There are two options:

**Option 1: GitHub Personal Access Token (Recommended for CI/CD)**

To create a GitHub Personal Access Token:

1. Go to GitHub.com and sign in
2. Click your profile picture (top right) → **Settings**
3. Scroll down to **Developer settings** (left sidebar, at the bottom)
4. Click **Personal access tokens** → **Tokens (classic)**
5. Click **Generate new token** → **Generate new token (classic)**
6. Give it a descriptive name (e.g., "HyperWallet Auto-Updater")
7. Set expiration (recommended: 90 days or custom)
8. Select the **`repo`** scope (this gives full access to private repositories)
   - For private repos, you need the `repo` scope
   - This includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`
9. Click **Generate token** at the bottom
10. **IMPORTANT**: Copy the token immediately - you won't be able to see it again!
11. Set it as an environment variable:
    ```bash
    export GH_TOKEN=your_token_here
    ```
    Or add it to your CI/CD secrets (GitHub Actions, etc.)
12. electron-updater will automatically use this token when building/publishing

**Option 2: Configure in package.json (Less Secure)**
You can add the token directly, but this is less secure:

```json
"publish": {
  "provider": "github",
  "owner": "kylebolton",
  "repo": "HyperWallet",
  "token": "your_github_token_here"
}
```

**Note:** For end users downloading updates, the releases need to be accessible. You have two options:

1. Make releases public (releases can be public even if repo is private)
2. Use a different hosting method for updates (generic server, S3, etc.)

**Alternative hosting options:**

- **Generic server**: Set `provider: "generic"` and `url: "https://your-update-server.com"`
- **GitLab**: Set `provider: "gitlab"` with owner and repo
- **S3**: Set `provider: "s3"` with bucket configuration

### 2. Building and Publishing

When you build your app, electron-builder will generate update metadata files (like `latest-mac.yml`). These need to be hosted alongside your app releases.

**For GitHub Releases:**

1. Build your app: `npm run build`
2. Create a GitHub release with the version tag (e.g., `v1.0.0`)
3. Upload the files from the `release/` directory to the GitHub release
4. The `latest-mac.yml` (or `latest.yml` for Windows) file tells the app where to find updates

**Important:** Make sure to:

- Tag your releases with version numbers (e.g., `v1.0.0`)
- Upload all files from the `release/` directory
- Keep the version in `package.json` updated
- **For private repos**: Make sure releases are accessible (either make releases public, or configure authentication)

**Automated Publishing:**
You can also use electron-builder to automatically publish to GitHub:

```bash
GH_TOKEN=your_token npm run build -- --publish always
```

This will:

- Build the app
- Create a GitHub release
- Upload all files automatically

## How It Works

1. **Automatic Checking**: The app checks for updates:

   - 5 seconds after app startup
   - Every 4 hours while running

2. **Update Flow**:

   - App checks for updates
   - If available, user is notified (via IPC events)
   - User can choose to download
   - After download, user can install (app will restart)

3. **Development Mode**: Update checks are disabled in development mode (`NODE_ENV=development`)

## Using the Update API in Your App

The update API is exposed via `window.electronAPI.updates`. Here's how to use it:

```typescript
// Check if running in Electron
if (typeof window !== "undefined" && (window as any).electronAPI) {
  const { updates } = (window as any).electronAPI;

  // Get current app version
  const version = await updates.getAppVersion();
  console.log("App version:", version);

  // Manually check for updates
  const result = await updates.checkForUpdates();
  console.log("Update check result:", result);

  // Listen for update status events
  updates.onUpdateStatus(status => {
    console.log("Update status:", status.status, status.message);

    switch (status.status) {
      case "available":
        // Show notification to user
        console.log("New version available:", status.data.version);
        break;
      case "downloaded":
        // Prompt user to restart
        console.log("Update downloaded, ready to install");
        break;
      case "download-progress":
        // Show progress
        console.log("Download progress:", status.data.percent);
        break;
      case "error":
        // Show error
        console.error("Update error:", status.message);
        break;
    }
  });

  // Download update (when user clicks "Download")
  await updates.downloadUpdate();

  // Install update (when user clicks "Restart & Install")
  await updates.installUpdate();
}
```

## Example: Adding Update UI to Settings Page

You can add an update section to your Settings page:

```typescript
import { useState, useEffect } from "react";
import { Download, RefreshCw } from "lucide-react";

function UpdateSection() {
  const [updateStatus, setUpdateStatus] = useState<any>(null);
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      const { updates } = (window as any).electronAPI;

      // Get app version
      updates.getAppVersion().then((version: string) => {
        setAppVersion(version);
      });

      // Listen for update events
      updates.onUpdateStatus((status: any) => {
        setUpdateStatus(status);
      });

      return () => {
        updates.removeUpdateStatusListener();
      };
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      await (window as any).electronAPI.updates.checkForUpdates();
    }
  };

  const handleDownloadUpdate = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      await (window as any).electronAPI.updates.downloadUpdate();
    }
  };

  const handleInstallUpdate = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      await (window as any).electronAPI.updates.installUpdate();
    }
  };

  if (!(typeof window !== "undefined" && (window as any).electronAPI)) {
    return null; // Not in Electron
  }

  return (
    <div className="space-y-4">
      <h3>App Updates</h3>
      <p>Current version: {appVersion}</p>

      {updateStatus?.status === "available" && (
        <div>
          <p>Update available: {updateStatus.data?.version}</p>
          <button onClick={handleDownloadUpdate}>
            <Download /> Download Update
          </button>
        </div>
      )}

      {updateStatus?.status === "downloaded" && (
        <div>
          <p>Update downloaded and ready to install</p>
          <button onClick={handleInstallUpdate}>Restart & Install</button>
        </div>
      )}

      {updateStatus?.status === "download-progress" && (
        <div>
          <p>Downloading: {Math.round(updateStatus.data?.percent || 0)}%</p>
        </div>
      )}

      <button onClick={handleCheckForUpdates}>
        <RefreshCw /> Check for Updates
      </button>
    </div>
  );
}
```

## Testing Updates

1. **Local Testing**: You can test updates locally by:

   - Building version 1.0.0: Update `package.json` version to `1.0.0`, run `npm run build`
   - Building version 1.0.1: Update `package.json` version to `1.0.1`, run `npm run build`
   - Host the `release/` directory on a local server
   - Update `package.json` publish config to point to your local server
   - Install version 1.0.0 and it should detect 1.0.1

2. **Production Testing**:
   - Use a staging GitHub repository
   - Create releases with different versions
   - Test the update flow

## Troubleshooting

- **Updates not detected**: Check that:

  - Version in `package.json` is lower than the release version
  - Update metadata files are accessible
  - For private repos: Releases are accessible (public releases or proper authentication)
  - GitHub token is set (if using GitHub releases with private repo)
  - App is not in development mode
  - Check the console logs for update check errors

- **Authentication errors with private repo**:

  - Ensure `GH_TOKEN` environment variable is set
  - Verify token has `repo` scope
  - Consider making releases public (releases can be public even if repo is private)

- **Download fails**: Check network connectivity and that update files are accessible

- **Install fails**: Ensure the app has proper permissions and isn't running from a read-only location

## Security Notes

- Updates are verified using SHA512 checksums
- Only signed updates should be used in production (configure code signing)
- Always verify update sources before installing
