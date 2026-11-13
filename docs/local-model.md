# Commercial and local models

`MODEL_ROUTE` chooses where the cheap classifiers run.

- Unset or `commercial`: every agent uses the Agent SDK commercial model (`grok-4.7`).
- `local`: `sentiment`, `theme-ai`, and `theme-quantum` take `LOCAL_MODEL_ID` when it is set. The orchestrator, research, market, technical, and both strategy agents stay on the commercial model.

The Agent SDK selects a model by id. It does not take an OpenAI base URL in `defineAgent`. Point a local OpenAI-compatible server (Ollama or vLLM) at the environment:

- `LOCAL_OPENAI_BASE_URL` such as `http://127.0.0.1:11434/v1`
- `LOCAL_MODEL_ID` such as `qwen2.5:7b-instruct` or a Llama instruct id
- `LOCAL_OPENAI_API_KEY` when the server requires a bearer token

When both `MODEL_ROUTE=local` and `LOCAL_OPENAI_BASE_URL` are set, the sentiment tool calls `{LOCAL_OPENAI_BASE_URL}/chat/completions`. The published score stays the lexicon score. The local draft can only confirm it. A base URL that already ends in `/v1` is not doubled.

Move research, market, or the strategy agents only after the fixture evals pass against that endpoint. Until then they stay commercial.

## Training

Do not train or serve Llama or Qwen on a GitHub-hosted runner. Export tool-grounded JSONL from accepted alerts (the tool payload plus the thesis that survived validation) on a machine you control. A later Unsloth LoRA on a Qwen or Llama instruct checkpoint is an off-runner job. Serve the adapter with Ollama or vLLM, then set the environment variables above. This repository does not start that job.
