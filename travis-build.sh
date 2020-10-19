#!/bin/bash
set -e

ORG=${ORG:-hsldevcom}
DOCKER_TAG=${TRAVIS_BUILD_NUMBER:-latest}
BUILD_AND_PUSH_BRANCHES=('development', 'stage', 'master')

if [[ $TRAVIS_BRANCH == "development" ]]; then
  DOCKER_TAG=dev
fi

if [[ $TRAVIS_BRANCH == "stage" ]]; then
  DOCKER_TAG=stage
fi

if [[ $TRAVIS_BRANCH == "master" ]]; then
  DOCKER_TAG=production
fi

DOCKER_IMAGE=$ORG/hsl-map-generator-server:${DOCKER_TAG}

echo "Building image with tag -> ${DOCKER_TAG}"

docker build --tag=$DOCKER_IMAGE .

if [[ $TRAVIS_PULL_REQUEST == "false" ]]; then
  if [[ " ${BUILD_AND_PUSH_BRANCHES[*]} " == *"$TRAVIS_BRANCH"* ]]; then
    echo "Pushing builded image to registry with tag -> ${DOCKER_TAG}"

    docker login -u $DOCKER_USER -p $DOCKER_AUTH
    docker push $DOCKER_IMAGE
  else
    echo "Pushed branch is not targeted environment branch (development, stage, master). Image is not pushed to registry"
  fi
else
  echo "Image is not pushed to registry for pull requests"
fi
