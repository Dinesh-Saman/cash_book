# Deployment

Production for this app is https://kassenbuch.nrwsystem.de. A release is a git tag. Pushing `v0.1.1` (any `vMAJOR.MINOR.PATCH` tag) makes GitHub Actions check that tag out on the server, rebuild it, and restart the app.

The current release is `v0.1.0`. This document describes that setup. It does not contain secret values.

## Release a new version

Work on `main`. The tag must point at a commit that already contains [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). GitHub reads the workflow from the tagged commit, not from whatever happens to be on the server.

```bash
git checkout main
git pull
# commit your changes
git tag v0.1.1
git push origin main
git push origin v0.1.1
```

Use only three numeric parts, such as `v0.1.1`. The workflow also starts for other tags that merely look similar (`v1.2.3-beta`), but the server script rejects those and the job fails.

Pushing a tag that already exists on GitHub does not start a new run. See [Rollback](#rollback) to deploy an older tag again.

After the run, the server is in a detached checkout of that tag. That is expected. Do not commit or edit files on the server.

## What GitHub Actions does

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on `ubuntu-latest` when a tag matching `v*.*.*` is pushed.

- Only one production deploy runs at a time (`concurrency` group `production`). A second tag waits. It is not cancelled.
- The job SSHes to `ubuntu@kassenbuch.nrwsystem.de`.
- It authenticates with the Actions secret `DEPLOY_SSH_KEY`.
- The remote command is the tag name, for example `v0.1.1`.
- The server host key is pinned in the workflow. The ed25519 fingerprint is `SHA256:xjtlTMO+1IA27qKT1L089ijJxELEXyQcvCXjJbhmpGY`.

The secret is created at [Actions secrets](https://github.com/uvexzon-dev/Cash_Book_Management_System/settings/secrets/actions). The private key file on the server is `/home/ubuntu/.ssh/kassenbuch_actions`. Paste that file into a secret named `DEPLOY_SSH_KEY`. Do not commit the private key.

That public key is in `/home/ubuntu/.ssh/authorized_keys` with `command` and `restrict`. It can only start [`scripts/deploy.sh`](scripts/deploy.sh). It cannot open a shell, forward ports, or run any other command. Its fingerprint is `SHA256:bw20uJTMjDvBOiQI6CMxsj939AbVgaav8RWFS+yhSMk`.

## What the server script does

[`scripts/deploy.sh`](scripts/deploy.sh) is the whole deploy:

1. Accept the tag from the first argument, or from `SSH_ORIGINAL_COMMAND` when Actions connects.
2. Refuse anything that is not `vMAJOR.MINOR.PATCH`.
3. Refuse to continue if `git status --porcelain` shows any change. Ignored files do not count.
4. `git fetch` that tag from `origin` and `git checkout --detach` it.
5. `npm ci` and `npm run build` in `frontend`, then the same in `backend`. Dev dependencies are installed even if `NODE_ENV` is `production`, because the build needs them.
6. `sudo systemctl restart kassenbuch`.
7. Poll `http://127.0.0.1:5000/api/health` for up to 30 seconds. The deploy succeeds only when the JSON contains `"dbState":1` (MongoDB connected).

The script copies itself to a temp file before the checkout, so replacing `scripts/deploy.sh` mid-deploy cannot change the copy that is already running.

## Server layout

| Piece | Location |
|---|---|
| App checkout | `/var/www/kassenbuch.nrwsystem.de` |
| Git remote | `git@github.com:uvexzon-dev/Cash_Book_Management_System.git` |
| Process | systemd unit `kassenbuch` |
| Runtime user | `ubuntu` |
| Start command | `/usr/bin/node dist/server.js` |
| Working directory | `/var/www/kassenbuch.nrwsystem.de/backend` |
| Environment file | `/var/www/kassenbuch.nrwsystem.de/backend/.env` |
| Listen address | `127.0.0.1:5000` |
| Uploads | `/var/www/kassenbuch.nrwsystem.de/backend/uploads` |
| Nginx site | `/etc/nginx/sites-available/kassenbuch.nrwsystem.de` |
| TLS certificate | `/etc/letsencrypt/live/kassenbuch.nrwsystem.de/` |

Node.js 22 is installed from NodeSource. The unit file is `/etc/systemd/system/kassenbuch.service`. It restarts the process on failure, loads `backend/.env`, and does not listen on a public port.

Nginx terminates HTTPS and proxies every request to `127.0.0.1:5000`. The body limit is `110m` because entry uploads allow 100 MB. HTTP on port 80 redirects to HTTPS. Certbot renews the certificate with `certbot.timer`.

Check the app from the server:

```bash
systemctl status kassenbuch
curl -fsS http://127.0.0.1:5000/api/health
curl -fsS -o /dev/null -w "%{http_code}\n" https://kassenbuch.nrwsystem.de/login
```

A healthy process returns `"status":"ok"` and `"dbState":1`.

## Environment

`backend/.env` is not in git. A deploy does not create or overwrite it. These are the variables the service uses:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Atlas connection string for the `cashbook` database |
| `JWT_SECRET` | Signing key for login tokens. Generate a new one per server. |
| `JWT_EXPIRES_IN` | Token lifetime. Production uses `7d`. |
| `PORT` | `5000` |
| `HOST` | `127.0.0.1` so the port is only reachable through Nginx |
| `NODE_ENV` | `production` |
| `UPLOAD_DIR` | `uploads` |

The file mode is `600` and the owner is `ubuntu`.

## What a deploy keeps

These stay on disk across a checkout:

- `backend/.env`
- `backend/uploads`

Both are gitignored, and the script never runs `git clean`. Do not delete them by hand during a deploy.

`node_modules` and `dist` are rebuilt on every deploy.

## Do not edit the server checkout

The next tag deploy stops if the worktree is dirty. Fixes belong in git, then in a new tag.

On the server, do not:

- change application source
- commit
- run `git clean`
- leave untracked files that `git status --porcelain` would show

Ignored files such as `.env`, `uploads`, and `node_modules` are allowed.

## Rollback

Run the deploy script on the server as `ubuntu`, with a tag that already exists on `origin`:

```bash
cd /var/www/kassenbuch.nrwsystem.de
./scripts/deploy.sh v0.1.0
```

That fetches the tag, checks it out, rebuilds, and restarts. The worktree must be clean. Pushing `v0.1.0` again does not start GitHub Actions, because GitHub does not emit a new tag-push event for an existing tag.

To make a previous commit the normal release path instead, tag that commit with a new number (`v0.1.2`) and push the new tag.

## When a deploy fails

Open the failed job in the GitHub Actions tab first. The SSH session prints the script output, including `Refusing to deploy` and `git status --porcelain`.

| Symptom | What it means | What to do |
|---|---|---|
| `Missing DEPLOY_SSH_KEY secret` | The Actions secret is empty or missing | Paste `/home/ubuntu/.ssh/kassenbuch_actions` into the `DEPLOY_SSH_KEY` secret and re-run the job. Re-running still sends the same tag. |
| `Refusing to deploy '…'. Expected a tag like v0.1.0.` | The tag is not `vX.Y.Z` | Push a three-part numeric tag. Do not use a pre-release suffix. |
| `Working tree is dirty` | Someone changed the server checkout | On the server, inspect `git status --porcelain`, discard those changes, and re-run the script with the tag. Do not delete `.env` or `uploads`. |
| `Host key verification failed` | The pinned key in the workflow does not match this server | Compare `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` with the fingerprint above. Update the workflow only if the server host key was intentionally rotated. |
| `npm ci` or `npm run build` fails | Install or TypeScript/Vite failed | Read the Actions log. Fix the app on `main`, push a new tag. The previous process keeps serving the last successful build until `systemctl restart` runs. |
| `Health check failed` | The process did not connect to MongoDB within 30 seconds | `journalctl -u kassenbuch -n 100 --no-pager` and `curl -fsS http://127.0.0.1:5000/api/health`. Check `MONGODB_URI` in `backend/.env`. `dbState` other than `1` means the HTTP server is up and the database is not. |
| Nginx returns 502 | The Node process is not listening | `systemctl status kassenbuch` and `ss -tlnp \| grep 5000`. It should show `127.0.0.1:5000` only. |
| Certificate or Nginx config error | TLS or proxy config | `sudo nginx -t` and `sudo certbot renew --dry-run`. |

Useful commands on the server:

```bash
journalctl -u kassenbuch -n 100 --no-pager
systemctl status kassenbuch
sudo nginx -t
sudo systemctl reload nginx
```
