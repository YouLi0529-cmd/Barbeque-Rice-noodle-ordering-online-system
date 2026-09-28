# Print Push Gateway

This CloudBase Cloud Hosting service keeps WebSocket connections to the restaurant Android print tablet. It carries no print content and cannot claim jobs. It only wakes the tablet after `tenantApi` has queued a job. The authenticated HTTP `print.agent.claim` API remains the authority for claiming and printing jobs.

## Required Cloud Hosting environment variables

- `TENANT_API_URL`: the deployed tenant API URL ending in `/tenantApi`.
- `PRINT_PUSH_GATEWAY_SECRET`: a long random secret shared with the `tenantApi` cloud function.

## Required tenantApi environment variables

- `PRINT_PUSH_GATEWAY_URL`: the Cloud Hosting public URL ending in `/notify`.
- `PRINT_PUSH_GATEWAY_SECRET`: exactly the same value used by this service.

## Android tablet

Enter the Cloud Hosting public WebSocket address ending in `/ws` in the print agent registration screen. Convert the public `https://` domain to `wss://`, for example:

`https://print-push.example.com` -> `wss://print-push.example.com/ws`

The Android agent still polls every five seconds whenever the connection is missing, so a Cloud Hosting restart or a restaurant network interruption cannot stop printing.
