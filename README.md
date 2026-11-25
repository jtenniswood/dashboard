# Dashboard

A Docker-hosted start page built from the [ReCasaOS dashboard](https://github.com/ReCasaOS/CasaOS-UI). It keeps the classic mountain wallpaper, translucent app tiles, and system and storage widgets.

## Run with Docker

```sh
git clone -b standalone-dashboard https://github.com/jtenniswood/dashboard.git
cd dashboard
docker compose up -d --build --wait
```

Open [http://localhost:8180](http://localhost:8180). Click **+** in the app grid to create a web card. Click a running container’s tile to set its launch address, or hover and open the tile’s menu to edit a card that already has an address. On touch screens the menu is always visible. Both kinds of cards support an icon URL or an uploaded PNG, JPEG, WebP, or GIF up to 4 MB. Uploads are resized to 128 pixels and stored with the card. Click the sliders in the toolbar to change the dashboard appearance.

The Docker volume keeps your cards, container customizations, wallpaper, and widget choices through container restarts and image rebuilds. Container settings follow the Docker container name when you recreate a container with the same name. The theme preference is saved in each browser. To use a different local port, set `DASHBOARD_PORT` when running Docker Compose.

## Show running containers and drive capacities

Run the inventory helper on the Docker host using Node.js 24 and the same Docker context you use to start the dashboard. Leave it running in a separate terminal while you use the live inventory:

```sh
node standalone/host-inventory.mjs
```

It lists running containers from that Docker context and reads the capacity of the filesystem containing your home folder. The dashboard also shows the Docker data filesystem. To include an additional mounted drive or network share, give the helper a path on that drive. Repeat `--drive` for more drives:

```sh
node standalone/host-inventory.mjs --drive "Media=/path/to/mounted/media" --drive "Backup=/path/to/mounted/backup"
```

The helper writes only container names, published TCP ports, and capacity totals to the local `inventory/` folder. Docker mounts that folder read-only. The dashboard container never receives the Docker socket or mounts of your drives. Label infrastructure containers `dashboard.exclude=true` to keep them out of the app grid. Capacity readings show filesystem space. Drive health and hardware diagnostics require separate tools.

## Open it over Tailscale

With Tailscale running on the Docker host and HTTPS enabled for your tailnet:

```sh
tailscale serve --bg http://127.0.0.1:8180
```

Open the HTTPS URL printed by [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve) on any device that can reach this host through your tailnet. The Docker port binds to loopback. Anyone with access to the dashboard can edit its shared cards and settings. App links open directly, so use an address your browser can reach.

## Standalone scope

The dashboard runs independently of CasaOS. On Docker Desktop the CPU and RAM widgets report the Linux virtual machine. The optional network widget reports the dashboard container’s traffic. CasaOS app installation, file browsing, terminals, and virtual-machine controls require CasaOS.

## Upstream and license

The source snapshot comes from [ReCasaOS/CasaOS-UI at 6eb0735](https://github.com/ReCasaOS/CasaOS-UI/tree/6eb07359c4a6cd01edfec962d0414767fa3e3364). The standalone UI and service are under `standalone/`. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [the upstream README](UPSTREAM.md) for attribution and licensing details.
