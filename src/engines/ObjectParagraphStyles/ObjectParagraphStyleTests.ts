import assert from "node:assert/strict";
import { defaultUniversalTypographyControls } from "@/engines/UniversalTypography/UniversalTypographyEngine";
import {
  getObjectAlignment,
  setObjectAlignment,
  setObjectJustifyEngineMode,
  setObjectJustifyMode,
} from "./ObjectParagraphStyleEngine";

const base = {
  ...defaultUniversalTypographyControls,
  headlineAlignment: "left" as const,
  bodyAlignment: "justify" as const,
  captionAlignment: "left" as const,
  creditAlignment: "left" as const,
};

const centeredHeadline = {
  ...base,
  ...setObjectAlignment(base, "headline", "center"),
};

assert.equal(centeredHeadline.headlineAlignment, "center");
assert.equal(centeredHeadline.bodyAlignment, "justify");
assert.equal(centeredHeadline.captionAlignment, "left");

const leftCaption = {
  ...centeredHeadline,
  ...setObjectAlignment(centeredHeadline, "caption", "left"),
};

assert.equal(leftCaption.captionAlignment, "left");
assert.equal(leftCaption.headlineAlignment, "center");
assert.equal(leftCaption.bodyAlignment, "justify");
assert.equal(leftCaption.bodyJustifyEngineMode, "browser");
assert.equal(leftCaption.captionJustifyEngineMode, "newspaper");

const rightCredit = {
  ...leftCaption,
  ...setObjectAlignment(leftCaption, "credit", "right"),
};

assert.equal(rightCredit.creditAlignment, "right");
assert.equal(rightCredit.captionAlignment, "left");
assert.equal(rightCredit.headlineAlignment, "center");

const justifiedBody = {
  ...rightCredit,
  ...setObjectAlignment(rightCredit, "body", "justify"),
  ...setObjectJustifyMode("body", "justify-all-lines"),
  ...setObjectJustifyEngineMode("body", "browser"),
};

assert.equal(justifiedBody.bodyAlignment, "justify");
assert.equal(justifiedBody.bodyJustifyMode, "justify-all-lines");
assert.equal(justifiedBody.bodyJustifyEngineMode, "browser");
assert.equal(justifiedBody.captionJustifyMode, "justify-except-last");
assert.equal(justifiedBody.captionJustifyEngineMode, "newspaper");
assert.equal(getObjectAlignment(justifiedBody, "headline"), "center");

console.log("Object paragraph style tests passed: 16");
