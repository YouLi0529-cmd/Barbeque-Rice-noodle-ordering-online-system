package com.zhangnan.printagent

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import java.net.InetSocketAddress
import java.net.Socket

interface PrinterTransport {
  fun send(bytes: ByteArray)
}

data class PrinterHealth(
  val networkStatus: String,
  val networkLatencyMs: Long = 0,
  val networkError: String = "",
  val hardwareStatus: String = "unknown",
  val hardwareStatusSource: String = "network_only"
)

/**
 * A TCP connection proves that the printer port is reachable.  ESC/POS real-time
 * status queries are attempted only for configured ESC/POS printers: many basic
 * network printers accept print bytes but do not answer status commands.
 */
class TcpPrinterHealthProbe(
  private val host: String,
  private val port: Int,
  private val supportsEscPos: Boolean
) {
  fun check(): PrinterHealth {
    val startedAt = System.nanoTime()
    return try {
      Socket().use { socket ->
        socket.connect(InetSocketAddress(host, port), HEALTH_CONNECT_TIMEOUT_MS)
        val latency = (System.nanoTime() - startedAt) / 1_000_000
        if (!supportsEscPos) return PrinterHealth("reachable", latency)

        socket.soTimeout = HEALTH_STATUS_TIMEOUT_MS
        val output = socket.getOutputStream()
        val input = socket.getInputStream()
        val offline = requestStatus(output, input, 2)
        val error = requestStatus(output, input, 3)
        val paper = requestStatus(output, input, 4)

        val hardware = when {
          paper >= 0 && paper and 0x60 != 0 -> "paper_out"
          offline >= 0 && offline and 0x04 != 0 -> "cover_open"
          error >= 0 && error and 0x08 != 0 -> "jammed"
          offline >= 0 || error >= 0 || paper >= 0 -> "ok"
          else -> "unknown"
        }
        PrinterHealth(
          networkStatus = "reachable",
          networkLatencyMs = latency,
          hardwareStatus = hardware,
          hardwareStatusSource = if (hardware == "unknown") "network_only" else "escpos_realtime"
        )
      }
    } catch (error: Exception) {
      PrinterHealth(
        networkStatus = "unreachable",
        networkLatencyMs = (System.nanoTime() - startedAt) / 1_000_000,
        networkError = error.message ?: error.javaClass.simpleName,
        hardwareStatus = "unknown",
        hardwareStatusSource = "network_only"
      )
    }
  }

  private fun requestStatus(output: java.io.OutputStream, input: java.io.InputStream, type: Int): Int {
    return try {
      output.write(byteArrayOf(0x10, 0x04, type.toByte()))
      output.flush()
      input.read()
    } catch (_: Exception) {
      -1
    }
  }

  companion object {
    private const val HEALTH_CONNECT_TIMEOUT_MS = 3_500
    private const val HEALTH_STATUS_TIMEOUT_MS = 450
  }
}

class TcpPrinterTransport(private val host: String, private val port: Int) : PrinterTransport {
  override fun send(bytes: ByteArray) {
    Socket().use { socket ->
      socket.connect(InetSocketAddress(host, port), 6000)
      socket.soTimeout = 9000
      socket.getOutputStream().use { output ->
        output.write(bytes)
        output.flush()
      }
    }
  }
}

class UsbPrinterTransport(private val context: Context, private val config: PrinterConfig) : PrinterTransport {
  private val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager

  override fun send(bytes: ByteArray) {
    val device = findDevice() ?: throw IllegalStateException("USB printer not found or not bound")
    if (!usbManager.hasPermission(device)) {
      requestPermission(device)
      throw IllegalStateException("USB permission requested; send the test job again after allowing access")
    }
    val printerInterface = (0 until device.interfaceCount)
      .map { device.getInterface(it) }
      .firstOrNull { iface -> iface.interfaceClass == UsbConstants.USB_CLASS_PRINTER }
      ?: device.getInterface(0)
    val endpoint = (0 until printerInterface.endpointCount)
      .map { printerInterface.getEndpoint(it) }
      .firstOrNull { endpoint -> endpoint.direction == UsbConstants.USB_DIR_OUT }
      ?: throw IllegalStateException("USB printer has no output endpoint")
    val connection = usbManager.openDevice(device) ?: throw IllegalStateException("Unable to open USB printer")
    try {
      if (!connection.claimInterface(printerInterface, true)) throw IllegalStateException("Unable to claim USB printer interface")
      try {
        var offset = 0
        while (offset < bytes.size) {
          val size = minOf(4096, bytes.size - offset)
          val chunk = bytes.copyOfRange(offset, offset + size)
          val sent = connection.bulkTransfer(endpoint, chunk, chunk.size, 8000)
          if (sent <= 0) throw IllegalStateException("USB bulk transfer failed")
          offset += sent
        }
      } finally {
        connection.releaseInterface(printerInterface)
      }
    } finally {
      connection.close()
    }
  }

  private fun findDevice(): UsbDevice? {
    return usbManager.deviceList.values.firstOrNull { device ->
      val vendorMatches = config.usbVendorId.isBlank() || device.vendorId.toString() == config.usbVendorId || "0x${device.vendorId.toString(16)}".equals(config.usbVendorId, true)
      val productMatches = config.usbProductId.isBlank() || device.productId.toString() == config.usbProductId || "0x${device.productId.toString(16)}".equals(config.usbProductId, true)
      val nameMatches = config.usbDeviceName.isBlank() || device.deviceName.contains(config.usbDeviceName, true)
      vendorMatches && productMatches && nameMatches
    }
  }

  private fun requestPermission(device: UsbDevice) {
    val action = "com.zhangnan.printagent.USB_PERMISSION"
    val pendingIntent = PendingIntent.getBroadcast(context, 1, Intent(action), PendingIntent.FLAG_IMMUTABLE)
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        try { context.unregisterReceiver(this) } catch (_: Exception) { }
      }
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, IntentFilter(action), Context.RECEIVER_NOT_EXPORTED)
    } else {
      context.registerReceiver(receiver, IntentFilter(action))
    }
    usbManager.requestPermission(device, pendingIntent)
  }
}
