ROOT_DIR := $(dir $(realpath $(lastword $(MAKEFILE_LIST))))

help:
	@echo "Please use 'make <target>' where <target> is one of"
	@echo "	build	builds and restarts docker container"


build:
	docker compose up --build -d --remove-orphans
