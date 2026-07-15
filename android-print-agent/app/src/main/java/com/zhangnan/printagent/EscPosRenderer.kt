package com.zhangnan.printagent

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.nio.charset.Charset

object EscPosRenderer {
  private val gb18030 = Charset.forName("GB18030")

  fun render(ticket: JSONObject, copies: Int): ByteArray {
    val output = ByteArrayOutputStream()
    repeat(copies.coerceIn(1, 9)) {
      output.write(byteArrayOf(0x1b, 0x40))
      val lines = ticket.optJSONArray("lines") ?: JSONArray()
      for (index in 0 until lines.length()) appendLine(output, lines.getJSONObject(index), ticket.optJSONObject("capabilities") ?: JSONObject())
      repeat(ticket.optInt("feedLines", 4).coerceIn(0, 20)) { output.write('\n'.code) }
      if (ticket.optBoolean("openCashDrawer", false)) output.write(byteArrayOf(0x1b, 0x70, 0x00, 0x19, 0xfa.toByte()))
      if (ticket.optBoolean("cutPaper", false)) output.write(byteArrayOf(0x1d, 0x56, 0x00))
    }
    return output.toByteArray()
  }

  private fun appendLine(output: ByteArrayOutputStream, line: JSONObject, capabilities: JSONObject) {
    if (line.optString("kind") == "blank") { output.write('\n'.code); return }
    if (line.optString("kind") == "divider") { output.write("--------------------------------\n".toByteArray(gb18030)); return }
    output.write(byteArrayOf(0x1b, 0x61, alignment(line.optString("align"))))
    output.write(byteArrayOf(0x1b, 0x45, if (line.optBoolean("bold")) 1 else 0))
    if (line.optBoolean("inverse")) output.write(byteArrayOf(0x1d, 0x42, 1))
    val size = when (line.optString("size")) { "medium" -> 0x11; "large" -> 0x22; "xlarge" -> 0x33; else -> 0x00 }
    output.write(byteArrayOf(0x1d, 0x21, size.toByte()))
    if (line.optString("color") == "red" && capabilities.optBoolean("twoColor", false)) output.write(byteArrayOf(0x1b, 0x72, 1))
    output.write(line.optString("text").toByteArray(gb18030))
    output.write('\n'.code)
    output.write(byteArrayOf(0x1b, 0x45, 0, 0x1d, 0x21, 0, 0x1b, 0x72, 0, 0x1d, 0x42, 0))
  }

  private fun alignment(value: String): Byte = when (value) { "center" -> 1; "right" -> 2; else -> 0 }
}
