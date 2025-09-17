---
title: "A Beginner's Guide to AWS S3 Block Public Access"
date: 2025-01-14
tags:
- aws
- s3
layout: layouts/post.njk
permalink: /s3-block-public-access/
---
S3 is an incredibly useful service for storing and sharing a vast variety of files. Due to its ability to store files in a bucket accessible to a broad audience, it is even possible to host a static website. The first "S" in the acronym S3 stands for "Simple." But is it actually so simple when it comes to public access? In this article, I will try to comprehensively figure out the thing that baffles me each time I come across it: the "Block public access" configuration.

<!-- more -->

![image](/assets/s3-block-public-access.webp)

## Why bother

::: quote

    But hey, why bother with an entire article on the topic when there's already comprehensive documentation available?

:::

Yes, the [documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html) does exist. But for me, it has always been tricky to wrap my mind around its sterile terms. I’ve always found it much simpler when someone describes a concept in plain terms with simple examples (I’m pretty basic, I know).

I also believe that new, complicated knowledge is best memorized and understood when you not only consume and apply it once but also process, organize it in a structured manner, write it down, or even explain it to someone. Kind of reminds you of school, doesn’t it?

## A little bit of theory

Security almost always comes with a cost. In most cases, this cost is added complexity. S3 is no exception to this rule. Since it is a very useful, helpful, and widespread service, it must be properly secured against various types of malicious activities.

The layers of security for a bucket include bucket policy, object ownership, access control lists (ACLs), Block Public Access, and Cross-Origin Resource Sharing (CORS) for the web.

The [bucket policy](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-policies.html) is the most commonly used method for access control, as it is the same familiar IAM resource policy known to any AWS user. It is clear, concise, straightforward, and very flexible.

[Object ownership](https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html), as the name suggests, allows granular configuration of permissions for the objects stored in a bucket. By default, the person who owns the bucket owns all the objects within it. However, this may not be the case in scenarios where one team (let’s call it operations) creates the infrastructure (bucket), and another team (developers) uploads files there, especially if these files are sensitive. By utilizing object ownership, developers can manage the files as they see fit using ACLs, granting read-only or write permissions to specific grantees on a particular object or even the entire bucket.

[CORS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html) is quite often a headache for IT professionals, as you never know when it will cause unexpected issues (a heartfelt nod of understanding to everyone struggling to configure CORS on Nginx in any way other than `'Access-Control-Allow-Origin' '*'`). S3 is no exception. Properly configuring CORS allows access to objects stored in a bucket (such as JavaScript files) from a domain that is not an S3 API endpoint.

And then there is the "Block Public Access" setting, which has always caused me more confusion than a sense of security. It looks simple -- just four checkboxes -- but every time I encounter them, I struggle to select the proper combination to serve my files publicly or restrict them to a specific audience.

## Figuring out public access

The four (actually five) options and their descriptions are as follows:

1. **Block public access to buckets and objects granted through _new_ access control lists (ACLs)**  

    S3 will block public access permissions applied to newly added buckets or objects and prevent the creation of new public access ACLs for existing buckets and objects. This setting doesn’t change any existing permissions that allow public access to S3 resources using ACLs.

2. **Block public access to buckets and objects granted through _any_ access control lists (ACLs)**  

    S3 will ignore all ACLs that grant public access to buckets and objects.

3. **Block public access to buckets and objects granted through _new_ public bucket or access point policies**  

    S3 will block new bucket and access point policies that grant public access to buckets and objects. This setting doesn’t change any existing policies that allow public access to S3 resources.

4. **Block public and cross-account access to buckets and objects through _any_ public bucket or access point policies**  

    S3 will ignore public and cross-account access for buckets or access points with policies that grant public access to buckets and objects.

The fifth option is simply "Block all public access," so there's really no need to discuss it in depth.

## The confusion

The first point of confusion arises when you open the documentation about this feature. The "Blocking public access" page mentions four options:
`BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`, and `RestrictPublicBuckets`. However, the options in the actual console bear little resemblance to these names, leaving us to spend time figuring out which console option corresponds to which documentation setting. Here’s how they map to each other:

| Web console                                                                                                       | Documentation           |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Block public access to buckets and objects granted through _new_ access control lists (ACLs)                      | `BlockPublicAcls`       |
| Block public access to buckets and objects granted through _any_ access control lists (ACLs)                      | `IgnorePublicAcls`      |
| Block public access to buckets and objects granted through _new_ public bucket or access point policies           | `BlockPublicPolicy`     |
| Block public and cross-account access to buckets and objects through _any_ public bucket or access point policies | `RestrictPublicBuckets` |

The second point of confusion comes from the definitions: how are `BlockPublicAcls` and `IgnorePublicAcls` different?

The first option (`BlockPublicAcls`) means that if you (or someone) try to add a new ACL or modify an existing ACL to make files in a bucket publicly available, this action will fail. Enabling this setting also means that you (or someone) cannot add a new object to the bucket if the request includes a public ACL[^1][^2].

The second option (`IgnorePublicAcls`) means that if a bucket (or account) has any public ACLs, they will be ignored. Simply put, objects will no longer be publicly available. However, this option does not prevent new objects with public ACLs from being added[^1]. It’s like a write-only permission.

The third point of confusion comes with the terms _new_ and _any_. While _any_ is somewhat understandable, the term _new_ raises the question: new from when, exactly?

This confusion could be avoided by removing the word entirely and changing the phrasing. Compare these examples:

1. Block public access to buckets and objects granted through _new_ public bucket or access point policies.

2. Block public access to buckets and objects granted through bucket policy or access point policy.

See? The second version is clearer and more understandable. This revision helps clarify the real issue: whether to allow changes to the bucket (or access point) policy to make objects in a bucket publicly accessible. 

::: info Notice

    This setting (`BlockPublicPolicy`) only affects the bucket (or access point) policy, not the objects in the bucket!

:::

Finally, setting number four is another source of imprecision. In this case, the name from the documentation (`RestrictPublicBuckets`) makes much more sense. Why separate "public" and "cross-account" access? In my view, "cross-account" essentially equals "public." The description could be simplified into a single sentence: only the account owner and AWS services can access this bucket and the objects within it.

Now you might ask, what about retrieving objects? This part is somewhat simpler. If the bucket already has a bucket policy that allows public access to objects, only `RestrictPublicBuckets` can make these objects restricted to the public. If no public bucket policy exists and `BlockPublicPolicy` is enabled, you (or someone) won’t be able to add a public policy to the bucket, effectively keeping the objects private.

## Summary

Was it so hard for AWS to initially create more understandable naming and documentation? Perhaps. The issue with these permissions seems to be that they add _yet another level_ of security to your bucket. Adding an additional layer of abstraction inevitably comes with trade-offs, in this case, the complexity of understanding all the configuration options.

Let’s summarize everything in a neat table. For the sake of brevity, I’ll use the settings' names as references:

|                                                            | `BlockPublicAcls`                                                             | `IgnorePublicAcls`  | `BlockPublicPolicy`                                                                                                         | `RestrictPublicBuckets`                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Will the objects be publicly available?                    | **YES** if the ACLs were added before enabling this setting; otherwise **NO** | **NO**              | **YES** if the policy was added before enabling this setting; otherwise **NO**                                              | **NO**                                               |
| Can objects be added to the bucket?                        | **YES** if the ACLs were added before enabling this setting; otherwise **NO** | **YES**             | **YES** if the policy was added before enabling this setting; **YES** if the policy allows `s3:PutObject`; otherwise **NO** | **YES** for owner and AWS services; otherwise **NO** |
| Who can access objects in a bucket with permissive policy? | Owner, Grantees, AWS Services                                                 | Owner, AWS Services | Owner, Grantees, AWS Services                                                                                               | Owner, AWS Services                                  |

For reference, a permissive policy looks something like this:

```json
{
	"Principal": "*", 
	"Resource": "*", 
	"Action": "s3:PutObject", 
	"Effect": "Allow" 
}
```

Grantee in the table above refers to the person (or group of people) who are granted certain access to the bucket: be it READ, WRITE, or FULL_CONTROL[^3].

## TLDR

Still confused about all these settings and permissions?  

Here’s the shortest recap of everything mentioned above:

* Want everyone to be able to access files in a bucket? Disable `RestrictPublicBuckets`.
* Want to restrict non-privileged users (or accounts) from changing permissions on buckets and objects? Enable `BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`.
* Don’t want to bother with all of this? Mark "Block _all_ public access" and forget about it as a horrible dream.

::: info Closing remarks

    As always, feel free to [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my mistakes and befriend me on one of the social media platforms listed below.

:::

[^1]: For example, using `aws s3api pub-object` [method](https://docs.aws.amazon.com/cli/latest/reference/s3api/put-object.html) with `--acl` parameter.
[^2]: Setting this option account-wide will also block creation of buckets, but this is out of the scope of the current article.
[^3]: A full list of permissions is available in the [ACL overview](https://docs.aws.amazon.com/AmazonS3/latest/userguide/acl-overview.html) document.
