# Dashboard

A Docker-hosted start page built from the [ReCasaOS dashboard](https://github.com/ReCasaOS/CasaOS-UI). It keeps the classic wallpaper, app tiles, search bar, clock, and status widgets. Add the web apps you already run using their HTTP or HTTPS addresses.

## Run with Docker

Clone the branch containing the standalone dashboard, then start it:

```sh
git clone -b standalone-dashboard https://github.com/jtenniswood/dashboard.git
cd dashboard
docker compose up -d --build --wait
```

Open [http://localhost:8180](http://localhost:8180) and click **+** beside **Apps** to add your first shortcut. Use the menu on a tile to edit, reorder, or remove it. In **Settings** you can pick a wallpaper, choose the widgets and search bar you want to show, and switch between light and dark appearance.

The Docker volume keeps the shortcuts, wallpaper, search visibility, and widget choices through container restarts and image rebuilds. The light or dark preference and clock format are saved in each browser. Use `DASHBOARD_PORT=8181 docker compose up -d --wait` to pick a different local port.

## Open it over Tailscale

With Tailscale running on the Docker host and HTTPS enabled for your tailnet:

```sh
tailscale serve --bg http://127.0.0.1:8180
```

Use the HTTPS URL printed by [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve) on any device with access to the host through your tailnet. The Compose port binds to loopback. Everyone who can reach the dashboard can edit its shared shortcuts and settings. Each app shortcut opens directly, so the browser needs access to that app's address too.

## Standalone features

The dashboard does not require a CasaOS installation, a Docker socket mount, or privileged container access. The CPU and RAM widgets show the Docker Linux environment, storage shows the filesystem containing the data volume, and network shows traffic on the dashboard container's interfaces. On Docker Desktop, the Linux metrics come from Docker's virtual machine. App installation, file browsing, terminals, virtual machines, and other CasaOS administration tools require CasaOS.

## Upstream and license

The source snapshot comes from [ReCasaOS/CasaOS-UI at 6eb0735](https://github.com/ReCasaOS/CasaOS-UI/tree/6eb07359c4a6cd01edfec962d0414767fa3e3364). The standalone UI and service are under `standalone/`. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [the upstream README](UPSTREAM.md) for attribution and licensing details.
