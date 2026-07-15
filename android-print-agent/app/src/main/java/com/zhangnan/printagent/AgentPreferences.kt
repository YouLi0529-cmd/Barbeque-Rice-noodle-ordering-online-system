package com.zhangnan.printagent

import android.content.Context

class AgentPreferences(context: Context) {
  private val store = context.getSharedPreferences("print_agent", Context.MODE_PRIVATE)

  var apiUrl: String
    get() = store.getString("api_url", "") ?: ""
    set(value) = store.edit().putString("api_url", value.trim()).apply()

  var websocketUrl: String
    get() = store.getString("websocket_url", "") ?: ""
    set(value) = store.edit().putString("websocket_url", value.trim()).apply()

  var tenantId: String
    get() = store.getString("tenant_id", "zhangnan") ?: "zhangnan"
    set(value) = store.edit().putString("tenant_id", value.trim()).apply()

  var agentId: String
    get() = store.getString("agent_id", "") ?: ""
    set(value) = store.edit().putString("agent_id", value).apply()

  var agentToken: String
    get() = store.getString("agent_token", "") ?: ""
    set(value) = store.edit().putString("agent_token", value).apply()

  var registered: Boolean
    get() = agentId.isNotBlank() && agentToken.isNotBlank() && apiUrl.isNotBlank()
    set(_) = Unit

  fun saveRegistration(api: String, tenant: String, id: String, token: String, ws: String) {
    store.edit()
      .putString("api_url", api.trim())
      .putString("tenant_id", tenant.trim())
      .putString("agent_id", id)
      .putString("agent_token", token)
      .putString("websocket_url", ws.trim())
      .apply()
  }

  fun clearRegistration() {
    store.edit().remove("agent_id").remove("agent_token").apply()
  }
}
