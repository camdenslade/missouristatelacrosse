#!/bin/bash
if systemctl list-unit-files | grep -q eb-docker-log.service; then
  systemctl enable eb-docker-log
  systemctl restart eb-docker-log
fi
