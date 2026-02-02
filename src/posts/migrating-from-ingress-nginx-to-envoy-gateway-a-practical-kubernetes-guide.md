---
title: "Migrating from ingress-nginx to Envoy Gateway: A Practical Kubernetes Guide"
date: 2026-02-02
tags:
  - kubernetes
layout: layouts/post.njk
permalink: /ingress-nginx-to-envoy-gateway/
---
Happy 2026, dear visitor! I know, it's already been a whole month of 2026, but only now have I found some time to write a new article. Today we're going to discuss migration from ingress-nginx to Kubernetes Gateway, particularly Envoy.

<!-- more -->

![Title image](/assets/ingress-nginx-to-envoy-gateway.webp)

## Why migrate

Before diving into technical details, let's address the main question -- why migrate at all, why can't we continue using Nginx Ingress? Last November, the Kubernetes blog [announced](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/) the oh-so-unfortunate retirement of Nginx Ingress. The article covers the reasons behind this decision, so I will omit them and instead concentrate on the key points:

- Best-effort maintenance will continue until March 2026.
- Afterward, there will be no further releases, no bug fixes, and no updates to resolve any security vulnerabilities that may be discovered.
- Existing deployments of Ingress NGINX will not be broken.
- Existing project artifacts such as Helm charts and container images will remain available.

So basically, we systems engineers are encouraged to migrate to modern alternatives of the Ingress, like [Gateway API](https://gateway-api.sigs.k8s.io/guides/getting-started/).

Being a lazy dude, I must address that, of course, there's always an option to just continue using Nginx Ingress anyway. But that increases the attack surface on your applications, so keep that in mind.

## What's an Ingress

If you're familiar with Kubernetes in general, you must've heard once or twice about Ingresses. Ingress, as a Kubernetes cluster component, is a proxy that routes external requests from the public internet to internal cluster resources. Using predefined resource configurations, Ingress can route requests to different backends using request paths and even configure TLS for the connections. Here's what an Ingress resource configuration looks like:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tls-example-ingress
spec:
  tls:
  - hosts:
      - https-example.foo.com
    secretName: testsecret-tls
  rules:
  - host: https-example.foo.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: service1
            port:
              number: 80

```

## What's a Gateway

Why would we need a different API for the same function if we already had Ingress? Well, let me tell you about Gateway API and the differences between it and Ingress API (apart from the fact that Ingress API is frozen in development).

Gateway API is role-oriented. What does this mean exactly? It means that different people (or teams) are responsible for different parts of the setup. Whereas in the Ingress case everything was shoved into one resource, Gateway API allows different teams to handle their parts: developers -- add necessary HTTPRoutes to their applications, Ops team -- take care of the GatewayClasses and Gateways, and so on.

Gateway API is built with extensibility in mind, so it allows for heavy custom resource usage -- instead of the classic annotation approach (which is kinda clunky). Another nice addition is that Gateway API supports GRPCRoutes out of the box. It was such a pain in the butt to configure GRPC routes previously, as I remember.

Overall, Gateway API is a nice upgrade over Ingress API with all the previous experience in mind, and not just trading this for that.

## Options

Upon the retirement announcement, Kubernetes community not only notified the user base about the change, but also provided a list of [existing implementations](https://gateway-api.sigs.k8s.io/implementations/#gateway-controller-implementation-status) by different companies. The list is quite broad, so luckily for us engineers we can stick with whatever we see as most fit, convenient, feature-rich, or just simple.

For my setup, I ended up choosing Envoy Gateway.

## Migration

To migrate from Nginx Ingress to Envoy Gateway, we need to compare existing resources managed by Nginx Ingress and the Ingress Controller with their respective implementations in Envoy Gateway.

For Nginx Ingress, we have:

1. Ingress Controller
2. Ingress

However, in Envoy Gateway, we will have:

1. Gateway Controller
2. Gateway
3. HTTPRoute[^1]

As mentioned earlier, Gateway API implements role-based separation, separating a single Ingress resource into multiple -- Gateway and HTTPRoute.

Ingress Controller and Gateway Controller are just Deployments that handle the corresponding API requests, and their installation doesn't differ much:

```shell
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

```shell
helm install eg oci://docker.io/envoyproxy/gateway-helm \
  --version v1.6.3 \
  -n envoy-gateway-system --create-namespace
```

Now things become slightly more complicated. Ingress serves both as a Load Balancer and Router for the requests, while in Gateway API implementation these functions are handled by different resources: Gateway and HTTPRoute.

Let's assume we have an Ingress with the following configuration:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/backend-protocol: HTTPS
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-buffer-size: 8k
    nginx.ingress.kubernetes.io/proxy-buffers-number: "4"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  labels:
    app: my-app
  name: my-ingress
spec:
  defaultBackend:
    service:
      name: my-service
      port:
        name: https
  ingressClassName: nginx
  rules:
  - host: example.com
    http:
      paths:
      - backend:
          service:
            name: my-service
            port:
              number: 8443
        path: /
        pathType: Prefix
  tls:
  - hosts:
    - example.com
    secretName: example-com-tls-cert
```

In this manifest we have:

- Annotations specifying different Nginx proxy configurations
- Default backend configuration
- IngressClass reference (`nginx`, as created by ingress-nginx-controller)
- Rules for where to route the incoming requests
- TLS configuration, specifying the secret name of the TLS key and certificate secret

### IngressClass to GatewayClass

The first thing that allows us to reference a particular class of resources, in this case Ingresses and Gateways, is IngressClass.
Here's the manifest for the existing `nginx` IngressClass:

```yaml
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: nginx
spec:
  controller: k8s.io/ingress-nginx
```

And this is its older brother, GatewayClass:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: eg
spec:
  controllerName: gateway.envoyproxy.io/gatewayclass-controller
  parametersRef:
    group: gateway.envoyproxy.io
    kind: EnvoyProxy
    name: envoy-proxy-public
    namespace: envoy-gateway-system
```

Instead of just specifying the name of the class and letting the controller do its own thing, here we specify the particular resource and its configuration, namely EnvoyProxy. This is how `envoy-proxy-public` is configured:

```yaml
apiVersion: v1
items:
- apiVersion: gateway.envoyproxy.io/v1alpha1
  kind: EnvoyProxy
  metadata:
    name: envoy-proxy-public
    namespace: envoy-gateway-system
  spec:
    logging:
      level:
        default: warn
    provider:
      kubernetes:
        envoyService:
          annotations:
            service.beta.kubernetes.io/aws-load-balancer-scheme: internet-facing
            service.beta.kubernetes.io/aws-load-balancer-type: nlb
          externalTrafficPolicy: Local
          type: LoadBalancer
      type: Kubernetes
kind: List
```

This looks fancy, isn't it? Here we have the ability to specify the logging level, the provider that's handling the proxy requests, annotations to fine-tune the proxy as a Load Balancer, and [lots of other things](https://gateway.envoyproxy.io/latest/api/extension_types/#envoyproxyspec). Already at this level, we can see the increase in available settings and the role-oriented dissection of a single component.

### Ingress to Gateway

The Ingress itself has a direct replacement: the Gateway resource. The transition is pretty straightforward and simple, as part of the configuration settings has moved to other resources.

Take a look at this Gateway manifest:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: eg
  namespace: envoy-gateway-system
spec:
  gatewayClassName: eg
  listeners:
  - allowedRoutes:
      namespaces:
        from: All
    hostname: '*.example.com'
    name: http
    port: 80
    protocol: HTTP
  - allowedRoutes:
      namespaces:
        from: All
    hostname: '*.example.com'
    name: https
    port: 443
    protocol: HTTPS
    tls:
      certificateRefs:
      - group: ""
        kind: Secret
        name: example-com-tls-cert
      mode: Terminate
```

Instead of routes, we have listeners: a list of endpoints assigned to a domain name that listen for requests on specified ports. In this example, there are 2 listeners: one for plain HTTP, and the other for HTTPS with a dedicated TLS configuration, which, just like in Ingress, references the TLS certificate for the serviced domain.

My most favorite part of the Gateway is that now one Gateway can allow routes from all namespaces to attach to a single listener in a centralized Gateway. It's incredibly convenient that we no longer have to configure a separate Ingress and Certificate for each individual namespace.

### Ingress routes to HTTPRoute

The last part of the resources to transition to are HTTPRoutes: the resources responsible for the same things as previously, only parts of the Ingress spec.

Here's how the transitioned manifest for our previously defined routes will look:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: my-route-route
spec:
  hostnames:
  - example.com
  parentRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: eg
    namespace: envoy-gateway-system
    sectionName: https
  rules:
  - backendRefs:
    - group: ""
      kind: Service
      name: my-service
      port: 8443
      weight: 1
    matches:
    - path:
        type: PathPrefix
        value: /
    timeouts:
      backendRequest: 600s
      request: 600s
```

If you look closely, the configuration is not that different from the `rules` part of the Ingress spec. A few new things to point out here:

- A new block `parentRefs`, which references the listener of the Gateway this route will be attached to. After creation, this route can be seen in the `kubectl describe gateway eg` output with its status.
- Request timeouts are now defined per rule and as parameters, not as annotations for the whole Ingress.
- Each rule can have multiple `backendRefs` with different weights, allowing very interesting weight-based routing (for staging environments, for example).

## Afterword

As always, seeing that some software that I'm currently using (and using quite a lot) is being deprecated, I was upset. I don't like rewriting existing infrastructure if it's working properly and without issues. But after the first frustration passed, I grew to appreciate the necessary transition and was more than pleased by several changes in the new Gateway API.

First and foremost, I'm very glad that TLS certificates are now attached to the Gateway and I can have only one (and not the same number as the amount of Ingresses in different namespaces).
Second, it's so nice to see the status of attached routes to the Gateway and check if they're active or if somehow the configuration was messed up.
And I didn't come up with a third point, so that's that!

The only annoyance is that, being a rather new ability, AWS hasn't yet implemented its display in the EKS console (in Networking, as it should be, and not in CRDs), but I'm sure it's only a matter of time.

Thank you for reading and see you soon!

[^1]: Gateway also handles GRPCRoute and TLSRoute resources, but for simplicity of the example, I will mention only HTTPRoute.

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20Migrating%20from%20ingress-nginx%20to%20Envoy%20Gateway%3A%20A%20Practical%20Kubernetes%20Guide">Reply to this post ✉️</a></p>
