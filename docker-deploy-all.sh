#!/bin/bash
set -e

# Builds and deploys all images for the Azure environments

ORG=${ORG:-hsldevcom}

for TAG in dev stage production; do
  DOCKER_IMAGE=$ORG/hsl-map-generator-server:${TAG}

  docker build -t $DOCKER_IMAGE .
  docker push $DOCKER_IMAGE
done
