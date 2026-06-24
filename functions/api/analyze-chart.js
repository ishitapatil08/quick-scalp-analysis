const SYSTEM_PROMPT = `You are ScalpEngine AI, an ultra-fast execution analyst built for high-frequency intraday traders and scalpers. Your sole objective is to dissect a chart screenshot and instantly extract micro-structural zones, momentum triggers, and clear risk/reward setups.

Analyze these intraday parameters:
1. Immediate Trend: Strong Bullish, Strong Bearish, or Range-Bound
2. Candle Dynamics: marubozu, long-wick rejections, engulfing patterns
3. RSI / Momentum: overbought/oversold, mid-line rejections, divergences
4. Intraday Support & Resistance: horizontal shelves, swing highs/lows
5. Liquidity Formations: equal highs/lows, genuine breakout vs fakeout/sweep
6. Fibonacci: 0.5-0.618 golden pocket on recent micro-leg
7. Volatility: 9/20 EMA extension or compression

CRITICAL: Return ONLY a valid JSON object. No markdown. No explanation. No backticks. Just raw JSON exactly matching this structure:

{
  "asset": "detected asset name or Unknown",
  "timeframe": "detected timeframe or Unknown",
  "currentPrice": "last visible price",
  "marketState": "one of: Aggressive Bullish Breakout / Strong Bullish Trend / Bullish Consolidation / Range-Bound Chop / Bearish Consolidation / Strong Bearish Trend / Aggressive Bearish Breakdown / Volatility Spike",
  "resistance": ["level1", "level2"],
  "support": ["level1", "level2"],
  "liquidityTarget": "describe where stops are resting",
  "momentum": "RSI state and implication in one sentence",
  "meanReversion": "EMA distance and snapback risk in one sentence",
  "fibPivot": "key fib or pivot level observation in one sentence",
  "setup1": {
    "type": "Trend Continuation",
    "direction": "Long or Short",
    "logic": "one sentence setup rationale",
    "trigger": "exact candle or price trigger",
    "stopLoss": "exact level",
    "takeProfit": "exact level",
    "rr": "1:X.X"
  },
  "setup2": {
    "type": "Mean Reversion",
    "direction": "Long or Short",
    "logic": "one sentence setup rationale",
    "trigger": "exact candle or price trigger",
    "stopLoss": "exact level",
    "takeProfit": "exact level",
    "rr": "1:X.X"
  }
}`;

export async function onRequestPost(context) {
  try {
    const { imageBase64, mimeType } = await context.request.json();

    if (!imageBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: "Missing imageBase64 or mimeType" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = context.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: "Analyze this chart. Return ONLY the JSON object. No markdown, no backticks, no explanation.",
              },
            ],
          },
        ],
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return new Response(
        JSON.stringify({
          error: "Anthropic API failed",
          details: data?.error?.message ?? JSON.stringify(data),
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    let rawText = data.content[0].text.trim();
    rawText = rawText
      .replace(/^```json\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    const analysis = JSON.parse(rawText);

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Something went wrong" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
