---
draft: true # TODO remove
authors:
  - hatedabamboo
date:
  created: 2024-10-17
slug: honey-i-shrunk-the-app
tags:
  - containers
  - docker
title: "Honey, I Shrunk the App: minimizing containerized applications"
---
Containers have been ruling the internet for almost two decades now. It's not only because they're convenient to use, but also because their simplicity in creation and setting up. I won't be the first one to say that containers are extremely useful tool, and I won't be the last. And, as every tool, they can be used fast, or they can be used effectively. Today we're gonna focus on the latter: maximizing the efficiency of our application by minimizing the size of the container.

<!-- more -->

<!-- ![image](../assets/honey-i-shrunk-the-app-minimizing-containerized-applications.webp) TODO make an image -->

Let's imagine we wrote an application. This is avery cool application, it shows us the weater based on our location. And we want to run it inside the container. Let's investigate different approaches and compare them.

!!! info

    For the sake of simplicity we will use Docker as a container building engine. It's very popular and very common. However, Docker may not be a suitable option for high-scale companies because of their licensing model (TODO: add link to docker TOS). In this case I suggest you to use cri-o.

## Level 1: Common

This is the most popular approach to building containers. We choose base image, we add necessary software and our application and voila! Our app works and we're happy.

Our Dockerfile looks like this:

```dockerfile
FROM ubuntu:latest
RUN apt-get update && apt-get install -y python3 python3-pip
COPY . /app
WORKDIR /app
RUN pip install --break-system-packages -r requirements.txt
CMD ["python3", "app.py"]
```

The build time of our application is:

```shell
$ docker build -t app:common -f Dockerfile.common .                                                             
[+] Building 59.8s (10/10) FINISHED
```

See? Nice and simple. It has all the necessary dependencies and stuff, and it does the job. A small nit: we've added `--break-system-packages` flag because from certain version `pip` will not simply install external packages on system level. For our scenario, however, this doesn't concern us.

Let's have a look how huge our container is.

```shell
REPOSITORY   TAG       IMAGE ID       CREATED          SIZE
app          common    b099d88eac42   40 seconds ago   571MB
```

Ah, who cares. The container is ready and it works!

## Level 2: Magic

We have been developing applications for a significant amount of time already, and we have learned more sofisticated ways to pack our applications. For example, instead of generic `ubuntu` image, we can tickle with slim images. Let's have a look at the opportunities.

```dockerfile
FROM python:3.12-slim
COPY . /app
WORKDIR /app
RUN pip install --break-system-packages -r requirements.txt
CMD ["python", "app.py"]
```

Dockerfile complexity almost hasn't changed.

```shell
$ docker build -t app:magic -f Dockerfile.magic .                                                                                                                                                                  
[+] Building 16.4s (9/9) FINISHED
```

Well well well, from almost 1 minute to 16 seconds, a nice 4 time decrease in build speed! But what about it's size?

```shell
$ docker images
REPOSITORY   TAG       IMAGE ID       CREATED         SIZE
app          magic     0c66f1144f28   3 minutes ago   141MB
app          common    94494ba1c3a5   5 minutes ago   571MB
```

And a very impressize 4 times reduce in size as well! Feels good man, isn't it? That's the power of optimizing the workloads. But can we go further?

## Level 3: Rare

What can be smaller than the smallest distributive? It's absence! That's right, pure and clean distroless image with only application runtime and the application itself. This idea came from Google[^1] and it's pretty fun and impressive. Apart from it's smaller size, lack of shells, package managers and any other software reduces the possible area of attack.

This is how our application looks like with distroless Python.

```dockerfile
FROM debian:12-slim AS build
RUN apt-get update \
    && apt-get install --no-install-suggests --no-install-recommends --yes python3-venv gcc libpython3-dev \
    && python3 -m venv /venv \
    && /venv/bin/pip install --upgrade pip setuptools wheel

FROM build AS build-venv
COPY requirements.txt /requirements.txt
RUN /venv/bin/pip install --disable-pip-version-check -r /requirements.txt

FROM gcr.io/distroless/python3-debian12
COPY --from=build-venv /venv /venv
COPY . /app
WORKDIR /app
ENTRYPOINT ["/venv/bin/python3", "app.py"]
```

The Dockerfile became much bigger and more complicated. Let's dissect it.

First block of commands creates a build environment for our application using Debian 12 and Python packages.

Second block of commands installs necessary libraries for our application and packs them into the virtual environment -- a separated environment for Python applications that has all the necessary packages ready to work.

Third block is our final application itself. This is where all the magic happens: we use distroless Python image and copy only the code of our application and a dedicated virtual environment with all the dependencies for our application.

This approach is called multi-stage build. It is a very useful Docker (or any container engine) feature which allows to distinguish the build environment and the runtime. This way final built application does not include all the heavy packages that were installed during the build phase and the resulting image is lightweight. However, there is also a small caveat: several build stages also take more time to complete.

```shell
$ docker build -t app:rare -f Dockerfile.rare .                                                                                                                                                             
[+] Building 49.8s (14/14) FINISHED 
```

But the result is very much worth it.

```shell
$ docker images
REPOSITORY   TAG       IMAGE ID       CREATED         SIZE
app          rare      2812cf2ca04e   8 minutes ago   81.7MB
app          magic     0c66f1144f28   16 minutes ago   141MB
app          common    94494ba1c3a5   18 minutes ago   571MB
```

## Level 4: Epic

Since the dawn of the container era developers have been pushing boundaries of reducing the size of the containers by creating smaller and smaller base images. One of such inventions was Alpine Linux, which is extremely small (approx. 8Mb base image). It is used for a vast variety of containerised applications as a base image for several reasons, the first being exactly it's impressive size (and another one, also quite important, is lack of glibc and based on it vulnerabilities). That's why we can usually see tags for application with `-alpine` suffix, which says us that this container should be small in size.

Let's see how true is that.

```dockerfile
FROM python:3.12-alpine
COPY . /app
WORKDIR /app
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt
CMD ["python", "app.py"]
```

Dockerfile almost hasn't changed. The only difference is the base image. Let's build it.

```shell
$ docker build -t app:epic -f Dockerfile.epic .
[+] Building 8.6s (9/9) FINISHED
```

Wow that's fast. Almost 2 times faster than the magic! How much space does it takes though?

```shell
$ docker images
REPOSITORY   TAG       IMAGE ID       CREATED          SIZE
app          epic      efb25dbcc8f0   2 minutes ago    62.3MB
app          rare      2812cf2ca04e   8 minutes ago    81.7MB
app          magic     0c66f1144f28   16 minutes ago   141MB
app          common    94494ba1c3a5   18 minutes ago   571MB
```

It weights even less that before! Almost 2 times less that slim and almost 10 times less that usual! It's always a great pleasure to see such changes.

## Level 5: Legendary

Alpine images are indeed small. But did you know, that we can build a container from scratch? Literally!

This is bullshit. I've spent 2 hours fucking trying to make python app a statically linked file. This is bullshit.


!!! abstract "Closing remarks"

    As always, feel free to
    [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with
    me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my
    mistakes and befriend me on one of the social media platforms listed below.

[^1] [distroless](https://github.com/GoogleContainerTools/distroless)
