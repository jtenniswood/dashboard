# Dashboard

A Docker-hosted start page built from the [ReCasaOS dashboard](https://github.com/ReCasaOS/CasaOS-UI). It keeps the classic mountain wallpaper, translucent app tiles, and system and storage widgets.

## Run with Docker

```sh
git clone https://github.com/jtenniswood/dashboard.git
cd dashboard
docker compose up -d --build --wait
```

Open [http://localhost:8180](http://localhost:8180). Use the **+** card at the end of the app grid to add a web link. Drag cards to reorder them. On touch screens, press and hold a card briefly before dragging. The dashed outline shows where it will land. Right-click a card to open, edit, or move it. To remove a card, open its editor. On touch screens the menu is always visible. Cards try the linked site’s icon automatically. To override it, enter an icon URL, upload a PNG, JPEG, WebP, GIF or SVG up to 4 MB, or choose **Create icon** to pick a Material Symbol and background colour. Created and uploaded icons are rendered as PNGs up to 128 pixels. The rendered icons and original SVG uploads are stored in `/data/icons` on the mounted `dashboard-data` volume.

Right-click the wallpaper and choose **Change wallpaper** to pick from the background images. The Docker volume keeps your web cards and wallpaper through container restarts and image rebuilds. To use a different local port, set `DASHBOARD_PORT` when running Docker Compose.

## Show drive capacities

Run the inventory helper on the Docker host using Node.js 24. Leave it running in a separate terminal while you use the live drive readings:

```sh
node standalone/host-inventory.mjs
```

The helper reads the capacity of the filesystem containing your home folder. The dashboard also shows the Docker data filesystem. To include an additional mounted drive or network share, give the helper a path on that drive. Repeat `--drive` for more drives:

```sh
node standalone/host-inventory.mjs --drive "Media=/path/to/mounted/media" --drive "Backup=/path/to/mounted/backup"
```

The helper writes capacity totals to the local `inventory/` folder. Docker mounts that folder read-only. The dashboard container never receives the Docker socket or mounts of your drives. Capacity readings show filesystem space. Drive health and hardware diagnostics require separate tools.

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

### Wallpaper credits

- **Dolomites at night** by [Marek Piwnicki](https://unsplash.com/photos/snowy-mountains-under-a-starry-night-sky-SumjjLhysZM).
- **Moena under stars** by [Benjamin Voros](https://unsplash.com/photos/snow-mountain-under-stars-phIFdC6lA4E).

These photographs are distributed under the [Unsplash License](https://unsplash.com/license).
