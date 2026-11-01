all:
	python3 ./render_template Dockerfile.j2 '{"base": "debian"}' > Dockerfile.debian
	python3 ./render_template Dockerfile.j2 '{"base": "alpine"}' > Dockerfile.alpine
.PHONY: all
