---
authors:
  - hatedabamboo
date:
  created: 2025-02-27
slug: bash-functions
tags:
  - bash
categories:
  - "⬢⬡⬡ Beginner"
title: "Bash functions"
---
Some time ago [I wrote](https://notes.hatedabamboo.me/bash-aliases) about bash aliases and how they
reduce the complexity of long commands by replacing them with several symbols.
But aliases are not the only things that can ease the usage of shell. In this
article I will share with you the magic of bash functions and provide several
examples of how awesome they are.

<!-- more -->

![image](../assets/bash-functions.webp){ .off-glb }

## Bash functions

As a huge nerd, I often get annoyed when someone answers the question, "Which
programming languages do you write in?" with, "Oh, you know, Bash." Because
Bash is not a programming language.

Bash is a shell interpreter. This means that it's not a language in itself;
it's a glue that ties programs together. Without actual programs to perform
specific logic, Bash's capabilities are quite limited outside of operations
within the shell itself and basic input-output tasks.

But that doesn't mean Bash is useless. On the contrary, its ability to act as a
glue between different commands makes it an incredibly powerful tool -- if used
correctly.

To increase your effectiveness and comfort when working in the shell, you can
use shell functions.

As the documentation states:

!!! quote "man bash"

    A shell function is an object that is called like a simple command and
    executes a compound command with a new set of positional parameters.

Basically, it's a predefined list of commands that execute in a certain order,
using the provided positional parameters as arguments.

For example, this function:

```shell
hw() {
  local hello=$1
  local world=$2

  echo $hello $world
}
```

will execute:

```shell
~ $ hw world hello
world hello
```

## Something tangible

The example above is quite useless, I know. So, let's take a look at something
that can actually be helpful.

### Transform UNIX timestamp into human-readable time

I've tried to remember the correct arguments for the `date` command to parse a
UNIX timestamp several times, but each time, the only one I can remember is
`date +%s`, which is the total opposite. So, I wrote the following function:

```shell
fromts() {
  local ts="$1"
  local len="$(echo -n $ts | wc -c)"

  if [ "$len" -eq "13" ]; then
    date -d@"$(echo $(($ts/1000)))"
  elif [ "$len" -eq "10" ]; then
    date -d@"$ts"
  else
    echo "Wrong timestamp"
  fi
}
```

With its help each time I need to quickly parse the time, I simply call
`~ $ fromts 1740670966` and receive the required
`Thu 27 Feb 16:42:46 CET 2025`. It can even parse millisecond-precision UNIX
time (which are rare, but they exist -- so why not?).

### Generate a random name for a git branch

When you need to create a branch for super-quick typo fix, it's quite annoying
to come up with a proper branch name for it. So I decided to generate a
somewhat random name instead.

```shell
new-branch() {
  echo "$(whoami)-tmp-$(openssl rand -hex 8)"
}

```
By calling

```shell
~ $ git checkout -b $(new-branch)
```

it will create a branch with your current shell username, "tmp," and 8 random
symbols in the end (just in case). I've used it several dozen times already --
super neat!

### Print the website TLS certificate dates

Expiring TLS certificates are a common pain in the ass, especially if you don't
use automation like Certbot and Let's Encrypt. But even in this case, to
quickly check if the certificate is expired is always a nice ability to have:

```shell
cert-dates() {
  local website="$1"

  openssl s_client -connect $website:443 </dev/null 2>/dev/null | openssl x509 -noout -dates
}
```

### Print the website TLS certificate details

And here’s the older brother of the previous function. It can be useful in
situations where you want to check multiple parameters simultaneously: common
name, dates, and DNS names.

```shell
get-cert() {
  local website="$1"

  openssl s_client -connect $website:443 </dev/null 2>/dev/null | openssl x509 -noout -text
}
```

### Share a text file

Apart from simple wrappers for complex commands, functions can serve more
advanced purposes. For example, sending a colleague or a friend a text file.
Pastebin is a great service for this purpose.

```shell
paste() {
  local filename=$1
  local text="$(cat $1)"
  local api_key="$PASTEBIN_API_KEY"
  local paste_url="https://pastebin.com/api/api_post.php"
  local expire="1D"

  curl -X POST \
    -F "api_dev_key=${api_key}" \
    -F "api_paste_code=<$1" \
    -F 'api_option=paste' \
    -F "api_paste_expire_date=${expire}" \
    ${paste_url}
  echo
}

```

To fully use Pastebin's functionality, you will need to obtain the
[Pastebin API key](https://pastebin.com/doc_api#1) and provide it as an
environment variable:

```shell
export PASTEBIN_API_KEY="my-totally-valid-pastebin-key"
```

In my example, the default expiration time is 1 day. You can configure it to
your liking; I prefer not to leave trash behind me.

### Share a secret securely

Some big tech companies have their own services for sharing sensitive data.
Some security-related software companies, if I’m not mistaken, provide the same
functionality.

For personal use, I prefer onetimesecret.com.

```shell
ots() {
  local secret=$1
  local ttl=3600
  local user="$OTS_USER_NAME"
  local api_key="$OTS_API_KEY"
  local domain="https://eu.onetimesecret.com"

  echo -n "Your new secret is: $domain/secret/"; curl -X POST -u "$user:$api_key" -d "secret=$secret&ttl=$ttl" "$domain/api/v1/share" 2>/dev/null | jq -r .secret_key
}
```

Unfortunately, they don’t print the full secret URL, so I had to improvise.

Same as before, to use the full functionality of the service, you will need to
create an account and
[obtain an API key](https://docs.onetimesecret.com/docs/rest-api).

### Get information about an IP address

Sometimes I want to check an IP address and its details: country, city, and the
like. This function, with the help of `jq`, helps me get the necessary
information in a pretty format.

```shell
ipinfo() {
  curl https://ipinfo.io 2>/dev/null | jq "{ip: .ip, city: .city, region: .region, country: .country, timezone: .timezone}"
}
```

---

As you can see, the variety of applications for functions is virtually
limitless. In situations when you need something done quickly, but writing a
[full program](https://github.com/hatedabamboo/jeeves) seems like overkill, and
aliases' functionality isn’t enough, bash functions may be just what you need.

All the aforementioned functions (and some other stuff) can be found in my
[dotfiles](https://github.com/hatedabamboo/dotfiles) repository.

!!! abstract "Closing remarks"

    As always, feel free to
    [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with
    me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my
    mistakes and befriend me on one of the social media platforms listed below.
