---
title: "Zero to llama.cpp: Run Local LLMs on Windows with AMD GPUs"
date: 2026-05-14
tags:
  - llm
  - self-hosting
layout: layouts/post.njk
permalink: /llama-cpp-on-amd-windows/
---
In the time when RAM and GPU prices are through the roof and each and every service would like their "just $7 bucks bro" from you, where can you turn to to utilize modern technologies in the form of Large Language Models? That's right, your gaming PC! That is if you're a gamer, of course. If yes -- this post is just right for you.

<!-- more -->

![Title image](/assets/llama-cpp-on-amd-windows/title.webp)

::: note 

    Yes, this is the first post about LLMs in my blog. I tried to hold off as long as possible, but this time the theme is actually close to me -- self-hosting, local-first, open source and a big fat middle finger to the corporations.

:::

## Prerequisites

As stated in the headline, this post will focus on Windows and AMD setup, so it only makes sense for you to have: Windows PC and AMD GPU. It's also benefitial if you know how to open Terminal (`Win+R` > type `cmd`), paste the command and read the output.

## Painful path

Installation is a rather broad term. Today we actually will build llama.cpp! From source code nonetheless! On Windows PC!

LLaMA.cpp's documentation is the best place to start with out journey. The whole endeavour will look like this:

- Installing Microsoft Visual Studio (don't confuse with Visual Studio Code!)
- Installing AMD ROCm
- Installing Git and Cmake
- Building llama.cpp
- Et voila!

Let's go step by step.

### 0. Installing winget

What's a `winget` and why do we need one?

[Winget](https://github.com/microsoft/winget-cli), or oficially `winget-cli`, is a command-line utility that handles the same tasks as `apt`/`apt-get`, `yum`/`dnf`, `pacman` and `brew`. It is a convenient package manager for Windows.
We will need `winget` for several tasks further down the article, so it's a necessary prerequisite for successful installation of `llama.cpp`.
Navigate to [Releases](https://github.com/microsoft/winget-cli/releases) GitHub page, select whichever release you like, follow installator insctucrions and you should have `winget` installed in no time.
To verify the installation, execute the following command in PowerShell:
```shell
PS C:\Users\user> winget --version

```
### 1. Installing Microsoft Visual Studio
We need this monstrosity for the libraries for C/C++ and the ability to compile them. Go to the Visual Studio [website](https://visualstudio.microsoft.com/), hit that "Get free download" button and installer will be downloaded shortly.
Enter the installation menu. Make sure to select "Desktop development with C++".

![image](/assets/llama-cpp-on-amd-windows/one.png)

Make absolutely sure to unselect these damn "GitHub Copilot" options, since they are enabled automatically.

![image](/assets/llama-cpp-on-amd-windows/two.png)

Hit that "Install" button and wait a couple minutes for the process to conclude.
### 2. Installing AMD ROCm
In order to fully utilize our glorious processing unit we need proper software. Ever heard of Nvidia's CUDA? ROCm is the same thing, but for AMD.
To download the ROCm libraries, go to AMD [website](https://www.amd.com/en/developer/resources/rocm-hub/hip-sdk.html) for HIP SDK. Why HIP SDK? Because this SDK allows developers to utilize a subset of ROCm for Windows. The latest version (as of the moment of writing this article) of HIP SDK has supported version of ROCm 7.1.1. Download HIP SDK, follow the installation prompts and after a few minutes you should have necessary libraries and software installed.
To check the correctness of installation execute the following command in PowerShell.

Note: from this point forward, all the shell blocks are mean for Windows PowerShell.

```shell
& 'C:\Program Files\AMD\ROCm\7.1\bin\hipInfo.exe'
```
This should show  the details of your GPU (or multiple). If the output looks like a bunch of parameters and numbers -- the installation is correct.
### 3. Installing git and CMake
These ones are pretty easy. Git has its own installer and can be downloaded [here](https://git-scm.com/). Installation for CMake can be found on the official [downloads page](https://cmake.org/download/).
Why do we need them, again?
We need git to fetch the llama.cpp repository. Alternatively, it can be downloaded as a zip archive and extracted and used like that, but that prevents you from updating code base by simple pulling the repository, making you to repeat manual actions for each new release you'd like to have.
CMake will help us build the source code into executable binaries. There's no way to avoid that, unfortunately.
### 4. Building llama.cpp
And now for the most interesting part -- building from the source code!
Download the repository first:
```shell
PS C:\Users\user> git clone https://github.com/ggerganov/llama.cpp
PS C:\Users\user> cd llama.cpp
```
This should take several seconds, as the repository is rather bulky.
Now, we build. To utilize GPU for local LLM usage we must build it with necessary parameters passed to `cmake`. If we execute build without any parameters, the only available inference  will be with CPU, and this reduces token generation tenfold[^1].

To proceed further, we need to install build tools, in our case Ninja.
```shell
PS C:\Users\hatedabamboo> winget install Ninja-build.Ninja
```

Ninja is necessary to execute files that CMake will create. These files include compilation instructions that will be performed by clang++, which is a part of ROCm distribution we installed earlier. And Visual Studio is required to provide runtime libraries and linker. Oh, what a great blend!

Okay, NOW we build. The command to configure build environment looks like this:

```shell
PS C:\Users\user\llama.cpp> mkdir build
PS C:\Users\user\llama.cpp> cmake -S . -B build -G Ninja `
  -DGGML_HIP=ON `
  -DGPU_TARGETS=gfx1100 `
  -DCMAKE_BUILD_TYPE=Release `
  -DCMAKE_PREFIX_PATH="C:\Program Files\AMD\ROCm\7.1" `
  -DCMAKE_C_COMPILER="C:\Program Files\AMD\ROCm\7.1\bin\clang.exe" `
  -DCMAKE_CXX_COMPILER="C:\Program Files\AMD\ROCm\7.1\bin\clang++.exe" `
  "-DCMAKE_CXX_FLAGS=--rocm-device-lib-path=C:/PROGRA~1/AMD/ROCm/7.1/amdgcn/bitcode"
```
Pretty huge, right? The parameters that are passed to `cmake` are important for the correct build:
- `-DGGML_HIP=ON` enables HIP backend for llama.cpp.
- `-DGPU_TARGETS=gfx1100` set the target GPU for build. To choose correct name refer to [AMD ROCm documentation](https://rocm.docs.amd.com/en/latest/reference/gpu-arch-specs.html). `gfx1100` is correct for **Radeon RX 7900 XTX**, **Radeon RX 7900 XT** and **Radeon RX 7900 GRE**.
- `-DCMAKE_BUILD_TYPE=Release` optimizes build type.
- `-DCMAKE_PREFIX_PATH` tells `cmake` where to find HIP files and `cmake` configs.
- `-DCMAKE_C_COMPILER` and `-DCMAKE_CXX_COMPILER` enables `clang` usage instead of MSVC.
- and finally `-DCMAKE_CXX_FLAGS` tells `clang` where GPU device libraries are.
If everything went correctly, you should see the following messages:
```shell
-- Configuring done (8.2s)
-- Generating done (0.9s)
-- Build files have been written to: C:/Users/user/llama.cpp/build
```
Now we start the compilation itself. Based on `NUMBER_OF_PROCESSORS` environment variable, it may take from 2-3 to 15-20 minutes.
```shell
cmake --build build -j $env:NUMBER_OF_PROCESSORS
```
Finally, after all these preparations you should see the one thing we've been working towards:
```shell
[587/587] Linking CXX executable bin\llama-server.exe
```
This is the executable that starts the server that handles LLMs and provides built-in Web UI.
If upon executing server you see no output whatsoever, try to pass environment variable with the following command:
```shell
PS C:\Users\user\llama.cpp> .\build\bin\llama-server.exe # not working
PS C:\Users\user\llama.cpp> .\build\bin\llama-server.exe --version # not working
PS C:\Users\user\llama.cpp> $env:PATH += ";C:\Program Files\AMD\ROCm\7.1\bin"
PS C:\Users\user\llama.cpp> .\build\bin\llama-server.exe --version # working!
HIP Library Path: C:\WINDOWS\SYSTEM32\amdhip64_7.dll
ggml_cuda_init: found 1 ROCm devices (Total VRAM: 24560 MiB):
  Device 0: AMD Radeon RX 7900 XTX, gfx1100 (0x1100), VMM: no, Wave Size: 32, VRAM: 24560 MiB
version: 9037 (bbeb89d76)
built with Clang 21.0.0 for Windows AMD64
```
To set ROCm libraries in the PATH environment for good, add it to register:
```shell
PS C:\Users\user\llama.cpp> [System.Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";C:\Program Files\AMD\ROCm\7.1\bin", [System.EnvironmentVariableTarget]::User)
```
## Painless path
After finishing all the steps above and successfully building `llama.cpp` from source and using for several local tasks, I returned to the official documentation to retrace my steps if I hadn't miss anything. Turns out, I missed one [critical note](https://github.com/ggml-org/llama.cpp/blob/master/docs/install.md) in the installation process.
There was a way to install `llama.cpp` using winget. It took literally one minute to do all of the work above. One minute.
```shell
PS C:\Users\user> winget install llama.cpp
```
And that's it. llama-server is installed on your computer.

In order to somehow cope with the timeloss I decided to find a single thing that turned out better in building from source than in installation via `winget`.

There wasn't.
## Providing llama-server with models
Now the hardest part is done, what else is necessary to run own chatbot? The models themselves.
This is a very easy step. Go to [Hugging Face](huggingface.co/models/) models hub, reduce *Parameters* slider to ~32B (because models with more parameters won't fit into RAM), select **llama.cpp** from *Apps* section, and choose whichever you like. For example, [unsloth/gemma-4-26B-A4B-it-GGUF](https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF). Open *Files and versions* tab and select `*.gguf` file. Download it and pass to llama-server with `-m` flag:
```shell
PS C:\Users\user\llama.cpp> .\build\bin\llama-server.exe -m C:\Users\user\Downloads\gemma-4-26B-A4B-it-UD-Q8_K_XL.gguf
```
This will start llama-server with provided model, and integrated Web UI will be available at `http://127.0.0.1:8080`.
Apart from using built-in Web UI there are other open-source applications, like [Jan](https://github.com/janhq/jan). I prefer it to default one, because it supports dynamic switching between models without loading them one by one into memory without unloading previous one. But that's entirely up to you which way to go. Because llama-server exposes OpenAI-compatible API, it can be tucked into any application supporting OpenAI backend.
## A sidenote about models
Diving into the wonderful world of open source models is a task and a half.
In Big Tech world we have one or several models and their numbers, which increase incrementally:
- gpt-5.4, gpt-5.5 etc;
- claude-opus-4.6, claude-sonte-4.7 etc.
The logic behind the naming is simple.
In the ocean of local open source modules we have:
- Mistral-Medium-3.5-128B-UD-IQ2_XXS.gguf
- Mistral-Medium-3.5-128B-UD-IQ3_XXS.gguf
- Mistral-Medium-3.5-128B-UD-Q5_K_XL-00001-of-00003.gguf
- Mistral-Medium-3.5-128B-UD-Q6_K_XL-00001-of-00003.gguf
- Mistral-Medium-3.5-128B-BF16-00001-of-00006.gguf
- Qwen3.6-35B-A3B-UD-Q8_K_XL.gguf
What are those???
As open source models are gigantic[^2], they must be shrunk in order to even run on your PC. Here comes into play quantization: the process of making models smaller by making them dumber, less precise or slower. This results in reducing model size by several times -- sometimes even by several orders of magnitude.
The most popualr quantizations are: 16bit, 8bit, 6bit, 5bit, 4bit, 3bit and 2bit. The lower the number -- the smaller (but dumber) the model.
So every time you see Q or IQ in the name of the model -- this means it was quantized from the original.

The number preceeding *B* or *T* in the name (31B, 128B, 809B) means amount of parameters. The more parameters -- the smarter the model and the heavier it is to operate.

Sometimes parameters can be represented as *E4B* or *A2B*: these are *effective* and *active* parameters respectively.

Effective parameters represent actual amount of parameters in the model, but with the power of embedded parameters as well (e.g.: 2.3B effective (5.1B with embeddings)). What does that mean? Each layer in a model has its own table of tokens (they are called PLE -- per-level embeddings). So instead of finding a specific token, models walk through a table to find one much faster. This allows the same level of effectiveness by reducing the number of parameters.

Active parameters allow for so-called *Mixture of Experts* model: based on the requests only active parameters will be used, but for more complex queries that require more thinking inactive parameters may be included for processing. This approach combines speed of execution with theoretical might of the full-scale model.
## Serving llama.cpp server on a local network
Now that you have a full-scale local LLM server with unlimited tokens, next reasonable step -- can you use it (for example) on your smartphone or your laptop? And yes, you absolutely can!
The process is very simple:
1. Serve llama-server.exe on a `0.0.0.0` rather than `127.0.0.1`;
2. Open your PC for incoming *local* connections (we don't want  to serve our own GPU for every North Korean hacker out there);
3. Install application that can connect to OpenAI-compatible llama-server API or
4. Open built-in llama.cpp WebUI in a browser.

To run llama-server open to all connections, starting command will be as follows:
```shell
PS C:\Users\user> llama-server.exe `
    --host 0.0.0.0 `
    --port 8080 `
    --models-dir "C:\Users\user\llama.cpp\models\"
```
To open firewall on your Windows PC create a new firewall rule with the following command:
```
PS C:\Users\user> New-NetFirewallRule -DisplayName "llama-server local" -Direction Inbound -Protocol TCP -LocalPort 8080 -RemoteAddress LocalSubnet -Action Allow
```
This rule will be available after the computer reboot, so don't worry if you forget it.

And, finally, to connect to your local llama-server from a different device, either open in a browser your PC with running llama IP address, or connect in an application of your choice to the same address. Your PC address can be found like this:
```shell
PS C:\Users\user\llama.cpp> ipconfig.exe | Select-String "IPv4 Address"

   IPv4 Address. . . . . . . . . . . : 10.1.2.3
   IPv4 Address. . . . . . . . . . . : 192.168.1.2

```
## Further reading

- [A Beginner's Guide to LLM Quantization](https://engineersmeetai.substack.com/p/a-beginners-guide-to-llm-quantization)
- [Quantization](https://huggingface.co/docs/optimum/v1.8.2/concept_guides/quantization)
- [What is mixture-of-experts (MoE), and how does it differ from a dense LLM?](https://sebastianraschka.com/faq/docs/mixture-of-experts.html)
- [What's Going on Under the Hood of LLMs](https://benlevinstein.substack.com/p/whats-going-on-under-the-hood-of)
- [Friends Don't Let Friends Use Ollama](https://sleepingrobots.com/dreams/stop-using-ollama/)
- [LLAMA.cpp and its friendlies to nonrich people](https://srejournals.com/2026/03/23/llama-cpp-and-its-friendlies-to-nonrich-people/)

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20Zero%20to%20llama.cpp%3A%20Run%20Local%20LLMs%20on%20Windows%20with%20AMD%20GPUs">Reply to this post ✉️</a></p>

[^1]: I'm not joking: on CPU I had ~9 tps (tokens per second), on GPU ~90-100 tps.
[^2]: And I mean GIGANTIC: some models wight hundreds of gigabytes and even terabytes. And they must fit into the RAM in FULL.
