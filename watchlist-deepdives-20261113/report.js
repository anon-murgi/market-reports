/* Shared chart renderer. Data is embedded for file:// viewing; no fetch required. */
requestAnimationFrame(()=>{
  const el=document.getElementById('price-chart'),error=document.getElementById('chart-error');
  const fail=e=>{error.hidden=false;error.textContent='Chart could not be rendered: '+e.message;el.dataset.chartState='error';};
  try{
    if(!window.LightweightCharts)throw new Error('Shared Lightweight Charts library unavailable. Keep this folder under market-reports.');
    const d=JSON.parse(document.getElementById('chart-data').textContent);
    if(!d.candles?.length)throw new Error('No comparable clean OHLCV data available.');
    const chart=LightweightCharts.createChart(el,{width:el.clientWidth,height:el.clientHeight,layout:{background:{color:'#171f2b'},textColor:'#a8b6c9',fontSize:11,panes:{separatorColor:'#2c394c',separatorHoverColor:'#49617e',enableResize:true}},grid:{vertLines:{color:'#243244'},horzLines:{color:'#243244'}},rightPriceScale:{borderColor:'#2c394c'},timeScale:{borderColor:'#2c394c',timeVisible:false},crosshair:{mode:LightweightCharts.CrosshairMode.Normal}});
    const candle=chart.addSeries(LightweightCharts.CandlestickSeries,{upColor:'#54b59a',downColor:'#d87b79',borderVisible:false,wickUpColor:'#54b59a',wickDownColor:'#d87b79'});candle.setData(d.candles);
    [['ema20','#82b6f6'],['ema50','#e2ba70'],['ema200','#b394d4']].forEach(([key,color])=>{const s=chart.addSeries(LightweightCharts.LineSeries,{color,lineWidth:1,lastValueVisible:false,priceLineVisible:false});s.setData(d[key]);});
    const vol=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false},1);vol.setData(d.volume);
    chart.panes()[0].setStretchFactor(3.5);chart.panes()[1].setStretchFactor(1);chart.timeScale().fitContent();
    new ResizeObserver(()=>{if(el.clientWidth>0)chart.resize(el.clientWidth,el.clientHeight);}).observe(el);
    el.dataset.chartState='ready';el.dataset.candleCount=d.candles.length;el.dataset.lastDate=d.candles.at(-1).time;el.dataset.lastClose=d.candles.at(-1).close;
    window.__researchChart={chart,candle,data:d};
  }catch(e){fail(e);}
});
