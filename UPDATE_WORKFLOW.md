# Auto-Update Workflow

## Quick Start

Your GitHub token has been configured and the auto-update pipeline is ready!

## Token Configuration

✅ **GH_TOKEN is set** in your `~/.zshrc` file for persistence across terminal sessions.

The token is configured for:
- Repository: `kylebolton/HyperWallet`
- Owner: `kylebolton`
- Provider: `github`

## Publishing a New Release

### Step 1: Update Version
The version in `package.json` is currently set to `1.0.0`. Update it for each new release:
```json
"version": "1.0.1"  // Increment for each release
```

### Step 2: Build and Publish
Use the new publish script:
```bash
npm run build:publish
```

**Note:** If you get a 404 error on the first publish, it's normal - electron-builder is checking for existing releases. The release will be created successfully.

This will:
1. Compile TypeScript
2. Build the Vite app
3. Package with electron-builder
4. **Automatically create a GitHub release**
5. **Upload all files to the release**

### Alternative: Manual Publishing
If you prefer to publish manually:
```bash
# Build only (no publish)
npm run build

# Then manually:
# 1. Go to https://github.com/kylebolton/HyperWallet/releases/new
# 2. Create a new release with tag v1.0.0 (match package.json version)
# 3. Upload all files from the release/ directory
```

## Important Notes for Private Repos

⚠️ **Critical**: For end users to download updates, you must make releases **public**:

1. Go to your GitHub release
2. Click "Edit release"
3. Check "Set as the latest release" (if it's the latest)
4. The release assets will be publicly accessible even though the repo is private

This is the recommended approach because:
- Users don't need authentication to download updates
- The repository code remains private
- Only the release files are public

## How Auto-Updates Work

1. **App Startup**: Checks for updates 5 seconds after launch
2. **Periodic Checks**: Every 4 hours while running
3. **Update Flow**:
   - App detects new version
   - User is notified (via IPC events)
   - User can download update
   - User can install update (app restarts)

## Testing

1. Build version 1.0.0 and publish
2. Install and run version 1.0.0
3. Build version 1.0.1 and publish
4. Version 1.0.0 should detect 1.0.1 automatically

## Troubleshooting

**Token not working?**
- Verify token is set: `echo $GH_TOKEN`
- Reload shell: `source ~/.zshrc`
- Check token has `repo` scope

**Updates not detected?**
- Ensure releases are public
- Check version in package.json is lower than release version
- Verify `latest-mac.yml` (or `latest.yml`) is in the release

**Build fails?**
- Check GH_TOKEN is set
- Verify repository name is correct
- Check you have write access to the repo

