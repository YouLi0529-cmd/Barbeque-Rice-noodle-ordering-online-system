# Print Module Database Indexes

Create these compound indexes in the CloudBase document database for the tenant
environment. They keep the print queue and log pages responsive after the store
has accumulated a large number of records.

| Collection | Index fields | Used by |
| --- | --- | --- |
| `printJobs` | `storeId` ascending, `status` ascending, `availableAt` ascending, `createTime` ascending | Android agent claims the next queued job |
| `printJobs` | `storeId` ascending, `status` ascending, `leaseUntil` ascending, `createTime` ascending | Expired agent lease recovery |
| `printJobs` | `storeId` ascending, `printerId` ascending, `status` ascending, `createTime` descending | Printer-specific task queries and queue clearing |
| `printJobs` | `storeId` ascending, `createTime` descending | Task history page and archiving |
| `printerEventLogs` | `storeId` ascending, `printerId` ascending, `createTime` descending | Printer log page and clearing the current page |
| `printerEventLogs` | `storeId` ascending, `createTime` descending | All-printer log page and archiving |
| `unassignedDishAlerts` | `storeId` ascending, `status` ascending, `createTime` descending | Dashboard unassigned-dish alerts |
| `printJobArchives` | `storeId` ascending, `createTime` descending | Long-term archive lookup |
| `printerEventLogArchives` | `storeId` ascending, `createTime` descending | Long-term archive lookup |

## How to add them

1. Open CloudBase for the target environment, then open **Document Database**.
2. Choose the collection, then choose **Indexes** and **Create index**.
3. Add the fields in the exact order shown above. Keep the final `createTime`
   direction exactly as listed.
4. Wait for each index to become available before treating high-volume print
   tests as complete.

The application still has compatibility fallbacks for local development. In
production, these indexes are required to avoid scanning a fixed first batch of
jobs or logs.

## Retention

The printing page can archive terminal jobs (`sent to printer`, failed, or
cancelled) and logs older than 90 days. Archive actions process at most 500
records per run so they stay within serverless execution limits; run it again
when the page reports remaining historical data. Active queued, claimed, and
sending jobs are never archived.
