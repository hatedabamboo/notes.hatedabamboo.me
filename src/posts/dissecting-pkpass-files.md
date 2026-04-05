---
title: "What's inside the pkpass file?"
date: 2026-04-05
tags:
  - other
layout: layouts/post.njk
permalink: /dissecting-pkpass-files/
---
As a long-time smartphone user, I always found the idea of storing hefty amount of cards in a single convenient place mighty impressive. Instead of cluttering the whole wallet with plastic, you just add a virtual card to an app -- and it's right there when you need it. After all, the data remains the same -- changes only the format. It's specially convenient (and cool, I just like the feature so much) for storing temporary data -- cinema tickets, boarding passes, museum tickets, etc. But what's inside these magic `pkpass` files, exactly? Today we're gonna dive deep into the topic and figure out what convenience looks like under the hood.

<!-- more -->

![Title image](/assets/dissecting-pkpass-files.webp)

## A journey to find the ticket number

First, a little detour. The idea to write this article came to me when I was looking for a ticket number from my boarding pass. Who knows that? Where can I find this info? I've never seen a ticket number before, only the booking reference number and the gate I have to go. Carrier website wasn't very explicit in providing this information, as well as an email with the boarding pass. "Hey, -- I though to myself, -- but boarding pass must have this information somewhere inside it, right? I mean, it has to compare somehow my name and seat with the internal database." Good thing I'm a nerd and I like to dive deep inside things -- so I decided to dissect my `BoardingPass.pkpass` file and find the necessary information.

## Investigating the file format

First and foremost, how do you dive into something? You start with finding out what it is! And in our case -- what kind of file `pkpass` is.

```bash
[15:39:55] ~/pkpass $ file BoardingPass.pkpass
BoardingPass.pkpass: Zip archive data, made by v2.0, extract using at least v2.0, last modified, last modified Sun, Mar 22 2026 06:50:02, uncompressed size 1036, method=deflate
```

Looks like it's just a zip-archive. How convenient!

```bash
[16:03:01] ~/pkpass $ unzip BoardingPass.pkpass
Archive:  BoardingPass.pkpass
...
[16:03:20] ~/pkpass $ tree
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

It seems that the contents of the `pkpass` file (or should I say archive?) are mostly graphic for the card in the application (*Wallet* on iOS), some file called `manifest.json`, seemingly the main data itself `pass.json`, some file called `signature` and metadata (or some other data) in 3 languages: English, French and Italian. That's an interesting choice of languages.

Images are not that interesting, they contain logos for the airline, so let's focus on others.

### manifest.json

Let's have a look inside `manifest.json`:

```bash
[16:08:32] ~/pkpass $ cat manifest.json
{
"en.lproj/pass.strings":"d13c82c875a14a153805c96f50d7960dfe3246ca",
"footer.png":"d4a13d4592f2ecd65ea733ed792d6ea66b6c2ee8",
"footer@2x.png":"d4a13d4592f2ecd65ea733ed792d6ea66b6c2ee8",
"fr.lproj/pass.strings":"204afc310960560d415470d9fdef4516de09d60a",
"icon.png":"98fbf5dca786f7103dc8689e1b6850bfd6309d56",
"icon@2x.png":"766d98c4ac6cca310bba42190103f85a2d60df28",
"it.lproj/pass.strings":"19392b890c4fa8ea329582fa5b4ece91dccdc074",
"logo.png":"347ae51a1b044463175e3ac6b169526784a1bcf8",
"logo@2x.png":"347ae51a1b044463175e3ac6b169526784a1bcf8",
"pass.json":"ba2ed9e39a5e64800e53e54c9786057315d8a975"}
```

Quite interesting! It looks like this file contains file names and their hashes for the contents of the `pkpass` file. Let's check my assumption:

```bash
[16:08:33] ~/pkpass $ md5sum en.lproj/pass.strings
7ea647331543c80885ed089a642a1802  en.lproj/pass.strings
[16:08:48] ~/pkpass $ sha1sum en.lproj/pass.strings
d13c82c875a14a153805c96f50d7960dfe3246ca  en.lproj/pass.strings
```

Yes, that's exactly it: manifest contains SHA1 hashes for each file in the archive. A very smart feature: it allows to validate the authenticity of the archive and its contents. I wonder how the application will react if it notices any inconsistency within the manifest and the file in the archive.

### signature

I have a hunch that this might be a certificate that signs the pass file and validates the contents of the pass file.

```bash
[16:18:38] ~/pkpass $ file signature
signature: DER Encoded PKCS#7 Signed Data
```

Yep, I was correct. With this information we can see who issues this certificate and who signed it:

```bash
[16:19:18] ~/pkpass $ openssl pkcs7 -in signature -inform DER -print_certs -text -noout
Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number:
            16:e4:88:30:3d:51:3c:fb:95:43:01:12:12:57:6b:3e
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: CN=Apple Worldwide Developer Relations Certification Authority, OU=G4, O=Apple Inc., C=US
        Validity
            Not Before: Aug 25 05:58:58 2025 GMT
            Not After : Sep 24 05:58:57 2026 GMT
        Subject: UID=pass.com.amadeus.ssci.Cert1, CN=Pass Type ID: pass.com.amadeus.ssci.Cert1, OU=L7R69DBD7T, O=Amadeus, C=US
        Subject Public Key Info:
            Public Key Algorithm: rsaEncryption
                Public-Key: (2048 bit)
                Modulus:
                    [...]
                Exponent: 65537 (0x10001)
        X509v3 extensions:
            X509v3 Basic Constraints: critical
                CA:FALSE
            X509v3 Authority Key Identifier:
                5B:D9:FA:1D:E7:9A:1A:0B:A3:99:76:22:50:86:3E:91:C8:5B:77:A8
            Authority Information Access:
                CA Issuers - URI:http://certs.apple.com/wwdrg4.der
                OCSP - URI:http://ocsp.apple.com/ocsp03-wwdrg404
            X509v3 Certificate Policies:
                Policy: 1.2.840.113635.100.5.1
                  User Notice:
                    Explicit Text: Reliance on this certificate by any party assumes acceptance of the then applicable standard terms and conditions of use, certificate policy and certification practice statements.
                  CPS: https://www.apple.com/certificateauthority/
            X509v3 Extended Key Usage:
                TLS Web Client Authentication, 1.2.840.113635.100.4.14
            X509v3 CRL Distribution Points:
                Full Name:
                  URI:http://crl.apple.com/wwdrg4-10.crl
            X509v3 Subject Key Identifier:
                E7:BC:E1:8A:6A:49:88:B1:A0:D5:EC:75:59:FF:9E:A0:5E:7C:A1:79
            X509v3 Key Usage: critical
                Digital Signature
            1.2.840.113635.100.6.1.16:
                ..pass.com.amadeus.ssci.Cert1
            1.2.840.113635.100.6.3.2:
                ..
    Signature Algorithm: sha256WithRSAEncryption
    Signature Value:
        [...]
```

A lot of certificate data, most of it is not really interesting, except for a few fields.

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
cat pass.json
{"backgroundColor":"rgb(20, 47, 87)","serialNumber":"LO72522MAR73","organizationName":"LOT","description":"LOT Boarding Pass","foregroundColor":"rgb(255, 255, 255)","labelColor":"rgb(247, 228, 134)","boardingPass":{"backFields":[{"label":"Ticket number","value":"[...]","key":"ticket"},{"label":"Booking reference","value":"[...]","key":"recloc"},{"label":"Frequent flyer","value":"[...]","key":"fqtv"},{"label":"Sequence number","value":"73","key":"seq"}],"transitType":"PKTransitTypeAir","secondaryFields":[{"label":"Passenger","value":"Kirill Solovei","key":"passenger"},{"label":"Class","value":"I","key":"bookingClass"},{"label":"Status","value":"","key":"status"}],"headerFields":[{"label":"Seat","value":"1A","key":"seat"},{"label":"zone","value":"1","key":"zone"}],"primaryFields":[{"label":"WARSAW","value":"WAW","key":"boardPoint"},{"label":"TBILISI","value":"TBS","key":"offPoint"}],"auxiliaryFields":[{"label":"Flight","value":"LO725","key":"flightNb"},{"label":"Date","value":"22 Mar","key":"Date"},{"label":"Boarding","value":"22:30","key":"boardingTime"},{"label":"Departure","value":"23:00","key":"departureTime"}]},"groupingIdentifier":"[...]","relevantDate":"2026-03-22T23:00+01:00","formatVersion":1,"passTypeIdentifier":"pass.com.amadeus.ssci.Cert1","teamIdentifier":"L7R69DBD7T","barcode":{"format":"PKBarcodeFormatQR","messageEncoding":"iso-8859-1","message":"M1SOLOVEI\/KIRILL      [...] WAWTBSLO 0725 [...] 377>8320 W6081BLO                                        [...] LO LH [...]     Y*30600000K09         "},"expirationDate":"2026-03-24T05:40+04:00"}
```

All right, there's the ticket number[^1]! So my theory was correct after all. Apart from the ticket number and my name there's also some different information:

- Seat
- Frequent flyer program number (if any)
- Departure airport code
- Arrival airport code
- Flight number
- and others

### pass.string

This leaves only last 3 files: `{en,fr,it}.lproj/pass.strings`. Let's see what's inside:

```bash
[16:39:24] ~/pkpass $ cat en.lproj/pass.strings
"LOT Boarding Pass" = "LOT Boarding Pass";
"Boarding" = "Boarding";
"Boarding time changed to %@." = "Boarding time changed to %@.";
"Passenger" = "Passenger";
[...]
```

That's not very informative. What about the second one?

```bash
[16:39:31] ~/pkpass $ cat fr.lproj/pass.strings
"LOT Boarding Pass" = "Carte d'embarquement LOT";
"Boarding closing" = "Embarquement";
"Boarding time changed to %@." = "Heure d'embarquement change  %@.";
"Passenger" = "Nom";
[...]
```

Oh, so this is not metadata, as I initially thought, but translations! Very thoughtful! I wonder why only 3 languages, though. And why Polish is not one of them, considering that LOT is a Polish airline? Oh well.

## Summary

To be honest, I like the passes and *Wallet* convenience even more now after figuring that it's basically a zip-archive with the information on the topic (flight details in this case) and some pictures slapped on top of it.

To summarize, the contents of boarding pass `pkpass` are:

- Ticket details
	- Name of the passenger
	- Departure date and airport
	- Arrival airport
	- Seats
- Pass translations (in 3 languages)
- Verification certificate
- Company logos
- Hashes of all the archive contents

I'm impressed by the fact that Apple didn't invent yet another proprietary format to utilize in their ecosystem and enforce everyone's inconvenience, but adapted an existing technology with quality of life additions: validation and security. I assume it was such convenience and simplicity that allowed the widespread usage of the application. Another benefit of the format being open and familiar is the creation of tools to pass-ify everything you want, such as [WalletWallet](https://walletwallet.alen.ro/), and debug and view them, such as [PKPass Debug Viewer](https://pkpass.waigel.com/). Way to go!

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20Dissecting%20pkpass%20files">Reply to this post ✉️</a></p>

[^1]: Redacted for, you know, privacy reasons.
