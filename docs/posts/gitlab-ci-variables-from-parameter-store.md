---
authors:
  - hatedabamboo
date:
  created: 2023-08-24
slug: /cicd-variables-from-aws
tags:
  - aws
  - gitlab
  - cicd
  - secrets
---
# Using AWS Parameter Store instead of Gitlab CICD Variables

This note is dedicated to showing how one can store CI/CD variables and secret
values inside AWS Parameter Store (or Secrets Manager) and use them within
Gitlab CI.

<!-- more -->

![Gitlab + AWS](../assets/2023-08-24-gitlab-ci-variables-from-parameter-store.webp)

Gitlab CI/CD Variables is a tool that helps store various variables and secret
values for later use within pipelines. It can be handy and convenient, but
there are also downsides:

1. similar variables from different projects need to be maintained separately
2. users have access to them
3. some variables can't be masked in the logs

To make the most of AWS Parameter Store (or Secrets Manager), I have decided to
relocate all the variables from Gitlab CI Variables. To achieve this goal, we
will leverage the `id_tokens` option.

## Using id_tokens to access AWS secrets

### 1. Create identity provider in IAM

First things first, we will have to create identity provider in the AWS IAM.

- Provider type: `OpenID Connect`
- Provider URL: `https://gitlab.com`
- Audience: some name for the provider audience (may be anything)

### 2. Create role for gitlab

In order to fetch secrets from AWS we will have to create a role for gitlab
pipeline executor to assume.

Trust policy looks like this:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "arn:aws:iam::{account-id}:oidc-provider/{provider-name}"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "gitlab.com:aud": "{audience-name}"
                }
            }
        }
    ]
}
```

While the attach policy to the role may look like this:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "ParameterStore",
            "Effect": "Allow",
            "Action": [
                "ssm:DescribeParameters",
                "ssm:GetParameter"
            ],
            "Resource": "*"
        }
    ]
}
```

This policy is overly permissive, which poses a security concern. To enhance
its strictness, we can specify the secrets to which we want to allow access by
name. Additionally, we may consider adding conditions to the policy, such as
requiring the existence of a specific tag.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "ParameterStore",
            "Effect": "Allow",
            "Action": [
                "ssm:DescribeParameters",
                "ssm:GetParameter"
            ],
            "Resource": [
                "arn:aws:ssm::{account_id}:parameter/{secret1}",
                "arn:aws:ssm::{account_id}:parameter/{secret2}"
            ],
            "Condition": {
                "StringEquals": {
                    "aws:ResourceTag/repository": "frontend"
                }
            }
        }
    ]
}
```

This policy will only permit fetching secrets with the "repository" set to
"frontend".

### 3. Write stage in gitlab CI

Now to the pipelines themself. Here's an example stage that demonstrates how
all of the above can be implemented within an actual `.gitlab-ci.yml` file.

```yaml
test:
  stage: test
  image: debian:bookworm-slim
  variables:
    ROLE_ARN: "arn:aws:iam::{account_id}:role/{role_name}"
  id_tokens:
    AWS_TOKEN:
      aud: "{audience_name}"
  script:
    - apt update && apt install -y awscli jq
    - aws sts assume-role-with-web-identity
      --duration-seconds 3600
      --role-arn "${ROLE_ARN}"
      --role-session-name "{some_name}"
      --web-identity-token "${AWS_TOKEN}"
      > ~/.identityfile
    - export AWS_ACCESS_KEY_ID="$(cat ~/.identityfile | jq '.Credentials.AccessKeyId' --raw-output)"
    - export AWS_SECRET_ACCESS_KEY="$(cat ~/.identityfile | jq '.Credentials.SecretAccessKey' --raw-output)"
    - export AWS_SESSION_TOKEN="$(cat ~/.identityfile | jq '.Credentials.SessionToken' --raw-output)"
    - export AWS_SECURITY_TOKEN="$AWS_SESSION_TOKEN"
    - export AWS_DEFAULT_REGION="us-east-1"
    - aws ssm get-parameter --name "s3-bucket"
```

What's happening here? We are using the `id_tokens` parameter to retrieve the
`AWS_TOKEN` using the previously established audience in AWS IAM.

To begin, we install the `awscli` tool to enable querying the AWS Parameter
Store. Next, we attempt to assume the role (created in step #1) using the
`AWS_TOKEN` and save the response data to an identity file for later use.
Subsequently, we extract the necessary parameters from the identity file
(access key, secret access key, and session token) using the `jq` tool. These
parameters are then utilized as environment variables.

With all the essential prerequisites in place, we proceed to query the
Parameter Store for the `s3-bucket` secret. Voilà!

This script can even be encapsulated within a Bash function to enable querying
multiple parameters within a single pipeline:

```yaml
test:
  stage: test
  image: debian:bookworm-slim
  variables:
    ROLE_ARN: "arn:aws:iam::{account_id}:role/{role_name}"
  id_tokens:
    AWS_TOKEN:
      aud: "{audience_name}"
  script:
    - apt update && apt install -y awscli jq
    - >
      function get_secret() {
        aws sts assume-role-with-web-identity \
          --role-arn "${ROLE_ARN}" \
          --role-session-name "{some_name}" \
          --web-identity-token "${AWS_TOKEN}" \
        > ~/.identityfile
        export AWS_ACCESS_KEY_ID="$(cat ~/.identityfile | jq '.Credentials.AccessKeyId' --raw-output)"
        export AWS_SECRET_ACCESS_KEY="$(cat ~/.identityfile | jq '.Credentials.SecretAccessKey' --raw-output)"
        export AWS_SESSION_TOKEN="$(cat ~/.identityfile | jq '.Credentials.SessionToken' --raw-output)"
        export AWS_SECURITY_TOKEN="$AWS_SESSION_TOKEN"
        export AWS_DEFAULT_REGION="us-east-1"
        aws ssm get-parameter --with-decryption --name "$1" | jq -r '.Parameter.Value'
      }
```

Don't forget to decrypt your secrets!

And request secrets with one function call:

```yaml
script:
  - export S3_BUCKET=$(get_secret "s3-bucket")
```

This way we can store all the necessary secrets and variables in one place
and change them anywhere with one simple trick.

---

As always, feel free to
[disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with
me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my
mistakes and befriend me on one of the social media platforms listed below.
