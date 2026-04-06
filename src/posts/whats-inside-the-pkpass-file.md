---
title: "What's inside the pkpass file?"
date: 2026-04-05
tags:
  - other
layout: layouts/post.njk
permalink: /whats-inside-the-pkpass-file/
---
As a long-time smartphone user, I always found the idea of storing a hefty amount of cards in a single convenient place mighty impressive. Instead of cluttering the whole wallet with plastic, you just add a virtual card to an app -- and it's right there when you need it. After all, the data remains the same -- only the format changes. It's especially convenient (and cool -- I just like the feature so much) for storing temporary data -- cinema tickets, boarding passes, museum tickets, etc. But what's inside these magic `pkpass` files, exactly? Today we're gonna dive deep into the topic and figure out what convenience looks like under the hood.

<!-- more -->

![Title image](/assets/whats-inside-the-pkpass-file.webp)

## A journey to find the ticket number

First, a little detour. The idea to write this article came to me when I was looking for a ticket number on my boarding pass. Who even knows that? Where do you even find this info? I've never seen a ticket number before, only the booking reference number and the gate I have to go to. The carrier website wasn't very explicit in providing this information, nor was the email with the boarding pass. "Hey, -- I thought to myself, -- but a boarding pass mights have this information somewhere inside it, right? I mean, it has to compare my name and seat with the internal database somehow." Good thing I'm a nerd and I like to dive deep into things -- so I decided to dissect my `BoardingPass.pkpass` file and find the necessary information.

## Investigating the file format

First and foremost, how do you dive into something? You start by finding out what it is! And in our case -- what kind of file `pkpass` is.

```bash
~/pkpass $ file BoardingPass.pkpass
BoardingPass.pkpass: Zip archive data, made by v2.0, extract using at least v2.0, last modified, last modified Sun, Mar 22 2026 06:50:02, uncompressed size 1036, method=deflate
```

Looks like it's just a zip archive. How convenient!

```bash
~/pkpass $ unzip BoardingPass.pkpass
Archive:  BoardingPass.pkpass
...
~/pkpass $ tree
.
├── en.lproj
│   └── pass.strings
├── footer@2x.png
├── footer.png
├── fr.lproj
│   └── pass.strings
├── icon@2x.png
├── icon.png
├── it.lproj
│   └── pass.strings
├── logo@2x.png
├── logo.png
├── manifest.json
├── pass.json
└── signature

4 directories, 13 files
```

It seems that the contents of the `pkpass` file (or should I say archive?) are mostly graphics for the card in the application (*Wallet* on iOS), a file called `manifest.json`, seemingly the main data itself in `pass.json`, a file called `signature`, and metadata (or some other data) in 3 languages: English, French, and Italian.

Images are not that interesting; they contain logos for the airline, so let's focus on the others.

### manifest.json

Let's have a look inside `manifest.json`:

```bash
~/pkpass $ cat manifest.json
{
"en.lproj/pass.strings":"d13c82c875a14a153805c96f50d7960dfe3246ca",
"footer.png":"d4a13d4592f2ecd65ea733ed792d6ea66b6c2ee8",
"footer@2x.png":"d4a13d4592f2ecd65ea733ed792d6ea66b6c2ee8",
[...],
"pass.json":"ba2ed9e39a5e64800e53e54c9786057315d8a975"
}
```

Quite fascinating! It looks like this file contains file names and their hashes for the contents of the `pkpass` file. Let's check my assumption:

```bash
~/pkpass $ md5sum en.lproj/pass.strings
7ea647331543c80885ed089a642a1802  en.lproj/pass.strings
~/pkpass $ sha1sum en.lproj/pass.strings
d13c82c875a14a153805c96f50d7960dfe3246ca  en.lproj/pass.strings
```

Yes, that's exactly it: the manifest contains SHA1 hashes for each file in the archive. A brilliant feature: it allows you to verify the integrity of the archive and its contents. I wonder how the application will react if it notices any inconsistency between the manifest and the file in the archive.

### signature

I have a hunch that this might be a certificate that signs the pass file and proves its authenticity.

```bash
~/pkpass $ file signature
signature: DER Encoded PKCS#7 Signed Data
```

Yep, I was correct. With this information, we can see who issues this certificate and who signed it:

```bash
~/pkpass $ openssl pkcs7 -in signature -inform DER -print_certs -text -noout
Certificate:
    Data:
    [...]
        Issuer: CN=Apple Worldwide Developer Relations Certification Authority, OU=G4, O=Apple Inc., C=US
        Validity
            Not Before: Aug 25 05:58:58 2025 GMT
            Not After : Sep 24 05:58:57 2026 GMT
        Subject: UID=pass.com.amadeus.ssci.Cert1, CN=Pass Type ID: pass.com.amadeus.ssci.Cert1, OU=L7R69DBD7T, O=Amadeus, C=US
        [...]
                  User Notice:
                    Explicit Text: Reliance on this certificate by any party assumes acceptance of the then applicable standard terms and conditions of use, certificate policy and certification practice statements.
        [...]
```

A lot of certificate data; most of it is not really interesting, except for a few fields.

This certificate was issued by Apple for someone with a Developer account:

```text
Issuer: CN=Apple Worldwide Developer Relations Certification Authority, OU=G4, O=Apple Inc., C=US
```

It's valid for 13 months, which is slightly odd:

```text
Validity
  Not Before: Aug 25 05:58:58 2025 GMT
  Not After : Sep 24 05:58:57 2026 GMT
```

It has a User Notice I've never seen before anywhere:

```text
User Notice:
Explicit Text: Reliance on this certificate by any party assumes acceptance of the then applicable standard terms and conditions of use, certificate policy and certification practice statements.
```

And the entity that requested this certificate (I assume an entity behind LOT Polish Airlines applications):

```text
Subject: UID=pass.com.amadeus.ssci.Cert1, CN=Pass Type ID: pass.com.amadeus.ssci.Cert1, OU=L7R69DBD7T, O=Amadeus, C=US
```

Overall, a rather common certificate.

### pass.json

And the most interesting part -- the pass data itself.

```bash
~/pkpass $ cat pass.json | jq
{
  [...],
  "boardingPass": {
    "backFields": [
      {"label": "Ticket number", "value": "[...]", "key": "ticket"},
      {"label": "Booking reference", "value": "[...]", "key": "recloc"},
      {"label": "Frequent flyer", "value": "[...]", "key": "fqtv"},
      {"label": "Sequence number", "value": "73", "key": "seq"}
    ],
    "transitType": "PKTransitTypeAir",
    "secondaryFields": [
      {"label": "Passenger", "value": "Kirill Solovei", "key": "passenger"},
      {"label": "Class", "value": "I", "key": "bookingClass"},
      {"label": "Status", "value": "", "key": "status"}
    ],
    "headerFields": [
      {"label": "Seat", "value": "1A", "key": "seat"},
      {"label": "zone", "value": "1", "key": "zone"}
    ],
    "primaryFields": [...],
    "auxiliaryFields": [...]
  },
  [...],
  "passTypeIdentifier": "pass.com.amadeus.ssci.Cert1",
  "teamIdentifier": "L7R69DBD7T",
  "barcode": {...},
  "expirationDate": "2026-03-24T05:40+04:00"
}
```

All right, there's the ticket number[^1]! So my theory was correct after all. Apart from the ticket number and my name, there's also some different information:

- Seat
- Frequent flyer program number (if any)
- Departure airport code
- Arrival airport code
- Flight number
- and others

### pass.string

This leaves only the last 3 files: `{en,fr,it}.lproj/pass.strings`. Let's see what's inside:

```bash
~/pkpass $ cat en.lproj/pass.strings
"LOT Boarding Pass" = "LOT Boarding Pass";
"Boarding" = "Boarding";
"Boarding time changed to %@." = "Boarding time changed to %@.";
"Passenger" = "Passenger";
[...]
```

That's not very informative. What about the second one?

```bash
~/pkpass $ cat fr.lproj/pass.strings
"LOT Boarding Pass" = "Carte d'embarquement LOT";
"Boarding closing" = "Embarquement";
"Boarding time changed to %@." = "Heure d'embarquement change  %@.";
"Passenger" = "Nom";
[...]
```

Oh, so this is not metadata, as I initially thought, but translations! That's actually pretty thoughtful! I wonder why only 3 languages, though. And why Polish is not one of them, considering that LOT is a Polish airline? Oh well.

## Summary

To be honest, I like the passes and *Wallet* convenience even more now after figuring out that it's basically a zip archive with information on the topic (flight details in this case) and some pictures slapped on top of it.

So, what's actually inside a `pkpass` boarding pass?

- Ticket details
	- Name of the passenger
	- Departure date and airport
	- Arrival airport
	- Seats
- Pass translations (in 3 languages)
- Verification certificate
- Company logos
- Hashes of all the archive contents

I'm impressed by the fact that Apple didn't invent yet another proprietary format to utilize in their ecosystem and enforce everyone's inconvenience, but adapted an existing technology with quality-of-life additions: validation and security.

I assume it was such convenience and simplicity that allowed the widespread usage of the application. Another benefit of the format being open and familiar is the creation of tools around the feature. For example, it's possible to pass-ify everything you want using [WalletWallet](https://walletwallet.alen.ro/), and view and debug the `pkpass` files with the help of [PKPass Debug Viewer](https://pkpass.waigel.com/). Way to go!

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20What%27s%20inside%20the%20pkpass%20file">Reply to this post ✉️</a></p>

[^1]: Redacted for, you know, privacy reasons.
