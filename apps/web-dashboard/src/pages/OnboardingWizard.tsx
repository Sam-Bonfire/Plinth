import { Button, Card, Input, InputNumber, Space, Steps, Typography, message } from "antd";
import React, { useState } from "react";

const STORAGE_KEY = "plinth-onboarding";

export interface OnboardingData {
  storeName: string;
  city: string;
  gstRate: number | null;
  ownerPin: string;
}

const STEPS: { title: string; hint: string }[] = [
  { title: "Store", hint: "Name your outlet" },
  { title: "Location", hint: "City it serves" },
  { title: "Tax", hint: "Default GST %" },
  { title: "Owner", hint: "Set an owner PIN" },
  { title: "Menu", hint: "Import or skip" },
  { title: "Printer", hint: "Name your printer" },
  { title: "Review", hint: "Confirm and finish" },
];

const emptyData = (): OnboardingData => ({ storeName: "", city: "", gstRate: null, ownerPin: "" });

const loadProgress = (): { step: number; data: OnboardingData } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { step: 0, data: emptyData() };
    const parsed = JSON.parse(raw) as { step?: number; data?: OnboardingData };
    return { step: typeof parsed.step === "number" ? Math.min(parsed.step, STEPS.length - 1) : 0, data: { ...emptyData(), ...parsed.data } };
  } catch {
    return { step: 0, data: emptyData() };
  }
};

/** A step is complete when its required field is filled (menu/printer/review are always passable). */
export const isStepComplete = (step: number, data: OnboardingData): boolean => {
  switch (step) {
    case 0:
      return data.storeName.trim() !== "";
    case 1:
      return data.city.trim() !== "";
    case 2:
      return data.gstRate !== null && data.gstRate >= 0;
    case 3:
      return data.ownerPin.trim().length >= 4;
    default:
      return true;
  }
};

export const OnboardingWizard: React.FC = () => {
  const [progress, setProgress] = useState<{ step: number; data: OnboardingData }>(loadProgress);
  const [printer, setPrinter] = useState<string>("");
  const { step, data } = progress;

  const persist = (next: { step: number; data: OnboardingData }): void => {
    setProgress(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: progress stays in memory only.
    }
  };

  const setData = (patch: Partial<OnboardingData>): void => persist({ step, data: { ...data, ...patch } });

  const next = (): void => {
    if (!isStepComplete(step, data)) {
      void message.error("Fill the required field to continue.");
      return;
    }
    persist({ step: Math.min(step + 1, STEPS.length - 1), data });
  };

  const finish = (): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up.
    }
    void message.success(`Welcome aboard, ${data.storeName}!`);
    persist({ step: 0, data: emptyData() });
  };

  return (
    <Card title="Outlet Onboarding" style={{ maxWidth: 640 }}>
      <Steps current={step} size="small" items={STEPS.map((s) => ({ title: s.title }))} style={{ marginBottom: 24 }} />
      <Typography.Paragraph type="secondary">{STEPS[step]?.hint}</Typography.Paragraph>
      {step === 0 && <Input placeholder="Store name" value={data.storeName} onChange={(e): void => setData({ storeName: e.target.value })} />}
      {step === 1 && <Input placeholder="City" value={data.city} onChange={(e): void => setData({ city: e.target.value })} />}
      {step === 2 && <InputNumber placeholder="GST %" value={data.gstRate} min={0} max={28} onChange={(v: number | null): void => setData({ gstRate: v })} style={{ width: "100%" }} />}
      {step === 3 && <Input.Password placeholder="Owner PIN (min 4 chars)" value={data.ownerPin} onChange={(e): void => setData({ ownerPin: e.target.value })} />}
      {step === 4 && <Typography.Text>Import your menu later from Menu → Import / Export CSV.</Typography.Text>}
      {step === 5 && <Input placeholder="Printer name (e.g. Kitchen-TM88)" value={printer} onChange={(e): void => setPrinter(e.target.value)} />}
      {step === 6 && (
        <Typography.Text>
          {data.storeName} · {data.city} · GST {data.gstRate ?? 0}% · {printer === "" ? "no printer" : printer}
        </Typography.Text>
      )}
      <Space style={{ marginTop: 24 }}>
        {step > 0 && (
          <Button onClick={(): void => persist({ step: step - 1, data })}>
            Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="primary" onClick={next}>
            Next
          </Button>
        ) : (
          <Button type="primary" onClick={finish}>
            Finish Setup
          </Button>
        )}
      </Space>
    </Card>
  );
};
