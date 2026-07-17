# GitHub Installation

This repository is the canonical distribution source for
`savne-saltcorn-agent-api`.

## Install From Saltcorn

In Saltcorn, open **Module store** -> **Add another plugin** and use:

```text
Nombre: savne-saltcorn-agent-api
Fuente: github
Ubicacion: OscarSanchezSavne/savne-saltcorn-agent-api
Version: main
```

The repository root contains the Saltcorn plugin package, so Saltcorn can read
`package.json` directly from GitHub.

Do not put the full GitHub URL in `Nombre`. With Saltcorn's `github` source,
`Ubicacion` must be the GitHub `owner/repository` pair.

## Install A Fixed Version

After a Git tag exists, prefer the tag instead of `main`:

```text
Nombre: savne-saltcorn-agent-api
Fuente: github
Ubicacion: OscarSanchezSavne/savne-saltcorn-agent-api
Version: v0.2.53
```

## Local Fallback

If your Saltcorn installation does not accept GitHub URLs, clone this repository
on the server and install the repository directory as a `local` plugin.

```bash
git clone https://github.com/OscarSanchezSavne/savne-saltcorn-agent-api.git
```

Then use the cloned path as the local plugin location.
