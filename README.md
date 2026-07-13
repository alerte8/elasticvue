# elasticvue — custom fork

> This repository is a custom fork of [cars10/elasticvue](https://github.com/cars10/elasticvue),
> currently based on upstream `v1.15.0`. See [About this fork](#about-this-fork) for the differences.

Elasticsearch gui for your browser [https://elasticvue.com](https://elasticvue.com)

> Elasticsearch is a trademark of Elasticsearch BV, registered in the U.S. and in other countries.

Contents

1. [About this fork](#about-this-fork)
2. [About](#about)
3. [Usage](#usage)
4. [Browser support](#browser-support)
5. [Troubleshooting](#troubleshooting)
6. [Comparing with other frontends](#comparing-with-other-frontends)
7. [i18n](#i18n)
8. [Contributing](#contributing)

## About this fork

This fork adds the following on top of upstream elasticvue:

* **Security page** — manage roles, API keys (with creation date) and users: create, filter,
  bulk delete; deleting a user also cleans up its API keys
* **Tabbed search** — multiple search tabs with rename, close (button or middle-click) and a
  reload button with auto-refresh interval
* **Large-volume index export** — streamed NDJSON dump format (bulk-ready, header line with
  settings + mappings), written batch by batch so large indices don't exhaust memory; the legacy
  single-file JSON (+ ZIP) export is still available
* **Multi-file index import** — select several dump files (.json, .ndjson, .zip) at once and
  configure each one individually (new or existing target index); NDJSON files are streamed and
  bulk-inserted in batches of 1000 documents
* **Search results table** — custom column management (order, visibility, drag & drop), manual
  multi-column sorting, copy selected columns only with Shift pressed
* **Clipboard tools** — paste multiple documents from the clipboard; delete all filtered documents
* **Global zoom** — Ctrl + mouse wheel, persisted and restored on reload
* **No phone-home** — update checks and telemetry are fully disabled in this build

See [CHANGELOG.md](CHANGELOG.md) for details.

## About

[Screenshots](https://elasticvue.com/features)

**Elasticvue** is a free and open-source gui for elasticsearch that you can use to manage the data in your cluster.
It supports every version of elasticsearch, even those that are EOL. Check
the [FAQ](https://github.com/cars10/elasticvue/wiki/FAQ) for more details.

### Features

* Cluster overview
* Index & alias management
* Shard management
* Searching and editing documents
* Rest queries
* Snapshot & repository management
* ... and much more

## Usage

You can use elasticvue in several ways, use whatever works best for you.

> **Note (fork):** automatic updates are disabled in this fork — the desktop app is built and
> distributed manually (`npm run tauri:build`). The download links below point to the upstream
> builds, which do **not** contain the fork features.

| Type | Auto Update | Cluster config | Support for self signed ssl |
|------|-------------|----------------|-----------------------------|
| Desktop app (this fork) | No | not needed | yes |
| Desktop app (upstream) | Yes | not needed | yes |
| Browser extension | Yes | not needed | partially |
| Web | Yes | required | partially |
| Self hosted | No | required | partially |
| Docker | No | required | partially |

### Desktop App - *recommended*

Fork: build locally with `npm install && npm run tauri:build`.

Upstream builds:

* [Windows .msi](https://update.elasticvue.com/download/windows/x86_64)
* [Homebrew](https://formulae.brew.sh/cask/elasticvue) / [Mac x68 .dmg](https://update.elasticvue.com/download/darwin/x86_64) / [Mac aarch64 .dmg](https://update.elasticvue.com/download/darwin/aarch64)
* [Linux .AppImage](https://update.elasticvue.com/download/linux/x86_64) / [Arch AUR](https://aur.archlinux.org/packages/elasticvue-bin)

### Browser extension

* [Google chrome](https://chrome.google.com/webstore/detail/elasticvue/hkedbapjpblbodpgbajblpnlpenaebaa)
* [Firefox](https://addons.mozilla.org/en-US/firefox/addon/elasticvue/)
* [Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/geifniocjfnfilcbeloeidajlfmhdlgo)

### Web version

> **You have to configure your elasticsearch cluster if you want to use elasticvue via docker**

Visit [https://app.elasticvue.com](https://app.elasticvue.com).

### Self-hosted

> **You have to configure your elasticsearch cluster if you want to self host elasticvue**

Please check the [wiki](https://github.com/cars10/elasticvue/wiki/Building-Elasticvue) for more information.

### Docker

> **You have to configure your elasticsearch cluster if you want to use elasticvue via docker**

Use the [existing image](https://hub.docker.com/r/cars10/elasticvue):

```bash
# docker hub:
docker run -p 8080:8080 --name elasticvue -d cars10/elasticvue

# ghcr.io:
docker run -p 8080:8080 --name elasticvue -d ghcr.io/cars10/elasticvue
```

When using docker you can provide default cluster configuration for your users. Clusters will automatically be imported every time you start elasticvue.
You can either set an environment variable or provide a config file as a volume. In either case the content should be a json array of your
clusters, looking like this:

```json
[
  {
    "name": "dev cluster",
    "uri": "http://localhost:9200"
  },
  {
    "name": "prod cluster",
    "uri": "http://localhost:9501",
    "username": "elastic",
    "password": "foobar"
  }
]
```

#### Possible keys

| Name | Value | Required | Example |
|------|-------|----------|---------|
| name | Name of the cluster | No | `"production"` |
| uri  | Cluster uri | Yes | `"http://localhost:9200"` |
| username | Username for basic authentication | No | `"elastic"` |
| password | Password for basic authentication | No | `"foobar"` |
| apiKey | API key for authentication | No | `"VuaCfGcBCdbkQm-e5aOx:ui2lp2axTNm5ShWDc11v6g"` |
| S3accessKeyId | AWS access key ID for IAM authentication | No | `"AKIAIOSFODNN7EXAMPLE"` |
| S3secretAccessKey | AWS secret access key for IAM authentication | No | `"wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"` |
| S3sessionToken | AWS session token for temporary credentials | No | `"FQoGZXIvYXdzE...example"` |
| S3region | AWS region for IAM authentication | No | `"us-east-1"` |



#### Docker with default clusters in environment variable

Example using environment variable `ELASTICVUE_CLUSTERS`:

```bash
docker run -p 8080:8080 -e ELASTICVUE_CLUSTERS='[{"name": "prod cluster", "uri": "http://localhost:9200", "username": "elastic", "password": "elastic"}]' cars10/elasticvue
```

#### Docker with default clusters in config file via volume

Example using config file volume to `/usr/share/nginx/html/api/default_clusters.json`:

```bash
echo '[{"name": "prod cluster", "uri": "http://localhost:9200", "username": "elastic", "password": "elastic"}]' > config.json
docker run -p 8080:8080 -v config.json:/usr/share/nginx/html/api/default_clusters.json cars10/elasticvue
```

## Elasticsearch configuration

You have to [enable CORS](https://www.elastic.co/guide/en/elasticsearch/reference/current/modules-network.html) to allow
connection to your elasticsearch cluster **if you do not use the desktop app or the browser extensions**.

Find your elasticsearch configuration (for example `/etc/elasticsearch/elasticsearch.yml`) and add the following lines:

```yaml
# enable CORS
http.cors.enabled: true

# Then set the allowed origins based on how you run elasticvue. Chose only one:
# for docker / running locally
http.cors.allow-origin: "http://localhost:8080"
# online version
http.cors.allow-origin: /https?:\/\/app.elasticvue.com/

# and if your cluster uses authorization you also have to add:
http.cors.allow-headers: X-Requested-With,Content-Type,Content-Length,Authorization
```

If you use docker to run your elasticsearch cluster you can pass the options via environment variables:

```bash
docker run -p 9200:9200 \
           -e "discovery.type=single-node" \
           -e "http.cors.enabled=true" \
           -e "http.cors.allow-origin=/.*/" \
           -e "http.cors.allow-headers=X-Requested-With,Content-Type,Content-Length,Authorization" \
           docker.elastic.co/elasticsearch/elasticsearch:9.0.0
```

or `compose.yml`

```yml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:9.0.0
    ports:
      - "9200:9200"
    environment:
      - http.cors.enabled=true
      - http.cors.allow-origin="/.*/"
      - http.cors.allow-headers=X-Requested-With,Content-Type,Content-Length,Authorization
      - discovery.type=single-node
```

After configuration restart your cluster and you should be able to connect.

## Browser Support

Any current version of Chrome, Firefox and Edge should work without issues. Safari is mostly untested so your
mileage may vary.

## Troubleshooting

Before opening an issue please try to reset elasticvue to its default settings:

1. Open the settings
2. Download a backup of your current elasticvue data
3. Click `Disconnect and reset`

This will reset all your saved filters, and you have to reconnect to your cluster. Please open
an [issue](https://github.com/cars10/elasticvue/issues/new/choose) if your problem persists.

## Comparing with other frontends

See the Wiki. [Comparing to other frontends](https://github.com/cars10/elasticvue/wiki/Comparing-to-other-frontends)

## i18n

Elasticvue is available in the following languages:

* english
* chinese (simplified & traditional)
* french
* russian
* japanese
* italian
* korean

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
