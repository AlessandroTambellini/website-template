#!/bin/sh

# In case I'm running it from outside the project folder
DIR=$(dirname "$0")

set -xe
node --watch --watch-preserve-output $DIR/src/server.js
