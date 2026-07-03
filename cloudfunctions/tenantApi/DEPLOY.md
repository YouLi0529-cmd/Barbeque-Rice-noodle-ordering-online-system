# tenantApi Deployment Notes

This function is the commercial backend entry for the Zhangnan BBQ mini program.
Deploy it to the CloudBase environment controlled by the service provider.

## 1. CloudBase environment

Create or select your own CloudBase environment, then deploy this folder as a cloud function:

```text
cloudfunctions/tenantApi
```

Enable an HTTP trigger for the function and copy the generated HTTPS URL.

## 2. Environment variables

Set these variables on the `tenantApi` function:

```text
WECHAT_APPID=your customer mini program appid
WECHAT_SECRET=your customer mini program app secret
TENANT_ID=zhangnan
```

`WECHAT_APPID` and `WECHAT_SECRET` are needed for `auth.login`.

## 3. Database license record

Create the `tenantLicense` collection and insert one record:

```json
{
  "tenantId": "zhangnan",
  "storeName": "Zhangnan BBQ",
  "status": "active",
  "expireAt": "2027-07-02T23:59:59+08:00",
  "graceUntil": "2027-07-09T23:59:59+08:00"
}
```

When the customer does not renew, change `status` to `expired` or `disabled`.

## 4. Frontend switch

For temporary testing, run this in the mini program console:

```js
wx.setStorageSync('tenantApiBaseUrl', 'https://your-cloudbase-http-trigger-url')
```

For production, fill the same URL into:

```text
miniprogram/utils/apiClient.js
```

Set `API_BASE_URL` to the HTTP trigger URL.

## 5. WeChat legal domain

In the customer's WeChat mini program admin console, add the API domain to:

```text
request legal domain
```

Without this, real devices cannot call the backend with `wx.request`.

## 6. Current migration coverage

Already routed through `tenantApi` when `API_BASE_URL` is enabled:

- Menu sync through `getCategory`
- Login token
- User profile
- Phone number exchange
- Shop info
- Notices
- Menu categories
- Dishes by category
- Dish search
- Order creation
- User order list
- Order delete/cancel
- Shared dine-in cart with polling
- Pre-order draft save/get/delete

Still to migrate later:

- Admin pages
- Dish/menu editing backend
- Table code management
- Printer management
- Payment

## 7. Sync menu data

`menu.sync` calls the `getCategory` cloud function in the same CloudBase environment.
Make sure `getCategory` has also been deployed to this environment.

Run these commands in the WeChat DevTools Console.

Normal dine-in menu:

```js
wx.request({
  url: 'https://your-cloudbase-http-trigger-url',
  method: 'POST',
  data: {
    tenantId: 'zhangnan',
    action: 'menu.sync',
    menuType: 'dineIn'
  },
  success: console.log,
  fail: console.error
})
```

If the function times out, sync by category batches:

```js
wx.request({
  url: 'https://your-cloudbase-http-trigger-url',
  method: 'POST',
  data: {
    tenantId: 'zhangnan',
    action: 'menu.sync',
    menuType: 'dineIn',
    categoryNames: ['明星烤肉', '张南招牌', '张南原切']
  },
  success: console.log,
  fail: console.error
})
```

Camping menu:

```js
wx.request({
  url: 'https://your-cloudbase-http-trigger-url',
  method: 'POST',
  data: {
    tenantId: 'zhangnan',
    action: 'menu.sync',
    menuType: 'camping'
  },
  success: console.log,
  fail: console.error
})
```
