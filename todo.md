**2/17**
**have demo ready for tomorrow**
- that means MCP integration!!
- test cases need to work:
    - simple backtest
    - have AI change the screen
    - have AI calculate indicator(s) and apply them to the chart


- need AI output
    - MCP needs to respond
    - error handling
- make volume a toggle/indicator!!
- get AI contextually aware of what the user's pane looks like
- give AI ability to change the screens
- ability to turn indicators on and off (and compare mode)
- custom code vision and execution ability
- **see if lightweight charts does indicators**

example functions:
- percent change start to end (do YTD if no start date given)
- show indicator
- swap ticker on chart
- swap timedelta (bar length)
- compare (overlay chart)
- make sure it has access to all info on the page-- test this by asking it

QOL:
- ability to open and close windows (like BB terminal)
- make sure MCP can also open and close windows
- MCP should also be able to switch chart to different windows
- keep chart window modular
- remove AI artifacts (live, green dot, remove emojis)
- turn quick actions to examples

backtester code functions
- for indicators: 
    - folder for fundamentals
    - folder for user's custom indicators pulled from code section (AI can write those)(benchmark for code, MCP, chart integration)
    - buy and sell indicators on bars when running a backtest, displayed on bars

**sammy todos**
- indicators (see if tradingview package has them for free)
- fix normalization of charts
- audit backtest results and give feedback/improve prompts/tools

**lutz todos**
[x] spec out macro page
[x]add macro widgets
[x] cookies to save state of charts (used local storage)
- SEC scraping integration
- show insider buying, politician buying
- shkreli model building from SEC forms
- db schema & auth

**Far Future**
- code module needs .sss support
- backtester switch to alphaworks
- auth with hosting or keep local?
- allow fitting ML models
- forward-testing

**Immediate**
- BETTER SYSTEM PROMPTS!!!
- make sure AI is time-aware
- README with instructions
- dropdowns associated with individual charts
- make sure alpaca gives access to live equities charts that read correctly
- add cost tracking to LLMs like how claude code does
- add feedback section in settings to request feature/report bug
- see backtest verification (visuals with entries and exits on chart, as well as equity curve, compute alphaworks' metrics)
- better strategy for overlay normalization
- default to best available data
- cookies for state

**Secondary**
- allow AI to make custom indicators
- stress-test through 2008, 2020, 2022
- walk forward and monte carlo, multi-fold val
- "improve this strategy with AI"
- add alternate data sources like SEC scraping


