# Overview

This project is an example Client for TypeScript for using the Liquid-Auth API.

## Getting Started

#### Clone the project
```bash
git clone git@github.com:algorandfoundation/liquid-auth-js.git
```

#### Install dependencies
```bash
npm install
```

## Configure Development Server

The service needs a valid SSL certificate to test all of the features. You can use [ngrok](https://ngrok.com/) to create a secure tunnel to your local development server.

### NGROK

**note on VPNs**: Ngrok will not work with VPNs, so to run locally the project, `disable` it or `configure` your VPN's split tunneling to allow ngrok traffic.

Sign up for a free account at [ngrok](https://ngrok.com/) and follow the instructions to get your <NGROK_AUTH_TOKEN> and <NGROK_STATIC_DOMAIN>.

#### Configure NGROK
ngrok will ask you to add your auth token to your configuration file.

``` bash
ngrok config add-authtoken <NGROK_AUTH_TOKEN>
```

Will then ask you to deploy your static domain, make sure to change the port to **5137** like this:

``` bash
ngrok http --domain=<NGROK_STATIC_DOMAIN> 5173
```

### ENV Configuration

Update the [.env.docker](.env.docker) file with the following keys with the values from ngrok:

```bash
HOSTNAME=<NGROK_STATIC_DOMAIN>
ORIGIN=https://<NGROK_STATIC_DOMAIN>
```

### Start services
Make sure to [login to ghcr.io](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-with-a-personal-access-token-classic) with your GitHub credentials to pull the images.
```bash
docker compose up -d
```

### Start the build watcher

Watch for changes and rebuild the library
```bash
npm run dev
```

### Start the simplified demo:

Start the example Vite application
```bash
cd ./example
npm install
npm run dev
```

Open your browser and navigate to `https://<NGROK_STATIC_DOMAIN>` to see the example running.
