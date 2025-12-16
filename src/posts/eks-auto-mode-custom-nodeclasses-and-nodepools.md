---
title: "EKS Auto Mode custom NodeClasses and NodePools"
date: 2025-08-16
tags:
- aws
- eks
- kubernetes
layout: layouts/post.njk
permalink: /eks-custom-nodeclasses-and-nodepools/
featured: true
---
Hello, dear reader! It's been a while since our last one-way communication. Mostly because the last couple of months have been taxing on me. Searching for a new job is not an easy task these days. Also, there's been a new [Warhammer box](https://www.warhammer-community.com/en-gb/articles/ujwwshq1/saturday-pre-orders-saturnine/), which I just couldn't resist.

But I'm slowly getting back up to speed, and today we're gonna explore the abilities to manage the managed service -- in particular, how we can configure custom parameters to spin up instances and storage on AWS EKS to our liking.

<!-- more -->

## EKS Auto Mode

EKS (Elastic Kubernetes Service) is an AWS-managed Kubernetes service that takes over control plane operations and cluster maintenance from users, leaving only application management[^1]. This comes at a cost of $0.10 per cluster per hour ($0.60 for extended support), alongside the regular price of the used instances.

There's another level to this management -- EKS Auto Mode. It takes cluster management one step further and offloads compute, storage, and load balancing from the user. Let's dive into it.

## NodeClass and NodePool

EKS Auto Mode is basically [Karpenter](https://karpenter.sh/) integrated into the EKS control plane. Given that Karpenter is written by AWS, I'm surprised it's not included by default, as it's a very helpful tool. Karpenter allows cluster administrators to specify infrastructure definitions based on which it will spin up new instances, should the need arise -- and spin them down as well, which is quite important for the budget.

These resources are called NodeClasses and NodePools. There are also NodeClaims, but they are not resources themselves -- rather, they are resource allocation agreements (akin to PersistentVolumeClaims).

### NodeClass

A NodeClass describes certain characteristics of the instances we would like to use, such as:

- IAM Role to be used by the EC2 instances
- Network allocation settings (subnets, security groups, network policies)
- Storage allocation settings (size, throughput, encryption)

You can check the [full resource definition](https://docs.aws.amazon.com/eks/latest/userguide/create-node-class.html#auto-node-class-spec) in the AWS EKS documentation.

It's worth noting that EKS Auto Mode uses different resource definitions than Karpenter, and the syntax varies quite a lot. Karpenter's EC2NodeClass allows for more granular configuration of the necessary instances, including kubelet settings. The difference between the two, I think, comes from AWS taking this part of the management upon itself.

### NodePool

NodePool, on the other hand, stays exactly the same between EKS and Karpenter -- which allows us administrators to look for necessary parameters in the more extensive [Karpenter documentation](https://karpenter.sh/docs/concepts/nodepools/). This resource is responsible for instance type configuration: which instances would we like to use? On which architecture? How much CPU should they have? Do they need a GPU? And just how many instances should we spin up within the scope of this NodePool?

## Creating Custom NodeClasses and NodePools

To create our own NodePool, we first need to create our own NodeClass. We can use the NodeClass that already exists in the EKS cluster (it's called `default`, and this name can't be used again), or we can create our own. For example, we might want to spin up new instances only inside private subnets or encrypt volumes using our own specified KMS key.

Here's what the NodeClass definition looks like:

```yaml
---
apiVersion: eks.amazonaws.com/v1
kind: NodeClass
metadata:
  name: mycoolnodeclass
spec:
  role: custom-role-for-ec2-instances

  subnetSelectorTerms:
    - tags:
        Name: "*private*"
        kubernetes.io/role/internal-elb: "1"

  securityGroupSelectorTerms:
    - tags:
        Name: "eks-cluster-sg-*"

  networkPolicy: DefaultAllow
  networkPolicyEventLogs: Disabled

  ephemeralStorage:
    iops: 6000
    size: "100Gi"
    kmsKeyID: "arn:aws:kms:us-west-2:123456789012:alias/custom-eks-cluster-kms-key"
    throughput: 250
```

In this NodeClass, we specify that we want to spin up new instances inside the private subnets (automation will map subnet names that have `private` in their names -- the asterisk allows for wildcard definitions), assign security groups that start with the `eks-cluster-sg*` string, and attach to each instance a fast and performant storage volume encrypted with our custom key.

Now, this part is important.

Since we're using a custom KMS key to encrypt the volumes of the instances, we must add the required permissions to the key. Specifically, nodes should be able to encrypt and decrypt the volumes (duh!), and the cluster should be able to grant nodes access to the key. So the key policy should look something like this:

```json
{
  "Version": "2012-10-17",
  "Id": "root-access",
  "Statement": [
    {
      "Sid": "Root access",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:root"
      },
      "Action": "kms:*",
      "Resource": "*"
    },
    {
      "Sid": "Allow EKS Nodes to use KMS key",
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::123456789012:role/aws-service-role/autoscaling.amazonaws.com/AWSServiceRoleForAutoScaling",
          "arn:aws:iam::123456789012:role/aws-service-role/eks.amazonaws.com/AWSServiceRoleForAmazonEKS",
          "arn:aws:iam::123456789012:role/custom-role-for-ec2-instances"
        ]
      },
      "Action": [
        "kms:Decrypt",
        "kms:DescribeKey",
        "kms:Encrypt",
        "kms:GenerateDataKey*",
        "kms:ReEncrypt*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Allow EKS Auto Mode to grant access to KMS key",
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::123456789012:role/eks-cluster-role"
        ]
      },
      "Action": "kms:CreateGrant",
      "Resource": "*",
      "Condition": {
        "Bool": {
          "kms:GrantIsForAWSResource": "true"
        }
      }
    }
  ]
}
```

Unfortunately for me, I didn't think of that before debugging why my deployment wasn't deploying, so here's a free tip for you. I hope it will help you spend less time than I did.

And finally, we come to NodePools.

The custom NodePool definition might look like this:

```yaml
---
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: compute
spec:
  template:
    spec:
      nodeClassRef:
        group: eks.amazonaws.com
        kind: NodeClass
        name: mycoolnodeclass

      taints:
        - key: "compute"
          value: "true"
          effect: "NoSchedule"

      requirements:
        - key: "eks.amazonaws.com/instance-category"
          operator: In
          values: ["m", "c"]
        - key: "eks.amazonaws.com/instance-generation"
          operator: Gt
          values: ["4"]
        - key: "eks.amazonaws.com/instance-cpu"
          operator: In
          values: ["2", "4", "8"]
        - key: "topology.kubernetes.io/zone"
          operator: In
          values: ["us-east-1a", "us-east-1b", "us-east-1c"]
        - key: "kubernetes.io/arch"
          operator: In
          values: ["amd64"]
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot"]

  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: 30s
    budgets:
      - nodes: "10%"

  limits:
    cpu: 1000
    memory: 1000Gi
```

In the example above, we specify that we want spot instances of the `m` or `c` classes on the `amd64` architecture, that they should be at least generation 5 (`Gt` stands for `greater than`), and located in the `us-east-1` region. We also specify that the total number of instances for this NodePool should not exceed 1000 CPUs or 1000 GiB of memory.

When selecting certain instance types and generations within a specific region, be sure to check that these instances are actually available in that region:

```bash
aws ec2 describe-instance-type-offerings \
  --location-type availability-zone \
  --query 'InstanceTypeOfferings[*].[InstanceType,Location]'
```

Some instances, classes, or generations may not be available in one region but might be available in another. It's always worth checking beforehand, so you won't spend too much time wondering why your `c10i.x124large` isn't coming up in the `ap-southeast-5` region.

I hope this article helps you spin up your custom nodes quickly and saves you both time and mental capacity. I really appreciate that AWS provides such a neat way to control your Kubernetes infrastructure without having to manage it all manually -- almost a win-win scenario.

[^1]: To be honest, it's not just application management. EKS brings its own overhead in the form of managing intertwined AWS services (like IAM), but that's outside the scope of the current article.

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20EKS%20Auto%20Mode%20custom%20NodeClasses%20and%20NodePools">Reply to this post ✉️</a></p>
