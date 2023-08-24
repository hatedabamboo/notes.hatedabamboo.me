---
layout:     post
title:      "Using AWS Parameter Store instead of Gitlab CICD Variables"
date:       2023-08-24
author:     Kirill Solovei
permalink:  /cicd-variables-from-aws
tags:       aws gitlab cicd
---
Gitlab CICD Variables is a tool that helps to store some variables and secret
values for later usage inside the pipelines. It may be handy and convenient,
but there are also downsides:

1. similar variables from different projects have to be maintaned separately
2. users have access to them
3. some variables can't be masked in the logs

So in order to get the best of AWS Parameter Store (or Secrets Manager) I
decided to move all the variables away from Gitlab CI Variables. To achieve
this goal we will need the help of `id_tokens` option.

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

This policy is very allowing, which is a security concern. In order to make it
more strict, we can specify by name all the secrets we want allow access to
and, perhaps, add some condition to it (e.g. existance of specific tag).

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

This policy will allow to fetch only secrets, which have tag "repository"
set to "frontend".

### 3. Write stage in gitlab CI

Now to the pipelines themself. This is an example stage showing how all of the
above can be used inside actual `.gitlab-ci.yml` file.

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

What happens here? We use `id_tokens` parameter to fetch `AWS_TOKEN` using
previously created audience in AWS IAM.

First, we install `awscli` tool to be able to query AWS Parameter Store. Then
we try to assume role (which has been created in step #1) using `AWS_TOKEN`
and write response data to identity file for later. We dissect necessary
parameters from identity file (access key, secret access key and session token)
with the help of `jq` and use them as environment variables. Having all the
necessary prerequisites, we finally query Parameter Store for `s3-bucket`
secret. Voila!

This script can even be wrapped in the bash function to query multiple
parameters during one pipeline:

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
