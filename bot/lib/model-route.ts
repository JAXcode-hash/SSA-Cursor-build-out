export type ModelSetting = {
  id: string;
  params?: Array<{ id: string; value: string }>;
};

export function commercialModel(): ModelSetting {
  return {
    id: "grok-4.7",
    params: [
      { id: "reasoning_effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  };
}

export function localFirstModel(): ModelSetting {
  if (process.env.MODEL_ROUTE === "local" && process.env.LOCAL_MODEL_ID) {
    return { id: process.env.LOCAL_MODEL_ID };
  }
  return commercialModel();
}

export function routeName(): "commercial" | "local" {
  return process.env.MODEL_ROUTE === "local" ? "local" : "commercial";
}
