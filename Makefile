ROOT_DIR := $(dir $(realpath $(lastword $(MAKEFILE_LIST))))

help:
	@echo "Please use 'make <target>' where <target> is one of"
	@echo "	start	installs deps, runs frontend (:5173) + backend (:3000)"
	@echo "	build	builds and restarts docker container"

.PHONY: help start build

start:
	yarn install
	yarn dev

build:
	docker compose up --build -d --remove-orphans
