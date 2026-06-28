# Barbeque Rice Noodle Ordering Online System

这是一个面向“张南火盆烧烤 / 米线”门店场景的微信小程序在线点餐系统。项目基于微信云开发实现，当前版本重点服务单店堂食、户外烧烤自取、排队取号、预约订座和管理员。

本仓库由开源点餐小程序改造而来，已经替换为本项目自己的业务定位、页面入口和后台流程。

## 项目定位

- 店铺品牌：张南火盆烧烤
- 业务类型：堂食自烤、户外烧烤自取、米线/餐饮点单
- 核心模式：同一个小程序，多入口扫码，一个菜单系统，一个订单系统，一个后台系统
- 主要用户：到店顾客、户外烧烤顾客、门店管理员

## 已实现功能

### 顾客端

- 品牌首页：张南火盆烧烤风格首页，包含堂食、户外、排队、预约入口
- 堂食点单：支持桌码进入并绑定桌号，下单写入 `orderType='dineIn'`
- 户外烧烤：顾客选择可用烤架，点同一套餐品，商家备货后顾客自取
- 排队取号：支持选择人数、填写昵称或手机号、生成排队号码
- 预约订座：支持日期、时间、人数、姓名、手机号和备注
- 购物车与结算：保留原有菜品分类、购物车、余额支付、微信支付、免单逻辑
- 我的订单：兼容堂食、户外和充值订单展示

### 管理后台

- 菜品管理、分类管理、会员管理、公告管理、店铺设置
- 订单管理：支持堂食、户外、付款状态、订单状态筛选
- 排队管理：叫号、过号、入座、取消
- 预约管理：确认、到店、取消
- 户外订单：配菜中、待自取、已取餐、待买单、确认线下已付款、取消
- 烤架管理：新增烤架、启用/停用烤架、创建默认烤架
- 桌码管理：保留堂食桌码生成能力
- 打印机管理：保留原有小票打印能力

## 技术栈

- 微信小程序
- 微信云开发
- 云函数
- 云数据库
- Vant Weapp
- ColorUI

## 目录结构

```text
.
├── miniprogram/
│   ├── app.js
│   ├── app.json
│   ├── app.wxss
│   ├── pages/
│   │   ├── index/              # 品牌首页 + 堂食菜单
│   │   ├── outdoor/            # 户外烧烤下单
│   │   ├── queue/              # 顾客排队取号
│   │   ├── reservation/        # 顾客预约订座
│   │   ├── settle/             # 堂食结算
│   │   ├── myorder/            # 我的订单
│   │   ├── myhome/             # 我的页面
│   │   └── admin/
│   │       ├── admin/          # 管理后台入口
│   │       ├── order/          # 订单管理
│   │       ├── queue/          # 排队管理
│   │       ├── reservation/    # 预约管理
│   │       ├── outdoor/        # 户外订单管理
│   │       ├── grill/          # 烤架管理
│   │       ├── dish/           # 菜品管理
│   │       ├── tableCode/      # 桌码管理
│   │       └── printer/        # 打印机管理
│   ├── components/
│   ├── images/
│   ├── utils/
│   └── vant/
│
├── cloudfunctions/
│   ├── login/
│   ├── getCategory/
│   ├── doBuy/
│   ├── pay/
│   ├── pay_success/
│   ├── get_code/
│   ├── getPhoneNumber/
│   ├── getUserList/
│   ├── printBack/
│   ├── printManage/
│   ├── queueManage/
│   ├── reservationManage/
│   ├── outdoorManage/
│   └── updateOrderStatus/
│
├── project.config.json
└── README.md
```

## 数据库集合

需要在云开发数据库中创建以下集合：

- `user`
- `dish`
- `dishCategory`
- `notice`
- `order`
- `printer`
- `rechargeOptions`
- `freeBuy`
- `shopInfo`
- `admin`
- `tableCode`
- `queue`
- `reservation`
- `outdoorGrill`

第一版开发阶段可以先使用自定义安全规则：

```json
{
  "read": true,
  "write": true
}
```

正式上线前应按用户身份、管理员身份和云函数调用范围收紧数据库权限。

## 云函数

需要在微信开发者工具中上传并部署以下云函数：

- `login`
- `getCategory`
- `doBuy`
- `pay`
- `pay_success`
- `get_code`
- `getPhoneNumber`
- `getUserList`
- `printBack`
- `printManage`
- `queueManage`
- `reservationManage`
- `outdoorManage`
- `updateOrderStatus`

上传方式：右键云函数目录，选择“上传并部署：云端安装依赖”。

## 本地配置

### 1. 配置云环境 ID

在 `miniprogram/app.js` 中把云环境占位替换为自己的云环境 ID：

```js
wx.cloud.init({
  env: '你的云环境ID',
  traceUser: true
})
```

同时检查各个云函数 `index.js` 中的：

```js
cloud.init({
  env: '填写你的环境ID'
})
```

把它替换为自己的云环境 ID，或者改成按当前云环境自动初始化的写法。

### 2. 配置小程序 AppID

仓库中的 `project.config.json` 使用 `touristappid`，避免公开仓库暴露真实 AppID。

本地开发时请在微信开发者工具中选择自己的小程序 AppID，或在本地私有配置里填写。不要把真实 AppID、AppSecret、商户号密钥、打印机密钥提交到 GitHub。

### 3. 配置微信支付

`cloudfunctions/pay/index.js` 中的商户号等配置需要替换为你自己的微信支付配置。正式项目中建议通过云函数环境变量或云开发安全配置管理敏感信息。

### 4. 配置打印机

`cloudfunctions/printManage/index.js` 保留打印机管理能力。打印机平台的 `appid`、`appsecret`、用户编号等信息不要写死并提交到仓库，建议使用环境变量或只保存在云函数线上配置中。

## 典型测试流程

1. 普通打开首页
2. 通过堂食桌码进入：`/pages/index/index?mode=dineIn&tableNumber=1`
3. 堂食点餐并提交订单
4. 通过户外二维码进入：`/pages/outdoor/outdoor?mode=outdoor&outdoorPointId=main`
5. 户外选择烤架并下单
6. 顾客排队取号
7. 顾客预约订座
8. 管理员确认线下付款
9. 管理员更新户外订单状态
10. 管理员管理烤架可用状态

## 安全说明

本仓库不应提交以下内容：

- 真实微信小程序 AppID
- AppSecret
- 微信支付商户密钥
- 打印机平台密钥
- 云环境访问密钥
- `node_modules`
- 本地私有配置文件

如果 GitHub 提示 secret scanning alert，请先从当前代码中移除相关内容，再到 GitHub 的 Security / Secret scanning 页面确认告警状态。已经暴露过的真实密钥应立即在对应平台撤销或轮换。

## 项目状态

当前版本是第一版 MVP，优先保证微信开发者工具可导入、可编译，并覆盖门店的核心点单、排队、预约和后台流程。
