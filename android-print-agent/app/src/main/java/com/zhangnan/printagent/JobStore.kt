package com.zhangnan.printagent

import android.content.Context

class JobStore(context: Context) {
  private val store = context.getSharedPreferences("print_agent_jobs", Context.MODE_PRIVATE)

  fun wasCompleted(jobId: String): Boolean = store.contains("done_$jobId")

  fun markCompleted(jobId: String) {
    store.edit().putLong("done_$jobId", System.currentTimeMillis()).apply()
  }

  fun markInFlight(jobId: String) {
    store.edit().putLong("inflight_$jobId", System.currentTimeMillis()).apply()
  }

  fun clearInFlight(jobId: String) {
    store.edit().remove("inflight_$jobId").apply()
  }
}
