#!/bin/sh
set -eu

mkdir -p /data
chown dashboard:dashboard /data
exec su-exec dashboard:dashboard node server.js
