---
title: "Advent of Sysadmin 2025"
date: 2025-12-02
tags:
  - troubleshooting
layout: layouts/post.njk
permalink: /advent-of-sysadmin-2025/
---
Advent season is here! And that means that advent challenges as well!

After [disasterous attempt](https://github.com/hatedabamboo/AoC2024) at Advent of Code last year, this year I was very happy to see that Sad Servers started the Advent challenge of their own -- [Advent of Sysadmin](https://sadservers.com/advent)! And this means more challenges for us to tackle! 12, to be precise. The Advent will consist of 12 challenges. To keep things slightly more interesting, I will publish the solution of the task the next day it was published: for example today, on December 2, I will solve task from December 1, and so on. Have fun!

<!-- more -->

![Title image](/assets/advent-of-sysadmin-2025.webp)

## Auderghem: containers miscommunication

::: info Description

    There is an nginx Docker container that listens on port 80, the purpose of which is to redirect the traffic to two other containers statichtml1 and statichtml2 but this redirection is not working. Fix the problem.

:::

We connect to the server and first thing we check is running docker containers:

```bash
admin@i-03fc55a1924a48445:~$ docker ps
CONTAINER ID   IMAGE          COMMAND                  CREATED        STATUS         PORTS                                 NAMES
89bf0e394bb9   statichtml:2   "busybox httpd -f -v…"   26 hours ago   Up 8 seconds   3000/tcp                              statichtml2
1f96c1876662   statichtml:1   "busybox httpd -f -v…"   26 hours ago   Up 8 seconds   3000/tcp                              statichtml1
7440094fc321   nginx          "/docker-entrypoint.…"   26 hours ago   Up 8 seconds   0.0.0.0:80->80/tcp, [::]:80->80/tcp   nginx
```

We can see that statichtml containers are opened to serve port 3000. Let's check if we can curl them:

```bash
admin@i-03fc55a1924a48445:~$ curl -v localhost/1
* Host localhost:80 was resolved.
* IPv6: ::1
* IPv4: 127.0.0.1
*   Trying [::1]:80...
* Connected to localhost (::1) port 80
* using HTTP/1.x
> GET /1 HTTP/1.1
> Host: localhost
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
```

Okay, so the problem is that the `nginx` container can't reach `statichtml{1,2}` containers. Duh. Let's see how they are configured in the web server.

```bash
admin@i-03fc55a1924a48445:~$ docker exec -ti nginx cat /etc/nginx/conf.d/default.conf
    server {
        listen 80;
        location / {
            root   /usr/share/nginx/html;
            index  index.html index.htm;
        }
        location /1 {
            rewrite ^ / break;
            proxy_pass http://statichtml1.sadservers.local;
            proxy_connect_timeout   2s;
            proxy_send_timeout      2s;
            proxy_read_timeout      2s;
        }
        location /2 {
            rewrite ^ / break;
            proxy_pass http://statichtml2.sadservers.local;
            proxy_connect_timeout   2s;
            proxy_send_timeout      2s;
            proxy_read_timeout      2s;
        }
```

Web server is configured to connect to the backends on port 80. Let's see if we can change the `default.conf`.

```bash
admin@i-03fc55a1924a48445:~$ docker inspect nginx | jq .[0].Mounts
[
  {
    "Type": "bind",
    "Source": "/home/admin/app/default.conf",
    "Destination": "/etc/nginx/conf.d/default.conf",
    "Mode": "",
    "RW": true,
    "Propagation": "rprivate"
  }
]
admin@i-03fc55a1924a48445:~$ vim app/default.conf 
admin@i-03fc55a1924a48445:~$ docker restart nginx
nginx
admin@i-03fc55a1924a48445:~$ docker exec -ti nginx cat /etc/nginx/conf.d/default.conf | grep local 
            proxy_pass http://statichtml1.sadservers.local:3000;
            proxy_pass http://statichtml2.sadservers.local:3000;
```

We found that `default.conf` is actually mounted from the home directory of the VM we're working on, which means we can change the file and restart the container, which we executed. Let's see if it helped:

```bash
admin@i-03fc55a1924a48445:~$ curl -v localhost/1
* Host localhost:80 was resolved.
* IPv6: ::1
* IPv4: 127.0.0.1
*   Trying [::1]:80...
* Connected to localhost (::1) port 80
* using HTTP/1.x
> GET /1 HTTP/1.1
> Host: localhost
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
^C
```

No, still no luck.

Let's see how the containers network is configured.

```bash
admin@i-03fc55a1924a48445:~$ docker inspect nginx | jq .[0].NetworkSettings.Networks
{
  "bridge": {
...
  }
}
admin@i-03fc55a1924a48445:~$ docker inspect statichtml1 | jq .[0].NetworkSettings.Networks
{
  "static-net": {
    "IPAMConfig": {
      "IPv4Address": "172.172.0.11"
    },
...
}
```

Oh, so the containers are in different networks! That's a bummer, but we can fix this. As per task, we're only allowed to restart containers. This means we can't recreate the container in a new network and we will have to hot-swap networks. Luckily, with bridge networks we can do that. And since both statichtml containers share the same network, it's much more convenient for us to connect `nginx` container to the `static-net` network: 

```bash
admin@i-03fc55a1924a48445:~$ docker network connect static-net nginx
admin@i-03fc55a1924a48445:~$ ./agent/check.sh 
OK
```

And we've successfully finished the first task!

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20Advent%20of%20Sysadmin%202025">Reply to this post ✉️</a></p>
