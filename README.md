# paas-prometheus-charts

## Overview

Generate SVG charts from PromQL queries to prometheus.

This repository was based on code from [nivo](https://github.com/plouc/nivo).

## Usage

```
PROM_URL=http://my.prom.server.local PROM_USERNAME=xxx PROM_PASSWORD=yyy npm start
```

then make PromQL requests to the server in the form:

```
http://localhost:3030/{CHART_TYPE}.svg?query={PROMETHESUS_QUERY}
```

For example:

* [Pie chart of buildpack usage](http://localhost:3030/pie.svg?query=sum(cf_application_info)%20by%20(buildpack))
* [Bar chart of memory usage by org](http://localhost:3030/bar.svg?query=sum(cf_application_memory_mb)%20by%20(organization_name))
* [Pie chart of memory usage by org with different colors](http://localhost:3030/pie.svg?query=sum(cf_application_memory_mb)%20by%20(organization_name)&colors=d320)

## Deploying to CF

Edit the `manifest.yml` to wire it up to prometheus:

```
---
applications:
- name: prometheus-charts
  command: node src/app.js
  memory: 256M
  buildpack: nodejs_buildpack
  env:
    PROM_URL: https://path-to-prom
    PROM_USERNAME: prom-user
    PROM_PASSWORD: prom-pass
```

then push

```
cf push
```
