---
title: "AWS Lambda MicroVMs"
date: 2026-07-14
tags:
  - aws
  - lambda
layout: layouts/post.njk
permalink: /aws-lambda-microvms/
---
Several days ago [AWS announced](https://aws.amazon.com/blogs/aws/run-isolated-sandboxes-with-full-lifecycle-control-aws-lambda-introduces-microvms/) the launch of Lambda MicroVMs -- a new way of running short-term workflows. Unlike Lambda Functions, a MicroVM spins up a whole micro virtual machine, introducing more use cases, more capabilities, enhanced security and longer execution time (finally!). In this article we will go through new features, differences from Lambda Functions, and new possibilities.

<!-- more -->

![Title image](/assets/aws-lambda-microvms.webp)

### What is MicroVM and how is it different from Lambda Function?

To fully appreciate the benefits of MicroVM (and there are many), first we have to learn the difference from the usual Lambda Function workflow.

Functions by their nature were asynchronous request-response logic elements, stripped of all the complexity of larger applications. No user-facing runtime environment, no OS, no hardware. One shot -- one invocation. Simple as that and extremely useful for a vast amount of applications.

MicroVMs take this approach one step further. Now, instead of running a single function, you can spin up a whole container.

::: info Notice

		Important notice: Lambda MicroVMs don't start and run containers by themselves like AWS Fargate does. Well, they do, but not in the same way: they spin up a virtual machine, inside of which they then spin up a containerized application.

:::

This creates a lot of new applications for short-lived workflows, which I will discuss later in the article, and adds a new layer of security. Apart from functional changes, there is also a technological one.

MicroVMs utilize [Firecracker virtualization](https://github.com/firecracker-microvm/firecracker), a VM monitor built by AWS and written in Rust. Spinning a new VM with Firecracker takes only **~125ms** on a cold start and **~28ms** on warm start (from snapshot restoration). AWS has been using Firecracker for some time (in Lambda Functions themselves, Bedrock AgentCore, Aurora DSQL).

Using MicroVMs also adds a new level of security isolation: instead of running on the host machine with added security policies, the containerized application runs inside its own guest kernel. And given Firecracker's intentionally minimalistic architecture, the attack surface is reduced drastically[^1].

Okay, Kirill, that's cool and all, yeah, security, all that stuff, but what about actual differences? How is it better than existing Lambda Functions?

Well, for starters: 8 HOURS MAXIMUM EXECUTION DURATION! How about that?

Yes, MicroVMs can now run workflows for 8 hours straight. That's 32 times more than we had previously!

Now for some of the less exciting differences.

Provisioned hardware now populates not only RAM, but also vCPUs, with the ability to automatically scale vertically up to 4 times the requested size.

Each MicroVM deploys with a dedicated network endpoint, supporting the following protocols: HTTP/1.1, HTTP/2, WebSockets, gRPC and Server-Sent Events (SSE). Previously Lambda Functions allowed communication only with HTTP/1.1, HTTP/2 and WebSockets if behind API Gateway.

MicroVMs are stateful, hence an application deployed to MicroVMs will be able to store session data. On top of that, storage and memory are persisted across suspension, so the application loads back into an active state.

Oh, and you can actually SSH into a MicroVM with the new Shell Ingress feature! That makes sense, since it's a full machine (though still micro and virtual).

### What MicroVMs can be used for

That's the most exciting topic in my opinion. After all, the service is only as good as the applications utilizing it.

To name a few:

- ETL pipelines for large datasets
- Log aggregation and parsing
- ML model training and ML batch inference on large datasets
- Compiling large codebases
- Running full test suites / overnight tests
- Generating large reports from a data warehouse
- Exporting/archiving data to S3 or external storage
- Aggregating metrics across many sources
- Backups with compression/encryption
- Data deduplication or cleanup runs
- Bulk API syncs (pulling thousands of records from a third-party API)
- CRM/ERP data reconciliation
- File ingestion pipelines (SFTP pickup, parse, store)
- Security scanning pipelines
- Short-lived ephemeral dev environments (hello Vercel)

And the list can go on and on and on.

The possibilities are vast, and the technology is there to help you.

### Pricing changes

With great power comes ~~great responsibility~~ cost model change.

Lambda Functions are priced based on GB-seconds (RAM × duration) and the number of requests per month.

Lambda MicroVMs are priced based on CPU and RAM usage per second, plus snapshot storage (GB-month) and snapshot data transfer (read and write). This pricing model resembles Fargate's rather than Lambda Functions'. Think twice before uploading full-sized node images, and use [available methods](https://notes.hatedabamboo.me/minimizing-containerized-applications/) to minimize your containerized applications. Proper sizing of the MicroVM makes much more sense than provisioning for peak load. Automatic vertical scaling will help with increased requests and will be billed only for active usage, rather than the baseline.

Unfortunately, being a new functionality means there's no Free Tier availability (yet, I hope), so it's not possible to spin up a working serverless application the same way as with Lambda Functions.

But regardless, the new feature is quite impressive and powerful, and I'm glad we'll get to play with it more.

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20AWS%20Lambda%20MicroVMs">Reply to this post ✉️</a></p>

[^1]: I highly recommend [this article](https://emirb.github.io/blog/microvm-2026/) by Emir Beganović talking in great depth about containerization and VMMs (virtual machine monitors).
