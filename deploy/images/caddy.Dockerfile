FROM caddy:2.11.9-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0
USER 0:0
COPY dashboard/ /srv/cloudlane/dashboard/
COPY Caddyfile /etc/caddy/Caddyfile
RUN chown -R 10001:10001 /data /config
USER 10001:10001
ENTRYPOINT ["caddy"]
CMD ["run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
