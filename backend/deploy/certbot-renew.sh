#!/bin/sh
# Renew the nclzs.com certificate and reload nginx when it actually changed.
# Installed as /usr/local/sbin/ncl-certbot-renew.sh, called from /etc/cron.d/certbot-renew.
/usr/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"
