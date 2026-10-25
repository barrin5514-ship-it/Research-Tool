# Three-video DeepSeek demo — October 24, 2026

All three real calls returned HTTP 200 and valid three-section answers. No mock responses were used for this live run.

Actual usage: 4332 tokens (2704 input, 1628 output; 256 input tokens were cache hits). Conservative estimated cost: $0.002689536 USD, below the approved $0.03 ceiling. DeepSeek does not return an invoice charge, so actual billed cost is unverified. Paid approval is now disabled.

DeepSeek remains the configured provider. Local vision is off; evidence fallback requires explicit selection. DeepSeek received transcript, OCR and source URL, without images. All claims remain NOT VERIFIED; no independent fact-checking was completed. The existing “Needs research” status reflects unfinished verification despite successful DeepSeek answers.

57 records found only in the September export are labeled. All 1,187 records remain present. Unrelated record content unchanged: true. Raw exports were read in place; no raw export, profile, key or media is included in this report.

## Pennywise: Multi-Model 'AI Hedge Fund' Committee Concept

[Original Instagram post](https://www.instagram.com/p/DeZjnKutWY2/)

- Acquisition: Cobalt failed; anonymous browser playback recording succeeded (50.423 seconds). These are playback recordings, not original downloads. yt-dlp and signed-in capture were not needed.
- Transcription quality: Readable main message, but several garbled phrases (for example “restores over 500 times” and “to need Monte Carlo”). OCR recovered three text samples. No human audio alignment or word-error measurement was performed.
- Usage: 758 input + 548 output = 1306 tokens; 0 cached input. Estimated cost: $0.000885000.
- API result: HTTP 200; parsed correctly, no paid retry.
- Cleanup: 0 scratch entries after processing.

### What is this?

- It is a claimed free tool running several AI models as a committee.
- It reportedly sets hard limits and shutdown switches on trading.
- It says it repeats results many times to test for luck.

Longer explanation (unchanged DeepSeek output): The post shows model names like Claude, ChatGPT, Gemini and Kimi arranged as a council. It claims limits, circuit breakers, self-auditing and repeated simulation runs to filter lucky results. No code, data or independent check is shown, so treat everything as unverified marketing.

### Why is it useful?

- Grouping several models can reduce reliance on one model's errors.
- Repeated simulation runs help separate skill from luck.
- Hard limits and shutdown switches matter for any automated trading idea.

Longer explanation (unchanged DeepSeek output): Mixing models mirrors how people crowd-check answers, and repeating runs checks whether results survive randomness. Spending caps and automatic stops are sensible safety habits for paper trading. These are reasonable design ideas, but the post does not prove the tool actually does any of them.

### What can I do with it?

- Ask for the actual code and data before trusting any claim.
- Test any idea only with paper trades and fake money.
- Write down stop rules before running any experiment.

Longer explanation (unchanged DeepSeek output): Request the source files and see whether the repeated runs and limits really exist. If you want to explore the idea, do it inside a paper-trading setup with fixed stop rules and logged results. Never connect an unverified tool to real money or live accounts.

### Recommendations

- Pennywise: Paper-only experiment: compare a two-model reviewer step against the existing deterministic copilot, logging disagreement rates in SQLite evidence.
  Difficulty: Medium; cost: Low; mostly local model time; priority: low. Risk and investigation fields were empty after normalization.

### Transcript recovered by Whisper

I've just built this AI hedge fund that runs like an actual investment committee and can manage your portfolio. Guys in hard limits, circuit breakers and it even audits itself and restores over 500 times to make sure that we're not just getting lucky to need Monte Carlo simulation. And it will even tell you if the results look too unrealistic before. And the best thing is this is completely free to use. So if you want access to this tool then comment dashboard below and I'll send it across to you.

### Failures and limitations

- Cobalt failed; an alternative acquisition method was used. Browser recordings reproduce playback and are not original downloads.
- Windows OCR failed for a sampled frame; remaining frames were still checked.
- DeepSeek claims and recommendations were not independently verified. Some bullets still use technical terms, despite the plain-English prompt.
- No local visual reasoning ran. OCR is text recognition, not visual reasoning.

## Pennywise: Kronos: candle-token forecasting model for paper testing

[Original Instagram post](https://www.instagram.com/p/DezC2eYkpAa/)

- Acquisition: Cobalt failed; anonymous browser playback recording succeeded (38.198 seconds). These are playback recordings, not original downloads. yt-dlp and signed-in capture were not needed.
- Transcription quality: Readable main explanation with unreliable proper names and numbers: “Chronos”, “Alolms”, “claw” and “100%” need checking against the original. Six OCR samples include substantial recognition noise. DeepSeek’s “100% returns” bullet is unsupported by the recovered evidence and may confuse “100% free” with returns. Do not use it as a fact.
- Usage: 990 input + 611 output = 1601 tokens; 128 cached input. Estimated cost: $0.000992568.
- API result: HTTP 200; parsed correctly, no paid retry.
- Cleanup: 0 scratch entries after processing.

### What is this?

- Kronos is an open model trained to predict the next candlestick.
- It turns price candles into tokens, similar to how chatbots handle words.
- The video's claims about 100% returns are marketing, not evidence.

Longer explanation (unchanged DeepSeek output): Kronos is a foundation model that treats candlestick series like a language, training on large volumes of market data and forecasting the next bar. The Instagram post wraps this real research in exaggerated profit claims. Treat the model as a research tool, not a money machine.

### Why is it useful?

- It offers a reusable pretrained forecaster you can test offline.
- You could compare its next-candle guesses against your current strategies.
- Paper testing keeps any risk away from real money.

Longer explanation (unchanged DeepSeek output): A pretrained candle forecaster could add a new signal source to your research stack. Because it is open, you can run it locally and measure it honestly. Its real value only shows up if it beats simple baselines in controlled paper tests, which is exactly what Pennywise is built for.

### What can I do with it?

- Download the model and run it on historical saved candle data.
- Compare its forecasts against a naive baseline before trusting it.
- Log every paper-trade result in your existing evidence store.

Longer explanation (unchanged DeepSeek output): Start by reproducing the published results on your own saved data. Then score forecasts against simple benchmarks and feed outcomes into your SQLite evidence trail. Only after consistent paper performance would it deserve a small experimental strategy slot.

### Recommendations

- Pennywise: Run Kronos offline on saved candle history and score its next-candle forecasts against simple baselines, logging results in the existing evidence store for paper-only evaluation.
  Difficulty: Medium; cost: Low: open model, local compute, no paid data required; priority: low. Risk and investigation fields were empty after normalization.

### Transcript recovered by Whisper

This is the most dangerous thing on the internet today. Someone built an AI that reads candlestick charts the way GPT reads English and released it for 100%. They just connected it to TradingView setup with their Opus 5.5 and now their AI Trading System reads every candle and predicts the next market move before it actually happens. This is how Chronos works. Alolms like chat GPT or claw turn words into tokens and predict the next word. Chronos turns every candle into tokens and predicts the next candle. It is pre-trained on 12 billion candles. They said help them make thousands of dollars. Now Trading can definitely lose you money. Follow me and comment on if you want to know how to build this system and I'll send you the guide.

### Failures and limitations

- Cobalt failed; an alternative acquisition method was used. Browser recordings reproduce playback and are not original downloads.
- DeepSeek claims and recommendations were not independently verified. Some bullets still use technical terms, despite the plain-English prompt.
- No local visual reasoning ran. OCR is text recognition, not visual reasoning.

## Personafy: Four Camera Fields for AI Video Prompts

[Original Instagram post](https://www.instagram.com/p/DekjlNrAWS4/)

- Acquisition: Cobalt failed; anonymous browser playback recording succeeded (56.651 seconds). These are playback recordings, not original downloads. yt-dlp and signed-in capture were not needed.
- Transcription quality: Coherent four-part camera explanation. “cloud” appears where OCR suggests “Claude”; the ending trails off. Five OCR samples recovered. No human audio alignment or word-error measurement was performed.
- Usage: 956 input + 469 output = 1425 tokens; 128 cached input. Estimated cost: $0.000811968.
- API result: HTTP 200; parsed correctly, no paid retry.
- Cleanup: 0 scratch entries after processing.

### What is this?

- It teaches four camera fields for AI video prompts.
- The fields are lens, movement, depth of field and angle.
- Each shot should hard-cut to the next.

Longer explanation (unchanged DeepSeek output): The video says AI video looks flat when prompts omit camera direction. It lists four fields a director uses: lens in millimeters, one movement verb, depth of field, and camera angle. Every shot gets its own fields, and each cut changes at least one field.

### Why is it useful?

- Explicit camera fields stop the model guessing.
- Changing a field each cut prevents shots melting together.
- Different angles and lenses set mood and scale.

Longer explanation (unchanged DeepSeek output): Without camera fields, the model picks a generic floating medium shot. Naming lens, movement, depth and angle gives control over isolation, power and size. Varying at least one field per cut keeps multi-shot prompts as distinct hard cuts instead of a mush.

### What can I do with it?

- Rewrite one existing prompt with all four fields.
- Test a two-shot prompt with different lenses and angles.
- Compare outputs before and after adding fields.

Longer explanation (unchanged DeepSeek output): Take a prompt you already use and add lens, movement, depth and angle to each shot. Make a second shot change at least one field to force a hard cut. Compare the new outputs to the old ones side by side and note which fields change results most.

### Recommendations

DeepSeek returned no formal project recommendation. Its next-step bullets are retained above; no project match was forced.

### Transcript recovered by Whisper

Your AI video looks amateur because your prompt never told the camera what to do. Leave the camera out and the model guesses, and the guess is a flat floating medium shot. Every prompt we write carries four camera fields. The calls a director makes on set. One, lens and millimeters. 24 wide, 35 standard, 50 portrait, 85 tight close up. Two, movement, one verb per shot, like dolly push in, slow pan or handheld. Three, depth of field. Shallow isolates one thing, deep keeps everything readable. Four, angle, low reads as power, high reads as small. And a multi-shot prompt every shot is a hard cut. If two shots share a lens and angle, the model melts them into one move. Change at least one field every cut. So a man walks into a bar becomes 24 millimeter, slow push in, deep focus, low angle, hard cut, 85 millimeter, static, shallow, eye level close up. Four camera fields, every shot. If you want every AI shot to cut like film, comment, camera, and I'll send you the link to cloud for content automation. The community where we build all of this with cloud. And if nobody's told you this yet,

### Failures and limitations

- Cobalt failed; an alternative acquisition method was used. Browser recordings reproduce playback and are not original downloads.
- Windows OCR failed for a sampled frame; remaining frames were still checked.
- DeepSeek claims and recommendations were not independently verified. Some bullets still use technical terms, despite the plain-English prompt.
- No local visual reasoning ran. OCR is text recognition, not visual reasoning.

## Verification

81 automated Windows tests passed with zero failures. Automated DeepSeek tests use stand-ins and do not spend money. Full output: [Windows tests](deepseek-demo-windows-tests.txt). The three live requests above are separate from those automated tests. Temporary recording, audio, frames, anonymous profile and cache directories were removed after every attempt. No unrelated project was changed and no software was installed.
