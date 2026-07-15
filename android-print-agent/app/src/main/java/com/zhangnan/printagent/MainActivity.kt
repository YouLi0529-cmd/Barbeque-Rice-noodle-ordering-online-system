package com.zhangnan.printagent

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {
  private lateinit var prefs: AgentPreferences
  private lateinit var status: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    prefs = AgentPreferences(this)
    render()
  }

  override fun onResume() {
    super.onResume()
    renderStatus()
  }

  private fun render() {
    val container = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(48, 64, 48, 48)
    }
    container.addView(TextView(this).apply { text = "Zhangnan Print Agent"; textSize = 28f })
    status = TextView(this).apply { textSize = 16f; setPadding(0, 30, 0, 30) }
    container.addView(status)
    container.addView(Button(this).apply {
      text = if (prefs.registered) "重新配置 / 注册" else "注册打印代理"
      setOnClickListener { openRegistrationDialog() }
    })
    container.addView(Button(this).apply {
      text = "启动打印服务"
      setOnClickListener { startAgentService() }
    })
    container.addView(Button(this).apply {
      text = "停止打印服务"
      setOnClickListener { stopService(Intent(this@MainActivity, PrintAgentService::class.java)) }
    })
    setContentView(container)
    renderStatus()
  }

  private fun renderStatus() {
    status.text = if (prefs.registered) {
      "已注册\n门店：${prefs.tenantId}\n设备：${prefs.agentId}\n服务将在后台持续领取任务。"
    } else {
      "尚未注册。请从小程序打印中心生成一次性注册码。"
    }
  }

  private fun openRegistrationDialog() {
    val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(38, 20, 38, 0) }
    val api = EditText(this).apply { hint = "tenantApi HTTP 地址"; setText(prefs.apiUrl) }
    val tenant = EditText(this).apply { hint = "门店 ID"; setText(prefs.tenantId) }
    val code = EditText(this).apply { hint = "小程序生成的注册码" }
    val name = EditText(this).apply { hint = "设备名称"; setText("店内安卓打印平板") }
    val ws = EditText(this).apply { hint = "可选 WebSocket 地址"; setText(prefs.websocketUrl) }
    listOf(api, tenant, code, name, ws).forEach(layout::addView)
    AlertDialog.Builder(this)
      .setTitle("注册打印代理")
      .setView(layout)
      .setNegativeButton("取消", null)
      .setPositiveButton("注册", null)
      .create()
      .also { dialog ->
        dialog.setOnShowListener {
          dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            if (api.text.isNullOrBlank() || code.text.isNullOrBlank()) {
              code.error = "请填写 API 地址和注册码"
              return@setOnClickListener
            }
            register(api.text.toString(), tenant.text.toString(), code.text.toString(), name.text.toString(), ws.text.toString(), dialog)
          }
        }
        dialog.show()
      }
  }

  private fun register(apiUrl: String, tenantId: String, code: String, name: String, wsUrl: String, dialog: AlertDialog) {
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val response = AgentApi(apiUrl, tenantId).register(code, name)
        prefs.saveRegistration(apiUrl, tenantId, response.agentId, response.agentToken, wsUrl)
        withContext(Dispatchers.Main) { dialog.dismiss(); renderStatus(); startAgentService() }
      } catch (error: Exception) {
        withContext(Dispatchers.Main) { AlertDialog.Builder(this@MainActivity).setMessage(error.message ?: "注册失败").setPositiveButton("确定", null).show() }
      }
    }
  }

  private fun startAgentService() {
    if (!prefs.registered) {
      AlertDialog.Builder(this).setMessage("请先完成注册").setPositiveButton("确定", null).show()
      return
    }
    ContextCompat.startForegroundService(this, Intent(this, PrintAgentService::class.java))
  }
}
