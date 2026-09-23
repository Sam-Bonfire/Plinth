#!/bin/bash
pnpm --filter web-dashboard dev > dev.log 2>&1 &
echo $! > dev.pid
