import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BachelorPage from "@/app/bachelor/page";
import MasterPage from "@/app/master/page";
import { LandingPage } from "@/components/landing/landing-page";
import {
  publicEntryPath,
  trajectorySessionStartPayload,
  unavailableQuestionnaireMessage,
} from "./entry";

type EntryElement = ReactElement<{ educationLevel: "BACHELOR" | "MASTER" }>;

describe("education-specific public entry routes", () => {
  it("binds /master to MASTER and /bachelor to BACHELOR through one shared flow", () => {
    const props = { searchParams: Promise.resolve({}) };
    expect((MasterPage(props) as EntryElement).props.educationLevel).toBe("MASTER");
    expect((BachelorPage(props) as EntryElement).props.educationLevel).toBe("BACHELOR");
    expect(publicEntryPath("MASTER")).toBe("/master");
    expect(publicEntryPath("BACHELOR")).toBe("/bachelor");
  });

  it("redirects the root to /master and removes the public BA/MA selector", () => {
    const root = readFileSync(resolve("src/app/page.tsx"), "utf8");
    const client = readFileSync(resolve("src/components/questionnaire/questionnaire-client.tsx"), "utf8");
    expect(root).toContain('redirect("/master")');
    expect(client).not.toContain('name="educationLevel"');
    const landing = renderToStaticMarkup(
      <LandingPage onStart={() => undefined} starting={false} startError={false} />,
    );
    expect(landing).toContain("Номер ИСУ");
    expect(landing).not.toContain("Магистратура");
    expect(landing).not.toContain("Бакалавриат");
    expect(landing).not.toContain("Уровень обучения");
  });

  it("guards the public start form from duplicate write requests", () => {
    const client = readFileSync(resolve("src/components/questionnaire/questionnaire-client.tsx"), "utf8");
    expect(client).toContain("startRequestInFlight.current");
    expect(client).toContain("if (startRequestInFlight.current) return");
  });

  it("keeps the route education level in the session start payload", () => {
    expect(trajectorySessionStartPayload("123456", "MASTER")).toEqual({
      isu: "123456",
      educationLevel: "MASTER",
    });
    expect(trajectorySessionStartPayload("123456", "BACHELOR")).toEqual({
      isu: "123456",
      educationLevel: "BACHELOR",
    });
  });

  it("provides a safe unavailable state for BACHELOR", () => {
    expect(unavailableQuestionnaireMessage("BACHELOR")).toBe(
      "Анкета для бакалавриата пока не настроена.",
    );
  });
});
