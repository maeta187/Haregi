// 気象庁 府県予報区マスタ
// validate-areas.mjs により 2026-07-19 に全 58 区分の実レスポンスから生成・検証済み。
//
// code:         府県予報区コード(user.areaCode・地域セレクタの値)
// forecastCode: 予報 JSON の取得コード(奄美・十勝のみ親区分に同居するため code と異なる。省略時は code)
// weatherArea:  短期予報の天気・降水確率を引く一次細分区域コード
// weeklyArea:   週間予報の天気・降水確率を引く区域コード(週間は広域統合されるため weatherArea と別)
// tempStation:  気温を引く代表アメダス地点コード(短期・週間の両方に存在することを検証済み)

export const areas = [
  { code: '100000', name: '群馬県', weatherArea: '100010', weeklyArea: '100000', tempStation: '42251' }, // 南部 / 週間:群馬県 / 前橋
  { code: '110000', name: '埼玉県', weatherArea: '110020', weeklyArea: '110000', tempStation: '43056' }, // 北部 / 週間:埼玉県 / 熊谷
  { code: '120000', name: '千葉県', weatherArea: '120010', weeklyArea: '120000', tempStation: '45148' }, // 北西部 / 週間:千葉県 / 銚子
  { code: '130000', name: '東京都', weatherArea: '130010', weeklyArea: '130010', tempStation: '44132' }, // 東京地方 / 週間:東京地方 / 東京
  { code: '140000', name: '神奈川県', weatherArea: '140010', weeklyArea: '140000', tempStation: '46106' }, // 東部 / 週間:神奈川県 / 横浜
  { code: '150000', name: '新潟県', weatherArea: '150010', weeklyArea: '150000', tempStation: '54232' }, // 下越 / 週間:新潟県 / 新潟
  { code: '160000', name: '富山県', weatherArea: '160010', weeklyArea: '160000', tempStation: '55102' }, // 東部 / 週間:富山県 / 富山
  { code: '170000', name: '石川県', weatherArea: '170010', weeklyArea: '170000', tempStation: '56227' }, // 加賀 / 週間:石川県 / 金沢
  { code: '180000', name: '福井県', weatherArea: '180010', weeklyArea: '180000', tempStation: '57066' }, // 嶺北 / 週間:福井県 / 福井
  { code: '190000', name: '山梨県', weatherArea: '190010', weeklyArea: '190000', tempStation: '49142' }, // 中・西部 / 週間:山梨県 / 甲府
  { code: '200000', name: '長野県', weatherArea: '200010', weeklyArea: '200000', tempStation: '48156' }, // 北部 / 週間:長野県 / 長野
  { code: '210000', name: '岐阜県', weatherArea: '210010', weeklyArea: '210000', tempStation: '52586' }, // 美濃地方 / 週間:岐阜県 / 岐阜
  { code: '220000', name: '静岡県', weatherArea: '220010', weeklyArea: '220000', tempStation: '50331' }, // 中部 / 週間:静岡県 / 静岡
  { code: '230000', name: '愛知県', weatherArea: '230010', weeklyArea: '230000', tempStation: '51106' }, // 西部 / 週間:愛知県 / 名古屋
  { code: '240000', name: '三重県', weatherArea: '240010', weeklyArea: '240000', tempStation: '53133' }, // 北中部 / 週間:三重県 / 津
  { code: '250000', name: '滋賀県', weatherArea: '250010', weeklyArea: '250000', tempStation: '60131' }, // 南部 / 週間:滋賀県 / 彦根
  { code: '260000', name: '京都府', weatherArea: '260010', weeklyArea: '260000', tempStation: '61286' }, // 南部 / 週間:京都府 / 京都
  { code: '270000', name: '大阪府', weatherArea: '270000', weeklyArea: '270000', tempStation: '62078' }, // 大阪府 / 週間:大阪府 / 大阪
  { code: '280000', name: '兵庫県', weatherArea: '280010', weeklyArea: '280000', tempStation: '63518' }, // 南部 / 週間:兵庫県 / 神戸
  { code: '290000', name: '奈良県', weatherArea: '290010', weeklyArea: '290000', tempStation: '64036' }, // 北部 / 週間:奈良県 / 奈良
  { code: '300000', name: '和歌山県', weatherArea: '300010', weeklyArea: '300000', tempStation: '65042' }, // 北部 / 週間:和歌山県 / 和歌山
  { code: '310000', name: '鳥取県', weatherArea: '310010', weeklyArea: '310000', tempStation: '69122' }, // 東部 / 週間:鳥取県 / 鳥取
  { code: '320000', name: '島根県', weatherArea: '320010', weeklyArea: '320000', tempStation: '68132' }, // 東部 / 週間:島根県 / 松江
  { code: '330000', name: '岡山県', weatherArea: '330010', weeklyArea: '330000', tempStation: '66408' }, // 南部 / 週間:岡山県 / 岡山
  { code: '340000', name: '広島県', weatherArea: '340010', weeklyArea: '340000', tempStation: '67437' }, // 南部 / 週間:広島県 / 広島
  { code: '350000', name: '山口県', weatherArea: '350010', weeklyArea: '350000', tempStation: '81428' }, // 西部 / 週間:山口県 / 下関
  { code: '360000', name: '徳島県', weatherArea: '360010', weeklyArea: '360000', tempStation: '71106' }, // 北部 / 週間:徳島県 / 徳島
  { code: '370000', name: '香川県', weatherArea: '370000', weeklyArea: '370000', tempStation: '72086' }, // 香川県 / 週間:香川県 / 高松
  { code: '380000', name: '愛媛県', weatherArea: '380010', weeklyArea: '380000', tempStation: '73166' }, // 中予 / 週間:愛媛県 / 松山
  { code: '390000', name: '高知県', weatherArea: '390010', weeklyArea: '390000', tempStation: '74182' }, // 中部 / 週間:高知県 / 高知
  { code: '400000', name: '福岡県', weatherArea: '400010', weeklyArea: '400000', tempStation: '82182' }, // 福岡地方 / 週間:福岡県 / 福岡
  { code: '410000', name: '佐賀県', weatherArea: '410010', weeklyArea: '410000', tempStation: '85142' }, // 南部 / 週間:佐賀県 / 佐賀
  { code: '420000', name: '長崎県', weatherArea: '420010', weeklyArea: '420000', tempStation: '84496' }, // 南部 / 週間:長崎県 / 長崎
  { code: '430000', name: '熊本県', weatherArea: '430010', weeklyArea: '430000', tempStation: '86141' }, // 熊本地方 / 週間:熊本県 / 熊本
  { code: '440000', name: '大分県', weatherArea: '440010', weeklyArea: '440000', tempStation: '83216' }, // 中部 / 週間:大分県 / 大分
  { code: '450000', name: '宮崎県', weatherArea: '450010', weeklyArea: '450000', tempStation: '87376' }, // 南部平野部 / 週間:宮崎県 / 宮崎
  { code: '460040', name: '奄美地方', weatherArea: '460040', weeklyArea: '460040', tempStation: '88837', forecastCode: '460100' }, // 奄美地方 / 週間:奄美地方 / 名瀬
  { code: '460100', name: '鹿児島県（奄美地方除く）', weatherArea: '460010', weeklyArea: '460100', tempStation: '88317' }, // 薩摩地方 / 週間:鹿児島県（奄美地方除く） / 鹿児島
  { code: '471000', name: '沖縄本島地方', weatherArea: '471010', weeklyArea: '471000', tempStation: '91197' }, // 本島中南部 / 週間:沖縄本島地方 / 那覇
  { code: '472000', name: '大東島地方', weatherArea: '472000', weeklyArea: '472000', tempStation: '92011' }, // 大東島地方 / 週間:大東島地方 / 南大東
  { code: '473000', name: '宮古島地方', weatherArea: '473000', weeklyArea: '473000', tempStation: '93041' }, // 宮古島地方 / 週間:宮古島地方 / 宮古島
  { code: '474000', name: '八重山地方', weatherArea: '474010', weeklyArea: '474000', tempStation: '94081' }, // 石垣島地方 / 週間:八重山地方 / 石垣島
  { code: '011000', name: '宗谷地方', weatherArea: '011000', weeklyArea: '011000', tempStation: '11016' }, // 宗谷地方 / 週間:宗谷地方 / 稚内
  { code: '012000', name: '上川・留萌地方', weatherArea: '012010', weeklyArea: '012000', tempStation: '12442' }, // 上川地方 / 週間:上川・留萌地方 / 旭川
  { code: '013000', name: '網走・北見・紋別地方', weatherArea: '013010', weeklyArea: '013000', tempStation: '17341' }, // 網走地方 / 週間:網走・北見・紋別地方 / 網走
  { code: '014030', name: '十勝地方', weatherArea: '014030', weeklyArea: '014030', tempStation: '20432', forecastCode: '014100' }, // 十勝地方 / 週間:十勝地方 / 帯広
  { code: '014100', name: '釧路・根室地方', weatherArea: '014020', weeklyArea: '014100', tempStation: '19432' }, // 釧路地方 / 週間:釧路・根室地方 / 釧路
  { code: '015000', name: '胆振・日高地方', weatherArea: '015010', weeklyArea: '015000', tempStation: '21323' }, // 胆振地方 / 週間:胆振・日高地方 / 室蘭
  { code: '016000', name: '石狩・空知・後志地方', weatherArea: '016010', weeklyArea: '016000', tempStation: '14163' }, // 石狩地方 / 週間:石狩・空知・後志地方 / 札幌
  { code: '017000', name: '渡島・檜山地方', weatherArea: '017010', weeklyArea: '017000', tempStation: '23232' }, // 渡島地方 / 週間:渡島・檜山地方 / 函館
  { code: '020000', name: '青森県', weatherArea: '020010', weeklyArea: '020010', tempStation: '31312' }, // 津軽 / 週間:津軽 / 青森
  { code: '030000', name: '岩手県', weatherArea: '030010', weeklyArea: '030010', tempStation: '33431' }, // 内陸 / 週間:内陸 / 盛岡
  { code: '040000', name: '宮城県', weatherArea: '040010', weeklyArea: '040010', tempStation: '34392' }, // 東部 / 週間:東部 / 仙台
  { code: '050000', name: '秋田県', weatherArea: '050010', weeklyArea: '050000', tempStation: '32402' }, // 沿岸 / 週間:秋田県 / 秋田
  { code: '060000', name: '山形県', weatherArea: '060010', weeklyArea: '060000', tempStation: '35426' }, // 村山 / 週間:山形県 / 山形
  { code: '070000', name: '福島県', weatherArea: '070010', weeklyArea: '070100', tempStation: '36127' }, // 中通り / 週間:中通り・浜通り / 福島
  { code: '080000', name: '茨城県', weatherArea: '080010', weeklyArea: '080000', tempStation: '40201' }, // 北部 / 週間:茨城県 / 水戸
  { code: '090000', name: '栃木県', weatherArea: '090010', weeklyArea: '090000', tempStation: '41277' }, // 南部 / 週間:栃木県 / 宇都宮
] as const

export type Area = (typeof areas)[number]
export type AreaCode = Area['code']
