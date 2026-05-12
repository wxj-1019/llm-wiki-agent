---
title: "实战｜Tushare 量化数据接口入门到实操，A股数据一键获取"
type: source
tags: []
date: 2026-05-12
source_url: "https://blog.csdn.net/m0_73639126/article/details/158320981"
author: "M"
sitename: "blog.csdn.net"
published: "2026-02-23"
quality_score: 100
extractor: "trafilatura"
---

## Summary

进阶建议

-
结合回测工具：获取的数据可直接对接Backtrader，快速搭建量化策略回测框架；

-
定时获取数据：用schedule库写定时任务，每日收盘后自动获取数据并保存，省去手动操作；

-
深入学习：Tushare还有更多特色数据（龙虎榜、新闻舆情等），可查看官方文档，拓展使用场景。 pro/，点击右上角“注册”，用手机号注册账号；

-
注册后登录，进入“个人中心”，找到“接口Token”，复制保存（后续会用到，建议存在记事本里）；

-
无需充值：个人开发者免费额度完全够用，日常获取日线、基本面数据，调用次数完全满足。 本文全程实战，附完整可运行代码、步骤拆解和避坑指南...

## Key Claims

- 无需爬虫基础：不用写requests、不用处理cookie和反爬，API直接调用，降低入门门槛；
- 数据标准化：返回Pandas DataFrame格式，直接对接Backtrader、Pyfolio等回测工具，无需格式转换；
- 覆盖场景全：A股、基金、期货、宏观经济等数据一站式获取，满足策略回测、因子研究、行情展示等需求；
- 免费且稳定：个人开发者免费使用，接口调用稳定，数据经过严格校验，减少脏数据干扰。
- 访问Tushare官网：https://tushare.pro/，点击右上角“注册”，用手机号注册账号；
- 注册后登录，进入“个人中心”，找到“接口Token”，复制保存（后续会用到，建议存在记事本里）；
- 无需充值：个人开发者免费额度完全够用，日常获取日线、基本面数据，调用次数完全满足。
- 报错“invalid token”：Token复制错误，检查是否有空格、拼写错误，重新复制个人中心的Token；
- 报错“no data”：股票代码后缀漏写（如只写600519，未加.SH），或日期范围无数据（如非交易日）；
- 调用超时：网络问题，或同时调用次数过多，可添加time.sleep(1)延迟调用，避免高并发。

## Detected Entities

### Linked to existing wiki pages

- [[BackTrader]] (entity)
- [[Tushare]] (entity)

### Suggested new pages

None

## Connections

- Source: https://blog.csdn.net/m0_73639126/article/details/158320981
- Site: blog.csdn.net
- Entitys: [[BackTrader]] · [[Tushare]]
- Suggested pages: None

## Full Content

作为CSDN社区的量化开发者，想必大家都有过这样的困扰：找A股数据要翻多个平台，爬取数据要处理反爬，拿到数据还要花大量时间清洗，最后才能用于策略回测或分析。今天就给大家安利一款我自用2年+的高效工具——**Tushare**，免费开源、接口极简，几行Python代码就能搞定全量金融数据，新手也能快速上手！

本文全程实战，附完整可运行代码、步骤拆解和避坑指南，复制就能用，适合量化入门、数据分析、策略开发的小伙伴，建议收藏备用～

### 一、先搞懂：Tushare 到底能帮我们解决什么问题？

在量化开发中，数据是基础，也是最耗时的环节。而Tushare的核心价值，就是**省去“爬数据-洗数据-存数据”的全流程**，让我们专注于策略本身，具体优势如下（贴合开发者实际需求）：

-
无需爬虫基础：不用写requests、不用处理cookie和反爬，API直接调用，降低入门门槛；

-
数据标准化：返回Pandas DataFrame格式，直接对接Backtrader、Pyfolio等回测工具，无需格式转换；

-
覆盖场景全：A股、基金、期货、宏观经济等数据一站式获取，满足策略回测、因子研究、行情展示等需求；

-
免费且稳定：个人开发者免费使用，接口调用稳定，数据经过严格校验，减少脏数据干扰。


避坑提醒：很多新手会踩“数据缺失、格式错乱”的坑，Tushare的数据经过官方清洗，字段统一，调用后可直接用于分析，省去80%的数据处理时间。

### 二、实战步骤：从安装到获取数据，全程5分钟搞定

以下步骤全程实操，每一步都附代码和说明，确保新手也能跟着做，建议打开Python编辑器（PyCharm、Jupyter均可）同步操作。

#### 步骤1：获取Tushare Token（关键一步）

Token是调用接口的“钥匙”，免费注册即可获取，步骤如下：

-
访问Tushare官网：https://tushare.pro/，点击右上角“注册”，用手机号注册账号；

-
注册后登录，进入“个人中心”，找到“接口Token”，复制保存（后续会用到，建议存在记事本里）；

-
无需充值：个人开发者免费额度完全够用，日常获取日线、基本面数据，调用次数完全满足。


#### 步骤2：安装Tushare库（一行命令搞定）

打开终端（或PyCharm的Terminal），输入以下命令，一键安装，支持Python3.6及以上版本：

`pip install tushare -i https://pypi.tuna.tsinghua.edu.cn/simple`


说明：添加清华源，安装速度更快，避免超时失败；如果已经安装过，可升级到最新版本（pip install --upgrade tushare）。

#### 步骤3：初始化接口，验证是否可用

复制以下代码，替换成自己的Token，运行后无报错，说明初始化成功，可正常调用数据：

```
# 导入tushare库 import tushare as ts import pandas as pd
# 初始化接口（替换成自己的Token）
pro = ts.pro_api('你的Token，复制过来替换这里')
# 验证：获取上证指数最新10条日线数据
df = pro.index_daily(ts_code='000001.SH', limit=10)
# 打印数据（查看是否获取成功）
print("上证指数最新10条日线数据：")
print(df.head())
```


运行结果说明：如果打印出如下格式的数据（包含日期、开盘价、收盘价等字段），说明接口正常可用；如果报错，检查Token是否复制正确、网络是否正常。

### 三、核心实战：4个高频场景，完整代码可直接复制

结合量化开发者的高频需求，整理了4个最常用的场景，每个场景都附完整代码、字段说明，复制替换参数就能用，覆盖日线数据、基本面数据、北向资金等核心需求。

#### 场景1：获取单只A股日线数据（最常用）

需求：获取贵州茅台（600519.SH）2025年1月1日至今的日线数据，包含开盘价、收盘价、成交量、换手率等字段，用于策略回测或行情分析。

```
# 场景1：获取单只A股日线数据（贵州茅台）
import tushare as ts import pandas as pd
# 初始化接口（替换成自己的Token）
pro = ts.pro_api('你的Token')
# 核心代码：获取日线数据 # ts_code：股票代码（沪市后缀.SH，深市后缀.SZ）
# start_date/end_date：日期格式（YYYYMMDD），end_date为空则获取到最新交易日 df = pro.daily( ts_code='600519.SH', start_date='20250101', end_date=''
# 空值表示获取到最新交易日 )
# 数据处理：将日期字段转为datetime格式（方便后续分析） df['trade_date'] = pd.to_datetime(df['trade_date'], format='%Y%m%d') # 按日期升序排列（默认是降序，回测时需要升序）
df = df.sort_values('trade_date', ascending=True) # 保存数据：保存为Excel，方便后续查看（可选）
df.to_excel('贵州茅台2025日线数据.xlsx', index=False)
print("数据获取成功，前5行数据如下：")
print(df.head())
print(f"共获取到{len(df)}条数据")
```


避坑提醒：股票代码后缀不能漏！沪市是.SH（如600519.SH），深市是.SZ（如000001.SZ），漏写会导致获取不到数据。

#### 场景2：获取A股基本面数据（财务指标）

需求：获取比亚迪（002594.SZ）2020-2024年的年度财务指标，包含净利润、净资产收益率（ROE）、资产负债率等，用于估值分析。

#### 场景3：获取北向资金流向数据（市场热点参考）

需求：获取最近30个交易日的北向资金净流入/流出数据，包含沪股通、深股通，用于判断市场资金流向。

```python
# 场景3：获取北向资金流向数据（市场热点参考）
import tushare as ts
import pandas as pd
# 初始化Tushare接口（替换成自己的Token）
pro = ts.pro_api('你的Token')
# 核心代码：获取北向资金每日流向数据
# market_type参数说明：1=沪股通，3=深股通，空值=全部（沪+深）
df = pro.moneyflow_hsgt(
start_date='', # 空值表示从最早可获取日期开始，可自定义格式：YYYYMMDD
end_date='', # 空值表示获取到最新交易日
market_type='' # 空值获取全部北向资金数据
)
# 数据处理：日期格式标准化 + 按日期升序排列
df['trade_date'] = pd.to_datetime(df['trade_date'], format='%Y%m%d')
df = df.sort_values('trade_date', ascending=True)
# 筛选最近30个交易日的数据（聚焦近期资金流向）
df_recent30 = df.tail(30).copy()
# 打印关键数据（仅展示核心字段，避免信息冗余）
print("最近30个交易日北向资金流向（单位：万元）：")
print(df_recent30[['trade_date', 'north_money', 'hk2sz_money', 'hk2sh_money']])
```


#### 场景4：批量获取多只股票数据（高效批量操作）

需求：批量获取3只股票（贵州茅台、比亚迪、宁德时代）2025年以来的日线数据，合并为一个DataFrame，方便批量分析。

```
# 场景4：批量获取多只股票数据
import tushare as ts
import pandas as pd
# 初始化Tushare接口（替换成自己的Token）
pro = ts.pro_api('你的Token')
# 定义需要获取的股票列表（代码+后缀：沪市.SH，深市.SZ）
stock_list = ['600519.SH', '002594.SZ', '300750.SZ']
# 定义数据起始日期（格式：YYYYMMDD）
start_date = '20250101'
# 初始化空DataFrame，用于合并所有股票数据
df_all = pd.DataFrame()
# 遍历股票列表，批量获取数据
for ts_code in stock_list:
# 获取单只股票的日线数据
df = pro.daily(
ts_code=ts_code,
start_date=start_date,
end_date='' # 空值表示获取到最新交易日
)
# 定义股票代码与名称的映射关系（可选，提升数据可读性）
stock_name = {
'600519.SH': '贵州茅台',
'002594.SZ': '比亚迪',
'300750.SZ': '宁德时代'
}
# 为数据添加股票名称列
df['stock_name'] = stock_name[ts_code]
# 合并单只股票数据到总DataFrame
df_all = pd.concat([df_all, df], ignore_index=True)
# 数据格式处理：日期字段转换为datetime格式
df_all['trade_date'] = pd.to_datetime(df_all['trade_date'], format='%Y%m%d')
# 按交易日期升序、股票名称升序排序
df_all = df_all.sort_values(['trade_date', 'stock_name'], ascending=True)
# 保存合并后的数据到Excel文件（可选）
df_all.to_excel('多只股票2025日线数据.xlsx', index=False)
# 打印数据获取结果
print("批量数据获取成功，数据总量：", len(df_all))
print("前10行数据：")
print(df_all.head(10))
```


### 四、避坑指南+进阶建议（开发者必看）

#### 1. 常见报错及解决方法

-
报错“invalid token”：Token复制错误，检查是否有空格、拼写错误，重新复制个人中心的Token；

-
报错“no data”：股票代码后缀漏写（如只写600519，未加.SH），或日期范围无数据（如非交易日）；

-
调用超时：网络问题，或同时调用次数过多，可添加time.sleep(1)延迟调用，避免高并发。


#### 2. 进阶建议

-
结合回测工具：获取的数据可直接对接Backtrader，快速搭建量化策略回测框架；

-
定时获取数据：用schedule库写定时任务，每日收盘后自动获取数据并保存，省去手动操作；

-
深入学习：Tushare还有更多特色数据（龙虎榜、新闻舆情等），可查看官方文档，拓展使用场景。


### 五、写在最后

作为一名长期在CSDN分享量化开发经验的开发者，我用过很多金融数据工具，Tushare是最贴合个人开发者的一款——免费、高效、稳定，不用为了数据浪费大量时间，让我们能专注于策略开发和技术提升。

无论是量化入门新手，还是有一定经验的开发者，Tushare都能帮你提升开发效率，省去数据处理的繁琐流程。现在注册就能免费使用，建议大家赶紧去试试，把时间花在更有价值的策略研究上。

如果觉得本文有用，欢迎点赞、收藏、转发，关注我，后续会分享更多Tushare进阶用法和量化策略实战教程～

附：Tushare官方文档（新手必看）：https://tushare.pro/document/1?doc_id=108

## Quality Assessment

- Score: 100/100 (Grade: A)
- Reasons: Content signals: +53

## Contradictions

None detected (auto-ingested).