---
title: 'Browser: Authentication'
---

Authenticate an existing [Passkey](https://liquidauth.com/guides/concepts/#passkeys) with the [Service](/guides/server/introduction).

### Who is this for?

- **dApps** logging back into the service without connecting to another client
- **Browser Wallets** that want to communicate with other clients

The {@link assertion.assertion | assertion} method is exported as a quick way to use an existing passkey

#### Quick Start:
{@includeCode ./assertion.spec.ts#assertionImport,quickStart}

## ⚒️ Manual Integration

If you want to manually handle the process of creating a passkey, you can use the following methods and preforming
the three steps of the process.

Importing the library:

{@includeCode ./assertion.fetch.spec.ts#assertionImport}

### 🧮 Options

Manually fetching the `Options` from the service using {@link assertion.fetch.postOptions}.

{@includeCode ./assertion.fetch.spec.ts#guideOptions}

### 🎉 Retrieving

To retrieve a passkey, decode the options from the service using {@link assertion.encoder.decodeOptions} and submit it
to the Credential API. 

The Credential must be encoded using the using {@link assertion.encoder.encodeCredential} method before
being submitted the response to the server

{@includeCode ./assertion.fetch.spec.ts#guideCredentialGet}

### 🚚 Response

Submit the passkey to the service using {@link assertion.fetch.postResponse}

{@includeCode ./assertion.fetch.spec.ts#guideResponse}