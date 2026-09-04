# Renew the GitHub token (when admin saves start failing)

The admin Worker uses a GitHub personal access token stored as the Cloudflare runtime secret `GITHUB_TOKEN`. Fine-grained tokens expire (often 90 days). Login can still work; adding, renaming, hiding, or reordering posters will fail.

## 1. Create a new token on GitHub

1. Open https://github.com/settings/personal-access-tokens
2. **Generate new token** → **Generate new fine-grained personal access token**
3. **Token name:** `ckd-admin` (or any name you will recognize)
4. **Expiration:** 90 days (or longer if GitHub offers it)
5. **Repository access:** **Only select repositories** → `suwardhan/art-posters-site`
6. **Permissions** → **+ Add permissions** → **Contents** → **Read and write**
7. **Generate token** and copy it. You will not see it again.

You can delete the old `ckd-admin` token on the same page after the new one works.

## 2. Paste it into Cloudflare

1. Open https://dash.cloudflare.com → **Workers & Pages** → **ckd-admin**
2. **Settings** → **Runtime variables and secrets**
   (not the build “Variables and secrets” list next to the API token)
3. Find `GITHUB_TOKEN` → **Rotate** (or delete it and **+ Add variable**)
4. Paste the new token
5. Type must stay **Secret**
6. Save

## 3. Make the new secret live

Adding a secret creates a new Worker version that is not live yet.

1. **ckd-admin** → **Deployments**
2. Click the newest version (it will mention `GITHUB_TOKEN`)
3. **Deploy** / promote it so it is at **100%** traffic

## 4. Check it

1. Open https://ckd-admin.suwardhan.workers.dev
2. Sign in with GitHub
3. Rename a poster (or move one) and confirm it says saved
4. After about a minute, confirm the shop updated

If that works, you are done.
