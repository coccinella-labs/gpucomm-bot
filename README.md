<p align="center">
  <img src="https://raw.githubusercontent.com/coccinella-labs/gpucomm-bot/main/.github/assets/thumbnail.png" alt="gpucomm-bot" width="100%">
</p>

# GPUComm-Bot

GPUComm-Bot is a GitHub App that automates GPU-related checks and CI workflows. It listens for pull request and issue events, applies GPU-related labels, executes CUDA and PyTorch smoke tests, and provides slash commands for manual validation and benchmarking. The bot integrates with self-hosted runners equipped with NVIDIA drivers and CUDA to perform real GPU validation before merge, and can trigger performance benchmarks before releases.

Status: Active. Local development and Render deployment both supported. Self-hosted GPU runner required for full validation.

## Getting Started

GPUComm-Bot requires Node.js 18+, a GitHub App (created through your GitHub account), and a deployment target (local development with ngrok or cloud deployment on Render).

For local development, copy `.env.example` to `.env` and fill in your GitHub App credentials (`GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_PRIVATE_KEY_B64`). Install dependencies with `npm install`, then start the bot with `npm start`. The bot will listen on port 3000. To expose it to GitHub webhook events, use ngrok: run `ngrok http 3000` in another terminal and register the ngrok HTTPS URL with `+ /webhook` as your GitHub App webhook URL (e.g., `https://abc123-ngrok.io/webhook`).

For production deployment on Render, create a Render account, connect your GitHub repository, create a Web Service with `npm install` as the build command and `npm start` as the start command, and add the environment variables listed in Deployment. Render will automatically deploy on every push to main.

To create the GitHub App itself, go to GitHub Settings > Developer settings > GitHub Apps, click "New GitHub App", name it `gpucomm-bot`, and set the webhook URL to your deployment endpoint. Configure permissions (Pull requests: read/write, Issues: read/write, Contents: read, Metadata: read), subscribe to events (Pull request, Issues, Release), and generate a private key. Convert the private key to base64 with `base64 -i private-key.pem | tr -d '\n'` and add it as `GITHUB_PRIVATE_KEY_B64`. Install the app on your account or organization at GitHub Apps > gpucomm-bot > Installations.

## Architecture

GPUComm-Bot is structured around three main components. The webhook entry point at `app/main.js` receives events from GitHub and routes them through `app/routes.js` to handlers in `app/handlers/` (PR opened/updated, issue created, release published). Signature verification lives in `app/webhook/verify.js` and GitHub API authentication in `app/github/`. There is no slash-command processor; no code parses commands from comments. The CI integration at `.github/workflows/gpu.yml` runs on self-hosted runners and executes CUDA and PyTorch smoke tests when a PR is labeled or titled with GPU-related keywords.

The flow is event-driven. When a PR is opened, the webhook handler analyzes the title and changed files. If GPU-related changes are detected, the bot automatically applies the `gpu-required` label (configurable via `GPUCOMM_GPU_LABEL`). This label gates the self-hosted GPU CI workflow, ensuring GPU tests only run when needed. When a user types a slash command in a PR or issue comment, the webhook handler parses it, invokes the corresponding command handler, and posts results back as a comment. The commands provide a manual interface for validation and benchmarking outside the automatic PR flow.

Key code anchors are `app/main.js` (entry point), `app/routes.js` (event routing), `app/handlers/` (PR, issue, and release handlers), `app/github/` (API authentication and client), and `.github/workflows/gpu.yml` (CI workflow for GPU validation).

## Configuration

Environment variables control bot behavior. `GITHUB_APP_ID` and `GITHUB_INSTALLATION_ID` are the app and installation identifiers from GitHub. `GITHUB_PRIVATE_KEY_B64` is the base64-encoded private key (or `GITHUB_PRIVATE_KEY` as a PEM string). `GPUCOMM_GPU_LABEL` sets the label name the bot applies to GPU PRs (default: `gpu-required`; the label must already exist in your repository). `PORT` and `HOST` control where the bot listens (default: 3000 on localhost). `WEBHOOK_SECRET` should match the secret configured in your GitHub App webhook settings for security validation.

For GPU validation, `GPUCOMM_ENFORCE_CUDA_VERSION` can be set to `true` to require CUDA versions listed in `config/gpu.json.allowed_cuda_versions`. When running PyTorch tests, set the repository or organization variable `PYTORCH_INDEX_URL` to point to the correct PyTorch wheel index (e.g., `https://download.pytorch.org/whl/cu121` for CUDA 12.1).

## Features

The bot detects GPU-related PRs by title keywords ("gpu", "cuda") and applies the configured label, which gates the self-hosted GPU runner. There are no manual slash commands; validation runs automatically on matching PRs.

When a GPU PR is detected, the bot comments on the PR and ensures the CI workflow is queued. The self-hosted GPU workflow runs CUDA smoke tests (compiling and running a small CUDA kernel) and optionally PyTorch smoke tests (importing PyTorch and running a simple tensor operation). Results are posted back to the PR. For releases, the bot can automatically trigger benchmarks to validate performance before shipping.

## CI Integration

The self-hosted GPU runner must be labeled with `self-hosted`, `linux`, `x64`, and `gpu`. It requires NVIDIA drivers and the CUDA toolkit installed. The workflow at `.github/workflows/gpu.yml` runs only on this runner and gates on either the `gpu-required` label or PR title containing GPU keywords. The workflow runs `bash scripts/gpu-ci.sh` to execute CUDA smoke tests. For PyTorch validation, run `bash scripts/gpu-ci.sh pytorch`, which requires `PYTORCH_INDEX_URL` to be set.

The CUDA smoke test compiles `scripts/cuda_smoke_test.cu` with `nvcc` and runs the resulting binary. If compilation fails, the workflow fails. PyTorch smoke tests import torch and execute a simple operation on the GPU. If either test fails, the workflow fails and the PR status updates accordingly. This provides early feedback that GPU code will not compile or run.

Setting up a self-hosted runner is a one-time task. On the runner machine, install GitHub Actions runner software, register it with your repository with the labels above, and keep it running. Ensure NVIDIA drivers and CUDA toolkit are installed. The runner will then execute GPU workflows automatically when PRs match the gate conditions.

## Deployment

For local development, use ngrok as described in Getting Started. For production, Render provides a free tier that runs Node.js applications. After deploying to Render, the bot will automatically pull changes from your repository on every push to main. Ensure environment variables are set in Render's dashboard before the first deploy. If you need to change the deployment endpoint (e.g., from ngrok to Render), update your GitHub App's webhook URL in GitHub Settings.

Railway was initially used but the free trial expired; Render was chosen as a replacement and has been stable for production use.

## Commands

There are no slash commands. Validation runs automatically when a PR title matches GPU keywords. If manual triggering is needed, it has to be built first; see Contributing for where command handling would live.

## Contributing

Fork the repository, create a feature branch, make changes to `app/`, add or update scripts in `scripts/`, test locally with `npm start`, and open a PR. Code standards: use the provided `.env.example` as a template for configuration, keep command handlers focused (one action per command), and test webhook payload parsing with sample payloads in `docs/` if available.

When adding a new handler, implement it in `app/handlers/` and route it from `app/routes.js`, and test it against a real GitHub App instance locally. When adding a CI check (e.g., a new CUDA version requirement), update `config/gpu.json` and document the change in a comment in the JSON file.

## Known Limitations

The bot relies on self-hosted runners for GPU validation; GitHub's default runners do not have GPUs. Without a self-hosted runner, GPU tests cannot run and the PR will show a skipped status. Label automation is simple pattern matching on PR title and file paths; complex rules would require more sophisticated code analysis. Commands are polled from PR comments, not reactive; there is a slight delay between posting a command and execution. The bot does not currently support GPU-specific error analysis (e.g., driver mismatches); it reports pass/fail only. Benchmarking is triggered manually or via release events, not automatically on every GPU PR.

## Troubleshooting

If the bot is not responding to commands, verify that the webhook URL is correct in GitHub App settings and that the bot service is running. Check logs with `npm start` locally or in Render's dashboard. If GPU tests are skipped, ensure the self-hosted runner is registered with the correct labels and is online. If CUDA tests fail, verify that NVIDIA drivers and CUDA toolkit are installed on the runner with `nvidia-smi` and `nvcc --version`.

If PyTorch tests fail, verify that `PYTORCH_INDEX_URL` is set correctly for your CUDA version. If the bot is not applying labels, ensure the label name in `config/` matches the `GPUCOMM_GPU_LABEL` environment variable and that the label exists in your repository. If webhook events are not reaching the bot, check the GitHub App webhook delivery log in GitHub Settings to see if requests are failing.

## Performance

Webhook processing completes in under 1 second for label detection and comment posting. CUDA smoke test compilation takes 5-10 seconds depending on CUDA version. PyTorch import and tensor operations complete in 2-3 seconds. Benchmark workflows depend on the benchmark itself but typically complete in 30 seconds to a few minutes. The bot does not cache results; each command re-runs tests.

## Roadmap

Planned features include more sophisticated GPU error analysis (detecting driver version mismatches, memory issues), automatic performance regression detection (comparing benchmark results across PRs), and support for multi-GPU setups. Integration with artifact storage (gpucomm-fs) is planned to store benchmark results. See GitHub Issues for the full roadmap.

## Related Documentation

The bot integrates with gpucomm benchmarking and artifact storage tools. See the main gpucomm documentation for context. See `docs/` for GitHub App webhook payloads and test scenarios. See `config/gpu.json` for CUDA version configuration and allowed GPU architectures.

## License

MIT. See LICENSE file.

## Contact

Questions? Open an issue on GitHub or see the repository for discussion.
