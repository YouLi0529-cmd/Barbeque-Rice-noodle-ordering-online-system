# Android Print Agent

This is the on-premise Android service that delivers CloudBase print jobs to the restaurant printers. It is deliberately separate from the WeChat Mini Program because a Mini Program cannot reliably control Android USB Host devices in the background.

## Build and register

1. Open `android-print-agent` in Android Studio and let it install the Android Gradle Plugin dependencies.
2. Build and install the `app` module on the restaurant Android tablet.
3. In the Mini Program, open `管理员后台 -> 店铺设置 -> 打印机管理 -> 打印中心`, then select `注册平板`.
4. On the tablet, tap `注册打印代理` and enter the Tenant API HTTP URL, store ID, the one-time registration code, and an optional WebSocket endpoint.
5. Allow USB access when Android asks. The service reports attached USB VID/PID devices to the backend, so the front-counter printer can be rebound from the Mini Program.

The service uses WebSocket notifications when a compatible endpoint is configured and continues polling `print.agent.claim` every five seconds when the socket is absent or disconnected. It is a foreground service and restarts after device boot when it has been registered.

## Hardware verification checklist

- Verify TCP reachability and port `9100` for `192.168.10.42`, `192.168.10.37`, and `192.168.10.207` on the tablet's restaurant LAN.
- Confirm the front counter XP-58IINT USB VID/PID and grant Android USB permission.
- Run one test ticket per printer, then verify Chinese GB18030 encoding, feed length, cutter command, beeper command, and cash drawer command with the actual printer model.
