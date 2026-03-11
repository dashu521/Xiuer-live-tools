// 预设互动话术库
export const PRESET_MESSAGES = {
  // 暖场话术
  warmup: [
    { content: '来了来了', weight: 1 },
    { content: '支持{主播/主播大大}', weight: 1 },
    { content: '今天直播{几点/什么时候}结束呀', weight: 1 },
    { content: '刚下班就赶来了', weight: 1 },
    { content: '终于等到开播了', weight: 1 },
  ],
  // 互动话术
  interaction: [
    { content: '666', weight: 2 },
    { content: '赞', weight: 2 },
    { content: '主播讲得太好了', weight: 1 },
    { content: '这个{产品/商品}怎么样', weight: 1 },
    { content: '有{优惠/活动}吗', weight: 1 },
    { content: '已拍，求{加急/尽快}发货', weight: 1 },
  ],
  // 提问话术
  question: [
    { content: '这个怎么用呀', weight: 1 },
    { content: '适合{什么/哪些}人群', weight: 1 },
    { content: '保质期{多久/多长时间}', weight: 1 },
    { content: '现在下单{多久/什么时候}能到', weight: 1 },
    { content: '还有{库存/货}吗', weight: 1 },
  ],
  // 情感话术
  emotion: [
    { content: '主播今天{好美/好帅}', weight: 1 },
    { content: '{喜欢/爱}了{喜欢/爱}了', weight: 1 },
    { content: '主播{声音/讲解}真好听', weight: 1 },
    { content: '{良心/宝藏}主播', weight: 1 },
    { content: '关注主播{好久/很久了}', weight: 1 },
  ],
  // 购买话术
  purchase: [
    { content: '已下单', weight: 1 },
    { content: '{买/拍}了{买/拍}了', weight: 1 },
    { content: '这个{价格/价位}很{划算/合适}', weight: 1 },
    { content: '{准备/打算}入手', weight: 1 },
    { content: '{推荐/安利}给{朋友/闺蜜}了', weight: 1 },
  ],
} as const

// 话术分类标签
export const MESSAGE_CATEGORIES = [
  { key: 'warmup', label: '暖场', description: '直播开始时的暖场话术' },
  { key: 'interaction', label: '互动', description: '直播过程中的互动话术' },
  { key: 'question', label: '提问', description: '询问商品相关问题' },
  { key: 'emotion', label: '情感', description: '表达对主播的支持和喜爱' },
  { key: 'purchase', label: '购买', description: '表达购买意向的话术' },
] as const

// 消息模板变量说明
export const MESSAGE_VARIABLES = [
  { variable: '{A/B}', description: '随机选择 A 或 B', example: '{你好/您好}' },
  { variable: '{streamer}', description: '主播名称', example: '支持{streamer}' },
  { variable: '{time}', description: '当前时间', example: '现在{time}了' },
  { variable: '{date}', description: '当前日期', example: '{date}直播' },
  { variable: '{random:1-10}', description: '随机数字', example: '第{random:1-100}名' },
] as const
