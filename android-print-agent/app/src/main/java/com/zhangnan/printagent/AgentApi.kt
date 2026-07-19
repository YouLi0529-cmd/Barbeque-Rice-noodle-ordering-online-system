package com.zhangnan.printagent

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

data class RegistrationResponse(val agentId: String, val agentToken: String)
data class PrinterConfig(
  val id: String,
  val name: String,
  val enabled: Boolean,
  val connectionType: String,
  val ip: String,
  val port: Int,
  val usbVendorId: String,
  val usbProductId: String,
  val usbDeviceName: String,
  val escpos: Boolean
)

data class PrintJob(
  val id: String,
  val claimToken: String,
  val printerId: String,
  val copies: Int,
  val ticket: JSONObject
)

class AgentApi(private val apiUrl: String, private val tenantId: String) {
  fun register(registrationCode: String, name: String): RegistrationResponse {
    val data = post("print.agent.register", JSONObject().put("registrationCode", registrationCode).put("name", name))
    return RegistrationResponse(data.getString("agentId"), data.getString("agentToken"))
  }

  fun heartbeat(agentId: String, token: String) {
    post("print.agent.heartbeat", auth(agentId, token).put("capabilities", JSONObject()
      .put("usbHost", true).put("tcp", true).put("escpos", true).put("websocket", true).put("httpPolling", true)))
  }

  fun bootstrap(agentId: String, token: String): List<PrinterConfig> {
    val data = post("print.agent.bootstrap", auth(agentId, token))
    val printers = data.optJSONArray("printers") ?: JSONArray()
    return (0 until printers.length()).map { index ->
      val item = printers.getJSONObject(index)
      val usb = item.optJSONObject("usbBinding") ?: JSONObject()
      PrinterConfig(
        id = item.getString("_id"),
        name = item.optString("name"),
        enabled = item.optBoolean("status", true),
        connectionType = item.optString("connectionType"),
        ip = item.optString("ip"),
        port = item.optInt("port", 9100),
        usbVendorId = usb.optString("vendorId"),
        usbProductId = usb.optString("productId"),
        usbDeviceName = usb.optString("deviceName"),
        escpos = item.optJSONObject("capabilities")?.optBoolean("escpos", true) ?: true
      )
    }
  }

  fun claim(agentId: String, token: String): PrintJob? {
    val data = post("print.agent.claim", auth(agentId, token))
    if (data == JSONObject.NULL || data.length() == 0) return null
    return PrintJob(
      id = data.getString("_id"),
      claimToken = data.getString("claimToken"),
      printerId = data.getString("printerId"),
      copies = data.optInt("copies", 1).coerceIn(1, 9),
      ticket = data.getJSONObject("ticket")
    )
  }

  fun start(agentId: String, token: String, job: PrintJob) {
    post("print.agent.start", auth(agentId, token)
      .put("jobId", job.id)
      .put("claimToken", job.claimToken))
  }

  fun reportResult(agentId: String, token: String, job: PrintJob, success: Boolean, error: String = "") {
    post("print.agent.result", auth(agentId, token)
      .put("jobId", job.id)
      .put("claimToken", job.claimToken)
      .put("success", success)
      .put("error", error))
  }

  fun log(agentId: String, token: String, status: String, message: String, printerId: String = "", level: String = "info") {
    post("print.agent.log", auth(agentId, token)
      .put("printerId", printerId)
      .put("status", status)
      .put("message", message)
      .put("level", level))
  }

  fun reportUsbDevices(agentId: String, token: String, devices: JSONArray) {
    post("print.agent.usbDevices", auth(agentId, token).put("usbDevices", devices))
  }

  fun reportPrinterHealth(agentId: String, token: String, printers: JSONArray) {
    post("print.agent.printerHealth", auth(agentId, token).put("printers", printers))
  }

  private fun auth(agentId: String, token: String): JSONObject = JSONObject()
    .put("agentId", agentId)
    .put("agentToken", token)

  private fun post(action: String, body: JSONObject): JSONObject {
    val connection = (URL(apiUrl).openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      connectTimeout = 12_000
      readTimeout = 18_000
      doOutput = true
      setRequestProperty("Content-Type", "application/json; charset=utf-8")
    }
    val request = body.put("tenantId", tenantId).put("action", action).toString()
    OutputStreamWriter(connection.outputStream, StandardCharsets.UTF_8).use { it.write(request) }
    val source = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
    val response = BufferedReader(source.reader(StandardCharsets.UTF_8)).use { it.readText() }
    val json = JSONObject(response)
    if (!json.optBoolean("success", false)) throw IllegalStateException(json.optString("message", "print backend request failed"))
    return json.opt("data") as? JSONObject ?: JSONObject()
  }
}
