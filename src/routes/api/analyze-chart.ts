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
          if (!apiKey) {
            return Response.json({ error: "AI gateway not configured." }, { status: 500 });
          }

          const dataUrl = `data:${mimeType};base64,${imageBase64}`;

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                  role: "user",
                  content: [
                    { type: "image_url", image_url: { url: dataUrl } },
                    {
                      type: "text",
                      text: "Validate this image first. If it is a stock/forex/crypto trading chart, analyze it and return the full JSON. If it is NOT a trading chart, return the {valid:false,reason} JSON. Return ONLY raw JSON.",
                    },
                  ],
                },
              ],
            }),
          });

          if (!aiRes.ok) {
            const errBody = await aiRes.text().catch(() => "");
            console.error("AI gateway error", aiRes.status, errBody);
            if (aiRes.status === 429) {
              return Response.json({ error: "Rate limit reached. Please wait a moment and retry." }, { status: 429 });
            }
            if (aiRes.status === 402) {
              return Response.json({ error: "AI credits exhausted. Add credits in workspace billing." }, { status: 402 });
            }
            return Response.json({ error: "AI analysis failed." }, { status: 500 });
          }

          const data = (await aiRes.json()) as {
            choices: Array<{ message: { content: string } }>;
          };
          let raw = data.choices?.[0]?.message?.content?.trim() ?? "";
          raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

          let parsed: { valid?: boolean; reason?: string; [k: string]: unknown };
          try {
            parsed = JSON.parse(raw);
          } catch {
            const m = raw.match(/\{[\s\S]*\}/);
            if (!m) {
              return Response.json(
                { error: "AI response was not valid JSON. Try a clearer chart screenshot." },
                { status: 502 },
              );
            }
            parsed = JSON.parse(m[0]);
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