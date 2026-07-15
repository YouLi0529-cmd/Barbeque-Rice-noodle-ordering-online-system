package com.zhangnan.printagent

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbManager
import android.media.ToneGenerator
import android.media.AudioManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import java.util.concurrent.TimeUnit

class PrintAgentService : Service() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private lateinit var prefs: AgentPreferences
  private lateinit var jobs: JobStore
  private var worker: Job? = null
  private var socket: WebSocket? = null
  private val client = OkHttpClient.Builder().pingInterval(30, TimeUnit.SECONDS).build()
  private var printers = emptyMap<String, PrinterConfig>()

  override fun onCreate() {
    super.onCreate()
    prefs = AgentPreferences(this)
    jobs = JobStore(this)
    createChannel()
    startForeground(NOTIFICATION_ID, NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_sys_upload)
      .setContentTitle("Print Agent is running")
      .setContentText("Waiting for print jobs")
      .setOngoing(true)
      .build())
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!prefs.registered) stopSelf()
    else {
      if (intent?.action == ACTION_USB_ATTACHED || intent?.action == ACTION_USB_DETACHED) {
        scope.launch {
          val api = AgentApi(prefs.apiUrl, prefs.tenantId)
          val status = if (intent.action == ACTION_USB_ATTACHED) "usb_device_attached" else "usb_device_removed"
          safeLog(api, status, if (status == "usb_device_attached") "USB device attached" else "USB device removed")
          try { reportUsbDevices(api) } catch (_: Exception) { }
        }
      }
      if (worker == null || worker?.isActive != true) startWorker()
    }
    return START_STICKY
  }

  private fun startWorker() {
    openWebSocketIfConfigured()
    worker = scope.launch {
      val api = AgentApi(prefs.apiUrl, prefs.tenantId)
      var refreshConfigAt = 0L
      while (isActive) {
        try {
          api.heartbeat(prefs.agentId, prefs.agentToken)
          reportUsbDevices(api)
          if (System.currentTimeMillis() >= refreshConfigAt) {
            printers = api.bootstrap(prefs.agentId, prefs.agentToken).associateBy { it.id }
            refreshConfigAt = System.currentTimeMillis() + 60_000
          }
          val job = api.claim(prefs.agentId, prefs.agentToken)
          if (job != null) executeJob(api, job)
          else delay(POLL_INTERVAL_MS)
        } catch (error: Exception) {
          safeLog(api, "agent_connection_error", error.message ?: "network error", level = "error")
          delay(RECONNECT_INTERVAL_MS)
        }
      }
    }
  }

  private fun executeJob(api: AgentApi, job: PrintJob) {
    if (jobs.wasCompleted(job.id)) {
      try { api.reportResult(prefs.agentId, prefs.agentToken, job, true) } catch (_: Exception) { }
      return
    }
    jobs.markInFlight(job.id)
    try {
      api.start(prefs.agentId, prefs.agentToken, job)
      val printer = printers[job.printerId] ?: throw IllegalStateException("Printer configuration not available")
      if (!printer.enabled) throw IllegalStateException("Printer is disabled")
      val bytes = EscPosRenderer.render(job.ticket, job.copies)
      if (printer.connectionType == "usb") UsbPrinterTransport(this, printer).send(bytes)
      else TcpPrinterTransport(printer.ip, printer.port).send(bytes)
      jobs.markCompleted(job.id)
      jobs.clearInFlight(job.id)
      try {
        api.reportResult(prefs.agentId, prefs.agentToken, job, true)
        api.log(prefs.agentId, prefs.agentToken, "printed", "Print job completed", printer.id)
      } catch (_: Exception) {
        // The local completed-job marker prevents a duplicate physical print after a network interruption.
      }
    } catch (error: Exception) {
      jobs.clearInFlight(job.id)
      val message = error.message ?: "Print failed"
      api.reportResult(prefs.agentId, prefs.agentToken, job, false, message)
      safeLog(api, when {
        message.contains("permission", true) -> "usb_permission_failed"
        message.contains("USB", true) -> "usb_send_failed"
        message.contains("timed out", true) -> "tcp_timeout"
        else -> "send_failed"
      }, message, job.printerId, "error")
      ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80).startTone(ToneGenerator.TONE_PROP_BEEP2, 200)
    }
  }

  private fun reportUsbDevices(api: AgentApi) {
    val manager = getSystemService(Context.USB_SERVICE) as UsbManager
    val devices = JSONArray()
    manager.deviceList.values.forEach { device ->
      devices.put(org.json.JSONObject()
        .put("name", device.deviceName)
        .put("vendorId", device.vendorId)
        .put("productId", device.productId)
        .put("permission", manager.hasPermission(device)))
    }
    api.reportUsbDevices(prefs.agentId, prefs.agentToken, devices)
  }

  private fun safeLog(api: AgentApi, status: String, message: String, printerId: String = "", level: String = "info") {
    try { api.log(prefs.agentId, prefs.agentToken, status, message, printerId, level) } catch (_: Exception) { }
  }

  private fun openWebSocketIfConfigured() {
    val wsUrl = prefs.websocketUrl
    if (wsUrl.isBlank()) return
    socket?.close(1000, "reconnect")
    socket = client.newWebSocket(Request.Builder().url(wsUrl).build(), object : WebSocketListener() {
      override fun onOpen(webSocket: WebSocket, response: Response) {
        webSocket.send("{\"agentId\":\"${prefs.agentId}\",\"tenantId\":\"${prefs.tenantId}\"}")
      }

      override fun onMessage(webSocket: WebSocket, text: String) {
        // The HTTP poller remains authoritative. A WebSocket notification only wakes it quickly.
        worker?.cancel()
        worker = null
        startWorker()
      }

      override fun onFailure(webSocket: WebSocket, throwable: Throwable, response: Response?) {
        // HTTP polling continues as the required fallback when the socket is unavailable.
      }
    })
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Print Agent", NotificationManager.IMPORTANCE_LOW))
    }
  }

  override fun onDestroy() {
    socket?.close(1000, "service stopped")
    scope.cancel()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    const val ACTION_RESTORE = "com.zhangnan.printagent.RESTORE"
    const val ACTION_USB_ATTACHED = "com.zhangnan.printagent.USB_ATTACHED"
    const val ACTION_USB_DETACHED = "com.zhangnan.printagent.USB_DETACHED"
    private const val CHANNEL_ID = "print_agent"
    private const val NOTIFICATION_ID = 4101
    private const val POLL_INTERVAL_MS = 5_000L
    private const val RECONNECT_INTERVAL_MS = 8_000L
  }
}
