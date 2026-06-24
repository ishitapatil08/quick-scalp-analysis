import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are ScalpEngine AI, an ultra-fast execution analyst for intraday traders and scalpers.

STEP 1 — VALIDATE THE IMAGE.
Before any analysis, decide if the screenshot is a real financial trading chart (candlestick / OHLC / line chart from TradingView, MT4/5, broker terminal, exchange app, etc. showing a stock, index, forex, crypto, futures or commodity with price axis and time axis).

If the image is NOT a trading chart (e.g. random photo, meme, document, UI screenshot, blank image, drawing, unrelated content), respond with EXACTLY this JSON and nothing else:
{"valid": false, "reason": "<one short sentence telling the user what you actually see and that they must upload a stock/forex/crypto chart screenshot>"}

STEP 2 — If it IS a valid trading chart, analyze:
1. Immediate Trend, 2. Candle Dynamics, 3. RSI/Momentum, 4. Intraday S/R,
5. Liquidity (equal highs/lows, sweeps), 6. Fibonacci 0.5-0.618, 7. EMA extension.

Return ONLY this JSON, no markdown, no backticks:
{
  "valid": true,
  "asset": "detected ticker/asset or Unknown",
  "timeframe": "detected timeframe or Unknown",
  "currentPrice": "last visible price",
  "marketState": "Aggressive Bullish Breakout | Strong Bullish Trend | Bullish Consolidation | Range-Bound Chop | Bearish Consolidation | Strong Bearish Trend | Aggressive Bearish Breakdown | Volatility Spike",
  "resistance": ["level1","level2"],
  "support": ["level1","level2"],
  "liquidityTarget": "where stops are resting",
  "momentum": "RSI state + implication, one sentence",
  "meanReversion": "EMA distance + snapback risk, one sentence",
  "fibPivot": "key fib/pivot observation, one sentence",
  "setup1": {"type":"Trend Continuation","direction":"Long|Short","logic":"...","trigger":"...","stopLoss":"...","takeProfit":"...","rr":"1:X.X"},
  "setup2": {"type":"Mean Reversion","direction":"Long|Short","logic":"...","trigger":"...","stopLoss":"...","takeProfit":"...","rr":"1:X.X"}
}`;

function extractGatewayError(body: string) {
  if (!body) return "AI gateway failed.";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    if (typeof parsed.error === "string") return parsed.error;
    if (typeof parsed.error?.message === "string") return parsed.error.message;
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // fall through to trimmed text
  }
  return body.slice(0, 220);
}

export const Route = createFileRoute("/api/analyze-chart")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { imageBase64, mimeType } = (await request.json()) as {
            imageBase64?: string;
            mimeType?: string;
          };
          if (!imageBase64 || !mimeType) {
            return Response.json({ error: "Missing image data." }, { status: 400 });
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          const anthropicKey = process.env.ANTHROPIC_API_KEY;
          if (!anthropicKey) {
            return Response.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
          }

          const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-3-5-sonnet-20241022",
              max_tokens: 2048,
              system: SYSTEM_PROMPT,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "image",
                      source: { type: "base64", media_type: mimeType, data: imageBase64 },
                    },
                    {
                      type: "text",
                      text: "Validate this image first. If it is a stock/forex/crypto trading chart, analyze it and return the full JSON. If it is NOT a trading chart, return the {valid:false,reason} JSON. Return ONLY raw JSON, no markdown.",
                    },
                  ],
                },
              ],
            }),
          });

          if (!aiRes.ok) {
            const errBody = await aiRes.text().catch(() => "");
            const gatewayMessage = extractGatewayError(errBody);
            console.error("Anthropic API error:", aiRes.status, gatewayMessage);
            if (aiRes.status === 429) {
              return Response.json({ error: "Rate limit hit. Please wait and try again." }, { status: 429 });
            }
            if (aiRes.status === 401) {
              return Response.json({ error: "Invalid ANTHROPIC_API_KEY." }, { status: 401 });
            }
            return Response.json({ error: `Claude API failed (${aiRes.status}): ${gatewayMessage}` }, { status: aiRes.status });
          }

          const data = await aiRes.json();
          let raw = (data.content?.[0]?.text ?? "").trim();
          // strip ```json fences if present
          raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
          
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            return Response.json(
              { error: "AI response was not valid JSON. Try a clearer chart screenshot." },
              { status: 502 },
            );
          }

          if (parsed.valid === false) {
            return Response.json(
              {
                error:
                  parsed.reason ||
                  "This doesn't look like a trading chart. Please upload a stock, forex, or crypto chart screenshot.",
              },
              { status: 422 },
            );
          }

          return Response.json(parsed);
        } catch (err) {
          console.error("ScalpEngine error:", err);
          return Response.json({ error: "Something went wrong." }, { status: 500 });
        }
      },
    },
  },
});
