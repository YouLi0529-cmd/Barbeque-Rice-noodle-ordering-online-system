const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

const CATEGORY_NAMES = [
  '\u660e\u661f\u70e4\u8089',
  '\u5f20\u5357\u62db\u724c',
  '\u5f20\u5357\u539f\u5207',
  '\u5305\u8089\u642d\u5b50',
  '\u852c\u83dc',
  '\u719f\u98df',
  '\u4e3b\u98df',
  '\u751c\u54c1\u996e\u6599',
  '\u8d35\u5dde\u51b0\u6d46',
  '\u96ea\u51b0'
]

const CAMPING_CATEGORY_NAMES = [
  '\u70e4\u67b6',
  '\u9732\u8425\u7528\u54c1',
  '\u5f20\u5357\u62db\u724c',
  '\u660e\u661f\u70e4\u8089',
  '\u5305\u8089\u642d\u5b50',
  '\u725b\u8089',
  '\u732a\u8089',
  '\u7d20\u83dc',
  '\u9521\u7eb8\u7c7b',
  '\u5c0f\u6599\u533a'
]

const SUGAR_OPTIONS = ['\u65e0\u7cd6', '\u5fae\u7cd6', '\u6b63\u5e38\u7cd6']
const SUGAR_NOTE = '\u65e0\u7cd6\u6307\u7684\u662f\u4e0d\u989d\u5916\u52a0\u7cd6'
const HEAT_OPTIONS = ['\u51b7', '\u70ed']

function heatGroup(options = HEAT_OPTIONS, note = '') {
  return {
    id: 'temperature',
    title: '\u70ed\u5ea6',
    options,
    note
  }
}

function sugarDish(name, price, sort, optionGroups = []) {
  return {
    name,
    price,
    sort,
    needSpec: true,
    flavorTitle: '\u7cd6\u5ea6',
    flavorOptions: SUGAR_OPTIONS,
    flavorNote: SUGAR_NOTE,
    optionGroups
  }
}

const DISH_SEEDS = {
  '\u660e\u661f\u70e4\u8089': [
    {
      name: '\u9c9c\u867e',
      price: 30,
      sort: 1,
      needSpec: true
    },
    {
      name: '\u9ebb\u8fa3\u8106\u8106\u9aa8',
      price: 30,
      sort: 2,
      needSpec: true
    },
    {
      name: '\u829d\u58eb\u8774\u8776\u867e',
      price: 28,
      sort: 3,
      needSpec: false
    },
    {
      name: '\u5364\u9e21\u722a',
      price: 26,
      sort: 4,
      needSpec: true
    },
    {
      name: '\u9c7f\u9c7c\u987b',
      price: 30,
      sort: 5,
      needSpec: true
    },
    {
      name: '\u65b0\u897f\u5170\u80f8\u53e3\u6cb9',
      price: 20,
      sort: 6,
      needSpec: false
    },
    {
      name: '\u7fc5\u4e2d',
      price: 26,
      sort: 7,
      needSpec: true
    },
    {
      name: '\u79d8\u5236\u9e21\u76ae',
      price: 19,
      sort: 8,
      needSpec: true
    },
    {
      name: '\u7279\u8272\u5c0f\u8c46\u8150',
      price: 15,
      sort: 9,
      needSpec: false
    },
    {
      name: '\u5496\u55b1\u9e21\u67f3',
      price: 18,
      sort: 10,
      needSpec: false
    },
    {
      name: '\u58a8\u9c7c\u80a0\u5757',
      price: 23,
      sort: 11,
      needSpec: true
    },
    {
      name: '\u97e9\u5f0f\u98ce\u5e72\u80a0',
      price: 30,
      sort: 12,
      needSpec: false
    },
    {
      name: '\u5927\u5200\u8170\u7247',
      price: 30,
      sort: 13,
      needSpec: true
    },
    {
      name: '\u9c9c\u5364\u80a5\u80a0',
      price: 30,
      sort: 14,
      needSpec: true
    },
    {
      name: '\u8089\u591a\u591a\u70ed\u72d7\u80a0',
      price: 26,
      sort: 15,
      needSpec: true
    },
    {
      name: '\u738b\u4e2d\u738b\u706b\u817f\u80a0',
      price: 16,
      sort: 16,
      needSpec: true
    },
    {
      name: '\u751c\u80a0',
      price: 16,
      sort: 17,
      needSpec: true
    },
    {
      name: '\u9c7c\u6392',
      price: 16,
      sort: 18,
      needSpec: true
    }
  ],
  '\u5f20\u5357\u62db\u724c': [
    {
      name: '\u8584\u5207\u4e94\u82b1\u8089',
      price: 25,
      sort: 1,
      needSpec: true
    },
    {
      name: '\u6cf0\u5f0f\u51ac\u9634\u529f',
      price: 38,
      sort: 2,
      needSpec: false
    },
    {
      name: '\u9f50\u9f50\u54c8\u5c14\u62cc\u725b\u8089',
      price: 28,
      sort: 3,
      needSpec: true,
      description: '\u8584\u8377\u3001\u8334\u9999\u3001\u9178\u83dc\u3001\u70e7\u6912'
    },
    {
      name: '\u4f0a\u6bd4\u5229\u4e9a\u8334\u9999\u9ed1\u732a\u8089',
      price: 28,
      sort: 4,
      needSpec: false
    },
    {
      name: '\u70e4\u69b4\u83b2',
      price: 15,
      sort: 5,
      needSpec: false
    },
    {
      name: '\u4e00\u7897\u5305\u8c37\u7c91',
      price: 18,
      sort: 6,
      needSpec: false
    },
    {
      name: '\u897f\u65d7\u7f8a\u7f94\u8089',
      price: 28,
      sort: 7,
      needSpec: false
    },
    {
      name: '\u5927\u51c9\u5c71\u5c0f\u9999\u732a\u8089',
      price: 35,
      sort: 8,
      needSpec: true
    },
    {
      name: '\u96ea\u82b1\u725b\u8089\u7c92',
      price: 25,
      sort: 9,
      needSpec: true
    },
    {
      name: '\u5916\u5a46\u5bb6\u7684\u9178\u6e23\u8089',
      price: 26,
      sort: 10,
      needSpec: false
    },
    {
      name: '\u73b0\u5207\u725b\u4e94\u82b1',
      price: 30,
      sort: 11,
      needSpec: true
    },
    {
      name: '\u5ae9\u6ed1\u725b\u8089\u7247',
      price: 25,
      sort: 12,
      needSpec: true
    },
    {
      name: '\u849c\u9999\u6392\u9aa8',
      price: 30,
      sort: 13,
      needSpec: false
    },
    {
      name: '\u5305\u6d46\u8c46\u8150',
      price: 20,
      sort: 14,
      needSpec: false
    },
    {
      name: '\u624b\u5de5\u82d5\u76ae',
      price: 16,
      sort: 15,
      needSpec: true
    },
    {
      name: '\u638c\u4e2d\u5b9d',
      price: 30,
      sort: 16,
      needSpec: true
    },
    {
      name: '\u65e0\u654c\u5c0f\u80a0',
      price: 30,
      sort: 17,
      needSpec: true
    },
    {
      name: '\u6728\u59dc\u5b50\u9e21\u817f\u8089',
      price: 22,
      sort: 18,
      needSpec: true,
      flavorOptions: ['\u5c11\u6728\u59dc\u5b50', '\u6b63\u5e38\u6728\u59dc\u5b50', '\u591a\u6728\u59dc\u5b50']
    },
    {
      name: '\u7cef\u7c73\u80a0\u5757',
      price: 20,
      sort: 19,
      needSpec: true
    }
  ],
  '\u5f20\u5357\u539f\u5207': [
    {
      name: '\u539f\u5207\u516d\u5bab\u683c',
      price: 78,
      sort: 1,
      needSpec: false,
      description: '\u96ea\u82b1\u725b\u8089\u7c92\u3001\u725b\u808b\u6761\u3001\u8584\u5207\u4e94\u82b1\u8089\u3001\u9e21\u67f3\u3001\u98ce\u5e72\u80a0\u3001\u7cef\u7c73\u80a0'
    },
    {
      name: '\u539f\u5207\u725b\u808b\u6761',
      price: 28,
      sort: 2,
      needSpec: false
    },
    {
      name: '\u725b\u4ed4\u9aa8',
      price: 28,
      sort: 3,
      needSpec: false
    },
    {
      name: '\u9ec4\u6cb9\u6a2a\u8188\u819c',
      price: 28,
      sort: 4,
      needSpec: false
    },
    {
      name: '\u6218\u65a7\u5c0f\u7f8a\u6392',
      price: 7,
      sort: 5,
      needSpec: false,
      description: '\u4e24\u4e2a\u8d77\u5356',
      minOrderCount: 2
    },
    {
      name: '\u9ed1\u6912\u725b\u6392',
      price: 15,
      sort: 6,
      needSpec: false
    }
  ],
  '\u5305\u8089\u642d\u5b50': [
    {
      name: '\u751f\u83dc',
      price: 6,
      sort: 1,
      needSpec: false
    },
    {
      name: '\u5c0f\u8584\u997c',
      price: 10,
      sort: 2,
      needSpec: false
    },
    {
      name: '\u83e0\u841d\u7247',
      price: 10,
      sort: 3,
      needSpec: false
    },
    {
      name: '\u7cd6\u5fc3\u82f9\u679c\u7247',
      price: 6,
      sort: 4,
      needSpec: false
    }
  ],
  '\u852c\u83dc': [
    {
      name: '\u7d20\u83dc\u62fc\u76d8',
      price: 18,
      sort: 1,
      needSpec: true,
      description: '\u85d5\u7247\u3001\u571f\u8c46\u7247\u3001\u97ed\u83dc\u3001\u91d1\u9488\u83c7'
    },
    {
      name: '\u85d5\u7247',
      price: 8,
      sort: 2,
      needSpec: true
    },
    {
      name: '\u571f\u8c46\u7247',
      price: 8,
      sort: 3,
      needSpec: true
    },
    {
      name: '\u97ed\u83dc',
      price: 8,
      sort: 4,
      needSpec: true
    },
    {
      name: '\u91d1\u9488\u83c7',
      price: 8,
      sort: 5,
      needSpec: true
    },
    {
      name: '\u5927\u767d\u8c46',
      price: 20,
      sort: 6,
      needSpec: true
    },
    {
      name: '\u849c\u84c9\u53e3\u8611',
      price: 16,
      sort: 7,
      needSpec: false
    },
    {
      name: '\u9ec4\u6cb9\u849c\u9999\u9762\u5305\u7247',
      price: 15,
      sort: 8,
      needSpec: false
    },
    {
      name: '\u829d\u58eb\u5e74\u7cd5',
      price: 15,
      sort: 9,
      needSpec: false
    },
    {
      name: '\u6912\u76d0\u571f\u8c46\u7403',
      price: 12,
      sort: 10,
      needSpec: false
    },
    {
      name: '\u9999\u83c7',
      price: 10,
      sort: 11,
      needSpec: true
    },
    {
      name: '\u9b54\u828b',
      price: 8,
      sort: 12,
      needSpec: true
    },
    {
      name: '\u8584\u8c46\u5e72',
      price: 8,
      sort: 13,
      needSpec: true
    },
    {
      name: '\u8304\u7247',
      price: 8,
      sort: 14,
      needSpec: true
    },
    {
      name: '\u8d1d\u8d1d\u5357\u74dc',
      price: 10,
      sort: 15,
      needSpec: true
    }
  ],
  '\u719f\u98df': [
    {
      name: '\u7edd\u5473\u82b1\u751f\u7c73',
      price: 12,
      sort: 1,
      needSpec: false
    },
    {
      name: '\u51c9\u62cc\u9cab\u9c7c',
      price: 29,
      sort: 2,
      needSpec: true
    },
    {
      name: '\u70e4\u8111\u82b1',
      price: 16,
      sort: 3,
      needSpec: true
    },
    {
      name: '\u70e4\u7c73\u8c46\u8150',
      price: 15,
      sort: 4,
      needSpec: true
    },
    {
      name: '\u70e4\u8c46\u82b1',
      price: 15,
      sort: 5,
      needSpec: true
    },
    {
      name: '\u70e4\u706b\u9505\u82d5\u7c89',
      price: 15,
      sort: 6,
      needSpec: true
    },
    {
      name: '\u829d\u58eb\u7389\u7c73',
      price: 15,
      sort: 7,
      needSpec: false
    },
    {
      name: '\u8471\u5fc3\u8c46\u5e72',
      price: 15,
      sort: 8,
      needSpec: false
    },
    {
      name: '\u82a5\u672b\u9ec4\u74dc\u6761',
      price: 10,
      sort: 9,
      needSpec: true,
      flavorOptions: ['\u5c11\u82a5\u672b', '\u6b63\u5e38\u82a5\u672b']
    },
    {
      name: '\u867e\u7247',
      price: 10,
      sort: 10,
      needSpec: true
    }
  ],
  '\u4e3b\u98df': [
    {
      name: '\u9ec4\u91d1\u86cb\u7092\u996d',
      price: 15,
      sort: 1,
      needSpec: false
    },
    {
      name: '\u87ba\u86f3\u7c89\u7092\u996d',
      price: 16,
      sort: 2,
      needSpec: true,
      flavorOptions: ['\u5fae\u8fa3', '\u6b63\u5e38', '\u52a0\u8fa3']
    },
    {
      name: '\u6ca1\u5403\u8fc7\u7684\u5916\u5a46\u7092\u996d',
      price: 15,
      sort: 3,
      needSpec: false
    },
    {
      name: '\u64c2\u6912\u76ae\u86cb\u62cc\u996d',
      price: 22,
      sort: 4,
      needSpec: false
    },
    {
      name: '\u714e\u997a\uff088\u4e2a\uff09',
      price: 16,
      sort: 5,
      needSpec: false
    },
    {
      name: '\u5c71\u6942\u5c0f\u82f9\u679c\uff088\u4e2a\uff09',
      price: 16,
      sort: 6,
      needSpec: false
    },
    {
      name: '\u6a31\u82b1\u7cd5\uff088\u4e2a\uff09',
      price: 16,
      sort: 7,
      needSpec: false
    },
    {
      name: '\u54b8\u86cb\u9ec4\u867e\u7403',
      price: 22,
      sort: 8,
      needSpec: false
    }
  ],
  '\u751c\u54c1\u996e\u6599': [
    sugarDish('\u6c34\u679c\u8336', 16, 1),
    sugarDish('\u6768\u679d\u7518\u9732\u51b0\u6c99\u828b\u5706', 15, 2),
    sugarDish('\u6842\u82b1\u6930\u9999\u51b0\u8c46\u82b1', 15, 3),
    sugarDish('\u6843\u80f6\u96ea\u71d5\u7096\u5976', 15, 4, [heatGroup()]),
    sugarDish('\u6728\u85af\u5927\u6ee1\u8d2f', 16, 5, [heatGroup()]),
    sugarDish('\u9ed1\u7cd6\u73cd\u73e0\u725b\u4e73', 12, 6, [heatGroup()]),
    sugarDish('\u624b\u6253\u6e23\u7537\u7eff\u8336', 8, 7),
    sugarDish('\u767e\u9999\u679c\u53cc\u54cd\u70ae', 8, 8),
    sugarDish('\u6842\u5706\u7ea2\u67a3\u5976\u8336', 8, 9, [heatGroup()]),
    sugarDish('\u5c0f\u540a\u68a8\u6c64', 8, 10, [heatGroup()]),
    sugarDish('\u6842\u82b1\u9178\u6885\u6c64', 6, 11, [heatGroup()]),
    sugarDish('\u7ea2\u7cd6\u6c64\u5706', 6, 12, [heatGroup(['\u70ed'], '\u53ea\u6709\u70ed')])
  ],
  '\u8d35\u5dde\u51b0\u6d46': [
    sugarDish('\u9752\u63d0', 10, 1),
    sugarDish('\u8292\u679c', 10, 2),
    sugarDish('\u706b\u9f99\u679c', 10, 3),
    sugarDish('\u9ec4\u74dc', 10, 4),
    sugarDish('\u8349\u8393\u5c71\u6942', 10, 5)
  ],
  '\u96ea\u51b0': [
    sugarDish('\u8349\u8393\u62b9\u8336\u96ea\u5c71\u51b0', 15, 1),
    sugarDish('\u51ac\u65e5\u9752\u63d0\u96ea\u5c71\u51b0', 15, 2),
    sugarDish('\u8292\u679c\u96ea\u5c71\u51b0', 15, 3),
    sugarDish('\u6768\u6885\u51b0\u6c64\u5706', 15, 4)
  ]
}

const CAMPING_MOVED_SOURCE_NAMES = [
  '\u849c\u9999\u6392\u9aa8',
  '\u8089\u591a\u591a\u70ed\u72d7\u80a0',
  '\u9c9c\u5364\u80a5\u80a0',
  '\u9ebb\u8fa3\u8106\u8106\u9aa8',
  '\u5927\u5200\u8170\u7247',
  '\u7cef\u7c73\u80a0\u5757',
  '\u5ae9\u6ed1\u725b\u8089\u7247',
  '\u96ea\u82b1\u725b\u8089\u7c92',
  '\u539f\u5207\u725b\u808b\u6761',
  '\u73b0\u5207\u725b\u4e94\u82b1',
  '\u9ed1\u6912\u725b\u6392',
  '\u725b\u4ed4\u9aa8'
]

function findDishSeed(name) {
  for (const categoryName of Object.keys(DISH_SEEDS)) {
    const dish = DISH_SEEDS[categoryName].find(item => item.name === name)
    if (dish) {
      return dish
    }
  }
  return null
}

function copyDishSeed(name, sort, displayName = name) {
  const dish = findDishSeed(name)
  if (!dish) {
    return null
  }

  return {
    ...dish,
    name: displayName,
    sort
  }
}

function copyCampingCategory(categoryName) {
  return (DISH_SEEDS[categoryName] || [])
    .filter(dish => !CAMPING_MOVED_SOURCE_NAMES.includes(dish.name))
    .map((dish, index) => ({
      ...dish,
      sort: index + 1
    }))
}

const CAMPING_DISH_SEEDS = {
  '\u70e4\u67b6': [
    {
      name: '\u78b3\u70e4\u67b6',
      price: 50,
      sort: 1,
      needSpec: false,
      description: '\u78b3\u9700\u5355\u72ec\u8d2d\u4e70\uff0c\u5b9e\u4ed8\u6ee1188\u914d\u8db3\u91cf\u78b3\uff0c\u67b6\u5b50\u9700\u8981\u5f52\u8fd8',
      quantityMode: 'single',
      maxOrderCount: 1,
      exclusiveGroup: 'camping_grill',
      returnRequired: true
    },
    {
      name: '\u5361\u5f0f\u7089',
      price: 50,
      sort: 2,
      needSpec: false,
      description: '\u914d\u8db3\u91cf\u6c14\u74f6\uff0c\u9700\u8981\u5f52\u8fd8',
      quantityMode: 'single',
      maxOrderCount: 1,
      freeThreshold: 188,
      exclusiveGroup: 'camping_grill',
      returnRequired: true
    },
    {
      name: '\u7535\u70e4\u76d8',
      price: 50,
      sort: 3,
      needSpec: false,
      description: '\u4e0d\u9700\u8981\u6362',
      quantityMode: 'single',
      maxOrderCount: 1,
      freeThreshold: 188,
      exclusiveGroup: 'camping_grill',
      returnRequired: true
    }
  ],
  '\u9732\u8425\u7528\u54c1': [
    {
      name: '\u4e00\u6b21\u6027\u7897',
      price: 0,
      sort: 1,
      needSpec: false
    },
    {
      name: '\u7b77\u5b50',
      price: 0,
      sort: 2,
      needSpec: false
    },
    {
      name: '\u676f\u5b50',
      price: 0,
      sort: 3,
      needSpec: false
    },
    {
      name: '\u6905\u5b50',
      price: 0,
      sort: 4,
      needSpec: false,
      description: '\u9700\u8981\u5f52\u8fd8',
      returnRequired: true
    },
    {
      name: '\u684c\u5b50',
      price: 0,
      sort: 5,
      needSpec: false,
      description: '\u9700\u8981\u5f52\u8fd8',
      returnRequired: true
    },
    {
      name: '\u5927\u74f6\u996e\u6599',
      price: 0,
      sort: 6,
      needSpec: false,
      description: '\u6839\u636e\u83dc\u54c1\u6570\u91cf\u63d0\u4f9b',
      quantityMode: 'single',
      maxOrderCount: 1
    }
  ],
  '\u5f20\u5357\u62db\u724c': copyCampingCategory('\u5f20\u5357\u62db\u724c'),
  '\u660e\u661f\u70e4\u8089': copyCampingCategory('\u660e\u661f\u70e4\u8089'),
  '\u5305\u8089\u642d\u5b50': [
    copyDishSeed('\u5c0f\u8584\u997c', 1),
    copyDishSeed('\u751f\u83dc', 2),
    copyDishSeed('\u83e0\u841d\u7247', 3)
  ].filter(Boolean),
  '\u732a\u8089': [
    copyDishSeed('\u849c\u9999\u6392\u9aa8', 1, '\u849c\u9999\u5927\u6392\u9aa8'),
    copyDishSeed('\u8089\u591a\u591a\u70ed\u72d7\u80a0', 2),
    copyDishSeed('\u9c9c\u5364\u80a5\u80a0', 3),
    copyDishSeed('\u9ebb\u8fa3\u8106\u8106\u9aa8', 4, '\u9ebb\u8fa3\u8f6f\u8106\u9aa8'),
    copyDishSeed('\u5927\u5200\u8170\u7247', 5),
    copyDishSeed('\u7cef\u7c73\u80a0\u5757', 6)
  ].filter(Boolean),
  '\u725b\u8089': [
    copyDishSeed('\u5ae9\u6ed1\u725b\u8089\u7247', 1),
    copyDishSeed('\u96ea\u82b1\u725b\u8089\u7c92', 2),
    copyDishSeed('\u539f\u5207\u725b\u808b\u6761', 3),
    copyDishSeed('\u73b0\u5207\u725b\u4e94\u82b1', 4, '\u79d8\u5236\u725b\u4e94\u82b1'),
    copyDishSeed('\u9ed1\u6912\u725b\u6392', 5, '\u539f\u5207\u725b\u6392'),
    copyDishSeed('\u725b\u4ed4\u9aa8', 6, '\u9ed1\u6912\u725b\u4ed4\u9aa8')
  ].filter(Boolean),
  '\u7d20\u83dc': [
    copyDishSeed('\u85d5\u7247', 1),
    copyDishSeed('\u8304\u7247', 2),
    copyDishSeed('\u849c\u84c9\u53e3\u8611', 3),
    copyDishSeed('\u571f\u8c46\u7247', 4),
    copyDishSeed('\u9999\u83c7', 5),
    copyDishSeed('\u8471\u5fc3\u8c46\u5e72', 6),
    copyDishSeed('\u97ed\u83dc', 7),
    copyDishSeed('\u5927\u767d\u8c46', 8),
    copyDishSeed('\u91d1\u9488\u83c7', 9),
    copyDishSeed('\u82a5\u672b\u9ec4\u74dc\u6761', 10, '\u82a5\u672b\u9ec4\u74dc'),
    {
      name: '\u8001\u5357\u74dc',
      price: 8,
      sort: 11,
      needSpec: true
    },
    {
      name: '\u6cb9\u9165\u82b1\u751f\u7c73',
      price: 10,
      sort: 12,
      needSpec: false
    },
    {
      name: '\u6d0b\u8471',
      price: 8,
      sort: 13,
      needSpec: true
    },
    copyDishSeed('\u8584\u8c46\u5e72', 14),
    copyDishSeed('\u9ec4\u6cb9\u849c\u9999\u9762\u5305\u7247', 15),
    copyDishSeed('\u9b54\u828b', 16),
    copyDishSeed('\u829d\u58eb\u5e74\u7cd5', 17),
    {
      name: '\u6912\u76d0\u5c0f\u571f\u8c46',
      price: 12,
      sort: 18,
      needSpec: false
    }
  ].filter(Boolean),
  '\u9521\u7eb8\u7c7b': [
    {
      name: '\u9521\u7eb8\u8111\u82b1',
      price: 18,
      sort: 1,
      needSpec: true
    },
    {
      name: '\u9521\u7eb8\u706b\u9505\u82d5\u7c89',
      price: 15,
      sort: 2,
      needSpec: true
    },
    {
      name: '\u9521\u7eb8\u8c46\u82b1',
      price: 15,
      sort: 3,
      needSpec: true
    },
    {
      name: '\u9521\u7eb8\u7c73\u8c46\u8150',
      price: 15,
      sort: 4,
      needSpec: true
    },
    {
      name: '\u829d\u58eb\u7389\u7c73',
      price: 15,
      sort: 5,
      needSpec: true
    },
    {
      name: '\u9521\u7eb8\u9cab\u9c7c',
      price: 29,
      sort: 6,
      needSpec: true
    }
  ].filter(Boolean),
  '\u5c0f\u6599\u533a': [
    {
      name: '\u79d8\u5236\u8fa3\u6912\u9762',
      price: 3,
      sort: 1,
      needSpec: false
    },
    {
      name: '\u9ec4\u8c46\u9762',
      price: 3,
      sort: 2,
      needSpec: false
    },
    {
      name: '\u79d8\u5236\u4e94\u9999\u9762',
      price: 3,
      sort: 3,
      needSpec: false
    }
  ].filter(Boolean)
}

function getMenuConfig(menuType) {
  if (menuType === 'camping') {
    return {
      menuType: 'camping',
      categoryNames: CAMPING_CATEGORY_NAMES,
      dishSeeds: CAMPING_DISH_SEEDS
    }
  }

  return {
    menuType: 'dineIn',
    categoryNames: CATEGORY_NAMES,
    dishSeeds: DISH_SEEDS
  }
}

function getCategorySort(category, menuConfig) {
  if (category && typeof category.sort === 'number') {
    return category.sort
  }

  const index = menuConfig.categoryNames.indexOf(category && category.name)
  return index >= 0 ? index + 1 : 9999
}

function pickCategoryCandidate(current, candidate, menuConfig) {
  if (!current) {
    return candidate
  }

  const currentExact = current.menuType === menuConfig.menuType
  const candidateExact = candidate.menuType === menuConfig.menuType
  if (currentExact !== candidateExact) {
    return candidateExact ? candidate : current
  }

  const currentActive = current.status !== 0
  const candidateActive = candidate.status !== 0
  if (currentActive !== candidateActive) {
    return candidateActive ? candidate : current
  }

  return getCategorySort(candidate, menuConfig) < getCategorySort(current, menuConfig)
    ? candidate
    : current
}

function buildDishSpecData(dish) {
  const needSpec = dish.needSpec !== false

  return {
    needSpec,
    flavorTitle: dish.flavorTitle || '\u53e3\u5473',
    flavorOptions: needSpec
      ? (dish.flavorOptions || ['\u4e0d\u8fa3', '\u5fae\u8fa3', '\u6b63\u5e38\u8fa3'])
      : [],
    flavorNote: dish.flavorNote || '',
    optionGroups: dish.optionGroups || [],
    tags: []
  }
}

async function syncDishes(category, menuConfig, options = {}) {
  const specOnly = options.specOnly === true
  const dishes = menuConfig.dishSeeds[category.name]
  if (!dishes || dishes.length === 0) {
    return
  }

  const dishNames = dishes.map(item => item.name)
  const dishWhere = {
    categoryId: category._id,
    name: _.in(dishNames)
  }

  if (menuConfig.menuType === 'camping') {
    dishWhere.menuType = 'camping'
  } else {
    dishWhere.menuType = _.neq('camping')
  }

  const dishRes = await db.collection('dish')
    .where(dishWhere)
    .get()

  const existingByName = {}
  ;(dishRes.data || []).forEach(item => {
    if (!existingByName[item.name]) {
      existingByName[item.name] = item
    }
  })

  await Promise.all(dishes.map(async dish => {
    const existing = existingByName[dish.name]
    const specData = buildDishSpecData(dish)
    const dishData = {
      name: dish.name,
      price: dish.price,
      originalPrice: dish.price,
      description: dish.description || '',
      categoryId: category._id,
      categoryName: category.name,
      menuType: menuConfig.menuType,
      image: existing && existing.image ? existing.image : '',
      status: 1,
      ...specData,
      minOrderCount: dish.minOrderCount || 1,
      maxOrderCount: dish.maxOrderCount || 0,
      quantityMode: dish.quantityMode || '',
      exclusiveGroup: dish.exclusiveGroup || '',
      freeThreshold: dish.freeThreshold || 0,
      returnRequired: !!dish.returnRequired,
      sort: dish.sort,
      updateTime: new Date()
    }

    if (existing) {
      await db.collection('dish').doc(existing._id).update({
        data: specOnly
          ? {
              ...specData,
              updateTime: new Date()
            }
          : dishData
      })
    } else {
      await db.collection('dish').add({
        data: {
          ...dishData,
          createTime: new Date()
        }
      })
    }
  }))

  if (menuConfig.menuType === 'camping' && !specOnly) {
    const allDishRes = await db.collection('dish')
      .where({
        categoryId: category._id,
        menuType: 'camping'
      })
      .limit(100)
      .get()

    const removedDishes = (allDishRes.data || [])
      .filter(item => !dishNames.includes(item.name) && item.status !== 0)

    await Promise.all(removedDishes.map(item => db.collection('dish').doc(item._id).update({
      data: {
        status: 0,
        updateTime: new Date()
      }
    })))
  }
}

exports.main = async (event = {}) => {
  try {
    const shouldSync = event && event.sync === true
    const specOnly = shouldSync && event && event.specOnly === true
    const menuConfig = getMenuConfig(event && event.menuType === 'camping' ? 'camping' : 'dineIn')
    const syncCategoryNames = Array.isArray(event.categoryNames)
      ? event.categoryNames
      : (event.categoryName ? [event.categoryName] : [])
    const categoryWhere = {
      name: _.in(menuConfig.categoryNames),
      menuType: menuConfig.menuType === 'camping' ? 'camping' : _.neq('camping')
    }

    const categoryRes = await db.collection('dishCategory')
      .where(categoryWhere)
      .get()

    const existingByName = {}
    ;(categoryRes.data || []).forEach(item => {
      existingByName[item.name] = pickCategoryCandidate(existingByName[item.name], item, menuConfig)
    })

    const data = []

    if (!shouldSync) {
      const list = menuConfig.categoryNames
        .map(name => existingByName[name])
        .filter(item => item && item.status !== 0)
        .map(item => ({
          ...item,
          sort: getCategorySort(item, menuConfig),
          menuType: item.menuType || menuConfig.menuType
        }))
        .sort((a, b) => {
          return getCategorySort(a, menuConfig) - getCategorySort(b, menuConfig)
        })

      return {
        success: true,
        data: list
      }
    }

    for (let index = 0; index < menuConfig.categoryNames.length; index++) {
      const name = menuConfig.categoryNames[index]
      const sort = index + 1
      const existing = existingByName[name]

      if (existing) {
        if (existing.sort !== sort || existing.status !== 1) {
          await db.collection('dishCategory').doc(existing._id).update({
            data: {
              sort,
              status: 1,
              menuType: menuConfig.menuType,
              updateTime: new Date()
            }
          })
        }
        data.push({
          ...existing,
          sort,
          status: 1,
          menuType: menuConfig.menuType
        })
      } else {
        const addRes = await db.collection('dishCategory').add({
          data: {
            name,
            sort,
            status: 1,
            menuType: menuConfig.menuType,
            createTime: new Date(),
            updateTime: new Date()
          }
        })

        data.push({
          _id: addRes._id,
          name,
          sort,
          status: 1
        })
      }
    }

    const syncTargets = syncCategoryNames.length > 0
      ? data.filter(category => syncCategoryNames.includes(category.name))
      : data

    await Promise.all(syncTargets.map(category => syncDishes(category, menuConfig, { specOnly })))

    return {
      success: true,
      data,
      syncedCategoryNames: syncTargets.map(category => category.name),
      specOnly
    }
  } catch (err) {
    console.error('getCategory failed', err)
    return {
      success: false,
      data: [],
      message: err.message || '获取菜品分类失败'
    }
  }
}
