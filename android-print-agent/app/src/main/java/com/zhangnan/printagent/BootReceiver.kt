package com.zhangnan.printagent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val prefs = AgentPreferences(context)
    if (!prefs.registered) return
    val action = when (intent.action) {
      "android.hardware.usb.action.USB_DEVICE_ATTACHED" -> PrintAgentService.ACTION_USB_ATTACHED
      "android.hardware.usb.action.USB_DEVICE_DETACHED" -> PrintAgentService.ACTION_USB_DETACHED
      else -> PrintAgentService.ACTION_RESTORE
    }
    ContextCompat.startForegroundService(context, Intent(context, PrintAgentService::class.java).apply {
      this.action = action
    })
  }
}
